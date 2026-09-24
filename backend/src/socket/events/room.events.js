import { createRoom, getRoom, removePeerFromRoom } from "../../mediasoup/rooms/roomManager.js";
import { createPeer, getPeer } from "../../mediasoup/peers/peerManager.js";

const normalizeRoomName = (roomName) => {
  if (typeof roomName !== "string") return null;

  const value = roomName.trim();
  if (!value || value.length > 128) return null;

  return value;
};

const participantState = (peerId) => {
  const peer = getPeer(peerId);

  return {
    peerId,
    audioEnabled: peer?.audioEnabled ?? true,
    videoEnabled: peer?.videoEnabled ?? true,
    connected: true,
  };
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

    // Join the Socket.IO room before awaiting mediasoup room creation. This
    // prevents a fast simultaneous join from missing participant-joined.
    socket.roomName = normalizedRoomName;
    socket.join(normalizedRoomName);

    const router = await createRoom(
      normalizedRoomName,
      socket.id,
    );

    // The socket may have disconnected while createRoom() was waiting on the
    // worker. Do not leave a ghost peer in the room.
    if (!socket.connected) {
      removePeerFromRoom(normalizedRoomName, socket.id);
      return;
    }

    const peer = createPeer(socket, normalizedRoomName);
    peer.audioEnabled = true;
    peer.videoEnabled = true;

    socket.audioEnabled = true;
    socket.videoEnabled = true;

    const room = getRoom(normalizedRoomName);
    const participants = (room?.peers || [])
      .filter((peerId) => peerId !== socket.id)
      .map(participantState);

    // Send the existing participant snapshot to the joining client.
    for (const participant of participants) {
      socket.emit("participant-state", participant);
    }

    // Tell existing clients about the new participant immediately, before
    // their media producers exist.
    socket.to(normalizedRoomName).emit("participant-joined", {
      peerId: socket.id,
      audioEnabled: true,
      videoEnabled: true,
      connected: true,
    });

    callback({
      rtpCapabilities: router.rtpCapabilities,
      participants,
    });
  } catch (error) {
    console.error("JOIN ROOM FAILED", error);

    if (socket.roomName === normalizedRoomName) {
      socket.leave(normalizedRoomName);
      socket.roomName = undefined;
    }

    callback({
      error: error.message,
    });
  }
};

export const audioState = (socket, { enabled }) => {
  const peer = getPeer(socket.id);
  if (!peer || !socket.roomName) return;

  peer.audioEnabled = Boolean(enabled);
  socket.audioEnabled = peer.audioEnabled;

  socket.to(socket.roomName).emit("audio-state", {
    peerId: socket.id,
    enabled: peer.audioEnabled,
  });
};

export const videoState = (socket, { enabled }) => {
  const peer = getPeer(socket.id);
  if (!peer || !socket.roomName) return;

  peer.videoEnabled = Boolean(enabled);
  socket.videoEnabled = peer.videoEnabled;

  socket.to(socket.roomName).emit("video-state", {
    peerId: socket.id,
    enabled: peer.videoEnabled,
  });
};
