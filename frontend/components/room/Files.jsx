import { useState } from "react";
import { downloadBlob } from "./hooks/useFiles";

export default function Files({ files, live, people, userId, action }) {
  const [file, setFile] = useState(null);
  const [recipient, setRecipient] = useState("");
  const state = files.state;
  const available = !state || ["cancelled", "done"].includes(state.phase);
  return <section className="meeting-tool">
    <p>Files go to one recipient after they accept. If the sender leaves, ask them to offer the file again. Maximum 100 MB per file.</p>
    {available && (live.features.files ? <form className="meeting-group" onSubmit={(event) => {
      event.preventDefault(); files.send(file, recipient);
    }}>
      <label className="grid">File<input type="file" required onChange={(event) => setFile(event.target.files[0])} /></label>
      <label className="grid">Recipient<select value={recipient} required onChange={(event) => setRecipient(event.target.value)}>
        <option value="">Choose a participant</option>
        {people.filter((person) => person.userId !== userId).map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}
      </select></label>
      <button>Offer file</button>
    </form> : <button disabled={live.requested.includes("files")} onClick={() => action("request", { feature: "files" })}>{live.requested.includes("files") ? "Access requested" : "Request file sharing access"}</button>)}
    {state && <div className="meeting-group">
      {state.file && <strong>{state.file.name} · {state.file.size.toLocaleString()} bytes</strong>}
      {state.phase === "offer" && <p>{state.file.sender} is offering this file.</p>}
      {state.phase === "waiting" && <p>Waiting for the recipient to accept.</p>}
      {["sending", "receiving"].includes(state.phase) && <progress aria-label="File transfer progress" value={state.bytes} max={state.file.size} />}
      {state.phase === "done" && <p>Transfer complete.</p>}
      {state.error && <p role="status">{state.error}</p>}
      {!available && <div className="meeting-inline">
        {state.phase === "offer" && <button onClick={() => files.command("accept")}>Accept</button>}
        <button onClick={() => files.command("cancel")}>{state.phase === "offer" ? "Decline" : "Cancel"}</button>
      </div>}
      {files.retry && live.features.files && <button onClick={files.retry}>Offer again</button>}
    </div>}
    {files.download && <button onClick={() => downloadBlob(files.download.blob, files.download.name)}>Save {files.download.name}</button>}
  </section>;
}
