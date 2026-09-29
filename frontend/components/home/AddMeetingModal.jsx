"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Check, Clock3, Link2, Users, X } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export default function AddMeetingModal({ session, onClose, onSaved }) {
  const [roomId, setRoomId] = useState("");
  const [meeting, setMeeting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const lookup = async (event) => {
    event.preventDefault();
    setError("");
    setMeeting(null);
    setSaved(false);
    setBusy(true);
    try {
      const id = roomId.trim();
      if (!id) throw new Error("Enter a meeting code.");
      const response = await fetch(`${BACKEND_URL}/api/meetings/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session?.backendToken || ""}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Meeting not found.");
      if (data.status !== "scheduled") throw new Error("Only scheduled meetings can be added to your calendar.");
      setMeeting(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${encodeURIComponent(meeting.roomId)}/calendar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.backendToken || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add the meeting.");
      setSaved(true);
      onSaved?.(data.meeting || meeting);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#132033]/28 p-5 backdrop-blur-[7px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[500px] rounded-[28px] border border-[#e6ebf2] bg-white shadow-[0_30px_100px_rgba(22,38,66,0.22)]">
        <div className="flex items-start justify-between px-7 pb-5 pt-6">
          <div><h2 className="text-[23px] font-semibold tracking-[-0.03em] text-[#111827]">Add meeting</h2><p className="mt-1 text-[13px] text-[#778397]">Add someone else's scheduled meeting to your calendar.</p></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[#738096] hover:bg-[#f3f6fa]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-7 pb-7">
          <form onSubmit={lookup} className="flex gap-2.5">
            <div className="relative min-w-0 flex-1"><Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b98a8]" /><input autoFocus value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter meeting code" className="h-13 w-full rounded-[14px] border border-[#dfe5ee] pl-11 pr-4 text-[14px] outline-none focus:border-[#2a77f4] focus:ring-4 focus:ring-[#2a77f4]/10" /></div>
            <button disabled={busy} className="rounded-[14px] bg-[#176df3] px-5 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Checking..." : "Find"}</button>
          </form>

          {meeting && <div className="mt-4 rounded-[20px] border border-[#e3eaf2] bg-[#f8fbff] p-5">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#e6f1ff] text-[#176df3]"><CalendarPlus className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate text-[15px] font-semibold text-[#132033]">{meeting.title}</h3><p className="mt-1 text-[12px] text-[#768397]">Hosted by {meeting.hostName}</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] bg-white p-3"><div className="flex items-center gap-2 text-[11px] text-[#7c8999]"><Clock3 className="h-3.5 w-3.5" />Starts</div><div className="mt-1 text-[13px] font-semibold text-[#243244]">{new Date(meeting.scheduledAt).toLocaleString()}</div></div><div className="rounded-[14px] bg-white p-3"><div className="flex items-center gap-2 text-[11px] text-[#7c8999]"><Users className="h-3.5 w-3.5" />Room</div><div className="mt-1 break-all text-[12px] font-semibold text-[#243244]">{meeting.roomId}</div></div></div>
            {saved ? <div className="mt-4 flex items-center justify-center gap-2 rounded-[13px] bg-[#eaf8ef] px-4 py-3 text-[13px] font-semibold text-[#1d8a4b]"><Check className="h-4 w-4" />Added to your calendar</div> : <button onClick={save} disabled={busy} className="mt-4 h-12 w-full rounded-[13px] bg-[#176df3] text-[14px] font-semibold text-white disabled:opacity-60">{busy ? "Adding..." : "Add to calendar"}</button>}
          </div>}

          {error && <p className="mt-4 rounded-[13px] bg-[#fff0f1] px-4 py-3 text-[13px] font-medium text-[#c53b4a]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
