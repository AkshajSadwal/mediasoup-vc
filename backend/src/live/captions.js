import crypto from "node:crypto";
import { getRoom } from "../mediasoup/rooms/roomManager.js";
import { getProducersByPeer } from "../mediasoup/producers/producerManager.js";
import { audioAllowed, rate } from "./state.js";
import { VoskAdapter, opusPayload } from "../captions/voskAdapter.js";

let adapter = new VoskAdapter();
let idleTimer;
const rooms = new Map();
// Opt-in browser recognition is separate from server Vosk. Text is relayed to
// subscribers in this exact room, never to another breakout or unsusbcribed peer.
const browserViewers = new Map();

export function setCaptionAdapter(replacement) {
  if (rooms.size) throw new Error("Caption rooms are active.");
  adapter = replacement;
}

const validViewer = (entry, state) => entry.peer.ready && entry.peer.roomName === state.key && entry.token === entry.peer.roomToken;
const eligible = (peer, state) => peer?.ready && peer.roomName === state.key && audioAllowed(peer, "microphone");

function stopSource(state, speakerId) {
  const entry = state.speakers.get(speakerId);
  if (!entry) return;
  state.speakers.delete(speakerId);
  entry.recognition?.close();
  entry.consumer?.close();
  entry.transport?.close();
  send(state, entry.peer, { type: "clear", streamId: entry.id, sequence: ++entry.sequence });
}

function send(state, speaker, event) {
  for (const viewer of state.viewers.values()) {
    if (validViewer(viewer, state)) viewer.peer.socket.emit("caption-update", {
      ...event, roomId: viewer.peer.activeRoomId, roomToken: viewer.token,
      subscription: viewer.subscription, speakerId: speaker.userId, speaker: speaker.displayName,
    });
  }
}

export function applyRecognition(state, entry, result) {
  if (state.speakers.get(entry.peer.userId) !== entry || !eligible(entry.peer, state) ||
    typeof result.final !== "boolean" || typeof result.text !== "string") return;
  const text = result.text.trim().slice(0, 500);
  if (!result.final && text === entry.partial) return;
  if (!text && !entry.partial) return;
  send(state, entry.peer, { type: result.final ? "final" : "partial", text, sequence: ++entry.sequence,
    utteranceId: entry.utterance, streamId: entry.id });
  entry.partial = result.final ? "" : text;
  if (result.final) entry.utterance = crypto.randomUUID();
}

function failRoom(state) {
  for (const viewer of state.viewers.values()) if (validViewer(viewer, state)) viewer.peer.socket.emit("caption-status", {
    roomToken: viewer.token, subscription: viewer.subscription, error: "Captions unavailable",
  });
  state.viewers.clear();
  dispose(state);
}

function dispose(state) {
  if (rooms.get(state.key) !== state) return;
  rooms.delete(state.key);
  for (const id of state.speakers.keys()) stopSource(state, id);
  if (!rooms.size) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!rooms.size) adapter.idle(); }, 15_000);
    idleTimer.unref();
  }
}

async function startSource(state, peer, producer) {
  const entry = { id: crypto.randomUUID(), utterance: crypto.randomUUID(), sequence: 0, partial: "", peer, producer };
  const current = () => rooms.get(state.key) === state && state.speakers.get(peer.userId) === entry &&
    eligible(peer, state) && !producer.closed;
  state.speakers.set(peer.userId, entry);
  try {
    const router = getRoom(state.key)?.router;
    if (!router) throw new Error("Room disappeared");
    const transport = await router.createDirectTransport();
    if (!current()) return transport.close();
    entry.transport = transport;
    const consumer = await transport.consume({ producerId: producer.id, paused: true,
      rtpCapabilities: { codecs: router.rtpCapabilities.codecs.filter(({ mimeType }) => mimeType.toLowerCase() === "audio/opus") } });
    if (!current()) return consumer.close();
    entry.consumer = consumer;
    const opus = consumer.rtpParameters.codecs.find(({ mimeType }) => mimeType.toLowerCase() === "audio/opus");
    if (!opus) throw new Error("Opus unavailable");
    entry.recognition = adapter.start(entry.id, opus.channels === 1 ? 1 : 2, (event) => {
      if (!current()) return;
      if (event.type === "result") applyRecognition(state, entry, event);
      if (event.type === "error") failRoom(state);
    });
    consumer.on("rtp", (packet) => {
      if (!current() || producer.paused) return;
      const payload = opusPayload(packet, opus.payloadType);
      if (!payload) return;
      if (entry.recognition.packet(payload)) entry.dropped = 0;
      else if ((entry.dropped = (entry.dropped || 0) + 1) > 25) failRoom(state);
    });
    consumer.once("producerclose", () => {
      if (state.speakers.get(peer.userId) === entry) stopSource(state, peer.userId);
    });
    await consumer.resume();
  } catch {
    if (current()) failRoom(state);
  }
}

