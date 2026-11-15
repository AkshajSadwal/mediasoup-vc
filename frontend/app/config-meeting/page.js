"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MeetingConfiguration from "@/components/room/MeetingConfiguration";
import "@/components/room/meeting.css";

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export default function ConfigureMeeting() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=%2Fconfig-meeting");
  }, [status, router]);
  const request = async (path, body) => {
    const response = await fetch(backend + "/api/meetings" + path, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.backendToken },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save the meeting.");
    return result;
  };
  return <main className="config-page">
    <Link href="/">Rauma home</Link>
    <h1>Config meeting</h1>
    {session?.backendToken && (!saved ? <MeetingConfiguration create onSave={async (configuration, details) => {
      const data = await request("/config", { ...details, configuration });
      const origin = window.location.origin;
      setSaved({ ...data, links: data.links.map(({ id, token }) => ({
        id, url: origin + "/room/" + data.roomId + "#team=" + token,
      })) });
    }} /> : <section className="config-form">
      <h2>{saved.title}</h2>
      {saved.links.length > 0 && <p>Copy these team links before leaving this page. Each link is shown here once.</p>}
      {saved.links.map(({ id, url }) => <label key={id}>{saved.configuration.teams.find((team) => team.id === id)?.name}
        <input readOnly value={url} onFocus={(event) => event.target.select()} />
        <button onClick={async () => {
          try { await navigator.clipboard.writeText(url); setFeedback("Team link copied."); }
          catch { setFeedback("Select the address and copy it."); }
        }}>Copy team link</button>
      </label>)}
      <button className="config-primary" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await request("/" + saved.roomId + "/start"); router.push("/room/" + saved.roomId); }
        catch (error) { setFeedback(error.message); setBusy(false); }
      }}>Start configured meeting</button>
      {feedback && <p role="status">{feedback}</p>}
    </section>)}
  </main>;
}
