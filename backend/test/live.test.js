import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { setCaptionAdapter } from "../src/live/captions.js";
import { VoskAdapter } from "../src/captions/voskAdapter.js";
import { emptyConfiguration, publicConfiguration } from "../src/meetings/configuration.js";
import { approveMeetingRequest, createConfiguredMeeting, getMeeting, requestMeetingAccess, saveBreakoutSession,
  startMeeting, updateMeetingConfiguration } from "../src/meetings/meetingStore.js";
import { after, before, test } from "node:test";
import registerSocketHandlers from "../src/socket/socketHandlers.js";
import { getPeer } from "../src/mediasoup/peers/peerManager.js";
import { getProducersByPeer } from "../src/mediasoup/producers/producerManager.js";
import { getRoom } from "../src/mediasoup/rooms/roomManager.js";
import { initializeWorker } from "../src/mediasoup/workers/workerManager.js";
import { CHUNK_BYTES, MAX_FILE_BYTES, safeFileName, validatePacket } from "../src/live/files.js";

const testData = mkdtempSync(join(tmpdir(), "rauma-test-"));
process.env.RAUMA_MEETINGS_FILE = join(testData, "meetings.json");
let worker;
const peers = new Set();
before(async () => { worker = await initializeWorker(); });
after(() => {
  for (const socket of peers) socket.disconnect();
  worker.close();
  rmSync(testData, { recursive: true, force: true });
});

function socket(userId) {
  const handlers = new Map();
  const events = [];
  const entry = {
    id: crypto.randomUUID(), user: { id: userId, username: userId }, connected: true, events,
    on: (name, handler) => handlers.set(name, handler),
    emit: (name, data) => events.push({ name, data }),
    to: () => ({ emit: () => undefined }),
    nsp: { to: () => ({ emit: () => undefined }) },
    join: () => undefined, leave: () => undefined,
    disconnect() {
      if (!entry.connected) return;
      entry.connected = false;
      handlers.get("disconnect")();
      peers.delete(entry);
    },
    async joinMeeting(meetingId, teamToken) {
      const result = await entry.signal("joinRoom", { roomName: meetingId, teamToken });
      entry.token = result.live?.roomToken;
      return result;
    },
    signal(name, data = {}) {
      return new Promise((resolve) => handlers.get(name)({ roomToken: entry.token, ...data }, resolve));
    },
    live(action, data) { return entry.signal("live-action", { action, ...data }); },
    snapshot() { return events.findLast((event) => event.name === "live-state")?.data; },
  };
  registerSocketHandlers(entry);
  peers.add(entry);
  return entry;
}

async function meeting() {
  const id = crypto.randomUUID();
  const host = socket("host");
  const member = socket("member");
  assert.equal((await host.joinMeeting(id)).live.role, "host");
  assert.equal((await member.joinMeeting(id)).live.role, "participant");
  return { id, host, member };
}

const opus = (ssrc) => ({
  codecs: [{ mimeType: "audio/opus", payloadType: 111, clockRate: 48000, channels: 2, parameters: {}, rtcpFeedback: [] }],
  encodings: [{ ssrc }], rtcp: { cname: "audio" + ssrc },
});

async function addMic(client, ssrc) {
  const { params } = await client.signal("createWebRtcTransport", { sender: true });
  assert.ok(params.sctpParameters);
  const result = await client.signal("transport-produce", {
    transportId: params.id, source: "microphone", kind: "audio", rtpParameters: opus(ssrc),
  });
  assert.ok(result.id, result.error);
  // Worker acknowledgements are serialized behind the server's pause/resume command.
  const producer = getProducersByPeer(client.id)[0].producer;
  await producer.dump();
  return { producer, transportId: params.id };
}

