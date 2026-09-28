"use client";

import { CalendarClock, Clock3, Link2, Loader2, UsersRound, Video } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MeetingStatusBadge from "./MeetingStatusBadge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function AddMeetingCard() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = async (event) => {
    event.preventDefault();
    const trimmed = roomId.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Meeting not found.");
      setMeeting(data);
    } catch (err) {
      setMeeting(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openMeeting = () => {
    if (!meeting) return;
    router.push(meeting.open ? `/room/${meeting.roomId}` : `/waiting/${meeting.roomId}`);
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-400/10 text-blue-300"><Link2 size={19} /></span>
        <div>
          <h2 className="text-lg font-semibold text-white">Add meeting</h2>
          <p className="text-xs text-white/40">Paste a reserved room ID to check its status.</p>
        </div>
      </div>

      <form onSubmit={lookup} className="mt-4 flex gap-2">
        <input
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          placeholder="Meeting room ID"
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
        />
        <button disabled={loading} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Link2 size={17} />}
        </button>
      </form>

      {error && <p className="mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      {meeting && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{meeting.title}</div>
              <div className="mt-1 truncate text-xs text-white/40">Hosted by {meeting.hostName}</div>
            </div>
            <MeetingStatusBadge meeting={meeting} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-black/15 px-3 py-2"><div className="flex items-center gap-1.5 text-white/40"><CalendarClock size={13} />Starts</div><div className="mt-1 text-white">{new Date(meeting.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>
            <div className="rounded-xl bg-black/15 px-3 py-2"><div className="flex items-center gap-1.5 text-white/40"><Clock3 size={13} />Room</div><div className="mt-1 truncate text-white">{meeting.roomId.slice(0, 14)}…</div></div>
            <div className="rounded-xl bg-black/15 px-3 py-2"><div className="flex items-center gap-1.5 text-white/40"><UsersRound size={13} />Waiting</div><div className="mt-1 text-white">{meeting.waitingCount || 0}</div></div>
            <div className="rounded-xl bg-black/15 px-3 py-2"><div className="flex items-center gap-1.5 text-white/40"><Video size={13} />In room</div><div className="mt-1 text-white">{meeting.activeParticipants || 0}</div></div>
          </div>
          <button onClick={openMeeting} className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
            {meeting.open ? "Join meeting" : "Open waiting room"}
          </button>
        </div>
      )}
    </div>
  );
}
