import { getPeer } from "../../mediasoup/peers/peerManager.js";
import { publish, syncAudio } from "../../live/controller.js";
import { role, setMute } from "../../live/state.js";
import { mountedPeer } from "./room.events.js";

function authorizedTarget(socket, data) {
  const actor = mountedPeer(socket, data);
  const target = getPeer(data.targetPeerId);
  if (!target?.ready || target.meeting !== actor.meeting || target === actor ||
    role(actor) === "participant" || role(target) === "host" ||
    (role(actor) === "moderator" && (target.roomName !== actor.roomName || role(target) === "moderator"))) {
    throw new Error("You cannot moderate this participant.");
  }
  return { actor, target };
}

export function adminSetAudioMuted(socket, data, callback) {
  const { actor, target } = authorizedTarget(socket, data);
  if (typeof data.muted !== "boolean") throw new Error("Invalid microphone state.");
  setMute(actor, target.member, data.muted);
  syncAudio(target);
  publish(actor.meeting);
  callback({ ok: true });
}

export function adminRemoveParticipant(socket, data, callback) {
  const { target } = authorizedTarget(socket, data);
  target.socket.emit("admin-removed", { reason: "You were removed from the meeting." });
  callback({ ok: true });
  target.socket.disconnect(true);
}
