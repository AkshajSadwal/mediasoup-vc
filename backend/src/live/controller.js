import crypto from "node:crypto";
import { duration } from "../meetings/configuration.js";
import { saveLivePolicy } from "../meetings/meetingStore.js";
import { reconcileCaptions } from "./captions.js";
import { getProducersByPeer, removeProducer } from "../mediasoup/producers/producerManager.js";
import { FEATURES, REACTIONS, allowed, audioAllowed, liveRoom, rate, role, roomMembers, setMute, speakingRestricted, videoAllowed } from "./state.js";
import { boardAction, castBallot, cleanText, createPoll, publicPoll, requireCondition } from "./collaboration.js";

export function syncAudio(peer) {
  const restricted = speakingRestricted(peer);
  const enabled = audioAllowed(peer, "microphone");
  for (const { producer, source } of getProducersByPeer(peer.socket.id, "audio")) {
    if (!producer.closed) {
      const update = audioAllowed(peer, source) ? producer.resume() : producer.pause();
      update.catch(() => removeProducer(producer.id));
    }
  }
  reconcileCaptions(peer.meeting, peer.roomName);
  peer.forcedAudioMuted = restricted;
  peer.audioEnabled = enabled;
  peer.socket.emit("admin-audio-state", { roomToken: peer.roomToken, enabled, mutedByAdmin: restricted,
    voluntary: peer.member.voluntary });
  peer.socket.to(peer.roomName).emit("audio-state", { peerId: peer.socket.id, enabled, mutedByAdmin: restricted });
}

export function syncVideo(peer) {
  const enabled = videoAllowed(peer);
  for (const { producer, source } of getProducersByPeer(peer.socket.id, "video")) {
    if (source === "camera" && !producer.closed) {
      const update = enabled ? producer.resume() : producer.pause();
      update.catch(() => removeProducer(producer.id));
    }
  }
  peer.videoEnabled = enabled;
  peer.socket.emit("host-video-state", { roomToken: peer.roomToken, enabled });
  peer.socket.to(peer.roomName).emit("video-state", { peerId: peer.socket.id, enabled });
}

function stopPresentation(peer) {
  const room = liveRoom(peer.meeting, peer.activeRoomId);
  if (room.presenter !== peer.member) return;
  room.presenter = null;
  for (const { producer, source } of getProducersByPeer(peer.socket.id)) {
    if (source.startsWith("screen-")) removeProducer(producer.id);
  }
  peer.socket.emit("presentation-stopped", { roomToken: peer.roomToken });
}

const memberView = (member) => ({
  userId: member.userId, name: member.name, room: member.peer.activeRoomId,
  role: role(member.peer), raisedAt: member.raisedAt || null, recording: Boolean(member.recording),
  muted: speakingRestricted(member.peer), individuallyMuted: Boolean(member.mutedBy), awaitingUnmute: member.held,
});

export function snapshot(peer, includeBoard = true) {
  const { meeting } = peer;
  const room = liveRoom(meeting, peer.activeRoomId);
  const host = role(peer) === "host";
  const members = [...meeting.members.values()].filter(({ peer: entry }) => entry?.ready);
  const result = {
    meetingId: meeting.id, roomId: room.id, roomToken: peer.roomToken, version: meeting.version,
    role: role(peer), title: room.title, closingAt: room.closingAt, endsAt: meeting.endsAt, serverNow: Date.now(), notice: meeting.notice,
    members: (host ? members : roomMembers(peer)).map(memberView),
    features: Object.fromEntries(FEATURES.map((feature) => [feature, allowed(peer, feature)])),
    requested: FEATURES.filter((feature) => meeting.requests.has(JSON.stringify([peer.userId, feature]))),
    locked: meeting.locked, muted: speakingRestricted(peer), presenter: room.presenter?.userId || null,
    spotlight: room.spotlight, boardPresented: room.boardPresented,
    polls: [...room.polls.values()].map((poll) => publicPoll(poll, peer)),
    boardRevision: room.boardRevision,
  };
  if (includeBoard) result.board = [...room.board.values()];
  if (host) Object.assign(result, {
    defaults: meeting.defaults, speakers: [...meeting.speakers],
    overrides: Object.fromEntries(meeting.overrides), duration: meeting.duration,
    requests: [...meeting.requests.values()],
    breakouts: [...meeting.rooms.values()].filter((entry) => entry.id !== "main").map(({ id, title, closingAt }) => ({ id, title, closingAt })),
    assignments: Object.fromEntries(meeting.assignments), started: meeting.started, help: [...meeting.help.values()],
  });
  return result;
}

export function publish(meeting, boardChange) {
  meeting.version++;
  for (const { peer } of meeting.members.values()) {
    if (!peer?.ready) continue;
    const state = snapshot(peer, false);
    if (boardChange?.roomId === peer.activeRoomId) state.boardDelta = boardChange.delta;
    peer.socket.emit("live-state", state);
  }
}

function hostOnly(peer) {
  requireCondition(role(peer) === "host", "Only the host can do this.");
}

