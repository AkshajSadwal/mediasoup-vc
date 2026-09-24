import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import {
  addConsumer,
  getConsumer,
  removeConsumer,
} from "../../mediasoup/consumers/consumerManager.js";
import { getTransportById } from "../../mediasoup/transports/transportManager.js";

export const consumeHandler = async (
  socket,
  {
    rtpCapabilities,
    remoteProducerId,
    serverConsumerTransportId,
  },
  callback,
) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer) {
      throw new Error("Peer has not joined a room.");
    }

    const room = getRoom(peer.roomName);
    if (!room) {
      throw new Error("Room no longer exists.");
    }

    if (
      !room.router.canConsume({
        producerId: remoteProducerId,
        rtpCapabilities,
      })
    ) {
      throw new Error(
        "Client cannot consume this producer.",
      );
    }

    const transportData = getTransportById(
      serverConsumerTransportId,
    );

    if (
      !transportData ||
      transportData.socketId !== socket.id ||
      !transportData.consumer ||
      transportData.transport.closed
    ) {
      throw new Error("Consumer transport not found.");
    }

    const consumer = await transportData.transport.consume({
      producerId: remoteProducerId,
      rtpCapabilities,
      paused: true,
    });

    addConsumer({
      consumer,
      roomName: peer.roomName,
      socketId: socket.id,
    });

    consumer.on("transportclose", () => {
      removeConsumer(consumer.id, false);
    });

    consumer.on("producerclose", () => {
      socket.emit("producer-closed", {
        remoteProducerId,
      });

      removeConsumer(consumer.id, false);
    });

    consumer.on("close", () => {
      removeConsumer(consumer.id, false);
    });

    callback({
      params: {
        producerId: remoteProducerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        serverConsumerId: consumer.id,
      },
    });
  } catch (error) {
    console.error("CONSUME FAILED", error);

    callback({
      params: {
        error: error.message,
      },
    });
  }
};

export const consumerResume = async (
  socket,
  { serverConsumerId },
) => {
  try {
    const consumerData = getConsumer(serverConsumerId);

    if (
      !consumerData ||
      consumerData.socketId !== socket.id ||
      consumerData.consumer.closed
    ) {
      return;
    }

    await consumerData.consumer.resume();
  } catch (error) {
    console.error("CONSUMER RESUME FAILED", error);
  }
};
