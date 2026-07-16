import {addConsumerToPeer} from "../peers/peerManager.js";

const consumers = [];

export const addConsumer = ({
  consumer,
  roomName,
  socketId,
}) => {
  consumers.push({
    consumer,
    roomName,
    socketId,
  });

  addConsumerToPeer(
    socketId,
    consumer.id
  );
};

export const getConsumer = (consumerId) => {
  return consumers.find((c) =>
      c.consumer.id === consumerId
  );
};

export const removeConsumer = (consumerId) => {
  const filtered = consumers.filter((c) =>
        c.consumer.id !== consumerId
    );

  consumers.length = 0;
  consumers.push(...filtered);
};

export const removeConsumers = (socketId) => {
  consumers.forEach((item) => {
    if (item.socketId === socketId) {
      item.consumer.close();
    }
  });

  const filtered =consumers.filter((item) =>
        item.socketId !== socketId
    );

  consumers.length = 0;
  consumers.push(...filtered);
};

export const getConsumers = () =>consumers;