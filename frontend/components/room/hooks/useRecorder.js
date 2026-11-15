import { useEffect, useRef, useState } from "react";
import { mixInputs } from "./audioMix";
import { downloadBlob } from "./useFiles";

const MAX_BYTES = 128 * 1024 * 1024;
const MAX_MEMORY_TIME = 20 * 60;
const mimeTypes = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1.42001E,mp4a.40.2", "video/mp4"];

function drawMeeting(canvas, element) {
  const layout = element?.querySelector("[data-record-layout]");
  if (!layout) return;
  const box = layout.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const context = canvas.getContext("2d");
  const scale = Math.min(canvas.width / box.width, canvas.height / box.height);
  const left = (canvas.width - box.width * scale) / 2;
  const top = (canvas.height - box.height * scale) / 2;
  context.fillStyle = "#132238";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const tile of layout.querySelectorAll("[data-record-tile]")) {
    const rect = tile.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.right <= box.left || rect.left >= box.right) continue;
    const x = left + (rect.left - box.left) * scale;
    const y = top + (rect.top - box.top) * scale;
    const w = rect.width * scale;
    const h = rect.height * scale;
    context.save();
    context.beginPath();
    context.rect(left, top, box.width * scale, box.height * scale);
    context.clip();
    context.fillStyle = "#e7effb";
    context.fillRect(x, y, w, h);
    const source = tile.matches("canvas") ? tile : tile.querySelector("video");
    if (source && (!("readyState" in source) || source.readyState >= 2)) {
      const width = source.videoWidth || source.width;
      const height = source.videoHeight || source.height;
      if (width && height) {
        const ratio = Math.min(w / width, h / height);
        context.drawImage(source, x + (w - width * ratio) / 2, y + (h - height * ratio) / 2, width * ratio, height * ratio);
      }
    }
    context.font = "16px sans-serif";
    context.textBaseline = "bottom";
    context.fillStyle = "#132238";
    const name = tile.dataset.name || "";
    context.fillRect(x, y + h - 24, Math.min(context.measureText(name).width + 16, w), 24);
    context.fillStyle = "white";
    context.fillText(name, x + 7, y + h - 4, Math.max(w - 14, 4));
    context.restore();
  }
}

