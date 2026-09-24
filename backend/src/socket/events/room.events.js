import { createRoom } from "../../mediasoup/rooms/roomManager.js";
import { createPeer } from "../../mediasoup/peers/peerManager.js";

const normalizeRoomName = (roomName) => {
  if (typeof roomName !== "string") return null;

  const value = roomName.trim();
  if (!value || value.length > 128) return null;

  return value;
};

export const joinRoom = async (
  socket,
  { roomName },
  callback,
) => {
  try {
    const normalizedRoomName = normalizeRoomName(roomName);
    if (!normalizedRoomName) {
      return callback({
        error: "Invalid room name.",
      });
    }

    const clients = await socket
      .in(normalizedRoomName)
      .fetchSockets();

    socket.join(normalizedRoomName);
    socket.roomName = normalizedRoomName;
    socket.audioEnabled = true;
    socket.videoEnabled = true;

    clients.forEach((client) => {
      socket.emit("participant-state", {
        peerId: client.id,
        audioEnabled: client.audioEnabled ?? true,
        videoEnabled: client.videoEnabled ?? true,
      });
    });

    const router = await createRoom(
      normalizedRoomName,
      socket.id,
    );

    createPeer(socket, normalizedRoomName);

    callback({
      rtpCapabilities: router.rtpCapabilities,
    });
  } catch (error) {
    console.error("JOIN ROOM FAILED", error);

    callback({
      error: error.message,
    });
  }
};

export const audioState = (socket, { enabled }) => {
  if (!socket.roomName) return;

  socket.audioEnabled = Boolean(enabled);
  socket.to(socket.roomName).emit("audio-state", {
    peerId: socket.id,
    enabled: socket.audioEnabled,
  });
};

export const videoState = (socket, { enabled }) => {
  if (!socket.roomName) return;

  socket.videoEnabled = Boolean(enabled);
  socket.to(socket.roomName).emit("video-state", {
    peerId: socket.id,
    enabled: socket.videoEnabled,
  });
};
