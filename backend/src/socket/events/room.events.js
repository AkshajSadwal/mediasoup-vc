import crypto from "node:crypto";
import { createRoom, getRoom, removePeerFromRoom } from "../../mediasoup/rooms/roomManager.js";
import { createPeer, deletePeer, getPeer } from "../../mediasoup/peers/peerManager.js";
import { removeConsumers } from "../../mediasoup/consumers/consumerManager.js";
import { removeProducers } from "../../mediasoup/producers/producerManager.js";
import { removeTransports } from "../../mediasoup/transports/transportManager.js";
import { getMeeting, isMeetingOpen, canJoinMeeting, saveBreakoutSession, admitTeam } from "../../meetings/meetingStore.js";
import { teamForToken } from "../../meetings/configuration.js";
import { reconcileCaptions } from "../../live/captions.js";
import { allowed, audioAllowed, getLiveMeeting, liveRoom, rate, releaseMember, reserveMember, speakingRestricted, videoAllowed } from "../../live/state.js";
import { applyLiveAction, publish, snapshot, syncAudio, syncVideo } from "../../live/controller.js";

export function participantState(peerId) {
  const peer = getPeer(peerId);
  return {
    peerId, userId: peer.userId, username: peer.username, name: peer.displayName, avatarUrl: peer.avatarUrl,
    audioEnabled: peer.audioEnabled, videoEnabled: peer.videoEnabled, connected: true,
    isAdmin: peer.isAdmin, isModerator: peer.isModerator, adminMuted: peer.forcedAudioMuted,
  };
}

export function mountedPeer(socket, data) {
  const peer = getPeer(socket.id);
  if (!peer?.ready || !socket.connected || data?.roomToken !== peer.roomToken) {
    throw new Error("The room connection has changed.");
  }
  return peer;
}

export const isCurrent = (peer, token) => peer.ready && peer.roomToken === token && peer.socket.connected && getPeer(peer.socket.id) === peer;

function leaveRoom(peer) {
  const roomName = peer.roomName;
  if (!roomName) return;
  peer.ready = false;
  reconcileCaptions(peer.meeting, roomName);
  clearTimeout(peer.move?.timer);
  peer.move = null;
  const room = liveRoom(peer.meeting, peer.activeRoomId);
  if (room.presenter?.peer === peer) room.presenter = null;
  if (room.spotlight === peer.userId) room.spotlight = null;
  if (room.boardPresented === peer.userId) room.boardPresented = false;
  peer.member.recording = false;
  peer.cancelFiles?.("The sender or recipient left the room.");
  peer.socket.to(roomName).emit("participant-left", { peerId: peer.socket.id });
  peer.socket.leave(roomName);
  removeConsumers(peer.socket.id);
  removeProducers(peer.socket.id);
  removeTransports(peer.socket.id);
  removePeerFromRoom(roomName, peer.socket.id);
  peer.roomName = null;
  peer.roomToken = null;
  peer.transportPromises = { send: null, recv: null };
  peer.producing = new Map();
  peer.consuming = new Map();
  deleteExpiredRoom(peer.meeting, room);
}

function destination(peer) {
  const { meeting, userId } = peer;
  const assigned = meeting.started && meeting.endsAt > Date.now() &&
    (meeting.assignments.get(userId) ?? meeting.teamRooms.get(peer.teamId));
  return assigned && meeting.rooms.has(assigned) && !meeting.rooms.get(assigned).expired ? assigned : "main";
}

function commitMove(peer) {
  if (!peer.ready || peer.activeRoomId === destination(peer)) return;
  const token = peer.roomToken;
  leaveRoom(peer);
  peer.socket.emit("room-move", { roomToken: token });
  publish(peer.meeting);
}

function movePeer(peer) {
  if (peer.move || !peer.ready || peer.activeRoomId === destination(peer)) return;
  if (!peer.member.recording) return commitMove(peer);
  const id = crypto.randomUUID();
  const timer = setTimeout(() => {
    peer.move = null;
    commitMove(peer);
  }, 8000);
  timer.unref();
  peer.move = { id, timer };
  peer.socket.emit("room-move-prepare", { roomToken: peer.roomToken, id });
}

