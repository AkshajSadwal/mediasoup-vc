import { getPeer } from "../../mediasoup/peers/peerManager.js";

import {addProducer,getProducersByRoom,} from "../../mediasoup/producers/producerManager.js";

import {getTransport,} from "../../mediasoup/transports/transportManager.js";

export const transportProduce =async (
    socket,
    {
      kind,
      rtpParameters,
    },
    callback) => {
    const transport =
      getTransport(
        socket.id,
        false
      );

    const producer =
      await transport.produce({
        kind,
        rtpParameters,
      });

    const roomName =
      getPeer(socket.id).roomName;

    addProducer({
      producer,
      roomName,
      socketId: socket.id,
    });

    producer.on("transportclose",() => {
        producer.close();
      }
    );

    socket.to(roomName).emit("new-producer",
        {
          producerId:
            producer.id,
          peerId:
            socket.id,
        }
      );

    callback({
      id: producer.id,
    });
  };

export const getProducersHandler =
  (socket, callback) => {
    const roomName =getPeer(socket.id).roomName;

    const producerList =getProducersByRoom(
        roomName,
        socket.id
      );

    callback(producerList);
  };