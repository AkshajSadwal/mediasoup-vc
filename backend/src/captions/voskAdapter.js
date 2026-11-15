import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./vosk_worker.py", import.meta.url));
const unavailable = () => new Error("Captions unavailable");

export class VoskAdapter {
  constructor() {
    this.listeners = new Map();
  }

  async ready() {
    if (this.child) return this.child.ready;
    if (!process.env.CAPTIONS_MODEL_PATH) throw unavailable();
    const limit = Math.min(30, Math.max(10, Number(process.env.CAPTIONS_MAX_SPEAKERS) || 10));
    const child = spawn(process.env.CAPTIONS_PYTHON || "python", ["-u", script, process.env.CAPTIONS_MODEL_PATH, String(limit)], {
      stdio: ["pipe", "pipe", "ignore"], windowsHide: true,
    });
    this.child = child;
    const fail = () => {
      if (this.child !== child) return;
      this.child = null;
      clearTimeout(child.timer);
      child.kill();
      child.rejectReady(unavailable());
      const listeners = [...this.listeners.values()];
      this.listeners.clear();
      for (const entry of listeners) entry.update({ type: "error" });
    };
    child.ready = new Promise((resolve, reject) => {
      child.rejectReady = reject;
      let pending = "";
      child.timer = setTimeout(fail, 30_000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        if (this.child !== child) return;
        pending += chunk;
        if (pending.length > 64 * 1024) return fail();
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          let result;
          try { result = JSON.parse(line); } catch { return fail(); }
          if (result.type === "ready") {
            clearTimeout(child.timer);
            resolve();
          } else if (result.type === "unavailable") {
            return fail();
          } else {
            const entry = this.listeners.get(result.id);
            if (!entry) continue;
            if (result.type === "credit") entry.pending = Math.max(0, entry.pending - 1);
            else entry.update(result);
          }
        }
      });
      child.once("error", fail);
      child.once("exit", fail);
      child.stdin.on("error", fail);
    });
    return child.ready;
  }

  send(message) {
    const pipe = this.child?.stdin;
    if (!pipe || pipe.destroyed || pipe.writableLength > 64 * 1024) return false;
    pipe.write(JSON.stringify(message) + "\n");
    return true;
  }

  start(id, channels, update) {
    if (!this.send({ type: "start", id, channels })) throw unavailable();
    this.listeners.set(id, { pending: 0, update });
    return {
      packet: (packet) => {
        const entry = this.listeners.get(id);
        if (!entry || entry.pending >= 12 ||
            !this.send({ type: "audio", id, packet: packet.toString("base64") })) return false;
        entry.pending++;
        return true;
      },
      close: () => {
        if (this.listeners.delete(id) && !this.send({ type: "stop", id })) this.child?.kill();
      },
    };
  }

  idle() {
    if (this.listeners.size || !this.child) return;
    const child = this.child;
    this.child = null;
    clearTimeout(child.timer);
    child.kill();
  }
}

export function opusPayload(packet, payloadType) {
  if (packet.length < 13 || packet[0] >> 6 !== 2 || (packet[1] & 0x7f) !== payloadType) return null;
  let start = 12 + 4 * (packet[0] & 15);
  if (packet[0] & 16) {
    if (start + 4 > packet.length) return null;
    start += 4 + packet.readUInt16BE(start + 2) * 4;
  }
  const padding = packet[0] & 32 ? packet.at(-1) : 0;
  const end = packet.length - padding;
  return end > start && end - start <= 1275 ? packet.subarray(start, end) : null;
}