export function readyToMove(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  if (peer.move?.id !== data.id) throw new Error("This move already ended.");
  clearTimeout(peer.move.timer);
  peer.move = null;
  commitMove(peer);
  callback({ ok: true });
}

function deleteExpiredRoom(meeting, room) {
  if (!room.expired || [...meeting.members.values()].some(({ peer }) => peer?.ready && peer.activeRoomId === room.id)) return;
  for (const poll of room.polls.values()) clearTimeout(poll.timer);
  meeting.rooms.delete(room.id);

}

function persistTiming(meeting) {
  const rooms = [...meeting.rooms.values()].filter((room) => room.id !== "main" && !room.expired)
    .map(({ id, title, closingAt }) => ({ id, title, closingAt }));
  saveBreakoutSession(meeting.id, meeting.hostId, meeting.started ? {
    endsAt: meeting.endsAt, rooms, assignments: Object.fromEntries(meeting.assignments), teamRooms: Object.fromEntries(meeting.teamRooms),
  } : null);
  meeting.saved = true;
  scheduleTiming(meeting);
}

function scheduleTiming(meeting) {
  clearTimeout(meeting.breakoutTimer);
  if (!meeting.started) return;
  const rooms = [...meeting.rooms.values()].filter((room) => room.id !== "main" && !room.expired);
  const next = Math.min(meeting.endsAt, ...rooms.map((room) => room.closingAt ?? Infinity));
  const reconcile = () => {
    if (!meeting.started) return;
    const now = Date.now();
    const end = meeting.endsAt <= now;
    const expired = rooms.filter((room) => end || (room.closingAt && room.closingAt <= now));
    if (end || expired.length) closeBreakouts(meeting, expired, end);
    else scheduleTiming(meeting);
  };
  if (next <= Date.now()) reconcile();
  else {
    meeting.breakoutTimer = setTimeout(reconcile, next - Date.now());
    meeting.breakoutTimer.unref();
  }
}

function closeBreakouts(meeting, rooms, complete = false) {
  const wasStarted = meeting.started;
  const ids = new Set(rooms.map(({ id }) => id));
  for (const [userId, roomId] of meeting.assignments) {
    if (ids.has(roomId)) meeting.assignments.delete(userId);
  }
  for (const [userId, help] of meeting.help) if (ids.has(help.room)) meeting.help.delete(userId);
  for (const room of rooms) room.expired = true;
  if (complete || ![...meeting.rooms.values()].some((room) => !room.expired && room.id !== "main")) {
    meeting.started = false;
    meeting.endsAt = null;
    meeting.teamRooms.clear();
  }
  if (wasStarted) {
    try { persistTiming(meeting); }
    catch (error) {
      console.error("Could not reconcile the persisted breakout deadline", error.code || error.name);
      scheduleTiming(meeting);
    }
  }
  for (const { peer } of meeting.members.values()) if (peer?.ready && ids.has(peer.activeRoomId)) movePeer(peer);
  for (const room of rooms) deleteExpiredRoom(meeting, room);
  publish(meeting);
}

export function disconnectPeer(socket) {
  const peer = getPeer(socket.id);
  if (!peer) return;
  leaveRoom(peer);
  if (peer.member) {
    releaseMember(peer.meeting, peer.member, peer);
    publish(peer.meeting);
  }
  deletePeer(socket.id);
}

