import Peer from "./Peer.js";
const peers = {};

export const createPeer = (
  socket,
  roomName
) => {
  peers[socket.id] = new Peer(
    socket,
    roomName
  );

  return peers[socket.id];
};

export const getPeer = (socketId) =>
  peers[socketId];

export const getPeers = () => peers;

export const deletePeer = (socketId) => {
  delete peers[socketId];
};

export const addTransportToPeer = (
  socketId,
  transportId
) => {
  peers[socketId]?.transports.push(
    transportId
  );
};

export const addProducerToPeer = (
  socketId,
  producerId
) => {
  peers[socketId]?.producers.push(
    producerId
  );
};

export const addConsumerToPeer = (
  socketId,
  consumerId
) => {
  peers[socketId]?.consumers.push(
    consumerId
  );
};