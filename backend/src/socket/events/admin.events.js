import { getPeer, getPeers } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
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
    const { admin, target } = getAuthorizedTarget(socket, targetPeerId);
    const room = getRoom(admin.roomName);
    if (!room) throw new Error("Room no longer exists.");

    const nextMuted = Boolean(muted);
    const targetUserId = target.userId;

    if (!targetUserId) {
      throw new Error("Authenticated participant identity is required for moderation.");
    }

    const existingModeration = room.getAudioModeration(targetUserId);

    if (nextMuted) {
      room.setAudioModeration(targetUserId, {
        forcedMuted: true,
        audioEnabledBeforeAdminMute:
          existingModeration?.audioEnabledBeforeAdminMute ?? target.audioEnabled,
      });
    } else {
      room.clearAudioModeration(targetUserId);
    }

    // Apply the moderation to every active session for this user in this room.
    // This prevents opening another tab while muted from bypassing the rule.
    const affectedPeers = Object.values(getPeers()).filter(
      (peer) => peer.roomName === admin.roomName && peer.userId === targetUserId,
    );

    for (const affectedPeer of affectedPeers) {
      if (nextMuted) {
        if (!affectedPeer.forcedAudioMuted) {
          affectedPeer.audioEnabledBeforeAdminMute = affectedPeer.audioEnabled;
        }
        affectedPeer.forcedAudioMuted = true;
        affectedPeer.audioEnabled = false;

        for (const item of getProducersByPeer(affectedPeer.socket.id, "audio")) {
          if (!item.producer.closed && !item.producer.paused) {
            await item.producer.pause();
          }
        }
      } else {
        affectedPeer.forcedAudioMuted = false;
        affectedPeer.audioEnabled =
          existingModeration?.audioEnabledBeforeAdminMute ??
          affectedPeer.audioEnabledBeforeAdminMute ??
          true;

        for (const item of getProducersByPeer(affectedPeer.socket.id, "audio")) {
          if (
            !item.producer.closed &&
            item.producer.paused &&
            affectedPeer.audioEnabled
          ) {
            await item.producer.resume();
          }
        }
      }

      affectedPeer.socket.emit("admin-audio-state", {
        enabled: affectedPeer.audioEnabled,
        mutedByAdmin: affectedPeer.forcedAudioMuted,
      });
    }

    const payload = {
      peerId: target.socket.id,
      userId: target.userId,
      username: target.username,
      name: target.displayName,
      audioEnabled: target.audioEnabled,
      videoEnabled: target.videoEnabled,
      connected: true,
      isAdmin: target.isAdmin,
      adminMuted: nextMuted,
    };

    socket.to(target.roomName).emit("participant-state", payload);
    socket.emit("participant-state", payload);
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
