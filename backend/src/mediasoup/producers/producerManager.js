import {
  addProducerToPeer,
  removeProducerFromPeer,
} from "../peers/peerManager.js";

const producers = [];

export const addProducer = ({
  producer,
  roomName,
  socketId,
}) => {
  const producerData = {
    producer,
    roomName,
    socketId,
  };

  producers.push(producerData);
  addProducerToPeer(socketId, producer.id);

  producer.on("transportclose", () => {
    removeProducer(producer.id, false);
  });

  producer.on("close", () => {
    removeProducer(producer.id, false);
  });

  return producerData;
};

export const getProducersByRoom = (roomName, socketId) => {
  return producers
    .filter(
      (producerData) =>
        producerData.roomName === roomName &&
        producerData.socketId !== socketId,
    )
    .map((producerData) => ({
      producerId: producerData.producer.id,
      peerId: producerData.socketId,
    }));
};

export const removeProducer = (producerId, closeProducer = true) => {
  const index = producers.findIndex(
    (item) => item.producer.id === producerId,
  );

  if (index === -1) return;

  const [item] = producers.splice(index, 1);
  removeProducerFromPeer(item.socketId, producerId);

  if (closeProducer && !item.producer.closed) {
    item.producer.close();
  }
};

export const removeProducers = (socketId) => {
  const peerProducers = producers.filter(
    (item) => item.socketId === socketId,
  );

  for (const item of peerProducers) {
    removeProducer(item.producer.id, true);
  }
};


export const getProducersByPeer = (socketId, kind = null) =>
  producers.filter(
    (item) => item.socketId === socketId && (!kind || item.producer.kind === kind),
  );

export const getProducers = () => producers;
export const closeAllProducers = () => {
  while (producers.length > 0) {
    const item = producers[0];
    removeProducer(item.producer.id, true);
  }
};

