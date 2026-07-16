import { createRoom } from "../../mediasoup/rooms/roomManager.js";
import { createPeer } from "../../mediasoup/peers/peerManager.js";

export const joinRoom = async (
  socket,
  { roomName },
  callback
) => {

  try {
    const clients =await socket.in(roomName).fetchSockets();
    
    socket.join(roomName);
    socket.roomName = roomName;
    socket.audioEnabled = true;
    socket.videoEnabled = true;

    clients.forEach(client=>{
      socket.emit(
        "participant-state",
        {
          peerId: client.id,
          audioEnabled: client.audioEnabled ?? true,
          videoEnabled: client.videoEnabled ?? true
        }
      );
    });
    const router =
      await createRoom(
        roomName,
        socket.id
      );
    createPeer(
      socket,
      roomName
    );
    callback({
      rtpCapabilities:
        router.rtpCapabilities,
    });
  } catch(error){
    console.log(error);
  }
};

export const audioState = (socket,{ enabled }) => {
 socket.audioEnabled = enabled;
 socket.to(socket.roomName).emit(
  "audio-state",
  {
    peerId: socket.id,
    enabled
  }
 );
};


export const videoState = (socket, { enabled }) => {
 socket.videoEnabled = enabled;
 socket.to(socket.roomName).emit(
  "video-state",
  {
    peerId: socket.id,
    enabled
  }
 );
};