test("a host mute survives reconnect and gates new producers, alternate sources and forged resumes", async () => {
  const { id, host, member } = await meeting();
  assert.match((await member.live("mute-all")).error, /Only the host/);
  assert.ok((await host.live("mute", { userId: member.user.id, muted: true })).ok);
  const { producer, transportId } = await addMic(member, 1111);
  assert.equal(producer.paused, true);
  const list = await host.signal("getProducers");
  assert.deepEqual(list.producers.map(({ source }) => source), ["microphone"]);
  assert.match((await member.signal("transport-produce", { transportId, source: "camera", kind: "audio", rtpParameters: opus(1112) })).error, /source/);
  assert.match((await member.signal("transport-produce", { transportId, source: "screen-audio", kind: "audio", rtpParameters: opus(1113) })).error, /Screen audio/);
  assert.match((await member.signal("audio-state", { enabled: true })).error, /restricted/);
  assert.match((await host.signal("producer-close", { producerId: producer.id })).error, /ownership/);
  const restored = socket("member");
  assert.equal((await restored.joinMeeting(id)).self.adminMuted, true);
  assert.equal(member.connected, false);
  assert.ok(member.events.some(({ name }) => name === "session-replaced"));
  const second = await addMic(restored, 1114);
  assert.equal(second.producer.paused, true);
  assert.ok((await host.live("mute", { userId: "member", muted: false })).ok);
  await second.producer.dump();
  assert.equal(second.producer.paused, true);
  assert.ok((await restored.signal("audio-state", { enabled: true })).ok);
  await second.producer.dump();
  assert.equal(second.producer.paused, false);
  assert.ok((await host.live("mute-all")).ok);
  await second.producer.dump();
  assert.equal(second.producer.paused, true);
  assert.equal(restored.snapshot().locked, false);
  assert.ok((await restored.signal("audio-state", { enabled: true })).ok);
  assert.ok((await restored.signal("audio-state", { enabled: false })).ok);
  assert.ok((await host.live("speaking", { locked: true, users: [] })).ok);
  assert.ok((await host.live("speaking", { locked: true, users: ["member"] })).ok);
  await second.producer.dump();
  assert.equal(second.producer.paused, true);
  assert.equal(getPeer(restored.id).member.voluntary, false);
  host.disconnect(); restored.disconnect();
});

test("moderators cannot lift host mutes or write host permission rules; revocation blocks board writes", async () => {
  const { host, member, id } = await meeting();
  const moderator = socket("moderator");
  await moderator.joinMeeting(id);
  getPeer(moderator.id).isModerator = true;
  const operation = { id: crypto.randomUUID(), tool: "pen", color: "#176df3", points: [[100, 100], [200, 200]] };
  assert.ok((await member.live("board-add", operation)).ok);
  assert.ok((await host.live("permission", { userId: "member", feature: "whiteboard", value: false })).ok);
  assert.match((await member.live("board-add", { ...operation, id: crypto.randomUUID() })).error, /permission/);
  assert.match((await member.live("board-undo", operation)).error, /permission/);
  assert.match((await moderator.live("permission", { userId: "member", feature: "whiteboard", value: true })).error, /Only the host/);
  assert.ok((await member.live("request", { feature: "whiteboard" })).ok);
  assert.equal(host.snapshot().requests[0].userId, "member");
  assert.ok((await host.live("mute", { userId: "member", muted: true })).ok);
  assert.match((await moderator.live("mute", { userId: "member", muted: false })).error, /cannot/);
  assert.ok((await host.live("mute", { userId: "moderator", muted: true })).ok);
  assert.ok((await host.live("permission", { userId: "member", feature: "whiteboard", value: true })).ok);
  assert.ok((await member.live("board-undo", operation)).ok);
  assert.equal(member.snapshot().boardDelta.operation.undone, true);
  assert.equal((await member.signal("live-snapshot")).live.board[0].undone, true);
  host.disconnect(); member.disconnect(); moderator.disconnect();
});

