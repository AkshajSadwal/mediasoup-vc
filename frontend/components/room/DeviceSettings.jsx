import { useCallback, useEffect, useRef, useState } from "react";
import { captureInput, mediaPreferences, saveMediaPreferences } from "./hooks/mediaDevices";
import { StreamElement } from "./VideoGrid";

export function useMeetingOutput(userId, notify) {
  const [choice, setChoice] = useState({ id: "", owner: null });
  const output = choice.owner === userId ? choice.id : "";
  const supported = typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype.setSinkId === "function";
  const pick = async (id, prompt = false) => {
    try {
      if (prompt && navigator.mediaDevices?.selectAudioOutput) {
        const result = await navigator.mediaDevices.selectAudioOutput(id ? { deviceId: id } : undefined);
        id = result.deviceId;
      }
      if (!supported) throw new Error("Meeting playback follows your system output settings on this browser.");
      await document.createElement("audio").setSinkId(id);
      setChoice({ id, owner: userId });
      saveMediaPreferences(userId, { output: id });
    } catch (error) {
      if (error.name !== "AbortError") notify("Could not select this speaker. Check browser permission or use the system output.");
    }
  };
  const unavailable = useCallback(() => {
    setChoice({ id: "", owner: userId });
    notify("The selected speaker is unavailable. Playback is using the system output.");
  }, [userId, notify]);
  useEffect(() => {
    if (!output) return;
    const devices = navigator.mediaDevices;
    let active = true;
    const changed = async () => {
      const available = await devices?.enumerateDevices().catch(() => []);
      const outputs = available?.filter(({ kind }) => kind === "audiooutput");
      if (active && outputs?.length && !outputs.some(({ deviceId }) => deviceId === output)) unavailable();
    };
    devices?.addEventListener("devicechange", changed);
    return () => { active = false; devices?.removeEventListener("devicechange", changed); };
  }, [output, unavailable]);
  return { output, supported, pick, unavailable };
}

function Meter({ stream }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length || !globalThis.AudioContext) return;
    const context = new AudioContext();
    const node = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    node.connect(analyser);
    void context.resume().catch(() => undefined);
    const samples = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      setLevel(Math.min(1, Math.sqrt(samples.reduce((power, value) => power + value ** 2, 0) / samples.length) * 5));
    }, 70);
    return () => { clearInterval(timer); node.disconnect(); void context.close(); };
  }, [stream]);
  return <meter aria-label="Microphone input level" min={0} max={1} value={stream ? level : 0} />;
}

async function testSpeaker(sink) {
  if (!globalThis.AudioContext) throw new Error("A speaker test is unavailable on this browser.");
  const context = new AudioContext();
  const audio = document.createElement("audio");
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  try {
    const resume = context.resume();
    const destination = context.createMediaStreamDestination();
    audio.srcObject = destination.stream;
    if (sink && audio.setSinkId) await audio.setSinkId(sink);
    await resume;
    oscillator.frequency.value = 440;
    gain.gain.value = .13;
    oscillator.connect(gain).connect(destination);
    const ended = new Promise((resolve) => { oscillator.onended = resolve; });
    const playing = audio.play();
    oscillator.start();
    oscillator.stop(context.currentTime + .5);
    await playing;
    await ended;
  } finally {
    audio.pause();
    audio.srcObject?.getTracks().forEach((track) => track.stop());
    audio.srcObject = null;
    void context.close();
  }
}

