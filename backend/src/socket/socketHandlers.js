import {joinRoom,  audioState,videoState} from "./events/room.events.js";

import {createTransportHandler,transportConnect,transportRecvConnect,} from "./events/transport.events.js";

import {transportProduce,getProducersHandler,} from "./events/producer.events.js";

import {consumeHandler,consumerResume,} from "./events/consumer.events.js";

import {removeConsumers,} from "../mediasoup/consumers/consumerManager.js";

import {removeProducers,} from "../mediasoup/producers/producerManager.js";

import {removeTransports,} from "../mediasoup/transports/transportManager.js";

import {getPeer,deletePeer,} from "../mediasoup/peers/peerManager.js";

import {removePeerFromRoom,} from "../mediasoup/rooms/roomManager.js";

const registerSocketHandlers = (
  socket,
  peersNamespace
) => {
  console.log("connected:",socket.id);

  socket.emit("connection-success",
    {
      socketId: socket.id,
    }
  );

  socket.on("joinRoom",
    (data, callback) =>
      joinRoom(
        socket,
        data,
        callback
      )
  );

  socket.on("createWebRtcTransport",
    (data, callback) =>
      createTransportHandler(
        socket,
        data,
        callback
      )
  );

  socket.on("transport-connect",
    (data) =>
      transportConnect(
        socket,
        data
      )
  );

  socket.on("transport-produce",
    (data, callback) =>
      transportProduce(
        socket,
        data,
        callback
      )
  );

  socket.on("getProducers",
    (callback) =>
      getProducersHandler(
        socket,
        callback
      )
  );

  socket.on("transport-recv-connect",
    (data) =>
      transportRecvConnect(
        socket,
        data
      )
  );

  socket.on("consume",
    (data, callback) =>
      consumeHandler(
        socket,
        data,
        callback
      )
  );

  socket.on("consumer-resume",
    (data) =>
      consumerResume(
        socket,
        data
      )
  );

  socket.on("disconnect",
    () => {
      console.log("peer disconnected",socket.id);

      removeConsumers(
        socket.id
      );

      removeProducers(
        socket.id
      );

      removeTransports(
        socket.id
      );

      const peer =getPeer(socket.id);

      if (peer) {
        removePeerFromRoom(
          peer.roomName,
          socket.id
        );
        deletePeer(
          socket.id
        );
      }
    }
  );
  socket.on(
    "audio-state",
    data => audioState(socket,data)
    );


  socket.on(
    "video-state",
    data => videoState(socket,data)
  );
};

export default registerSocketHandlers;