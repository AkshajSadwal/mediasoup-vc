import { getPeer } from "../../mediasoup/peers/peerManager.js";
import {
  addProducer,
  getProducersByRoom,
} from "../../mediasoup/producers/producerManager.js";
import { getTransport } from "../../mediasoup/transports/transportManager.js";

export const transportProduce = async (
  socket,
  { kind, rtpParameters },
  callback,
) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer) {
      throw new Error("Peer has not joined a room.");
    }

    const transport = getTransport(socket.id, false);
    if (!transport || transport.closed) {
      throw new Error("Producer transport not found.");
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    addProducer({
      producer,
      roomName: peer.roomName,
      socketId: socket.id,
    });

    socket.to(peer.roomName).emit("new-producer", {
      producerId: producer.id,
      peerId: socket.id,
    });

    callback({
      id: producer.id,
    });
  } catch (error) {
    console.error("PRODUCE FAILED", error);
    callback({
      error: error.message,
    });
  }
};

export const getProducersHandler = (socket, callback) => {
  const peer = getPeer(socket.id);
  if (!peer) {
    return callback([]);
  }

  callback(
    getProducersByRoom(peer.roomName, socket.id),
  );
};
