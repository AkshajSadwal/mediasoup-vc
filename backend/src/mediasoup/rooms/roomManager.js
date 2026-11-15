import { getProducers } from "../producers/producerManager.js";
import { getPeer } from "../peers/peerManager.js";
import Room from "./room.js";
import {
  getWorker,
  getMediaCodecs,
} from "../workers/workerManager.js";

const rooms = Object.create(null);
const roomCreationPromises = new Map();

export const createRoom = async (roomName, socketId, adminUserId = null) => {
  const existingRoom = rooms[roomName];

  if (existingRoom) {
    if (!existingRoom.peers.includes(socketId)) {
      existingRoom.peers.push(socketId);
    }

    return existingRoom.router;
  }

  // Only one router may be created for a brand-new room at a time.
  let creationPromise = roomCreationPromises.get(roomName);

  if (!creationPromise) {
    creationPromise = (async () => {
      const router = await getWorker().createRouter({
        mediaCodecs: getMediaCodecs(),
      });

      const room = new Room(
        roomName,
        router,
        socketId,
        adminUserId,
      );

      const observer = await router.createAudioLevelObserver({ maxEntries: 1, threshold: -58, interval: 580 }).catch(() => null);
      room.audioObserver = observer;
      let namespace;
      let changedAt = 0;
      let silenceTimer;
      const speaker = (userId) => {
        if (room.speaker === userId) return;
        room.speaker = userId;
        changedAt = Date.now();
        namespace?.to(roomName).emit("active-speaker", { userId });
      };
      observer?.on("volumes", ([entry]) => {
        const source = getProducers().find(({ producer }) => entry?.producer === producer);
        const peer = source && getPeer(source.socketId);
        if (peer?.ready && peer.roomName === roomName) {
          clearTimeout(silenceTimer);
          namespace = peer.socket.nsp;
          if (!room.speaker || Date.now() - changedAt >= 2000) speaker(peer.userId);
        }
      });
      observer?.on("silence", () => {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => speaker(null), 2000);
        silenceTimer.unref();
      });
      router.observer.once("close", () => clearTimeout(silenceTimer));
      rooms[roomName] = room;
      return room;
    })();

    roomCreationPromises.set(roomName, creationPromise);
  }

  try {
    const room = await creationPromise;

    if (!room.peers.includes(socketId)) {
      room.peers.push(socketId);
    }

    return room.router;
  } finally {
    if (roomCreationPromises.get(roomName) === creationPromise) {
      roomCreationPromises.delete(roomName);
    }
  }
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

export const closeAllRooms = () => {
  for (const roomName of Object.keys(rooms)) {
    const room = rooms[roomName];

    try {
      if (!room.router.closed) {
        room.router.close();
      }
    } catch (error) {
      console.error("ROOM ROUTER CLOSE FAILED", roomName, error);
    }

    delete rooms[roomName];
  }

  roomCreationPromises.clear();
};
