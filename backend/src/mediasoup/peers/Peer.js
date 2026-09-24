class Peer {
  constructor(socket, roomName) {
    this.socket = socket;
    this.roomName = roomName;

    // Participant state lives with the peer, while media resources remain
    // separate. This keeps participant presence independent from media tracks.
    this.audioEnabled = true;
    this.videoEnabled = true;

    this.transports = [];
    this.producers = [];
    this.consumers = [];

    // Prevent concurrent requests from creating duplicate transports.
    this.transportPromises = {
      send: null,
      recv: null,
    };
  }
}

export default Peer;
