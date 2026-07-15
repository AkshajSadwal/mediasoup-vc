import {addProducerToPeer,} from "../peers/peerManager.js";

const producers = [];

export const addProducer = ({
  producer,
  roomName,
  socketId,
}) => {
  producers.push({
    producer,
    roomName,
    socketId,
  });

  addProducerToPeer(
    socketId,
    producer.id
  );
};

export const getProducersByRoom = (
  roomName,
  socketId
) => {
  return producers.filter(
      (p) =>
        p.roomName === roomName &&
        p.socketId !== socketId
    ).map((p) => ({
      producerId: p.producer.id,
      peerId: p.socketId,
    }));
};

export const removeProducers = (socketId) => {
  producers.forEach((item) => {
    if (item.socketId === socketId) {
      item.producer.close();
    }
  });

  const filtered = producers.filter(
      (item) =>
        item.socketId !== socketId
    );

  producers.length = 0;
  producers.push(...filtered);
};

export const getProducers = () =>
  producers;