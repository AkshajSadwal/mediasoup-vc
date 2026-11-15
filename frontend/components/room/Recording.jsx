import { downloadBlob } from "./hooks/useFiles";

export default function Recording({ recorder, live, action }) {
  return <section className="meeting-tool">
    <p>Recording stays on this device. Meeting permission controls the Rauma recorder. External screen capture remains possible.</p>
    {recorder.status === "idle" && (live.features.recording ? <>
      {typeof window !== "undefined" && window.showSaveFilePicker && <button onClick={() => recorder.start(true)}>Record to a local file</button>}
      <button onClick={() => recorder.start(false)}>Record in browser memory</button>
      <p>Memory recordings stop at 20 minutes or near 128 MiB. The browser chooses a supported format.</p>
    </> : <button disabled={live.requested.includes("recording")} onClick={() => action("request", { feature: "recording" })}>{live.requested.includes("recording") ? "Access requested" : "Request recording access"}</button>)}
    {["recording", "paused"].includes(recorder.status) && <div className="meeting-inline">
      <span>{Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}</span>
      <button onClick={recorder.togglePause}>{recorder.status === "paused" ? "Resume" : "Pause"}</button>
      <button onClick={() => recorder.stop()}>Stop recording</button>
    </div>}
    {["starting", "saving"].includes(recorder.status) && <p role="status">{recorder.status === "starting" ? "Starting recording…" : "Finalizing recording…"}</p>}
    {recorder.output && <div className="meeting-inline">
      <button onClick={() => downloadBlob(recorder.output.blob, recorder.output.name)}>Save recording</button>
      <button onClick={recorder.clear}>Discard recording</button>
    </div>}
  </section>;
}
