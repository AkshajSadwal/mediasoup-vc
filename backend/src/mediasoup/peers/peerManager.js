import Peer from "./Peer.js";

const peers = {};

export const createPeer = (socket, roomName, user = null) => {
  if (peers[socket.id]) {
    return peers[socket.id];
  }

  peers[socket.id] = new Peer(socket, roomName, user);
  return peers[socket.id];
};

export const getPeer = (socketId) => peers[socketId];

export const getPeers = () => peers;

export const deletePeer = (socketId) => {
  delete peers[socketId];
};

export const addTransportToPeer = (socketId, transportId) => {
  const peer = peers[socketId];
  if (!peer || peer.transports.includes(transportId)) return;
  peer.transports.push(transportId);
};

export const removeTransportFromPeer = (socketId, transportId) => {
  const peer = peers[socketId];
  if (!peer) return;

  peer.transports = peer.transports.filter(
    (id) => id !== transportId,
  );
};

export const addProducerToPeer = (socketId, producerId) => {
  const peer = peers[socketId];
  if (!peer || peer.producers.includes(producerId)) return;
  peer.producers.push(producerId);
};

export const removeProducerFromPeer = (socketId, producerId) => {
  const peer = peers[socketId];
  if (!peer) return;

  peer.producers = peer.producers.filter(
    (id) => id !== producerId,
  );
};

export const addConsumerToPeer = (socketId, consumerId) => {
  const peer = peers[socketId];
  if (!peer || peer.consumers.includes(consumerId)) return;
  peer.consumers.push(consumerId);
};

export const removeConsumerFromPeer = (socketId, consumerId) => {
  const peer = peers[socketId];
  if (!peer) return;

  peer.consumers = peer.consumers.filter(
    (id) => id !== consumerId,
  );
};
