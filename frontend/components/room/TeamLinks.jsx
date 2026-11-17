"use client";

import { useEffect, useState } from "react";

const keyFor = (roomId) => `rauma-issued-teams:${roomId}`;

// Only the team token's SHA-256 digest exists on the server. Cache links issued
// in this browser session, never in durable localStorage or a backend response.
export function rememberTeamLink(roomId, id, token, revision = 1) {
  try {
    const key = keyFor(roomId);
    const saved = JSON.parse(sessionStorage.getItem(key) || "{}");
    saved[id] = { token, revision };
    sessionStorage.setItem(key, JSON.stringify(saved));
  } catch { /* Browsers may block session storage. The link is still shown immediately. */ }
}

export default function TeamLinks({ roomId, configuration, issueTeam }) {
  const [issued, setIssued] = useState({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    try { setIssued(JSON.parse(sessionStorage.getItem(keyFor(roomId)) || "{}")); }
    catch { setIssued({}); }
  }, [roomId]);

  const submit = async (input, id = "new") => {
    if (busy) return;
    setBusy(id);
    setFeedback("");
    try {
      const data = await issueTeam(input);
      const revision = data.configuration.teams.find((team) => team.id === data.link.id)?.revision || 1;
      rememberTeamLink(roomId, data.link.id, data.link.token, revision);
      setIssued((previous) => ({ ...previous, [data.link.id]: { token: data.link.token, revision } }));
      if (id === "new") setName("");
      setFeedback(id === "new" ? "Team link created." : "New team link issued. The previous link no longer works.");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(""); }
  };
  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setFeedback("Team link copied."); }
    catch { setFeedback("Select the link and copy it manually."); }
  };
  const teams = configuration?.teams || [];
  return <section className="config-field" aria-label="Team links in meeting">
    <h3 className="font-semibold">Team invite links</h3>
    <p className="text-sm text-[#718096]">Send each team its own link. Only the host can issue or replace links. Private meeting approval is still required.</p>
    {teams.map((team) => {
      const cached = issued[team.id];
      const token = cached?.revision === (team.revision || 1) ? cached.token : null;
      const url = token ? new URL(`/room/${encodeURIComponent(roomId)}#team=${token}`, window.location.origin).href : "";
      return <div className="meeting-team-entry" key={team.id}>
        <strong>{team.name}</strong>
        <span className="text-xs text-[#718096]">{team.enabled ? "Link active" : "Link disabled"}{team.room ? " · Breakout assigned" : ""}</span>
        {token && team.enabled ? <>
          <label>Team link<input readOnly value={url} onFocus={(event) => event.target.select()} aria-label={`${team.name} team link`} /></label>
          <button type="button" onClick={() => copy(url)}>Copy team link</button>
        </> : <p className="text-xs text-[#718096]">The original secret cannot be retrieved. Issue a new link to share it.</p>}
        <button type="button" disabled={!!busy} onClick={() => {
          if (team.enabled && !window.confirm(`Replace ${team.name}'s link? The previous URL will stop working.`)) return;
          void submit({ teamId: team.id }, team.id);
        }}>{busy === team.id ? "Issuing…" : team.enabled ? "Replace team link" : "Enable with new link"}</button>
      </div>;
    })}
    {teams.length < 10 && <form className="meeting-team-create" onSubmit={(event) => {
      event.preventDefault();
      void submit({ name: name.trim() });
    }}>
      <label>New team name<input value={name} onChange={(event) => setName(event.target.value)}
        minLength={1} maxLength={50} required placeholder="e.g. Design team" /></label>
      <button type="submit" disabled={!!busy || !name.trim()}>{busy === "new" ? "Creating…" : "Create team link"}</button>
    </form>}
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
  </section>;
}
