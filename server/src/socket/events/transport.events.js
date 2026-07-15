import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";

import createWebRtcTransport from "../../mediasoup/transports/webRtcTransport.js";

import {addTransport,getTransport,getTransportById,} from "../../mediasoup/transports/transportManager.js";

export const createTransportHandler =async (
    socket,
    { sender },
    callback
  ) => {
    try {
      const roomName =getPeer(socket.id).roomName;

      const router =getRoom(roomName).router;

      const transport =await createWebRtcTransport(
          router
        );

      console.log("TRANSPORT CREATED:",transport.id,
        "sender:",sender,
        "socket:",socket.id
      );

      addTransport({
        transport,
        roomName,
        socketId: socket.id,
        consumer: !sender,
      });

      callback({
        params: {
          id: transport.id,
          iceParameters:transport.iceParameters,
          iceCandidates:transport.iceCandidates,
          dtlsParameters:transport.dtlsParameters,
        },
      });
    } catch (error) {
      console.error("TRANSPORT CREATE FAILED",error );

      callback({
        params: {
          error: error.message,
        },
      });
    }
  };

export const transportConnect =async (
    socket,
    { dtlsParameters }
  ) => {
    const transport =
      getTransport(
        socket.id,
        false
      );

    await transport.connect({
      dtlsParameters,
    });
  };

export const transportRecvConnect =async (
    socket,
    {
      dtlsParameters,
      serverConsumerTransportId,
    }
  ) => {
    const transportData =
      getTransportById(
        serverConsumerTransportId
      );

    await transportData.transport.connect(
      {
        dtlsParameters,
      }
    );
  };