test("screen slots are atomic and an existing screen-audio producer stays paused after allowlisting", async () => {
  const { host, member } = await meeting();
  const [sender, second] = await Promise.all([
    member.signal("createWebRtcTransport", { sender: true }),
    host.signal("createWebRtcTransport", { sender: true }),
  ]);
  const screen = (transportId, ssrc) => ({
    transportId, source: "screen-video", kind: "video",
    rtpParameters: { codecs: [{ mimeType: "video/VP8", payloadType: 96, clockRate: 90000, parameters: {}, rtcpFeedback: [] }],
      encodings: [{ ssrc }], rtcp: { cname: "screen" + ssrc } },
  });
  const [current, busy] = await Promise.all([
    member.signal("transport-produce", screen(sender.params.id, 5001)),
    host.signal("transport-produce", screen(second.params.id, 5002)),
  ]);
  assert.ok(current.id, current.error);
  assert.match(busy.error, /already presenting/);
  assert.ok((await member.signal("transport-produce", {
    transportId: sender.params.id, source: "screen-audio", kind: "audio", rtpParameters: opus(5003),
  })).id);
  const audio = getProducersByPeer(member.id, "audio")[0].producer;
  await audio.dump();
  assert.equal(audio.paused, false);
  assert.ok((await host.live("speaking", { locked: true, users: [] })).ok);
  await audio.dump();
  assert.equal(audio.paused, true);
  assert.ok((await host.live("speaking", { locked: true, users: ["member"] })).ok);
  await audio.dump();
  assert.equal(audio.paused, true);
  assert.ok((await host.live("stop-presentation")).ok);
  assert.equal(audio.closed, true);
  assert.ok((await host.signal("transport-produce", screen(second.params.id, 5004))).id);
  host.disconnect(); member.disconnect();
});

test("anonymous ballot has account-based deduplication, room eligibility and hidden voter data", async () => {
  const { id, host, member } = await meeting();
  assert.ok((await host.live("poll-create", { type: "poll", question: "Pick one", options: ["A", "B"],
    anonymous: true, multiple: false, change: false, live: true, seconds: 0 })).ok);
  const pollId = host.snapshot().polls[0].id;
  const late = socket("late");
  await late.joinMeeting(id);
  assert.match((await late.live("poll-ballot", { id: pollId, choices: [1] })).error, /eligible/);
  assert.ok((await member.live("poll-ballot", { id: pollId, choices: [0] })).ok);
  member.disconnect();
  const restored = socket("member");
  await restored.joinMeeting(id);
  assert.equal(restored.snapshot().polls[0].submitted, true);
  assert.ok((await restored.live("poll-ballot", { id: pollId, choices: [0] })).ok);
  assert.match((await restored.live("poll-ballot", { id: pollId, choices: [1] })).error, /changed/);
  const view = host.snapshot().polls[0];
  assert.deepEqual(view.totals, [1, 0]);
  for (const key of ["voters", "ballots", "voterIds", "author"]) assert.equal(key in view, false);
  assert.equal(JSON.stringify(view).includes("member"), false);
  host.disconnect(); restored.disconnect(); late.disconnect();
});

test("breakout movement keeps parent authority and rejects stale media, ballots and other-room files", async () => {
  const { id, host, member } = await meeting();
  const { producer } = await addMic(host, 2233);
  assert.ok((await host.live("breakout-create", { title: "Group one" })).ok);
  const breakout = host.snapshot().breakouts[0].id;
  assert.ok((await host.live("breakout-assign", { room: breakout, userId: "member" })).ok);
  assert.ok((await host.live("breakout-start")).ok);
  const stale = member.token;
  assert.match((await member.live("board-clear")).error, /connection has changed/);
  const joined = await member.joinMeeting(id);
  assert.equal(joined.live.roomId, breakout);
  assert.notEqual(stale, member.token);
  assert.notEqual(getRoom(getPeer(host.id).roomName).router.id, getRoom(getPeer(member.id).roomName).router.id);
  assert.deepEqual((await member.signal("getProducers")).producers, []);
  assert.match((await member.signal("consume", { remoteProducerId: producer.id })).error, /Cannot subscribe/);
  assert.match((await host.signal("file-offer", { name: "a", size: 10, recipient: "member" })).error, /Invalid/);
  assert.match((await member.signal("getProducers", { roomToken: stale })).error, /connection has changed/);
  assert.ok((await host.live("speaking", { locked: true, users: [] })).ok);
  host.disconnect(); member.disconnect();
  const restored = socket("member");
  const reconnect = await restored.joinMeeting(id);
  assert.equal(reconnect.live.roomId, breakout);
  assert.equal(reconnect.live.role, "participant");
  assert.equal(reconnect.self.adminMuted, true);
  restored.disconnect();
});

