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
    isAdmin: Boolean(peer?.isAdmin),
    adminMuted: Boolean(peer?.forcedAudioMuted),
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

    const existingRoom = getRoom(normalizedRoomName);
    const adminUserId = meeting?.hostUserId || (!existingRoom ? socket.user?.id : existingRoom?.adminUserId);
    const router = await createRoom(normalizedRoomName, socket.id, adminUserId);
    if (!socket.connected) {
      removePeerFromRoom(normalizedRoomName, socket.id);
      return;
    }

    const peer = createPeer(socket, normalizedRoomName, socket.user);
    const room = getRoom(normalizedRoomName);
    peer.isAdmin = Boolean(room?.adminUserId && socket.user?.id === room.adminUserId);

    const audioModeration = room?.getAudioModeration?.(peer.userId);
    peer.forcedAudioMuted = Boolean(audioModeration?.forcedMuted);
    peer.audioEnabledBeforeAdminMute =
      audioModeration?.audioEnabledBeforeAdminMute ?? true;
    peer.audioEnabled = peer.forcedAudioMuted
      ? false
      : peer.audioEnabled ?? true;
    peer.videoEnabled = true;
    socket.audioEnabled = true;
    socket.videoEnabled = true;

    const participants = (room?.peers || [])
      .filter((peerId) => peerId !== socket.id)
      .map(participantState);

    participants.forEach((participant) => socket.emit("participant-state", participant));
    socket.emit("chat-history", room?.chatMessages || []);

    socket.to(normalizedRoomName).emit("participant-joined", participantState(socket.id));

    callback({ rtpCapabilities: router.rtpCapabilities, participants, self: participantState(socket.id) });
  } catch (error) {
    console.error("JOIN ROOM FAILED", error);
    if (socket.roomName === normalizedRoomName) {
      socket.leave(normalizedRoomName);
      socket.roomName = undefined;
    }
    callback({ error: error.message });
  }
};

export const audioState = async (socket, { enabled }) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer || !socket.roomName) return;

    const requestedEnabled = Boolean(enabled);
    const nextEnabled = peer.forcedAudioMuted ? false : requestedEnabled;
    peer.audioEnabled = nextEnabled;
    socket.audioEnabled = nextEnabled;

    const { getProducersByPeer } = await import(
      "../../mediasoup/producers/producerManager.js"
    );

    for (const item of getProducersByPeer(socket.id, "audio")) {
      if (item.producer.closed) continue;

      if (nextEnabled) {
        if (item.producer.paused && !peer.forcedAudioMuted) {
          await item.producer.resume();
        }
      } else if (!item.producer.paused) {
        await item.producer.pause();
      }
    }

    socket.to(socket.roomName).emit("audio-state", {
      peerId: socket.id,
      enabled: peer.audioEnabled,
      mutedByAdmin: peer.forcedAudioMuted,
    });
  } catch (error) {
    console.error("AUDIO STATE FAILED", error);
  }
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
