import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import createWebRtcTransport from "../../mediasoup/transports/webRtcTransport.js";
import { addTransport, getTransportById } from "../../mediasoup/transports/transportManager.js";
import { isCurrent, mountedPeer } from "./room.events.js";
import { rate } from "../../live/state.js";

export async function createTransportHandler(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  if (typeof data.sender !== "boolean") throw new Error("Invalid transport direction.");
  const type = data.sender ? "send" : "recv";
  const promises = peer.transportPromises;
  if (!promises[type]) {
    const { roomName, roomToken } = peer;
    promises[type] = (async () => {
      const transport = await createWebRtcTransport(getRoom(roomName).router);
      if (!isCurrent(peer, roomToken)) {
        transport.close();
        throw new Error("The room connection has changed.");
      }
      addTransport({ transport, roomName, socketId: socket.id, consumer: !data.sender });
      transport.observer.once("close", () => { promises[type] = null; });
      return transport;
    })().catch((error) => { promises[type] = null; throw error; });
  }
  const { id, iceParameters, iceCandidates, dtlsParameters, sctpParameters } = await promises[type];
  callback({ params: { id, iceParameters, iceCandidates, dtlsParameters, sctpParameters } });
}

export async function transportConnect(socket, data, callback, consumer) {
  const peer = mountedPeer(socket, data);
  const record = getTransportById(data.transportId);
  if (!record || record.socketId !== socket.id || record.roomName !== peer.roomName || record.consumer !== consumer) {
    throw new Error("Transport ownership required.");
  }
  record.connecting ??= record.transport.connect({ dtlsParameters: data.dtlsParameters }).catch((error) => {
    record.connecting = null;
    throw error;
  });
  await record.connecting;
  callback({ ok: true });
}

export async function restartIce(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  rate(peer, "restart-ice", 6, 60_000);
  const record = getTransportById(data.transportId);
  if (!record || record.socketId !== socket.id || record.roomName !== peer.roomName || record.transport.closed) {
    throw new Error("Transport ownership required.");
  }
  const iceParameters = await record.transport.restartIce();
  if (!isCurrent(peer, data.roomToken)) throw new Error("The room connection has changed.");
  callback({ iceParameters });
}
