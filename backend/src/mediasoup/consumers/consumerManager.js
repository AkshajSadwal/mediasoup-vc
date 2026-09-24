import {
  addConsumerToPeer,
  removeConsumerFromPeer,
} from "../peers/peerManager.js";

const consumers = [];

export const addConsumer = ({
  consumer,
  roomName,
  socketId,
}) => {
  const consumerData = {
    consumer,
    roomName,
    socketId,
  };

  consumers.push(consumerData);
  addConsumerToPeer(socketId, consumer.id);

  return consumerData;
};

export const getConsumer = (consumerId) => {
  return consumers.find(
    (item) => item.consumer.id === consumerId,
  );
};

export const removeConsumer = (
  consumerId,
  closeConsumer = true,
) => {
  const index = consumers.findIndex(
    (item) => item.consumer.id === consumerId,
  );

  if (index === -1) return;

  const [item] = consumers.splice(index, 1);
  removeConsumerFromPeer(item.socketId, consumerId);

  if (closeConsumer && !item.consumer.closed) {
    item.consumer.close();
  }
};

export const removeConsumers = (socketId) => {
  const peerConsumers = consumers.filter(
    (item) => item.socketId === socketId,
  );

  for (const item of peerConsumers) {
    removeConsumer(item.consumer.id, true);
  }
};

export const getConsumers = () => consumers;
export const closeAllConsumers = () => {
  while (consumers.length > 0) {
    const item = consumers[0];
    removeConsumer(item.consumer.id, true);
  }
};