test("the native worker accepts 10 concurrent members across rooms, rejects the eleventh", async (t) => {
  const id = crypto.randomUUID();
  const host = socket("load-host");
  await host.joinMeeting(id);
  const users = Array.from({ length: 9 }, (_, n) => socket("load-" + n));
  const started = performance.now();
  assert.ok((await Promise.all(users.map((entry) => entry.joinMeeting(id)))).every((result) => result.live));
  assert.ok((await host.live("breakout-create", { title: "Group A" })).ok);
  assert.ok((await host.live("breakout-create", { title: "Group B" })).ok);
  assert.ok((await host.live("breakout-auto")).ok);
  assert.ok((await host.live("breakout-start")).ok);
  assert.ok((await Promise.all(users.map((entry) => entry.joinMeeting(id)))).every((result) => result.live?.roomId !== "main"));
  const overflow = socket("overflow");
  assert.match((await overflow.joinMeeting(id)).error, /10 participant limit/);
  const transportCount = await Promise.all([host, ...users].map((entry) => entry.signal("createWebRtcTransport", { sender: true })));
  assert.ok(transportCount.every((entry) => entry.params?.sctpParameters));
  t.diagnostic("10 mocked signaling clients populated three native routers and opened ten real send transports in " + Math.round(performance.now() - started) + " ms; no RTP or browser inference load.");
  for (const entry of [host, ...users, overflow]) entry.disconnect();
});

test("recording is finalized through an acknowledged breakout move before room resources close", async () => {
  const { id, host, member } = await meeting();
  const { producer } = await addMic(member, 5511);
  assert.ok((await member.live("recording", { active: true })).ok);
  assert.ok((await host.live("breakout-create", { title: "Recording move" })).ok);
  const room = host.snapshot().breakouts[0].id;
  assert.ok((await host.live("breakout-assign", { room, userId: "member" })).ok);
  assert.ok((await host.live("breakout-start")).ok);
  const preparation = member.events.findLast((event) => event.name === "room-move-prepare").data;
  assert.equal(producer.closed, false);
  assert.match((await host.signal("room-move-ready", { id: preparation.id })).error, /ended/);
  assert.ok((await member.live("recording", { active: false })).ok);
  assert.ok((await member.signal("room-move-ready", { id: preparation.id })).ok);
  assert.equal(producer.closed, true);
  const latest = await member.joinMeeting(id);
  assert.equal(latest.live.roomId, room);
  assert.equal(latest.live.members[0].recording, false);
  host.disconnect(); member.disconnect();
});

test("file offer enforces the exact cap, recipient ownership and cancellation on revoke and disconnect", async () => {
  const { id, host, member } = await meeting();
  const observer = socket("observer");
  await observer.joinMeeting(id);
  const offer = { name: "../secret\u202e.html", recipient: "observer", size: MAX_FILE_BYTES };
  assert.match((await member.signal("file-offer", { ...offer, size: MAX_FILE_BYTES + 1 })).error, /Invalid/);
  const { id: transferId } = await member.signal("file-offer", offer);
  assert.ok(transferId);
  assert.equal(observer.events.findLast(({ name }) => name === "file-update").data.file.name, "_secret_.html");
  assert.match((await host.signal("file-accept", { transferId })).error, /unavailable/);
  assert.ok((await observer.signal("file-accept", { transferId })).ok);
  assert.ok((await host.live("permission", { userId: "member", feature: "files", value: false })).ok);
  assert.equal(observer.events.findLast(({ name }) => name === "file-update").data.event, "cancelled");
  assert.ok((await host.live("permission", { userId: "member", feature: "files", value: true })).ok);
  assert.ok((await member.signal("file-offer", offer)).id);
  member.disconnect();
  assert.ok(observer.events.some(({ name, data }) => name === "file-update" && /left/.test(data.reason)));
  assert.equal(safeFileName("..."), "download");
  const offset = MAX_FILE_BYTES - CHUNK_BYTES;
  const packet = Buffer.alloc(36 + CHUNK_BYTES);
  packet.writeUInt32BE(offset);
  crypto.createHash("sha256").update(packet.subarray(36)).digest().copy(packet, 4);
  assert.ok(validatePacket(packet, offset, MAX_FILE_BYTES));
  assert.equal(validatePacket(packet, offset + 1, MAX_FILE_BYTES), false);
  packet[37] = 1;
  assert.equal(validatePacket(packet, offset, MAX_FILE_BYTES), false);
  host.disconnect(); observer.disconnect();
});

