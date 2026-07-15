import {addTransportToPeer,} from "../peers/peerManager.js";

const transports = [];

export const addTransport = ({
  transport,
  roomName,
  socketId,
  consumer,
}) => {
  transports.push({
    transport,
    roomName,
    socketId,
    consumer,
  });

  addTransportToPeer(
    socketId,
    transport.id
  );
};

export const getTransport = (
  socketId,
  consumer = false
) => {
  const transportData =transports.find(
      (t) =>
        t.socketId === socketId &&
        t.consumer === consumer
    );
  return transportData?.transport;
};

export const getTransportById = (transportId) => {
  return transports.find(
    (t) =>
      t.transport.id === transportId
  );
};

export const removeTransports = (socketId) => {
  transports.forEach((item) => {
    if (item.socketId === socketId) {
      item.transport.close();
    }
  });

  const filtered =transports.filter(
      (item) =>
        item.socketId !== socketId
    );

  transports.length = 0;
  transports.push(...filtered);
};

export const removeTransportById = (transportId) => {
  const filtered =
    transports.filter(
      (t) =>
        t.transport.id !== transportId
    );

  transports.length = 0;
  transports.push(...filtered);
};

export const getTransports = () =>
  transports;