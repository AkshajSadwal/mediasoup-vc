import { useState } from "react";

import { features } from "./MeetingConfiguration";

function RulePicker({ label, value, update }) {
  return <label className="meeting-inline justify-between">{label}
    <select value={String(value ?? "default")} onChange={(event) => update(event.target.value === "default" ? null : event.target.value === "true")}>
      <option value="default">Default</option><option value="true">Allow</option><option value="false">Deny</option>
    </select>
  </label>;
}

export default function MeetingTools({ live, userId, action, panel }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(live.duration || 15);
  const [extension, setExtension] = useState(5);
  const [notice, setNotice] = useState("");
  const host = live.role === "host";
  const hands = live.members.filter(({ raisedAt }) => raisedAt).sort((a, b) => a.raisedAt - b.raisedAt);
  const others = live.members.filter((member) => member.userId !== userId);
  if (panel === "hands") return <div className="meeting-tool">
    <h3 className="font-semibold">Raised hands</h3>
    {!hands.length && <p>No hands raised.</p>}
    <ol>{hands.map((member) => <li key={member.userId} className="meeting-inline justify-between">{member.name}{host && <button onClick={() => action("lower-hand", { userId: member.userId })}>Lower hand</button>}</li>)}</ol>
  </div>;
  if (panel === "breakouts") return <div className="meeting-tool">
    <p>Current room · {live.title}</p>
    {!host && live.roomId !== "main" && <button onClick={() => action("help")}>Request host help</button>}
    {host && <>
      <form className="meeting-inline" onSubmit={async (event) => {
        event.preventDefault();
        if (await action("breakout-create", { title })) setTitle("");
      }}>
        <input aria-label="Breakout room name" value={title} maxLength={50} required onChange={(event) => setTitle(event.target.value)} />
        <button>Create room</button>
      </form>
      {live.breakouts.length > 0 && <div className="meeting-inline">
        <button onClick={() => action("breakout-auto")}>Auto-assign</button>
        {!live.started ? <>
          <label>Duration (minutes)<input type="number" min={1} max={180} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
          <button disabled={duration < 1 || duration > 180} onClick={() => action("breakout-start", { duration })}>Start breakouts</button>
        </> : <>
          <label>Extra minutes<input type="number" min={1} max={180} value={extension} onChange={(event) => setExtension(Number(event.target.value))} /></label>
          <button disabled={extension < 1 || extension > 180} onClick={() => action("breakout-extend", { duration: extension })}>Extend session</button>
          <button onClick={() => action("breakout-end")}>End session now</button>
        </>}
        <button onClick={() => action("breakout-close")}>Close all with countdown</button>
      </div>}
      {live.breakouts.map((room) => <section className="meeting-group" key={room.id}>
        <strong>{room.title}{room.closingAt ? " · Closing" : ""}</strong>
        <span>{live.members.filter((member) => member.room === room.id).map((member) => member.name).join(", ") || "Empty"}</span>
        <div className="meeting-inline">
          {live.started && <button disabled={room.closingAt || live.roomId === room.id} onClick={() => action("breakout-assign", { userId, room: room.id })}>Visit room</button>}
          <button disabled={Boolean(room.closingAt)} onClick={() => action("breakout-close", { room: room.id })}>Close room</button>
        </div>
      </section>)}
      {live.roomId !== "main" && <button onClick={() => action("breakout-assign", { userId, room: "main" })}>Return to main</button>}
      {others.map((member) => <label className="meeting-inline justify-between" key={member.userId}>{member.name}
        <select aria-label={"Assign " + member.name} value={live.assignments[member.userId] || "main"} onChange={(event) => action("breakout-assign", { userId: member.userId, room: event.target.value })}>
          <option value="main">Main room</option>
          {live.breakouts.map((room) => <option key={room.id} value={room.id} disabled={Boolean(room.closingAt)}>{room.title}</option>)}
        </select>
      </label>)}
      <form className="meeting-group" onSubmit={async (event) => {
        event.preventDefault();
        if (await action("broadcast", { text: notice })) setNotice("");
      }}>
        <input maxLength={500} required value={notice} onChange={(event) => setNotice(event.target.value)} aria-label="Meeting notice" placeholder="Notice to all rooms" />
        <button>Broadcast notice</button>
      </form>
      {live.help.map((entry) => <div key={entry.userId} className="meeting-group">
        <span>{entry.name} requested help in {live.breakouts.find(({ id }) => id === entry.room)?.title}.</span>
        <button onClick={() => action("breakout-assign", { userId, room: entry.room })}>Visit room</button>
        <button onClick={() => action("help-dismiss", { userId: entry.userId })}>Dismiss</button>
      </div>)}
    </>}
  </div>;
  return <div className="meeting-tool">
    <h3 className="font-semibold">Tool permissions</h3>
    {Object.entries(features).map(([feature, label]) => <div key={feature} className="meeting-inline justify-between">
      <span>{label} · {live.features[feature] ? "Allowed" : "Restricted"}</span>
      {!live.features[feature] && <button disabled={live.requested.includes(feature)} onClick={() => action("request", { feature })}>{live.requested.includes(feature) ? "Requested" : "Request access"}</button>}
    </div>)}
    {host && <>
      <section className="meeting-group">
        <strong>Speaking</strong>
        <div className="meeting-inline">
          <button onClick={() => action("mute-all")}>Mute everyone once</button>
          <button aria-pressed={live.locked} onClick={() => action("speaking", { locked: !live.locked, users: live.speakers })}>{live.locked ? "Unlock speaking" : "Restrict speaking"}</button>
        </div>
        {others.map((member) => <div key={member.userId} className="meeting-inline">
          <label><input type="checkbox" checked={live.speakers.includes(member.userId)} onChange={(event) => action("speaking", { locked: live.locked, users: event.target.checked ? [...live.speakers, member.userId] : live.speakers.filter((id) => id !== member.userId) })} /> {member.name} on allowlist</label>
          <button onClick={() => action("mute", { userId: member.userId, muted: !member.individuallyMuted })}>{member.individuallyMuted ? "Remove mute restriction" : "Mute"}</button>
          <button onClick={() => action("stop-presentation", { userId: member.userId })}>Stop room screen share</button>
        </div>)}
      </section>
      {["participant", "moderator"].map((tier) => <section key={tier} className="meeting-group">
        <strong>{tier === "participant" ? "Participant defaults" : "Moderator defaults"}</strong>
        {Object.entries(features).map(([feature, label]) => <RulePicker key={feature} label={label} value={live.defaults[tier][feature]} update={(value) => action("permission", { tier, feature, value })} />)}
      </section>)}
      {others.map((member) => <section key={member.userId} className="meeting-group">
        <strong>{member.name}</strong>
        {Object.entries(features).map(([feature, label]) => <RulePicker key={feature} label={label} value={live.overrides[member.userId]?.[feature]} update={(value) => action("permission", { userId: member.userId, feature, value })} />)}
      </section>)}
      {live.requests.map(({ userId: requester, name, feature }) => <section className="meeting-group" key={requester + feature}>
        <span>{name} requested {features[feature].toLowerCase()}.</span>
        <div className="meeting-inline">
          <button onClick={() => action("permission", { userId: requester, feature, value: true })}>Grant</button>
          <button onClick={() => action("permission", { userId: requester, feature, value: false })}>Deny</button>
        </div>
      </section>)}
    </>}
  </div>;
}
