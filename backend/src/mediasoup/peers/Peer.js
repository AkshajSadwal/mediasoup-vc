class Peer {
  constructor(socket, roomName) {
    this.socket = socket;
    this.roomName = roomName;

    this.transports = [];
    this.producers = [];
    this.consumers = [];
  }
}

export default Peer;