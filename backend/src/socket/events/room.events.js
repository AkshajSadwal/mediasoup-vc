import { createRoom, getRoom, removePeerFromRoom } from "../../mediasoup/rooms/roomManager.js";
import { createPeer, getPeer } from "../../mediasoup/peers/peerManager.js";
import { getMeeting, isMeetingOpen } from "../../meetings/meetingStore.js";

const normalizeRoomName = (roomName) => {
  if (typeof roomName !== "string") return null;
  const value = roomName.trim();
  if (!value || value.length > 128) return null;
  return value;
};

export const participantState = (peerId) => {
  const peer = getPeer(peerId);
  return {
    peerId,
    userId: peer?.userId || null,
    username: peer?.username || null,
    name: peer?.displayName || `Guest ${peerId.slice(0, 6)}`,
    audioEnabled: peer?.audioEnabled ?? true,
    videoEnabled: peer?.videoEnabled ?? true,
    connected: true,
  };
};

export const joinRoom = async (socket, { roomName }, callback) => {
  try {
    const normalizedRoomName = normalizeRoomName(roomName);
    if (!normalizedRoomName) return callback({ error: "Invalid room name." });

    const meeting = getMeeting(normalizedRoomName);
    if (meeting) {
      if (!socket.user) return callback({ error: "AUTH_REQUIRED" });
      if (meeting.status === "cancelled") return callback({ error: "This meeting has been cancelled." });
      if (!isMeetingOpen(meeting)) return callback({ error: "WAITING_ROOM" });
    }

    socket.roomName = normalizedRoomName;
    socket.join(normalizedRoomName);

    const router = await createRoom(normalizedRoomName, socket.id);
    if (!socket.connected) {
      removePeerFromRoom(normalizedRoomName, socket.id);
      return;
    }

    const peer = createPeer(socket, normalizedRoomName, socket.user);
    peer.audioEnabled = true;
    peer.videoEnabled = true;
    socket.audioEnabled = true;
    socket.videoEnabled = true;

    const room = getRoom(normalizedRoomName);
    const participants = (room?.peers || [])
      .filter((peerId) => peerId !== socket.id)
      .map(participantState);

    participants.forEach((participant) => socket.emit("participant-state", participant));

    socket.to(normalizedRoomName).emit("participant-joined", participantState(socket.id));

    callback({ rtpCapabilities: router.rtpCapabilities, participants });
  } catch (error) {
    console.error("JOIN ROOM FAILED", error);
    if (socket.roomName === normalizedRoomName) {
      socket.leave(normalizedRoomName);
      socket.roomName = undefined;
    }
    callback({ error: error.message });
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