export async function joinRoom(socket, data, callback) {
  if (!socket.connected || socket.joining || socket.user == null) return callback({ error: "AUTH_REQUIRED" });
  const meetingId = typeof data?.roomName === "string" ? data.roomName.trim() : "";
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(meetingId)) return callback({ error: "Invalid room name." });
  let peer = getPeer(socket.id);
  if (peer && peer.meeting.id !== meetingId) return callback({ error: "Leave the current meeting first." });
  if (peer?.ready) return callback(peer.joinResponse());
  socket.joining = true;
  let pendingRoomName;
  try {
    const saved = getMeeting(meetingId);
    const linkedTeam = data.teamToken != null ? teamForToken(saved?.configuration, data.teamToken) : null;
    const assignedTeam = saved?.teamMembers?.find(({ userId }) => userId === socket.user.id);
    const pendingTeam = linkedTeam || (assignedTeam && saved.configuration?.teams.find(({ id }) => id === assignedTeam.teamId));
    if (saved) {
      if (saved.status === "cancelled") return callback({ error: "This meeting has been cancelled." });
      if (!isMeetingOpen(saved)) return callback({ error: "WAITING_ROOM" });
      if (!canJoinMeeting(saved, socket.user.id)) return callback({ error: "JOIN_APPROVAL_REQUIRED" });
    }
    if (!peer) {
      peer = createPeer(socket, null, socket.user);
      peer.accountName = peer.displayName;
      peer.meeting = getLiveMeeting(meetingId, saved?.hostUserId || peer.userId, saved);
      if (peer.meeting.started && !peer.meeting.breakoutTimer) scheduleTiming(peer.meeting);
      peer.isAdmin = peer.meeting.hostId === peer.userId;
      peer.isModerator = Boolean(saved?.moderatorUserIds?.includes(peer.userId));
      peer.member = reserveMember(peer.meeting, peer);
    }
    peer.teamId = pendingTeam?.id;
    const roomId = destination(peer);
    liveRoom(peer.meeting, roomId);
    const roomName = JSON.stringify([meetingId, roomId]);
    pendingRoomName = roomName;
    const router = await createRoom(roomName, socket.id, peer.meeting.hostId);
    if (!socket.connected || getPeer(socket.id) !== peer) {
      removePeerFromRoom(roomName, socket.id);
      return;
    }
    if (saved) {
      const team = admitTeam(meetingId, socket.user.id, data.teamToken);
      peer.teamId = team?.id;
      peer.displayName = team?.name || peer.accountName;
      peer.member.name = peer.displayName;
      peer.member.teamId = peer.teamId;
    }
    if (roomId !== destination(peer)) {
      removePeerFromRoom(roomName, socket.id);
      return callback({ error: "ROOM_CHANGED" });
    }
    peer.roomName = roomName;
    peer.activeRoomId = roomId;
    peer.roomToken = crypto.randomUUID();
    peer.ready = true;
    if (speakingRestricted(peer)) peer.member.held = true;
    peer.audioEnabled = audioAllowed(peer, "microphone");
    if (!allowed(peer, "camera")) peer.member.cameraWanted = false;
    peer.videoEnabled = videoAllowed(peer);
    peer.forcedAudioMuted = speakingRestricted(peer);
    peer.producing = new Map();
    peer.consuming = new Map();
    socket.join(roomName);
    peer.joinResponse = () => ({
      rtpCapabilities: router.rtpCapabilities, live: snapshot(peer), self: participantState(socket.id),
      activeSpeaker: getRoom(roomName).speaker || null,
      participants: getRoom(roomName).peers.filter((id) => id !== socket.id && getPeer(id)?.ready).map(participantState),
      chat: liveRoom(peer.meeting, roomId).chat || [],
    });
    socket.to(roomName).emit("participant-joined", participantState(socket.id));
    publish(peer.meeting);
    callback(peer.joinResponse());
  } catch (error) {
    if (pendingRoomName && !peer?.ready) removePeerFromRoom(pendingRoomName, socket.id);
    disconnectPeer(socket);
    callback({ error: error.message });
  } finally {
    socket.joining = false;
  }
}

export function liveSnapshot(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  rate(peer, "snapshot", 5);
  callback({ live: snapshot(peer) });
}

export function liveAction(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  rate(peer, "live", 80);
  if (JSON.stringify(data).length > 8192) throw new Error("This action is too large.");
  applyLiveAction(peer, data.action, data, movePeer, closeBreakouts, persistTiming);
  callback({ ok: true });
}

export function audioState(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  if (typeof data.enabled !== "boolean") throw new Error("Invalid microphone state.");
  if (data.enabled && speakingRestricted(peer)) throw new Error("The host has restricted speaking.");
  peer.member.voluntary = data.enabled;
  if (data.enabled) peer.member.held = false;
  syncAudio(peer);
  publish(peer.meeting);
  callback({ ok: true });
}

export function videoState(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  if (typeof data.enabled !== "boolean") throw new Error("Invalid camera state.");
  if (data.enabled && !allowed(peer, "camera")) throw new Error("The host has restricted camera publishing.");
  peer.member.cameraWanted = data.enabled;
  syncVideo(peer);
  callback({ ok: true });
}