function configured(configuration, visibility = "public") {
  const result = createConfiguredMeeting({ config: configuration, hostUserId: "host", title: "Configured", visibility });
  startMeeting(result.meeting.roomId, "host");
  return { ...result, id: result.meeting.roomId };
}

const vp8 = (ssrc) => ({
  codecs: [{ mimeType: "video/VP8", payloadType: 96, clockRate: 90000, parameters: {}, rtcpFeedback: [] }],
  encodings: [{ ssrc }], rtcp: { cname: "video" + ssrc },
});

test("configured defaults precede media, revocations pause active camera, and reconnect cannot recreate locked producers", async () => {
  const config = emptyConfiguration();
  config.initial.participant = { microphone: true, camera: true };
  config.defaults.participant = { chat: false, hands: false, screen: false };
  config.defaults.moderator = { reactions: false };
  const { id } = configured(config);
  const host = socket("host");
  const member = socket("member");
  await host.joinMeeting(id);
  const initial = await member.joinMeeting(id);
  assert.equal(initial.self.audioEnabled, false);
  assert.equal(initial.self.videoEnabled, false);
  assert.match((await member.signal("chat-message", { text: "Blocked" })).error, /restricted/);
  assert.match((await member.live("raise-hand", { raised: true })).error, /permission/);
  const { params } = await member.signal("createWebRtcTransport", { sender: true });
  const camera = { source: "camera", kind: "video", transportId: params.id, rtpParameters: vp8(6501) };
  assert.match((await host.signal("restart-ice", { transportId: params.id })).error, /ownership/);
  assert.ok((await member.signal("restart-ice", { transportId: params.id })).iceParameters.usernameFragment);
  assert.match((await member.signal("transport-produce", camera)).error, /restricted/);
  assert.match((await member.signal("transport-produce", { ...camera, source: "screen-video" })).error, /restricted/);
  assert.ok((await member.signal("video-state", { enabled: true })).ok);
  assert.ok((await member.signal("transport-produce", camera)).id);
  const producer = getProducersByPeer(member.id)[0].producer;
  assert.ok((await host.live("permission", { tier: "participant", feature: "camera", value: false })).ok);
  assert.ok((await host.live("permission", { tier: "participant", feature: "microphone", value: false })).ok);
  await producer.dump();
  assert.ok(producer.paused);
  assert.match((await member.signal("video-state", { enabled: true })).error, /restricted/);
  const returning = socket("member");
  const rejoined = await returning.joinMeeting(id);
  assert.equal(rejoined.self.videoEnabled, false);
  const send = (await returning.signal("createWebRtcTransport", { sender: true })).params.id;
  assert.match((await returning.signal("transport-produce", { ...camera, transportId: send })).error, /restricted/);
  assert.match((await returning.signal("transport-produce", {
    transportId: send, kind: "audio", source: "microphone", rtpParameters: opus(6502),
  })).error, /restricted/);
  assert.ok((await host.live("permission", { tier: "participant", feature: "camera", value: true })).ok);
  assert.equal(getPeer(returning.id).videoEnabled, false);
  assert.ok((await host.signal("chat-message", { text: "Existing history" })).ok);
  const second = socket("new");
  assert.equal((await second.joinMeeting(id)).chat[0].text, "Existing history");
  host.disconnect(); returning.disconnect(); second.disconnect();
});

