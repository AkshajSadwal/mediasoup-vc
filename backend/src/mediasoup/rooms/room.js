class Room {
  constructor(roomName, router, socketId, adminUserId = null) {
    this.roomName = roomName;
    this.router = router;
    this.peers = [socketId];
    this.adminUserId = adminUserId || null;
    this.chatMessages = [];
  }

  addChatMessage(message) {
    this.chatMessages.push(message);
    if (this.chatMessages.length > 200) {
      this.chatMessages.splice(0, this.chatMessages.length - 200);
    }
  }
}

export default Room;