import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getProducersByPeer } from "../../mediasoup/producers/producerManager.js";

const getAuthorizedTarget = (socket, targetPeerId) => {
  const admin = getPeer(socket.id);
  const target = getPeer(targetPeerId);

  if (!admin?.isAdmin) throw new Error("Admin permission required.");
  if (!admin.roomName || !target || target.roomName !== admin.roomName) {
    throw new Error("Participant is not in your room.");
  }
  if (target.socket.id === socket.id) throw new Error("You cannot moderate yourself.");
  if (target.isAdmin) throw new Error("The meeting admin cannot be moderated.");

  return { admin, target };
};

const emitParticipantState = (socket, target) => {
  const payload = {
    peerId: target.socket.id,
    userId: target.userId,
    username: target.username,
    name: target.displayName,
    audioEnabled: target.audioEnabled,
    videoEnabled: target.videoEnabled,
    connected: true,
    isAdmin: target.isAdmin,
    adminMuted: target.forcedAudioMuted,
  };

  socket.emit("participant-state", payload);
  socket.to(target.roomName).emit("participant-state", payload);
};

export const adminSetAudioMuted = async (socket, { targetPeerId, muted }, callback) => {
  try {
    const { target } = getAuthorizedTarget(socket, targetPeerId);
    const nextMuted = Boolean(muted);

    if (nextMuted) {
      if (!target.forcedAudioMuted) {
        target.audioEnabledBeforeAdminMute = target.audioEnabled;
      }
      target.forcedAudioMuted = true;
      target.audioEnabled = false;
      for (const item of getProducersByPeer(target.socket.id, "audio")) {
        if (!item.producer.closed && !item.producer.paused) {
          await item.producer.pause();
        }
      }
    } else {
      target.forcedAudioMuted = false;
      target.audioEnabled = target.audioEnabledBeforeAdminMute ?? true;
      for (const item of getProducersByPeer(target.socket.id, "audio")) {
        if (!item.producer.closed && item.producer.paused && target.audioEnabled) {
          await item.producer.resume();
        }
      }
    }

    target.socket.emit("admin-audio-state", {
      enabled: target.audioEnabled,
      mutedByAdmin: target.forcedAudioMuted,
    });
    emitParticipantState(socket, target);
    callback?.({ ok: true });
  } catch (error) {
    console.error("ADMIN AUDIO MODERATION FAILED", error);
    callback?.({ error: error.message || "Could not update participant." });
  }
};

export const adminRemoveParticipant = (socket, { targetPeerId }, callback) => {
  try {
    const { target } = getAuthorizedTarget(socket, targetPeerId);
    target.socket.emit("admin-removed", { reason: "You were removed from the meeting by the admin." });
    callback?.({ ok: true });
    setImmediate(() => target.socket.disconnect(true));
  } catch (error) {
    console.error("ADMIN REMOVE FAILED", error);
    callback?.({ error: error.message || "Could not remove participant." });
  }
};
