"use client";

import { useState } from "react";

export const features = { microphone: "Microphone publishing", camera: "Camera publishing", whiteboard: "Whiteboard editing",
  hands: "Raise hand", reactions: "Emoji reactions", screen: "Screen sharing", chat: "Send chat messages",
  recording: "Local recording", files: "File sharing", polls: "Poll and vote creation" };

export const emptyConfiguration = () => ({
  defaults: { participant: {}, moderator: {} }, initial: { participant: {}, moderator: {} },
  overrides: {}, rooms: [], assignments: {}, duration: 15, teams: [],
});

function Rules({ rules, onChange, defaults = false }) {
  return <div className="config-rules">
    {Object.entries(features).map(([key, label]) => <label key={key}>{label}
      <select value={String(rules[key] ?? "inherit")} onChange={(event) => {
        const next = { ...rules };
        if (event.target.value === "inherit") delete next[key];
        else next[key] = event.target.value === "true";
        onChange(next);
      }}>
        <option value="inherit">{defaults ? "Default (allow)" : "Use role default"}</option>
        <option value="true">Allow</option><option value="false">Restrict</option>
      </select>
    </label>)}
  </div>;
}

export default function MeetingConfiguration({ initial, onSave, create = false, participants = [] }) {
  const [config, setConfig] = useState(initial || emptyConfiguration);
  const [title, setTitle] = useState("Rauma Meeting");
  const [visibility, setVisibility] = useState("public");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const change = (key, value) => setConfig((current) => ({ ...current, [key]: value }));
  const options = config.rooms.map((room) => <option key={room.id} value={room.id}>{room.title || "Unnamed room"}</option>);
  const names = new Map(participants.map(({ userId, name }) => [userId, name]));
  const submit = async (event) => {
    event.preventDefault();
    setStatus(""); setBusy(true);
    try { await onSave(config, { title, visibility }); setStatus("Meeting configuration saved."); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  return <form className="config-form" onSubmit={submit}>
    {create && <fieldset className="config-field">
      <legend>Meeting details</legend>
      <label>Meeting title<input value={title} required maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Admission<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="public">Public</option><option value="private">Private · approval required</option></select></label>
    </fieldset>}
    {["participant", "moderator"].map((tier) => <details className="config-field" key={tier}>
      <summary>{tier === "participant" ? "Participant defaults" : "Moderator defaults"}</summary>
      <label className="config-check"><input type="checkbox" checked={!!config.initial[tier].microphone} onChange={(event) => change("initial", { ...config.initial, [tier]: { ...config.initial[tier], microphone: event.target.checked } })} />Start muted</label>
      <label className="config-check"><input type="checkbox" checked={!!config.initial[tier].camera} onChange={(event) => change("initial", { ...config.initial, [tier]: { ...config.initial[tier], camera: event.target.checked } })} />Start with camera off</label>
      <Rules defaults rules={config.defaults[tier]} onChange={(rules) => change("defaults", { ...config.defaults, [tier]: rules })} />
    </details>)}
    <details className="config-field">
      <summary>Individual overrides and assignments</summary>
      <label>Account ID<input value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="off" list="meeting-account-ids" /></label>
      <datalist id="meeting-account-ids">{participants.map(({ userId, name }) => <option key={userId} value={userId}>{name}</option>)}</datalist>
      <button type="button" disabled={!/^[\w-]{1,128}$/.test(account.trim())} onClick={() => {
        const id = account.trim();
        change("overrides", { ...config.overrides, [id]: config.overrides[id] || {} }); setAccount("");
      }}>Add account</button>
      {[...new Set([...Object.keys(config.overrides), ...Object.keys(config.assignments)])].map((id) => <fieldset className="config-field" key={id}>
        <legend>{names.get(id) || id}</legend>
        <Rules rules={config.overrides[id] || {}} onChange={(rules) => change("overrides", { ...config.overrides, [id]: rules })} />
        <label>Breakout assignment<select value={config.assignments[id] ?? ""} onChange={(event) => {
          const assignments = { ...config.assignments };
          if (event.target.value) assignments[id] = event.target.value;
          else delete assignments[id];
          change("assignments", assignments);
        }}><option value="">Use team mapping</option><option value="main">Main room</option>{options}</select></label>
      </fieldset>)}
    </details>
    <details className="config-field">
      <summary>Breakout plan</summary>
      <label>Duration in minutes<input type="number" min={1} max={180} required value={config.duration} onChange={(event) => change("duration", Number(event.target.value))} /></label>
      {config.rooms.map((room, index) => <label key={room.id}>Room {index + 1}
        <input required maxLength={50} value={room.title} onChange={(event) => change("rooms", config.rooms.map((entry) => entry.id === room.id ? { ...entry, title: event.target.value } : entry))} />
      </label>)}
      <button type="button" disabled={config.rooms.length >= 5} onClick={() => change("rooms", [...config.rooms, { id: crypto.randomUUID(), title: "Breakout " + (config.rooms.length + 1) }])}>Add room</button>
    </details>
    <details className="config-field">
      <summary>Team links</summary>
      {create && <p>Links are shown after saving. Each uses its own token and follows your admission rules.</p>}
      {config.teams.map((team, index) => {
        const update = (changeSet) => change("teams", config.teams.map((entry) => entry.id === team.id ? { ...entry, ...changeSet } : entry));
        return <fieldset className="config-field" key={team.id}>
          <legend>Team {index + 1}</legend>
          <label>Team name<input required maxLength={50} value={team.name} onChange={(event) => update({ name: event.target.value })} /></label>
          <label>Team breakout<select value={team.room ?? ""} onChange={(event) => update({ room: event.target.value || null })}><option value="">No team assignment</option>{options}</select></label>
          {!create && <label className="config-check"><input type="checkbox" checked={team.enabled} disabled={!initial.teams.find(({ id }) => id === team.id)?.enabled} onChange={(event) => update({ enabled: event.target.checked })} />Accept new joins through this link</label>}
        </fieldset>;
      })}
      {create && <button type="button" disabled={config.teams.length >= 10} onClick={() => change("teams", [...config.teams,
        { id: crypto.randomUUID(), name: "Team " + (config.teams.length + 1), room: null, enabled: true }])}>Add team</button>}
    </details>
    <button className="config-primary" disabled={busy}>{busy ? "Saving…" : "Save configuration"}</button>
    {status && <p role="status">{status}</p>}
  </form>;
}
