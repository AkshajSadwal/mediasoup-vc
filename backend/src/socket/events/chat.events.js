import crypto from "crypto";
import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const getChatHistory = (socket, callback) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer) return callback?.([]);
    const room = getRoom(peer.roomName);
    callback?.(room?.chatMessages || []);
  } catch (error) {
    console.error("CHAT HISTORY FAILED", error);
    callback?.([]);
  }
};

export const sendChatMessage = (socket, { text }, callback) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer) throw new Error("Peer has not joined a room.");

    const room = getRoom(peer.roomName);
    if (!room) throw new Error("Room no longer exists.");

    const normalized = normalizeText(text);
    if (!normalized) throw new Error("Message cannot be empty.");
    if (normalized.length > 1000) throw new Error("Message is too long.");

    const message = {
      id: crypto.randomUUID(),
      peerId: socket.id,
      userId: peer.userId,
      username: peer.username,
      name: peer.displayName,
      text: normalized,
      createdAt: new Date().toISOString(),
    };

    room.addChatMessage(message);
    socket.to(peer.roomName).emit("chat-message", message);
    socket.emit("chat-message", message);
    callback?.({ ok: true });
  } catch (error) {
    console.error("CHAT SEND FAILED", error);
    callback?.({ error: error.message || "Could not send message." });
  }
};