export function reconcileCaptions(meeting, key) {
  const local = browserViewers.get(key);
  if (local) {
    for (const [id, viewer] of local) {
      if (!viewer.peer.ready || viewer.peer.roomName !== key || viewer.peer.roomToken !== viewer.token) local.delete(id);
    }
    if (!local.size) browserViewers.delete(key);
  }
  const state = rooms.get(key);
  if (!state) return;
  for (const [socket, viewer] of state.viewers) if (!validViewer(viewer, state)) state.viewers.delete(socket);
  if (!state.viewers.size) return dispose(state);
  const desired = new Map();
  for (const { peer } of meeting.members.values()) {
    if (!eligible(peer, state)) continue;
    const record = getProducersByPeer(peer.socket.id, "audio").find(({ source, producer }) => source === "microphone" && !producer.closed);
    if (record) desired.set(peer.userId, { peer, producer: record.producer });
  }
  for (const [id, entry] of state.speakers) if (desired.get(id)?.producer !== entry.producer) stopSource(state, id);
  for (const [id, entry] of desired) if (!state.speakers.has(id)) void startSource(state, entry.peer, entry.producer);
}

export async function subscribeCaptions(peer, data) {
  rate(peer, "caption-subscribe", 8);
  if (typeof data.enabled !== "boolean" || typeof data.subscription !== "string" || !/^[a-f0-9-]{36}$/.test(data.subscription)) throw new Error("Invalid caption subscription.");
  const { roomName: key, roomToken: token } = peer;
  peer.captionRequest = data.subscription;
  let state = rooms.get(key);
  if (!data.enabled) {
    state?.viewers.delete(peer.socket.id);
    reconcileCaptions(peer.meeting, key);
    return;
  }
  await adapter.ready();
  if (!peer.ready || peer.roomToken !== token || peer.captionRequest !== data.subscription) {
    if (!rooms.size) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (!rooms.size) adapter.idle(); }, 15_000);
      idleTimer.unref();
    }
    return;
  }
  clearTimeout(idleTimer);
  state = rooms.get(key);
  if (!state) {
    state = { key, viewers: new Map(), speakers: new Map() };
    rooms.set(key, state);
  }
  state.viewers.set(peer.socket.id, { peer, token, subscription: data.subscription });
  reconcileCaptions(peer.meeting, key);
}

// Browser SpeechRecognition fallback: users opt in locally before their browser
// processes microphone audio. The server only relays bounded, authenticated text.
export function subscribeBrowserCaptions(peer, data) {
  rate(peer, "browser-caption-subscribe", 8);
  if (typeof data.enabled !== "boolean" || typeof data.subscription !== "string" ||
      !/^[a-f0-9-]{36}$/.test(data.subscription)) throw new Error("Invalid caption subscription.");
  let viewers = browserViewers.get(peer.roomName);
  if (!data.enabled) {
    viewers?.delete(peer.socket.id);
    if (viewers && !viewers.size) browserViewers.delete(peer.roomName);
    return;
  }
  if (!viewers) {
    viewers = new Map();
    browserViewers.set(peer.roomName, viewers);
  }
  viewers.set(peer.socket.id, { peer, token: peer.roomToken, subscription: data.subscription });
}

export function publishBrowserCaption(peer, data) {
  rate(peer, "browser-caption-publish", 60);
  if (!audioAllowed(peer, "microphone") || !getProducersByPeer(peer.socket.id, "audio")
    .some(({ source, producer }) => source === "microphone" && !producer.closed && !producer.paused)) {
    throw new Error("An active microphone is required to share captions.");
  }
  if (typeof data.final !== "boolean" || typeof data.text !== "string" ||
      data.text.length > 500 || !/^[a-f0-9-]{36}$/.test(data.streamId) ||
      !/^[a-f0-9-]{36}$/.test(data.utteranceId) ||
      !Number.isSafeInteger(data.sequence) || data.sequence < 1 || data.sequence > 1_000_000) {
    throw new Error("Invalid browser caption.");
  }
  const text = data.text.trim();
  if (!text) return;
  const viewers = browserViewers.get(peer.roomName);
  if (!viewers) return;
  for (const viewer of viewers.values()) {
    if (!viewer.peer.ready || viewer.peer.roomName !== peer.roomName || viewer.peer.roomToken !== viewer.token) continue;
    viewer.peer.socket.emit("caption-update", { roomId: viewer.peer.activeRoomId,
      roomToken: viewer.token, subscription: viewer.subscription,
      speakerId: peer.userId, speaker: peer.displayName,
      streamId: data.streamId, utteranceId: data.utteranceId,
      sequence: data.sequence, type: data.final ? "final" : "partial", text });
  }
}
