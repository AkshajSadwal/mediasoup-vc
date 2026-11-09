class Peer {
  constructor(socket, roomName, user = null) {
    this.socket = socket;
    this.roomName = roomName;
    this.userId = user?.id || null;
    this.username = user?.username || null;
    this.displayName = user?.displayName || user?.name || user?.username || `Guest ${socket.id.slice(0, 6)}`;
    this.avatarUrl = user?.avatarUrl || user?.image || null;
    this.isAdmin = false;
    this.isModerator = false;
    this.audioEnabled = true;
    this.videoEnabled = true;
    this.forcedAudioMuted = false;
    this.audioEnabledBeforeAdminMute = true;
    this.transports = [];
    this.producers = [];
    this.consumers = [];
    this.transportPromises = { send: null, recv: null };
  }
}

export default Peer;
