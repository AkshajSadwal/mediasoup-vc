import { getProducers } from "../../mediasoup/producers/producerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import { addConsumer, getConsumer, removeConsumer } from "../../mediasoup/consumers/consumerManager.js";
import { getTransportById } from "../../mediasoup/transports/transportManager.js";
import { rate } from "../../live/state.js";
import { isCurrent, mountedPeer } from "./room.events.js";

export async function consumeHandler(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  rate(peer, "consume", 120);
  const { remoteProducerId, rtpCapabilities, serverConsumerTransportId, roomToken } = data;
  const source = getProducers().find((entry) => entry.producer.id === remoteProducerId &&
    entry.roomName === peer.roomName && entry.socketId !== socket.id);
  const transport = getTransportById(serverConsumerTransportId);
  const room = getRoom(peer.roomName);
  if (!source || !transport?.consumer || transport.socketId !== socket.id || transport.roomName !== peer.roomName ||
    !room?.router.canConsume({ producerId: remoteProducerId, rtpCapabilities })) throw new Error("Cannot subscribe to this source.");

  const requests = peer.consuming;
  if (!requests.has(remoteProducerId)) {
    requests.set(remoteProducerId, (async () => {
      const consumer = await transport.transport.consume({ producerId: remoteProducerId, rtpCapabilities, paused: true });
      if (!isCurrent(peer, roomToken) || source.producer.closed || transport.transport.closed) {
        consumer.close();
        throw new Error("Media source changed.");
      }
      addConsumer({ consumer, roomName: peer.roomName, socketId: socket.id });
      consumer.on("producerclose", () => socket.emit("producer-closed", { remoteProducerId, roomToken }));
      consumer.observer.once("close", () => {
        requests.delete(remoteProducerId);
        removeConsumer(consumer.id, false);
      });
      return {
        producerId: remoteProducerId, id: consumer.id, kind: consumer.kind, source: source.source,
        rtpParameters: consumer.rtpParameters, serverConsumerId: consumer.id,
      };
    })().catch((error) => {
      requests.delete(remoteProducerId);
      throw error;
    }));
  }
  callback({ params: await requests.get(remoteProducerId) });
}

export async function consumerResume(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  const record = getConsumer(data.serverConsumerId);
  if (!record || record.socketId !== socket.id || record.roomName !== peer.roomName || record.consumer.closed) {
    throw new Error("Consumer ownership required.");
  }
  await record.consumer.resume();
  callback({ ok: true });
}
