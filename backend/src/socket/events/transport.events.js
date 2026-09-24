import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import createWebRtcTransport from "../../mediasoup/transports/webRtcTransport.js";
import {
  addTransport,
  getTransport,
  getTransportById,
} from "../../mediasoup/transports/transportManager.js";

export const createTransportHandler = async (
  socket,
  { sender },
  callback,
) => {
  try {
    const peer = getPeer(socket.id);
    if (!peer) {
      return callback({
        params: { error: "Peer has not joined a room." },
      });
    }

    // Keep one send transport and one receive transport per peer.
    const existingTransport = getTransport(
      socket.id,
      !sender,
    );

    if (existingTransport && !existingTransport.closed) {
      return callback({
        params: {
          id: existingTransport.id,
          iceParameters: existingTransport.iceParameters,
          iceCandidates: existingTransport.iceCandidates,
          dtlsParameters: existingTransport.dtlsParameters,
        },
      });
    }

    const room = getRoom(peer.roomName);
    if (!room) {
      return callback({
        params: { error: "Room no longer exists." },
      });
    }

    const transport = await createWebRtcTransport(
      room.router,
    );

    addTransport({
      transport,
      roomName: peer.roomName,
      socketId: socket.id,
      consumer: !sender,
    });

    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  } catch (error) {
    console.error("TRANSPORT CREATE FAILED", error);

    callback({
      params: {
        error: error.message,
      },
    });
  }
};

export const transportConnect = async (
  socket,
  { dtlsParameters },
  callback,
) => {
  try {
    const transport = getTransport(socket.id, false);
    if (!transport || transport.closed) {
      throw new Error("Producer transport not found.");
    }

    await transport.connect({ dtlsParameters });
    callback?.();
  } catch (error) {
    console.error("PRODUCER TRANSPORT CONNECT FAILED", error);
    callback?.(error.message);
  }
};

export const transportRecvConnect = async (
  socket,
  {
    dtlsParameters,
    serverConsumerTransportId,
  },
  callback,
) => {
  try {
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

    await transportData.transport.connect({
      dtlsParameters,
    });

    callback?.();
  } catch (error) {
    console.error("CONSUMER TRANSPORT CONNECT FAILED", error);
    callback?.(error.message);
  }
};
