import crypto from "node:crypto";
import { getRoom } from "../mediasoup/rooms/roomManager.js";
import { getTransportById } from "../mediasoup/transports/transportManager.js";
import { allowed, rate } from "./state.js";
import { mountedPeer } from "../socket/events/room.events.js";
import { requireCondition } from "./collaboration.js";

export const MAX_FILE_BYTES = 100_000_000;
export const CHUNK_BYTES = 16_384;
const WINDOW = CHUNK_BYTES * 8;
const HEADER = 36;
const transfers = new Map();

export function safeFileName(name) {
  if (typeof name !== "string") return "download";
  const normalized = name.normalize("NFC").slice(0, 180).replace(/[\\/:*?"<>|\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/gu, "_")
    .replace(/^[ .]+|[ .]+$/gu, "") || "download";
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(normalized) ? "_" + normalized : normalized;
}

export function validatePacket(packet, offset, size) {
  const bytes = Math.min(CHUNK_BYTES, size - offset);
  return bytes > 0 && packet.length === bytes + HEADER && packet.readUInt32BE(0) === offset &&
    crypto.timingSafeEqual(packet.subarray(4, HEADER), crypto.createHash("sha256").update(packet.subarray(HEADER)).digest());
}

function update(transfer, peer, event, data = {}) {
  peer.socket.emit("file-update", { event, id: transfer.id, roomToken: peer.roomToken, ...data });
}

function expiry(transfer) {
  clearTimeout(transfer.timer);
  transfer.timer = setTimeout(() => finish(transfer, "cancelled", "The file transfer timed out."), 35_000);
  transfer.timer.unref();
}

function finish(transfer, event, reason) {
  if (!transfers.delete(transfer.id)) return;
  clearTimeout(transfer.timer);
  // Close subscribers before their upstream producers so the worker receives each close only once.
  transfer.output?.close();
  transfer.direct?.close();
  transfer.input?.close();
  for (const peer of [transfer.sender, transfer.recipient]) {
    peer.transfers?.delete(transfer);
    update(transfer, peer, event, { reason, bytes: transfer.acknowledged });
  }
}

function trackPeer(peer, transfer) {
  peer.transfers ??= new Set();
  peer.transfers.add(transfer);
  peer.cancelFiles = (reason, { sendingOnly = false } = {}) => {
    for (const entry of peer.transfers) {
      if (!sendingOnly || entry.sender === peer) finish(entry, "cancelled", reason);
    }
  };
}

function openTransfer(peer, data, callback) {
  rate(peer, "file-offer", 5);
  const recipient = peer.meeting.members.get(data.recipient)?.peer;
  requireCondition(allowed(peer, "files") && recipient?.ready && recipient !== peer &&
    recipient.roomName === peer.roomName && Number.isInteger(data.size) && data.size > 0 && data.size <= MAX_FILE_BYTES);
  requireCondition(!peer.transfers?.size && !recipient.transfers?.size, "A sender or recipient is already transferring a file.");
  const file = { name: safeFileName(data.name), size: data.size, sender: peer.displayName };
  const transfer = { id: crypto.randomUUID(), sender: peer, recipient, file, received: 0, acknowledged: 0 };
  transfers.set(transfer.id, transfer);
  trackPeer(peer, transfer);
  trackPeer(recipient, transfer);
  expiry(transfer);
  update(transfer, recipient, "offer", { file });
  callback({ id: transfer.id });
}

function ensureActive(transfer) {
  requireCondition(transfers.has(transfer.id) && transfer.sender.ready && transfer.recipient.ready &&
    transfer.sender.roomName === transfer.recipient.roomName && allowed(transfer.sender, "files"), "The file transfer ended.");
}

function ownedTransport(peer, id, consumer) {
  const entry = getTransportById(id);
  requireCondition(entry?.socketId === peer.socket.id && entry.roomName === peer.roomName && entry.consumer === consumer);
  return entry.transport;
}

async function setupInput(transfer, peer, data) {
  requireCondition(peer === transfer.sender && transfer.accepted && !transfer.creating);
  const { sctpStreamParameters } = data;
  requireCondition(sctpStreamParameters?.ordered === true && !sctpStreamParameters.maxPacketLifeTime && !sctpStreamParameters.maxRetransmits);
  const transport = ownedTransport(peer, data.transportId, false);
  transfer.creating = true;
  const router = getRoom(peer.roomName).router;
  let input, direct;
  try {
    input = await transport.produceData({ sctpStreamParameters, label: "rauma-file" });
    ensureActive(transfer);
    transfer.input = input;
    direct = await router.createDirectTransport({ maxSendMessageSize: CHUNK_BYTES + HEADER, maxReceiveMessageSize: CHUNK_BYTES + HEADER });
    ensureActive(transfer);
    transfer.direct = direct;
    const incoming = await direct.consumeData({ dataProducerId: input.id });
    const relay = await direct.produceData({ label: "rauma-file" });
    ensureActive(transfer);
    transfer.relay = relay;
    input.observer.once("close", () => finish(transfer, "cancelled", "The sender's data channel closed."));
    incoming.on("message", (packet, ppid) => {
      if (!transfers.has(transfer.id)) return;
      if (!transfer.ready || peer.roomName !== transfer.recipient.roomName || !allowed(peer, "files") ||
        ppid !== 53 || transfer.received >= transfer.acknowledged + WINDOW ||
        !validatePacket(packet, transfer.received, transfer.file.size)) {
        return finish(transfer, "cancelled", "File size, sequence or integrity check failed.");
      }
      transfer.received += packet.length - HEADER;
      try { relay.send(packet, ppid); } catch { finish(transfer, "cancelled", "The file data channel closed."); }
    });
    update(transfer, transfer.recipient, "subscribe");
    return { id: input.id };
  } catch (error) {
    input?.close();
    direct?.close();
    throw error;
  }
}

export async function fileSignal(socket, data, callback, action) {
  const peer = mountedPeer(socket, data);
  if (action === "offer") return openTransfer(peer, data, callback);
  if (action === "credit") rate(peer, "file-credit", 600);
  const transfer = transfers.get(data.transferId);
  if (!transfer && action === "cancel") return callback({ ok: true });
  requireCondition(transfer && (peer === transfer.sender || peer === transfer.recipient), "This file is unavailable.");
  ensureActive(transfer);
  if (action === "cancel") finish(transfer, "cancelled", "File transfer cancelled.");
  else if (action === "accept") {
    requireCondition(peer === transfer.recipient && !transfer.accepted);
    transfer.accepted = true;
    expiry(transfer);
    update(transfer, transfer.sender, "accepted", { chunk: CHUNK_BYTES });
  } else if (action === "produce") {
    try { return callback(await setupInput(transfer, peer, data)); }
    catch (error) { finish(transfer, "cancelled", "Cannot create the file data channel."); throw error; }
  } else if (action === "consume") {
    requireCondition(peer === transfer.recipient && transfer.relay && !transfer.subscribing);
    const transport = ownedTransport(peer, data.transportId, true);
    transfer.subscribing = true;
    try {
      const output = await transport.consumeData({ dataProducerId: transfer.relay.id, ordered: true });
      if (!transfers.has(transfer.id)) {
        output.close();
        throw new Error("The file transfer ended.");
      }
      transfer.output = output;
      output.observer.once("close", () => finish(transfer, "cancelled", "The recipient's data channel closed."));
      return callback({ params: { id: output.id, dataProducerId: transfer.relay.id, label: output.label,
        protocol: output.protocol, sctpStreamParameters: output.sctpStreamParameters } });
    } catch (error) {
      finish(transfer, "cancelled", "Cannot subscribe to the file data channel.");
      throw error;
    }
  } else if (action === "ready") {
    requireCondition(peer === transfer.recipient && transfer.output && !transfer.ready);
    transfer.ready = true;
    expiry(transfer);
    update(transfer, transfer.sender, "ready");
  } else if (action === "credit") {
    requireCondition(peer === transfer.recipient && transfer.ready &&
      data.bytes === Math.min(transfer.acknowledged + WINDOW, transfer.file.size) && data.bytes <= transfer.received);
    transfer.acknowledged = data.bytes;
    if (data.bytes === transfer.file.size) finish(transfer, "done");
    else {
      expiry(transfer);
      update(transfer, transfer.sender, "credit", { bytes: data.bytes });
    }
  }
  callback({ ok: true });
}
