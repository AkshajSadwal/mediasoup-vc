import { Device } from "mediasoup-client";

const cameraOptions = {
  encodings: [
    { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" },
    { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" },
    { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" },
  ],
  codecOptions: { videoGoogleStartBitrate: 1000 },
};

export function request(socket, event, payload, timeout = 8000) {
  if (!socket?.connected) return Promise.reject(new Error("The meeting is disconnected."));
  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(event, payload, (error, result) => {
      if (error || result?.error || result?.params?.error) {
        reject(new Error(result?.error || result?.params?.error || "The meeting did not respond."));
      } else resolve(result);
    });
  });
}

export class RoomMedia {
  constructor(socket, token, update) {
    this.socket = socket;
    this.token = token;
    this.update = update;
    this.device = new Device();
    this.producers = new Map();
    this.consumers = new Map();
    this.pending = new Set();
    this.closedProducers = new Set();
  }

  mergeSnapshot(data) {
    if (this.live?.version > data.version) return this.live;
    const { boardDelta, ...fields } = data;
    let board = fields.board ?? this.live?.board ?? [];
    if (fields.board === undefined && fields.boardRevision !== this.live?.boardRevision) {
      if (!boardDelta || fields.boardRevision !== (this.live?.boardRevision ?? 0) + 1) return null;
      if (boardDelta.clear) board = [];
      else {
        const operation = boardDelta.operation;
        board = board.some(({ id }) => id === operation.id)
          ? board.map((entry) => entry.id === operation.id ? operation : entry)
          : [...board, operation];
      }
    }
    this.live = { ...fields, board, clockOffset: fields.serverNow ? fields.serverNow - Date.now() : 0 };
    return this.live;
  }

  attachRecorder(onLeaving, onRevoked) {
    this.recording = { onLeaving, onRevoked };
    return () => { this.recording = null; };
  }

  ask(event, data) {
    if (this.closed) return Promise.reject(new Error("The room connection changed."));
    return request(this.socket, event, { ...data, roomToken: this.token },
      event === "caption-subscribe" && data?.enabled ? 32_000 : 8000);
  }

  async load(rtpCapabilities) {
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    const [send, receive] = await Promise.all([this.transport(true), this.transport(false)]);
    this.send = send;
    this.receive = receive;
    return (await this.ask("getProducers")).producers;
  }

  async transport(sender) {
    const { params } = await this.ask("createWebRtcTransport", { sender });
    if (this.closed) throw new Error("The room connection changed.");
    const transport = sender ? this.device.createSendTransport(params) : this.device.createRecvTransport(params);
    if (sender) this.send = transport;
    else this.receive = transport;
    let timer;
    let attempts = 0;
    let restarting = false;
    const check = (delay = 4500) => {
      clearTimeout(timer);
      if (this.closed || transport.closed || transport.connectionState === "connected" || attempts >= 2) return;
      timer = setTimeout(async () => {
        if (this.closed || transport.closed || transport.connectionState === "connected" || restarting) return;
        restarting = true;
        attempts++;
        try {
          const { iceParameters } = await this.ask("restart-ice", { transportId: transport.id });
          if (!this.closed && !transport.closed) await transport.restartIce({ iceParameters });
        } catch (error) {
          if (!this.closed) console.warn("Media ICE restart failed", error.message);
        } finally {
          restarting = false;
          check();
        }
      }, delay);
    };
    transport.on("connectionstatechange", (state) => {
      if (state === "connected") { attempts = 0; clearTimeout(timer); }
      else if (state !== "closed") check(state === "failed" ? 0 : undefined);
    });
    transport.observer.once("close", () => clearTimeout(timer));
    transport.on("connect", ({ dtlsParameters }, done, fail) => {
      this.ask(sender ? "transport-connect" : "transport-recv-connect", { transportId: params.id, dtlsParameters })
        .then(() => { done(); check(); }, fail);
    });
    if (sender) {
      transport.on("produce", ({ kind, rtpParameters, appData }, done, fail) => {
        this.ask("transport-produce", { transportId: params.id, kind, rtpParameters, source: appData.source })
          .then(done, fail);
      });
      transport.on("producedata", (data, done, fail) => {
        this.ask("file-produce", { transportId: params.id, transferId: data.appData.transferId,
          sctpStreamParameters: data.sctpStreamParameters }).then(done, fail);
      });
    }
    return transport;
  }

  async produce(source, track) {
    if (!track || this.closed || !this.send) return;
    const producer = await this.send.produce({
      ...(source === "camera" ? cameraOptions : {}),
      track, stopTracks: false, disableTrackOnPause: false, appData: { source },
    });
    if (this.closed) return producer.close();
    this.producers.set(source, producer);
    return producer;
  }

  async stopSource(source) {
    const producer = this.producers.get(source);
    if (!producer) return;
    this.producers.delete(source);
    producer.close();
    await this.ask("producer-close", { producerId: producer.id });
  }

  async subscribe({ producerId, peerId, source }) {
    if (this.closed || !this.receive || this.pending.has(producerId) || this.consumers.has(producerId) || this.closedProducers.has(producerId)) return;
    this.pending.add(producerId);
    try {
      const { params } = await this.ask("consume", {
        remoteProducerId: producerId, rtpCapabilities: this.device.rtpCapabilities,
        serverConsumerTransportId: this.receive.id,
      });
      if (this.closed || this.closedProducers.has(producerId)) return;
      const consumer = await this.receive.consume(params);
      if (this.closed || this.closedProducers.has(producerId)) return consumer.close();
      this.consumers.set(producerId, { consumer, peerId, source: params.source || source,
        producerId, stream: new MediaStream([consumer.track]) });
      await this.ask("consumer-resume", { serverConsumerId: params.serverConsumerId });
      if (!this.closed) this.update([...this.consumers.values()]);
    } catch (error) {
      this.remove(producerId);
      if (!this.closed) console.warn("Media subscription failed", error.message);
    } finally {
      this.pending.delete(producerId);
    }
  }

  remove(producerId) {
    this.closedProducers.add(producerId);
    if (this.closedProducers.size > 256) this.closedProducers.delete(this.closedProducers.values().next().value);
    this.consumers.get(producerId)?.consumer.close();
    this.consumers.delete(producerId);
    if (!this.closed) this.update([...this.consumers.values()]);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.send?.close();
    this.receive?.close();
    this.consumers.clear();
    this.producers.clear();
    this.pending.clear();
    this.closedProducers.clear();
  }
}
