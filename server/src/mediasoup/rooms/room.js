class Room {
  constructor(roomName, router, socketId) {
    this.roomName = roomName;
    this.router = router;
    this.peers = [socketId];
  }
}

export default Room;