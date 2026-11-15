import crypto from "node:crypto";
import { allowed, liveRoom, rate } from "../../live/state.js";
import { mountedPeer } from "./room.events.js";

export function sendChatMessage(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  if (!allowed(peer, "chat")) throw new Error("The host has restricted sending chat messages.");
  rate(peer, "chat", 15);
  if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 1000) throw new Error("Invalid message.");
  const room = liveRoom(peer.meeting, peer.activeRoomId);
  const message = {
    id: crypto.randomUUID(), peerId: socket.id, userId: peer.userId,
    name: peer.displayName, text: data.text.trim(), createdAt: new Date().toISOString(),
  };
  room.chat ??= [];
  room.chat.push(message);
  if (room.chat.length > 200) room.chat.shift();
  socket.emit("chat-message", message);
  socket.to(peer.roomName).emit("chat-message", message);
  callback({ ok: true });
}
