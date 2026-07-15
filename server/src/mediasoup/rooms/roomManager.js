import Room from "./room.js";
import {getWorker,getMediaCodecs,} from "../workers/workerManager.js";

const rooms = {};

export const createRoom = async (
  roomName,
  socketId
) => {
  let router;
  const room = rooms[roomName];

  if (room) {
    router = room.router;
    room.peers.push(socketId);
  } else {
    router = await getWorker().createRouter({
      mediaCodecs: getMediaCodecs(),
    });

    rooms[roomName] = new Room(
      roomName,
      router,
      socketId
    );
  }
  return router;
};

export const getRoom = (roomName) =>rooms[roomName];
export const getRooms = () => rooms;

export const removePeerFromRoom = (
  roomName,
  socketId
) => {
  if (!rooms[roomName]) return;
  rooms[roomName].peers =
    rooms[roomName].peers.filter(
      (id) => id !== socketId
    );
  if (
    rooms[roomName].peers.length === 0
  ) {
    delete rooms[roomName];
  }
};