test("timed breakout extension persists and a restored deadline returns a reconnecting member to main", async () => {
  const config = emptyConfiguration();
  config.rooms = [{ id: "focus", title: "Focus" }, { id: "already-closed", title: "Closed room" }];
  config.assignments = { member: "focus", other: "already-closed" };
  config.duration = 1;
  const first = configured(config);
  const host = socket("host");
  const member = socket("member");
  await host.joinMeeting(first.id);
  assert.equal((await member.joinMeeting(first.id)).live.endsAt, null);
  assert.ok((await host.live("breakout-start", { duration: 1 })).ok);
  const expires = (await member.joinMeeting(first.id)).live.endsAt;
  assert.ok(expires > Date.now());
  assert.ok((await host.live("breakout-extend", { duration: 2 })).ok);
  assert.equal(getMeeting(first.id).breakoutSession.endsAt, expires + 120_000);
  assert.equal(member.snapshot().endsAt, expires + 120_000);
  assert.ok((await host.live("breakout-end")).ok);
  assert.equal((await member.joinMeeting(first.id)).live.roomId, "main");
  assert.equal(getMeeting(first.id).breakoutSession, null);

  const restarted = configured(config);
  const ending = Date.now() + 300;
  saveBreakoutSession(restarted.id, "host", { endsAt: ending, rooms: [config.rooms[0]], assignments: config.assignments });
  const reconnect = socket("member");
  const restored = await reconnect.joinMeeting(restarted.id);
  assert.equal(restored.live.endsAt, ending);
  assert.equal(restored.live.roomId, "focus");
  const closedRoomMember = socket("other");
  assert.equal((await closedRoomMember.joinMeeting(restarted.id)).live.roomId, "main");
  await sleep(375);
  assert.ok(reconnect.events.some(({ name }) => name === "room-move"));
  assert.equal((await reconnect.joinMeeting(restarted.id)).live.roomId, "main");
  assert.equal(getMeeting(restarted.id).breakoutSession, null);
  host.disconnect(); member.disconnect(); reconnect.disconnect(); closedRoomMember.disconnect();
});

test("team tokens are meeting-scoped, private admission remains required, and duplicate names keep distinct accounts", async () => {
  const config = emptyConfiguration();
  config.rooms = [{ id: "team-room", title: "Team room" }];
  config.teams = [{ name: "Shared name", enabled: true, room: "team-room" }, { name: "Shared name", enabled: true }];
  const { id, links } = configured(config, "private");
  const other = configured(config);
  const a = socket("team-a");
  const b = socket("team-b");
  assert.notEqual(links[0].token, links[1].token);
  assert.match((await a.joinMeeting(other.id, links[0].token)).error, /invalid or revoked/);
  assert.equal((await a.joinMeeting(id, links[0].token)).error, "JOIN_APPROVAL_REQUIRED");
  for (const name of ["team-a", "team-b"]) {
    requestMeetingAccess(id, name, name);
    approveMeetingRequest(id, "host", name, true);
  }
  assert.equal((await a.joinMeeting(id, links[0].token)).self.name, "Shared name");
  const second = await b.joinMeeting(id, links[1].token);
  assert.equal(second.self.name, "Shared name");
  assert.notEqual(second.participants[0].userId, second.self.userId);
  assert.equal(second.live.role, "participant");
  const host = socket("host");
  await host.joinMeeting(id);
  assert.ok((await host.live("poll-create", { type: "poll", question: "Same team name", options: ["A", "B"],
    anonymous: true, multiple: false, change: false, live: true, seconds: 0 })).ok);
  const pollId = host.snapshot().polls[0].id;
  assert.ok((await a.live("poll-ballot", { id: pollId, choices: [0] })).ok);
  assert.ok((await b.live("poll-ballot", { id: pollId, choices: [1] })).ok);
  assert.deepEqual(host.snapshot().polls[0].totals, [1, 1]);
  assert.ok((await host.live("breakout-start")).ok);
  assert.equal((await a.joinMeeting(id)).live.roomId, "team-room");
  assert.equal((await b.joinMeeting(id)).live.roomId, "main");
  assert.ok((await host.live("breakout-end")).ok);
  assert.ok(!JSON.stringify(getMeeting(id)).includes(links[0].token));
  const next = publicConfiguration(getMeeting(id).configuration);
  next.teams[0] = { ...next.teams[0], enabled: false, name: "Renamed" };
  updateMeetingConfiguration(id, "host", next);
  const rejected = socket("new");
  assert.match((await rejected.joinMeeting(id, links[0].token)).error, /invalid or revoked/);
  a.disconnect();
  const restored = socket("team-a");
  assert.equal((await restored.joinMeeting(id)).self.name, "Renamed");
  host.disconnect(); restored.disconnect(); b.disconnect(); rejected.disconnect();
});