export function useRecorder(media, canRecord, layout, audio, notify) {
  const active = useRef(null);
  const currentAudio = useRef(audio);
  const [state, setState] = useState({ status: "idle", seconds: 0 });
  const [output, setOutput] = useState(null);

  const stop = (reason) => active.current?.stop(reason);

  useEffect(() => {
    if (!media) return;
    const detach = media.attachRecorder(
      (reason) => active.current?.stop(reason),
      () => active.current?.stop("Recording permission was revoked."),
    );
    return () => {
      if (active.current?.media === media) void active.current.stop("left");
      detach();
    };
  }, [media]);

  useEffect(() => { currentAudio.current = audio; active.current?.mixer?.update(audio); }, [audio]);

  const start = async (disk) => {
    if (active.current || !media || !canRecord) return;
    if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || !globalThis.AudioContext) {
      return notify("This browser cannot record the meeting canvas and audio. Try a current Chromium, Firefox, or Safari release.");
    }
    const entry = { media, parts: [], bytes: 0, queued: 0, writes: Promise.resolve(), elapsed: 0 };
    entry.finished = new Promise((resolve) => { entry.resolve = resolve; });
    entry.stop = (reason) => {
      if (reason === "left") entry.autoSave = true;
      if (entry.stopping) return entry.finished;
      entry.stopping = true;
      clearInterval(entry.timer);
      if (entry.recorder && entry.recorder.state !== "inactive") {
        setState({ status: "saving", seconds: Math.floor(entry.elapsed / 1000) });
        entry.recorder.stop();
      }
      if (reason && !["left", "moved", "disconnected"].includes(reason)) notify(reason);
      return entry.finished;
    };
    active.current = entry;
    setState({ status: "starting", seconds: 0 });
    try {
      const supported = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const extension = supported?.startsWith("video/mp4") ? "mp4" : "webm";
      const name = "rauma-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension;
      if (disk) {
        const handle = await window.showSaveFilePicker({ suggestedName: name });
        if (entry.stopping || media.closed) throw new Error("The room connection changed.");
        entry.sink = await handle.createWritable();
      }
      if (entry.stopping || media.closed) throw new Error("The room connection changed.");
      entry.context = new AudioContext();
      await entry.context.resume();
      if (entry.stopping || media.closed) throw new Error("The room connection changed.");
      const bus = entry.context.createDynamicsCompressor();
      const destination = entry.context.createMediaStreamDestination();
      bus.connect(destination);
      entry.mixer = mixInputs(entry.context, bus);
      entry.mixer.update(currentAudio.current);
      entry.canvas = document.createElement("canvas");
      entry.canvas.width = 1280;
      entry.canvas.height = 720;
      const render = () => drawMeeting(entry.canvas, layout.current);
      render();
      entry.video = entry.canvas.captureStream(15);
      const combined = new MediaStream([...entry.video.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      entry.recorder = new MediaRecorder(combined, { ...(supported ? { mimeType: supported } : {}), videoBitsPerSecond: 2_000_000 });
      entry.recorder.ondataavailable = ({ data }) => {
        if (!data.size) return;
        entry.bytes += data.size;
        if (entry.sink) {
          if (entry.queued + data.size > 16 * 1024 * 1024) {
            entry.failed = true;
            void entry.stop("The disk is too slow. Recording stopped.");
            return;
          }
          entry.queued += data.size;
          entry.writes = entry.writes.then(() => entry.sink.write(data)).catch(() => {
            entry.failed = true;
            void entry.stop("Could not write the recording to disk.");
          }).finally(() => { entry.queued -= data.size; });
        } else if (entry.bytes <= MAX_BYTES) {
          entry.parts.push(data);
          if (entry.bytes >= MAX_BYTES * .9) void entry.stop("Recording reached its memory limit.");
        } else {
          entry.failed = true;
          void entry.stop("A recording chunk exceeded the memory limit.");
        }
      };
      entry.recorder.onerror = () => { void entry.stop("Recording stopped because of a media error."); };
      entry.recorder.onstop = async () => {
        clearInterval(entry.timer);
        entry.video.getTracks().forEach((track) => track.stop());
        entry.mixer.close();
        void entry.context.close();
        if (!media.closed) void media.ask("live-action", { action: "recording", active: false }).catch(() => undefined);
        const actualType = entry.recorder.mimeType || supported || "video/webm";
        const actualName = name.replace(/\.(mp4|webm)$/, actualType.startsWith("video/mp4") ? ".mp4" : ".webm");
        try {
          await entry.writes;
          if (entry.sink) {
            if (entry.failed) await entry.sink.abort();
            else { await entry.sink.close(); notify("Recording saved to disk."); }
          } else if (entry.parts.length && !entry.failed) {
            const blob = new Blob(entry.parts, { type: actualType });
            if (entry.autoSave) downloadBlob(blob, actualName);
            else setOutput({ name: actualName, blob });
          }
        } catch { notify("The recording could not be finalized."); }
        finally {
          entry.parts = [];
          if (active.current === entry) { active.current = null; setState({ status: "idle", seconds: 0 }); }
          entry.resolve();
        }
      };
      await media.ask("live-action", { action: "recording", active: true });
      if (entry.stopping || media.closed) throw new Error("The room connection changed.");
      entry.recorder.start(1000);
      let previous = performance.now();
      let lastDraw = 0;
      entry.timer = setInterval(() => {
        const now = performance.now();
        if (entry.recorder.state === "recording") {
          entry.elapsed += now - previous;
          if (now - lastDraw >= 60) {
            try { render(); } catch { void entry.stop("The meeting layout could not be recorded."); }
            lastDraw = now;
          }
          const seconds = Math.floor(entry.elapsed / 1000);
          setState((current) => current.seconds === seconds ? current : { status: "recording", seconds });
          if (!entry.sink && seconds >= MAX_MEMORY_TIME) void entry.stop("Recording reached the 20-minute memory limit.");
        }
        previous = now;
      }, 66);
      setOutput(null);
      setState({ status: "recording", seconds: 0 });
    } catch (error) {
      entry.video?.getTracks().forEach((track) => track.stop());
      entry.mixer?.close();
      void entry.context?.close();
      await entry.sink?.abort().catch(() => undefined);
      if (!media.closed) void media.ask("live-action", { action: "recording", active: false }).catch(() => undefined);
      if (active.current === entry) { active.current = null; setState({ status: "idle", seconds: 0 }); }
      entry.resolve();
      if (error.name !== "AbortError") notify(error.message);
    }
  };
  const togglePause = () => {
    const entry = active.current;
    const recorder = entry?.recorder;
    if (recorder?.state === "recording") { recorder.pause(); setState((value) => ({ ...value, status: "paused" })); }
    else if (recorder?.state === "paused") { recorder.resume(); setState((value) => ({ ...value, status: "recording" })); }
  };
  return { ...state, output, start, stop, togglePause, clear: () => setOutput(null) };
}
