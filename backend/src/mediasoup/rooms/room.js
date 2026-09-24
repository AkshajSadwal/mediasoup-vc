class Room {
  constructor(roomName, router, socketId, adminUserId = null) {
    this.roomName = roomName;
    this.router = router;
    this.peers = [socketId];
    this.adminUserId = adminUserId || null;
    this.chatMessages = [];

    // Room-level moderation survives a participant's socket reconnect/refresh.
    // Keys are stable authenticated user IDs, not transient socket IDs.
    this.audioModeration = new Map();
  }

  addChatMessage(message) {
    this.chatMessages.push(message);
    if (this.chatMessages.length > 200) {
      this.chatMessages.splice(0, this.chatMessages.length - 200);
    }
  }

  getAudioModeration(userId) {
    if (!userId) return null;
    return this.audioModeration.get(userId) || null;
  }

  setAudioModeration(userId, state) {
    if (!userId) return;
    this.audioModeration.set(userId, {
      forcedMuted: Boolean(state?.forcedMuted),
      audioEnabledBeforeAdminMute: Boolean(
        state?.audioEnabledBeforeAdminMute ?? true,
      ),
    });
  }

  clearAudioModeration(userId) {
    if (!userId) return;
    this.audioModeration.delete(userId);
  }
}

export default Room;