function featureOnly(peer, feature) {
  requireCondition(allowed(peer, feature), "You need permission to use this tool.");
}

export function reevaluate(meeting) {
  for (const member of meeting.members.values()) {
    const peer = member.peer;
    if (!peer?.ready) continue;
    if (speakingRestricted(peer)) member.held = true;
    syncAudio(peer);
    if (!allowed(peer, "camera")) member.cameraWanted = false;
    syncVideo(peer);
    if (!allowed(peer, "hands")) member.raisedAt = null;
    if (!allowed(peer, "screen")) stopPresentation(peer);
    if (!allowed(peer, "recording")) member.recording = false;
    if (!allowed(peer, "whiteboard")) {
      const room = liveRoom(meeting, peer.activeRoomId);
      if (room.boardPresented === peer.userId) room.boardPresented = false;
    }
    if (!allowed(peer, "files")) peer.cancelFiles?.("File sharing permission was revoked.", { sendingOnly: true });
  }
}

const boardActions = new Set(["board-add", "board-move", "board-undo", "board-redo", "board-clear"]);
const breakoutActions = new Set(["breakout-create", "breakout-assign", "breakout-auto", "breakout-start", "breakout-close", "breakout-extend", "breakout-end", "broadcast", "help", "help-dismiss"]);

export function applyLiveAction(peer, action, data, move, closeRooms, saveSchedule) {
  const { meeting, member, userId } = peer;
  const room = liveRoom(meeting, peer.activeRoomId);
  const target = meeting.members.get(data.userId);
  if (breakoutActions.has(action)) {
    applyBreakout(peer, action, data, target, move, closeRooms, saveSchedule);
  } else if (boardActions.has(action)) {
    featureOnly(peer, "whiteboard");
    if (action === "board-clear") {
      hostOnly(peer);
      room.board.clear();
      room.boardRevision++;
      return publish(meeting, { roomId: room.id, delta: { clear: true } });
    }
    const operation = boardAction(room, peer, action, data);
    if (operation) {
      room.boardRevision++;
      publish(meeting, { roomId: room.id, delta: { operation } });
    }
    return;
  } else switch (action) {
    case "permission": {
      hostOnly(peer);
      requireCondition(FEATURES.includes(data.feature) && [true, false, null].includes(data.value));
      requireCondition(target || [ "participant", "moderator" ].includes(data.tier));
      const rules = { ...(target ? meeting.overrides.get(target.userId) : meeting.defaults[data.tier]) };
      if (data.value === null) delete rules[data.feature];
      else rules[data.feature] = data.value;
      const overrides = new Map(meeting.overrides);
      const defaults = { ...meeting.defaults };
      if (target) overrides.set(target.userId, rules);
      else defaults[data.tier] = rules;
      if (meeting.saved) saveLivePolicy(meeting.id, peer.userId, defaults, Object.fromEntries(overrides));
      meeting.defaults = defaults;
      meeting.overrides = overrides;
      if (target && data.value !== null) meeting.requests.delete(JSON.stringify([target.userId, data.feature]));
      reevaluate(meeting);
      break;
    }
    case "request": {
      requireCondition(FEATURES.includes(data.feature) && !allowed(peer, data.feature));
      meeting.requests.set(JSON.stringify([userId, data.feature]), { userId, name: member.name, feature: data.feature });
      break;
    }
    case "mute":
      requireCondition(target && typeof data.muted === "boolean");
      setMute(peer, target, data.muted);
      reevaluate(meeting);
      break;
    case "mute-all":
      hostOnly(peer);
      for (const other of meeting.members.values()) if (other.peer && other !== member) other.held = true;
      reevaluate(meeting);
      break;
    case "speaking":
      hostOnly(peer);
      requireCondition(typeof data.locked === "boolean" && Array.isArray(data.users) && data.users.length <= 10 &&
        data.users.every((id) => meeting.members.has(id)));
      meeting.locked = data.locked;
      meeting.speakers = new Set(data.users);
      reevaluate(meeting);
      break;
    case "raise-hand":
      if (data.raised) featureOnly(peer, "hands");
      requireCondition(typeof data.raised === "boolean");
      member.raisedAt = data.raised ? (member.raisedAt || Date.now()) : null;
      break;
    case "lower-hand":
      hostOnly(peer);
      requireCondition(target);
      target.raisedAt = null;
      break;
    case "reaction": {
      featureOnly(peer, "reactions");
      rate(peer, "reaction", 4, 5000);
      requireCondition(REACTIONS.includes(data.emoji));
      const reaction = { emoji: data.emoji, name: member.name };
      peer.socket.emit("meeting-reaction", reaction);
      peer.socket.to(peer.roomName).emit("meeting-reaction", reaction);
      return;
    }
    case "recording":
      requireCondition(typeof data.active === "boolean");
      if (data.active) featureOnly(peer, "recording");
      member.recording = data.active;
      break;
    case "spotlight":
      requireCondition(role(peer) !== "participant", "Moderator permission required.");
      requireCondition(data.userId === null || (target?.peer?.ready && target.peer.activeRoomId === peer.activeRoomId));
      room.spotlight = data.userId;
      break;
    case "present-board":
      featureOnly(peer, "whiteboard");
      requireCondition(typeof data.active === "boolean");
      requireCondition(role(peer) !== "participant" || !room.boardPresented || room.boardPresented === userId);
      room.boardPresented = data.active ? userId : false;
      break;
    case "stop-presentation": {
      hostOnly(peer);
      requireCondition(data.userId === undefined || target?.peer?.ready);
      const presenting = target?.peer?.ready ? target.peer : peer;
      const presentationRoom = liveRoom(meeting, presenting.activeRoomId);
      const owner = presentationRoom.presenter?.peer;
      if (owner) stopPresentation(owner);
      break;
    }
    case "poll-create":
      featureOnly(peer, "polls");
      createPoll(room, peer, data, () => publish(meeting));
      break;
    case "poll-ballot":
      castBallot(room.polls.get(data.id), userId, data.choices);
      break;
    case "poll-close": {
      const poll = room.polls.get(data.id);
      requireCondition(poll && (role(peer) === "host" || poll.author === userId));
      clearTimeout(poll.timer);
      poll.closed = true;
      break;
    }
    default:
      throw new Error("Unknown meeting action.");
  }
  publish(meeting);
}

