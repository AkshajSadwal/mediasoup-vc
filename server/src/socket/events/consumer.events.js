import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";

import {addConsumer,getConsumer,removeConsumer,} from "../../mediasoup/consumers/consumerManager.js";

import {getTransportById,removeTransportById,} from "../../mediasoup/transports/transportManager.js";

export const consumeHandler =
  async (
    socket,
    {
      rtpCapabilities,
      remoteProducerId,
      serverConsumerTransportId,
    },
    callback
  ) => {
    try {
      const roomName =getPeer(socket.id).roomName;

      const router =getRoom(roomName).router;

      if (
        !router.canConsume({
          producerId:remoteProducerId,
          rtpCapabilities,
        })
      ) {
        return;
      }
      const transportData = getTransportById(
          serverConsumerTransportId
        );

      const consumer = await transportData.transport.consume(
          {
            producerId:remoteProducerId,
            rtpCapabilities,
            paused: true,
          }
        );

      addConsumer({
        consumer,
        roomName,
        socketId: socket.id,
      });

      consumer.on("transportclose",() => {
          console.log("consumer transport closed");
        }
      );

      consumer.on("producerclose",() => {
          socket.emit("producer-closed",
            {
              remoteProducerId,
            }
          );
          consumer.close();
          removeConsumer(consumer.id);
          removeTransportById(transportData.transport.id
          );
        }
      );

      callback({
        params: {
          producerId:remoteProducerId,
          id: consumer.id,
          kind: consumer.kind,
          rtpParameters:consumer.rtpParameters,
          serverConsumerId:consumer.id,
        },
      });
    } catch (error) {
      console.error("CONSUME FAILED",error);

      callback({
        params: {
          error: error.message,
        },
      });
    }
  };

export const consumerResume =async (socket,{ serverConsumerId }) => {
    const consumerData =getConsumer(serverConsumerId);
    await consumerData.consumer.resume();
  };