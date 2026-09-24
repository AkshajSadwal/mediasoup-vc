import {
  addTransportToPeer,
  removeTransportFromPeer,
} from "../peers/peerManager.js";

const transports = [];

export const addTransport = ({
  transport,
  roomName,
  socketId,
  consumer,
}) => {
  const transportData = {
    transport,
    roomName,
    socketId,
    consumer,
  };

  transports.push(transportData);
  addTransportToPeer(socketId, transport.id);

  transport.on("close", () => {
    removeTransportRecord(transport.id);
  });

  return transportData;
};

export const getTransport = (socketId, consumer = false) => {
  const transportData = transports.find(
    (item) =>
      item.socketId === socketId &&
      item.consumer === consumer &&
      !item.transport.closed,
  );

  return transportData?.transport;
};

export const getTransportById = (transportId) => {
  return transports.find(
    (item) =>
      item.transport.id === transportId &&
      !item.transport.closed,
  );
};

const removeTransportRecord = (transportId) => {
  const index = transports.findIndex(
    (item) => item.transport.id === transportId,
  );

  if (index === -1) return;

  const [item] = transports.splice(index, 1);
  removeTransportFromPeer(item.socketId, transportId);
};

export const removeTransportById = (transportId) => {
  const item = getTransportById(transportId);
  if (!item) return;

  item.transport.close();
  removeTransportRecord(transportId);
};

export const removeTransports = (socketId) => {
  const peerTransports = transports.filter(
    (item) => item.socketId === socketId,
  );

  for (const item of peerTransports) {
    item.transport.close();
    removeTransportRecord(item.transport.id);
  }
};

export const getTransports = () => transports;

export const closeAllTransports = () => {
  while (transports.length > 0) {
    const item = transports[0];

    try {
      if (!item.transport.closed) {
        item.transport.close();
      }
    } catch (error) {
      console.error("TRANSPORT CLOSE FAILED", item.transport.id, error);
    }

    removeTransportRecord(item.transport.id);
  }
};
