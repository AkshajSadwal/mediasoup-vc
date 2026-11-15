import { addProducer, getProducers, getProducersByPeer, getProducersByRoom, removeProducer } from "../../mediasoup/producers/producerManager.js";
import { getRoom } from "../../mediasoup/rooms/roomManager.js";
import { getTransportById } from "../../mediasoup/transports/transportManager.js";
import { SOURCE_KINDS, allowed, audioAllowed, liveRoom, rate, videoAllowed } from "../../live/state.js";
import { reconcileCaptions } from "../../live/captions.js";
import { publish, syncAudio, syncVideo } from "../../live/controller.js";
import { isCurrent, mountedPeer } from "./room.events.js";

export async function transportProduce(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  rate(peer, "produce", 20);
  const { source, kind, rtpParameters, transportId, roomToken } = data;
  if (SOURCE_KINDS.get(source) !== kind || !SOURCE_KINDS.has(source)) throw new Error("Invalid media source.");
  const transport = getTransportById(transportId);
  if (!transport || transport.socketId !== socket.id || transport.consumer || transport.roomName !== peer.roomName) {
    throw new Error("Producer transport not found.");
  }
  if (peer.producing.has(source) || getProducersByPeer(socket.id).some((entry) => entry.source === source)) {
    throw new Error("This source already exists.");
  }
  const permitted = () => source === "camera" ? videoAllowed(peer) :
    source === "microphone" ? allowed(peer, "microphone") : allowed(peer, "screen");
  if (!permitted()) throw new Error("The host has restricted this media source or it is off.");
  const room = liveRoom(peer.meeting, peer.activeRoomId);
  const reservation = {};
  if (source === "screen-video") {
    if (room.presenter) throw new Error("Someone is already presenting in this room.");
    room.presenter = peer.member;
    room.presentation = reservation;
  }
  if (source === "screen-audio" && (room.presenter !== peer.member || !audioAllowed(peer, source) ||
    !getProducersByPeer(socket.id).some((entry) => entry.source === "screen-video"))) {
    throw new Error("Screen audio is unavailable while speaking is restricted or without an active presentation.");
  }
  const pending = peer.producing;
  const presentation = room.presentation;
  pending.set(source, reservation);
  let producer;
  try {
    producer = await transport.transport.produce({ kind, rtpParameters, paused: true, appData: { source } });
    if (!isCurrent(peer, roomToken) || transport.transport.closed || !permitted() ||
      (source.startsWith("screen-") && (room.presenter !== peer.member || room.presentation !== presentation))) {
      throw new Error("Media source was cancelled.");
    }
    const record = addProducer({ producer, roomName: peer.roomName, socketId: socket.id, source });
    producer.observer.once("close", () => {
      removeProducer(producer.id, false);
      if (source === "microphone") reconcileCaptions(peer.meeting, record.roomName);
      if (source === "screen-video" && room.presentation === reservation) {
        room.presenter = null;
        for (const item of getProducersByPeer(socket.id)) if (item.source === "screen-audio") removeProducer(item.producer.id);
        if (isCurrent(peer, roomToken)) publish(peer.meeting);
      }
    });
    if (kind === "audio") syncAudio(peer);
    else if (source === "camera") syncVideo(peer);
    else await producer.resume();
    if (!isCurrent(peer, roomToken) || producer.closed) throw new Error("Media source was cancelled.");
    if (source === "microphone") {
      void getRoom(peer.roomName)?.audioObserver?.addProducer({ producerId: producer.id }).catch(() => undefined);
    }
    socket.to(record.roomName).emit("new-producer", { producerId: producer.id, peerId: socket.id, source });
    if (source === "screen-video") publish(peer.meeting);
    callback({ id: producer.id });
  } catch (error) {
    producer?.close();
    if (source === "screen-video" && room.presentation === reservation) room.presenter = null;
    throw error;
  } finally {
    pending.delete(source);
  }
}

export function producerClose(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  const record = getProducers().find((entry) => entry.producer.id === data.producerId);
  if (record && (record.socketId !== socket.id || record.roomName !== peer.roomName)) throw new Error("Producer ownership required.");
  if (record) removeProducer(record.producer.id);
  callback({ ok: true });
}

export function getProducersHandler(socket, data, callback) {
  const peer = mountedPeer(socket, data);
  callback({ producers: getProducersByRoom(peer.roomName, socket.id) });
}