function applyBreakout(peer, action, data, target, move, closeRooms, saveSchedule) {
  const { meeting, member } = peer;
  if (action === "help") {
    requireCondition(peer.activeRoomId !== "main");
    meeting.help.set(peer.userId, { name: member.name, userId: peer.userId, room: peer.activeRoomId });
    return;
  }
  hostOnly(peer);
  if (action === "breakout-create") {
    requireCondition(meeting.rooms.size < 6);
    const id = crypto.randomUUID();
    liveRoom(meeting, id).title = cleanText(data.title, 50);
  } else if (action === "breakout-assign") {
    const destination = meeting.rooms.get(data.room);
    requireCondition(target && destination && !destination.closingAt);
    const former = meeting.assignments;
    meeting.assignments = new Map(former).set(target.userId, data.room);
    try { if (meeting.started) saveSchedule(meeting); }
    catch (error) { meeting.assignments = former; throw error; }
    if (meeting.started && target.peer?.ready && target.peer.activeRoomId !== data.room) move(target.peer);
  } else if (action === "breakout-auto") {
    const rooms = [...meeting.rooms.values()].filter((entry) => entry.id !== "main" && !entry.closingAt);
    requireCondition(rooms.length > 0);
    const participants = [...meeting.members.values()].filter((entry) => entry.peer?.ready && entry.userId !== meeting.hostId);
    const former = meeting.assignments;
    meeting.assignments = new Map(former);
    participants.forEach((entry, index) => {
      const destination = rooms[index % rooms.length].id;
      meeting.assignments.set(entry.userId, destination);
    });
    if (meeting.started) {
      try { saveSchedule(meeting); }
      catch (error) { meeting.assignments = former; throw error; }
      for (const entry of participants) move(entry.peer);
    }
  } else if (action === "breakout-start") {
    requireCondition(!meeting.started && meeting.rooms.size > 1);
    const former = meeting.duration;
    meeting.duration = duration(data.duration ?? meeting.duration);
    meeting.endsAt = Date.now() + meeting.duration * 60_000;
    meeting.teamRooms = new Map((meeting.teams || []).filter((team) => team.room).map((team) => [team.id, team.room]));
    meeting.started = true;
    try { saveSchedule(meeting); }
    catch (error) { meeting.duration = former; meeting.endsAt = null; meeting.started = false; meeting.teamRooms.clear(); throw error; }
    for (const { peer: entry } of meeting.members.values()) if (entry?.ready) move(entry);
  } else if (action === "breakout-extend") {
    requireCondition(meeting.started && meeting.endsAt > Date.now());
    const extra = duration(data.duration);
    requireCondition(meeting.endsAt + extra * 60_000 <= Date.now() + 180 * 60_000, "A session can have at most three hours remaining.");
    const former = meeting.endsAt;
    meeting.endsAt += extra * 60_000;
    try { saveSchedule(meeting); }
    catch (error) { meeting.endsAt = former; throw error; }
  } else if (action === "breakout-end") {
    requireCondition(meeting.started);
    closeRooms(meeting, [...meeting.rooms.values()].filter(({ id }) => id !== "main"), true);
  } else if (action === "breakout-close") {
    const rooms = [...meeting.rooms.values()].filter((entry) => entry.id !== "main" && !entry.closingAt &&
      (!data.room || data.room === entry.id));
    requireCondition(rooms.length > 0);
    const closingAt = Date.now() + 15_000;
    rooms.forEach((entry) => { entry.closingAt = closingAt; });
    if (meeting.started) saveSchedule(meeting);
    else setTimeout(() => closeRooms(meeting, rooms), 15_000).unref();
  } else if (action === "broadcast") {
    meeting.notice = { text: cleanText(data.text, 500), at: Date.now() };
  } else if (action === "help-dismiss") {
    meeting.help.delete(data.userId);
  }
}


