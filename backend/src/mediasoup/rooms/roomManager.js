import Room from "./room.js";
import {
  getWorker,
  getMediaCodecs,
} from "../workers/workerManager.js";

const rooms = {};

export const createRoom = async (roomName, socketId) => {
  const existingRoom = rooms[roomName];

  if (existingRoom) {
    if (!existingRoom.peers.includes(socketId)) {
      existingRoom.peers.push(socketId);
    }

    return existingRoom.router;
  }

  const router = await getWorker().createRouter({
    mediaCodecs: getMediaCodecs(),
  });

  rooms[roomName] = new Room(
    roomName,
    router,
    socketId,
  );

  return router;
};

export const getRoom = (roomName) => rooms[roomName];
export const getRooms = () => rooms;

export const removePeerFromRoom = (roomName, socketId) => {
  const room = rooms[roomName];
  if (!room) return;

  room.peers = room.peers.filter((id) => id !== socketId);

  if (room.peers.length === 0) {
    room.router.close();
    delete rooms[roomName];
  }
};
