import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import createWebRtcTransport from "../../mediasoup/transports/webRtcTransport.js";
import {
  addTransport,
  getTransport,
  getTransportById,
} from "../../mediasoup/transports/transportManager.js";

const toTransportParams = (transport) => ({
  id: transport.id,
  iceParameters: transport.iceParameters,
  iceCandidates: transport.iceCandidates,
  dtlsParameters: transport.dtlsParameters,
});

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

    const transportType = sender ? "send" : "recv";
    const existingTransport = getTransport(
      socket.id,
      !sender,
    );

    if (existingTransport && !existingTransport.closed) {
      return callback({
        params: toTransportParams(existingTransport),
      });
    }

    // If another request is already creating this direction's transport,
    // wait for it instead of creating a duplicate.
    if (peer.transportPromises[transportType]) {
      const transport = await peer.transportPromises[transportType];
      return callback({
        params: toTransportParams(transport),
      });
    }

    const room = getRoom(peer.roomName);
    if (!room) {
      return callback({
        params: { error: "Room no longer exists." },
      });
    }

    const creationPromise = (async () => {
      const transport = await createWebRtcTransport(
        room.router,
      );

      addTransport({
        transport,
        roomName: peer.roomName,
        socketId: socket.id,
        consumer: !sender,
      });

      return transport;
    })();

    peer.transportPromises[transportType] = creationPromise;

    try {
      const transport = await creationPromise;
      callback({
        params: toTransportParams(transport),
      });
    } finally {
      if (peer.transportPromises[transportType] === creationPromise) {
        peer.transportPromises[transportType] = null;
      }
    }
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