export default function DeviceSettings({ kind, call, output, userId, notify, onEffects }) {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(() => mediaPreferences(userId)[kind] || "");
  const [quality, setQuality] = useState(() => mediaPreferences(userId).quality || "balanced");
  const activeMenu = useRef(false);
  const meetingCameraOn = useRef(call.videoEnabled);
  meetingCameraOn.current = call.videoEnabled;
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const inputKind = kind + "input";
  const canUse = call.live?.features[kind === "audio" ? "microphone" : "camera"] !== false;
  const permitted = useRef(canUse);
  useEffect(() => { permitted.current = canUse; }, [canUse]);

  useEffect(() => {
    let active = true;
    const media = navigator.mediaDevices;
    const scan = async () => {
      try { const list = await media?.enumerateDevices(); if (active) setDevices(list || []); }
      catch { if (active) setError("Browser permissions prevented listing devices."); }
    };
    void scan();
    media?.addEventListener("devicechange", scan);
    return () => { active = false; media?.removeEventListener("devicechange", scan); };
  }, [refresh]);

  useEffect(() => {
    activeMenu.current = true;
    return () => { activeMenu.current = false; };
  }, []);
  useEffect(() => () => { preview?.getTracks().forEach((track) => track.stop()); }, [preview]);
  useEffect(() => {
    if (!canUse || (kind === "video" && call.videoEnabled)) setPreview(null);
  }, [canUse, kind, call.videoEnabled]);

  const select = async (id, nextQuality) => {
    // A preview is a separate acquisition and must not outlive the test.
    preview?.getTracks().forEach((track) => track.stop());
    setPreview(null);
    setBusy(true); setError("");
    try {
      await call.changeInput(kind, id, nextQuality);
      setSelected(mediaPreferences(userId)[kind] || id); setQuality(nextQuality);
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(failure.name === "NotAllowedError" ? "Permission denied. Allow this input in your browser." : failure.message);
    } finally { setBusy(false); }
  };
  const inputs = devices.filter((device) => device.kind === inputKind && device.deviceId && device.deviceId !== "default");
  const speakers = devices.filter((device) => device.kind === "audiooutput" && device.deviceId && device.deviceId !== "default");
  const liveInput = kind === "audio" ? (call.audioEnabled ? call.mic : null) : (call.videoEnabled ? call.camera : null);
  const qualitySupported = navigator.mediaDevices?.getSupportedConstraints?.().height;
  const previewStream = preview?.getTracks().some((track) => track.readyState === "live") ? preview : null;
  return <div className="meeting-device-settings">
    <label>{kind === "audio" ? "Microphone input" : "Camera"}
      <select aria-label={kind === "audio" ? "Microphone input" : "Camera"} value={inputs.some(({ deviceId }) => deviceId === selected) ? selected : ""} disabled={busy || !canUse}
        onChange={(event) => select(event.target.value, quality)}>
        <option value="">System default</option>
        {inputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || (kind === "audio" ? "Microphone " : "Camera ") + (index + 1)}</option>)}
      </select>
    </label>
    <button type="button" disabled={busy || !canUse} onClick={() => select(selected, quality)}>{kind === "video" && !call.videoEnabled ? "Save camera selection" : "Refresh input access"}</button>
    {canUse && !liveInput && <button type="button" disabled={busy} onClick={async () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        return setPreview(null);
      }
      setError("");
      setBusy(true);
      try {
        const stream = await captureInput(kind, selected, quality, true);
        if (!activeMenu.current || !permitted.current || (kind === "video" && meetingCameraOn.current)) {
          return stream.getTracks().forEach((track) => track.stop());
        }
        setPreview(stream);
        setRefresh((value) => value + 1);
      }
      catch { setError("The input is unavailable. Check browser permissions and reconnect the device."); }
      finally { setBusy(false); }
    }}>{previewStream ? "Stop local test" : kind === "audio" ? "Test microphone locally" : "Preview camera locally"}</button>}
    {kind === "video" && canUse && !call.videoEnabled && <p role="status">{previewStream
      ? "Local camera preview is active. Your camera light may be on, but video is not shared with the meeting. Stop the test or close settings to release it."
      : "Meeting camera is off. Preview camera locally to test it temporarily without joining the video feed."}</p>}
    {kind === "audio" ? <>
      <Meter stream={canUse ? previewStream || liveInput : null} />
      {output.supported ? <>
        <label>Speaker output<select aria-label="Speaker output" value={output.output}
          onChange={(event) => output.pick(event.target.value)}>
          <option value="">System default</option>
          {output.output && !speakers.some(({ deviceId }) => deviceId === output.output) && <option value={output.output}>Selected speaker</option>}
          {speakers.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Speaker " + (index + 1)}</option>)}
        </select></label>
        {navigator.mediaDevices?.selectAudioOutput && <button type="button" onClick={() => output.pick(mediaPreferences(userId).output, true)}>Choose speaker…</button>}
        {!navigator.mediaDevices?.selectAudioOutput && mediaPreferences(userId).output && output.output !== mediaPreferences(userId).output &&
          <button type="button" onClick={() => output.pick(mediaPreferences(userId).output)}>Restore saved speaker</button>}
      </> : <p>Meeting playback follows your system output settings on this browser.</p>}
      <button type="button" disabled={testing} onClick={async () => {
        setTesting(true);
        try { await testSpeaker(output.output); }
        catch { notify("Could not play the speaker test. Check your selected output and browser playback settings."); }
        finally { setTesting(false); }
      }}>Play speaker test</button>
    </> : <>
      {canUse && (previewStream || liveInput) && <div className="meeting-device-preview"><StreamElement stream={previewStream || liveInput} /></div>}
      {qualitySupported && <label>Capture quality<select value={quality} disabled={busy || !canUse} onChange={(event) => select(selected, event.target.value)}>
        <option value="low">Low bandwidth · 360p</option><option value="balanced">Balanced · 720p</option><option value="high">High · 1080p</option>
      </select></label>}
      <button type="button" onClick={onEffects}>Background effects</button>
    </>}
    {!canUse && <p role="status">The host has restricted this input.</p>}
    {error && <p role="status">{error}</p>}
  </div>;
}
