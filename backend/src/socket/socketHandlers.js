import { joinRoom, disconnectPeer, mountedPeer, audioState, videoState, liveAction, liveSnapshot, readyToMove } from "./events/room.events.js";
import { createTransportHandler, restartIce, transportConnect } from "./events/transport.events.js";
import { transportProduce, producerClose, getProducersHandler } from "./events/producer.events.js";
import { consumeHandler, consumerResume } from "./events/consumer.events.js";
import { sendChatMessage } from "./events/chat.events.js";
import { adminSetAudioMuted, adminRemoveParticipant } from "./events/admin.events.js";
import { rate } from "../live/state.js";
import { rateAccount } from "../live/accountRate.js";

import { subscribeCaptions, subscribeBrowserCaptions, publishBrowserCaption } from "../live/captions.js";
import { fileSignal } from "../live/files.js";

export default function registerSocketHandlers(socket) {
  const events = {
    "caption-subscribe": async (s, data, cb) => { await subscribeCaptions(mountedPeer(s, data), data); cb({ ok: true }); },
    "browser-caption-subscribe": (s, data, cb) => { subscribeBrowserCaptions(mountedPeer(s, data), data); cb({ ok: true }); },
    "browser-caption-publish": (s, data, cb) => { publishBrowserCaption(mountedPeer(s, data), data); cb({ ok: true }); },
    joinRoom, "room-move-ready": readyToMove, "createWebRtcTransport": createTransportHandler, "restart-ice": restartIce,
    "transport-connect": (s, d, cb) => transportConnect(s, d, cb, false),
    "transport-recv-connect": (s, d, cb) => transportConnect(s, d, cb, true),
    "transport-produce": transportProduce, "producer-close": producerClose, getProducers: getProducersHandler,
    consume: consumeHandler, "consumer-resume": consumerResume,
    "audio-state": audioState, "video-state": videoState, "live-action": liveAction, "live-snapshot": liveSnapshot,
    "chat-message": sendChatMessage, "admin-mute-participant": adminSetAudioMuted, "admin-remove-participant": adminRemoveParticipant,
  };
  for (const action of ["offer", "accept", "produce", "consume", "ready", "credit", "cancel"]) {
    events["file-" + action] = (s, d, cb) => fileSignal(s, d, cb, action);
  }
  for (const [event, handler] of Object.entries(events)) {
    socket.on(event, async (data, callback) => {
      if (typeof callback !== "function") return;
      try {
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid request.");
        if (event === "joinRoom") {
          rate(socket, "join", 12);
          rateAccount(socket.user?.id, "joinRoom", 30, 60_000);
        }
        else if (event !== "file-credit") rate(mountedPeer(socket, data), "signaling", 300);
        await handler(socket, data, callback);
      } catch (error) {
        callback({ error: error.message || "Meeting request failed." });
      }
    });
  }
  socket.on("disconnect", () => disconnectPeer(socket));
}
