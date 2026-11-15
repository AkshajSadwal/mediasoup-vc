import { DEFAULT_DURATION, FEATURES } from "../meetings/configuration.js";
export { FEATURES };
export const SOURCE_KINDS = new Map([
  ["microphone", "audio"], ["camera", "video"],
  ["screen-video", "video"], ["screen-audio", "audio"],
]);
export const REACTIONS = ["👍", "❤️", "👏", "😂", "🎉", "😮"];
export const MAX_PARTICIPANTS = 10;

const meetings = new Map();
export const findLiveMeeting = (id) => meetings.get(id);

export function getLiveMeeting(id, hostId, saved) {
  if (!meetings.has(id)) {
    meetings.set(id, {
      id, hostId, version: 0, members: new Map(),
      defaults: { participant: {}, moderator: {} }, initial: {}, overrides: new Map(), duration: DEFAULT_DURATION, endsAt: null,
      locked: false, speakers: new Set(), rooms: new Map(),
      requests: new Map(), assignments: new Map(), started: false,
      teamRooms: new Map(),
      notice: null, help: new Map(), expiry: null,
    });
  }
  const meeting = meetings.get(id);
  if (!meeting.hydrated) {
    meeting.hydrated = true;
    meeting.saved = !!saved;
    applyConfiguration(meeting, saved?.configuration);
    if (saved?.breakoutSession) {
      const session = saved.breakoutSession;
      meeting.rooms.clear();
      meeting.started = true;
      meeting.endsAt = session.endsAt;
      for (const room of session.rooms) Object.assign(liveRoom(meeting, room.id), room);
      meeting.assignments = new Map(Object.entries(session.assignments));
      meeting.teamRooms = new Map(Object.entries(session.teamRooms || {}));
    }
  }
  return meeting;
}

export function applyConfiguration(meeting, config) {
  if (!config) return;
  meeting.defaults = config.defaults;
  meeting.initial = config.initial;
  meeting.overrides = new Map(Object.entries(config.overrides));
  meeting.duration = config.duration;
  meeting.teams = config.teams;
  if (!meeting.started) {
    for (const { id, title } of config.rooms) liveRoom(meeting, id).title = title;
    for (const [account, id] of Object.entries(config.assignments)) meeting.assignments.set(account, id);
  }
}

export function liveRoom(meeting, id) {
  if (!meeting.rooms.has(id)) {
    meeting.rooms.set(id, {
      id, title: id === "main" ? "Main room" : id,
      presenter: null, spotlight: null, boardPresented: false,
      board: new Map(), boardOrder: 0, boardRevision: 0, polls: new Map(), closingAt: null,
    });
  }
  return meeting.rooms.get(id);
}

export function reserveMember(meeting, peer) {
  const earlier = meeting.members.get(peer.userId)?.peer;
  if (earlier && earlier !== peer) {
    earlier.socket.emit("session-replaced");
    earlier.socket.disconnect(true);
  }
  if (meeting.members.size >= 100 && !meeting.members.has(peer.userId)) throw new Error("The live session account limit has been reached.");
  if ([...meeting.members.values()].filter((member) => member.peer).length >= MAX_PARTICIPANTS) {
    throw new Error("This meeting has reached its 10 participant limit.");
  }
  clearTimeout(meeting.expiry);
  const member = meeting.members.get(peer.userId) || {
    userId: peer.userId, voluntary: !meeting.initial[role(peer)]?.microphone,
    cameraWanted: !meeting.initial[role(peer)]?.camera, held: false, mutedBy: null,
  };
  member.peer = peer;
  member.name = peer.displayName;
  member.teamId = peer.teamId;
  member.lastRole = role(peer);
  meeting.members.set(peer.userId, member);
  return member;
}

export function releaseMember(meeting, member, peer) {
  if (member.peer !== peer) return;
  member.peer = null;
  member.recording = false;
  if ([...meeting.members.values()].some((entry) => entry.peer)) return;
  meeting.expiry = setTimeout(() => {
    if (meetings.get(meeting.id) !== meeting) return;
    for (const room of meeting.rooms.values()) for (const poll of room.polls.values()) clearTimeout(poll.timer);
    clearTimeout(meeting.breakoutTimer);
    meetings.delete(meeting.id);
  }, 15 * 60_000);
  meeting.expiry.unref();
}

export function role(peer) {
  if (peer.userId === peer.meeting.hostId) return "host";
  return peer.isModerator ? "moderator" : "participant";
}

export function allowed(peer, feature) {
  const tier = role(peer);
  return FEATURES.includes(feature) && (tier === "host" ||
    (peer.meeting.overrides.get(peer.userId)?.[feature] ?? peer.meeting.defaults[tier][feature] ?? true));
}

export function speakingRestricted(peer) {
  return role(peer) !== "host" && (!allowed(peer, "microphone") || Boolean(peer.member.mutedBy) ||
    (peer.meeting.locked && !peer.meeting.speakers.has(peer.userId)));
}

export const audioAllowed = (peer, source) =>
  !speakingRestricted(peer) && !peer.member.held && (source !== "microphone" || peer.member.voluntary);

export const videoAllowed = (peer) => allowed(peer, "camera") && peer.member.cameraWanted;

export function setMute(actor, member, muted) {
  const targetRole = member.peer ? role(member.peer) : member.lastRole;
  const actorRole = role(actor);
  if (actorRole === "participant" || member.userId === actor.userId || targetRole === "host" ||
    (actorRole === "moderator" && (targetRole === "moderator" || member.mutedBy === "host"))) {
    throw new Error("You cannot change this participant's mute.");
  }
  if (muted) member.held = true;
  member.mutedBy = muted ? actorRole : null;
}

export function rate(peer, key, max, span = 10_000) {
  const now = Date.now();
  peer.rates ??= new Map();
  let window = peer.rates.get(key);
  if (!window || now >= window.until) {
    window = { count: 0, until: now + span };
    peer.rates.set(key, window);
  }
  if (++window.count > max) throw new Error("Too many requests. Try again shortly.");
}

export function roomMembers(peer) {
  return [...peer.meeting.members.values()].filter(({ peer: entry }) => entry?.ready && entry.activeRoomId === peer.activeRoomId);
}