test("caption viewer scope, one recognizer per microphone, ordered partial/final and mute isolation", async () => {
  const active = new Map();
  setCaptionAdapter({ ready: async () => undefined, idle() {}, start(id, _channels, update) {
    active.set(id, update);
    return { packet: () => true, close: () => active.delete(id) };
  } });
  const { id, host, member } = await meeting();
  const viewer = socket("viewer");
  const outsider = socket("outsider");
  await viewer.joinMeeting(id); await outsider.joinMeeting(id);
  await host.live("breakout-create", { title: "Side" });
  const side = host.snapshot().breakouts[0].id;
  await host.live("breakout-assign", { userId: "outsider", room: side });
  await host.live("breakout-start");
  await outsider.joinMeeting(id);
  await addMic(member, 7723);
  const subscription = () => ({ enabled: true, subscription: crypto.randomUUID() });
  assert.ok((await viewer.signal("caption-subscribe", subscription())).ok);
  assert.ok((await host.signal("caption-subscribe", subscription())).ok);
  assert.ok((await outsider.signal("caption-subscribe", subscription())).ok);
  for (let i = 0; i < 50 && !active.size; i++) await sleep(5);
  assert.equal(active.size, 1);
  const send = [...active.values()][0];
  send({ type: "result", final: false, text: "one" });
  send({ type: "result", final: false, text: "one two" });
  send({ type: "result", final: false, text: "one two" });
  send({ type: "result", final: true, text: "one two" });
  const events = viewer.events.filter(({ name }) => name === "caption-update").map(({ data }) => data);
  assert.deepEqual(events.map(({ type, sequence }) => [type, sequence]), [["partial", 1], ["partial", 2], ["final", 3]]);
  assert.equal(new Set(events.map(({ utteranceId }) => utteranceId)).size, 1);
  assert.equal(events[0].roomToken, viewer.token);
  assert.ok(!outsider.events.some(({ name }) => name === "caption-update"));
  assert.ok(!member.events.some(({ name }) => name === "caption-update"));
  await member.signal("audio-state", { enabled: false });
  assert.equal(active.size, 0);
  send({ type: "result", final: false, text: "must not escape" });
  assert.equal(viewer.events.filter(({ name }) => name === "caption-update").at(-1).data.type, "clear");
  host.disconnect(); viewer.disconnect(); member.disconnect(); outsider.disconnect();
  setCaptionAdapter(new VoskAdapter());
});

test("missing server caption configuration reports availability without allocating a viewer", async () => {
  const saved = process.env.CAPTIONS_MODEL_PATH;
  delete process.env.CAPTIONS_MODEL_PATH;
  const { host, member } = await meeting();
  try {
    assert.equal((await member.signal("caption-subscribe", { enabled: true, subscription: crypto.randomUUID() })).error,
      "Captions unavailable");
    assert.ok(!member.events.some(({ name }) => name === "caption-update"));
  } finally {
    if (saved !== undefined) process.env.CAPTIONS_MODEL_PATH = saved;
    host.disconnect(); member.disconnect();
  }
});
