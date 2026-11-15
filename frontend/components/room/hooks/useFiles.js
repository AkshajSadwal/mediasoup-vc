import { useEffect, useRef, useState } from "react";

const LIMIT = 100_000_000;
const CHUNK = 16_384;
const WINDOW = CHUNK * 8;
const HEADER = 36;

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function packetFor(file, offset) {
  const bytes = await file.slice(offset, offset + CHUNK).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const packet = new Uint8Array(HEADER + bytes.byteLength);
  new DataView(packet.buffer).setUint32(0, offset);
  packet.set(new Uint8Array(hash), 4);
  packet.set(new Uint8Array(bytes), HEADER);
  return packet;
}

export function useFiles(media, notify) {
  const transfer = useRef(null);
  const retry = useRef(null);
  const generation = useRef(null);
  const [state, setState] = useState(null);
  const [download, setDownload] = useState(null);

  useEffect(() => {
    if (!media) return;
    const context = {};
    generation.current = context;
    const current = (entry) => generation.current === context && transfer.current === entry;
    const signal = (action, id, data) => media.ask("file-" + action, { transferId: id, ...data });
    const close = (entry) => {
      if (transfer.current === entry) transfer.current = null;
      entry?.channel?.close();
      if (entry) entry.parts = [];
    };
    const fail = (entry, error) => {
      if (!current(entry)) return;
      if (entry.id) void signal("cancel", entry.id).catch(() => undefined);
      close(entry);
      setState({ phase: "cancelled", error: error.message, canRetry: retry.current?.file === entry.file });
    };
    const pump = async (entry, offset) => {
      await new Promise((resolve) => setTimeout(resolve, 24));
      for (let sent = offset; sent < Math.min(offset + WINDOW, entry.file.size); sent += CHUNK) {
        const packet = await packetFor(entry.file, sent);
        if (!current(entry)) return;
        if (!entry.channel || entry.channel.readyState !== "open" || entry.channel.bufferedAmount > 256 * 1024) {
          throw new Error("File connection is overloaded. Try again after the call stabilizes.");
        }
        entry.channel.send(packet.buffer);
      }
    };
    const receivePacket = async (entry, message) => {
      if (!current(entry)) return;
      const packet = new Uint8Array(message instanceof Blob ? await message.arrayBuffer() : message);
      const size = Math.min(CHUNK, entry.file.size - entry.bytes);
      if (size <= 0 || packet.byteLength !== HEADER + size || new DataView(packet.buffer).getUint32(0) !== entry.bytes) throw new Error("Invalid file packet.");
      const bytes = packet.slice(HEADER);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      if (!hash.every((byte, index) => byte === packet[index + 4])) throw new Error("File integrity check failed.");
      if (!current(entry)) return;
      entry.parts.push(bytes);
      entry.bytes += size;
      if (entry.bytes === entry.file.size || entry.bytes % WINDOW === 0) {
        if (entry.bytes === entry.file.size) entry.blob = new Blob(entry.parts, { type: "application/octet-stream" });
        setState({ phase: "receiving", file: entry.file, bytes: entry.bytes });
        await signal("credit", entry.id, { bytes: entry.bytes });
      }
    };
    const update = async (message) => {
      if (message.roomToken !== media.token || generation.current !== context) return;
      const { event, id } = message;
      if (event === "offer") {
        if (transfer.current) return;
        transfer.current = { id, file: message.file, parts: [], bytes: 0, queue: Promise.resolve(), queued: 0 };
        setDownload(null);
        setState({ phase: "offer", file: message.file });
        return;
      }
      const entry = transfer.current;
      if (!entry || (entry.id && entry.id !== id)) return;
      entry.id = id;
      try {
        if (event === "accepted") {
          if (message.chunk !== CHUNK) throw new Error("The file chunk size is incompatible.");
          const channel = await media.send.produceData({ ordered: true, appData: { transferId: id } });
          if (!current(entry)) return channel.close();
          entry.channel = channel;
          const start = () => {
            if (entry.ready && channel.readyState === "open" && !entry.started) {
              entry.started = true;
              void pump(entry, 0).catch((error) => fail(entry, error));
            }
          };
          channel.on("open", start);
          entry.start = start;
          start();
          setState({ phase: "sending", file: entry.file, bytes: 0 });
        } else if (event === "subscribe") {
          const { params } = await signal("consume", id, { transportId: media.receive.id });
          const channel = await media.receive.consumeData(params);
          if (!current(entry)) return channel.close();
          entry.channel = channel;
          channel.on("message", (message) => {
            if (++entry.queued > 9) return fail(entry, new Error("Too many queued file packets."));
            entry.queue = entry.queue.then(() => receivePacket(entry, message))
              .catch((error) => fail(entry, error)).finally(() => { entry.queued--; });
          });
          let ready = false;
          const open = () => {
            if (ready || !current(entry)) return;
            ready = true;
            void signal("ready", id).catch((error) => fail(entry, error));
          };
          channel.on("open", open);
          if (channel.readyState === "open") open();
        } else if (event === "ready") {
          entry.ready = true;
          entry.start?.();
        } else if (event === "credit") {
          setState({ phase: "sending", file: entry.file, bytes: message.bytes });
          await pump(entry, message.bytes);
        } else if (event === "done") {
          if (entry.blob) setDownload({ name: entry.file.name, blob: entry.blob });
          if (retry.current?.file === entry.file) retry.current = null;
          setState({ phase: "done", file: entry.file, bytes: entry.file.size });
          close(entry);
        } else if (event === "cancelled") {
          setState({ phase: "cancelled", error: message.reason, canRetry: retry.current?.file === entry.file });
          close(entry);
        }
      } catch (error) { fail(entry, error); }
    };
    context.send = async (file, recipient) => {
      if (!file || !recipient || file.size < 1 || file.size > LIMIT) throw new Error("Choose a file from 1 to 100,000,000 bytes and a recipient.");
      if (transfer.current) throw new Error("Finish or cancel the current transfer first.");
      if (!crypto.subtle) throw new Error("File sharing needs a secure browser context.");
      const entry = { file };
      transfer.current = entry;
      retry.current = { file, recipient };
      setDownload(null);
      setState({ phase: "waiting", file, bytes: 0 });
      try {
        const { id } = await signal("offer", null, { name: file.name, size: file.size, recipient });
        if (current(entry)) entry.id = id;
      } catch (error) { fail(entry, error); }
    };
    context.command = async (action) => {
      const entry = transfer.current;
      if (!entry?.id) return;
      try {
        if (action === "accept") {
          if (!crypto.subtle) throw new Error("File sharing needs a secure browser context.");
          setState({ phase: "receiving", file: entry.file, bytes: 0 });
        }
        await signal(action, entry.id);
      } catch (error) { fail(entry, error); }
    };
    media.socket.on("file-update", update);
    return () => {
      generation.current = null;
      media.socket.off("file-update", update);
      close(transfer.current);
      retry.current = null;
      setDownload(null);
      setState(null);
    };
  }, [media]);
  const send = (file, recipient) => generation.current?.send(file, recipient)?.catch((error) => notify(error.message));
  return { state, download, send, command: (action) => generation.current?.command(action),
    retry: state?.canRetry ? () => { if (retry.current) send(retry.current.file, retry.current.recipient); } : null };
}
