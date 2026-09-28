"use client";

import { CalendarClock, ChevronRight, Clock3, Copy, UsersRound, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import MeetingStatusBadge from "./MeetingStatusBadge";

function relativeTime(dateString) {
  const diff = new Date(dateString).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "now";
  if (minutes > 0) {
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  const ago = Math.abs(minutes);
  if (ago < 60) return `${ago}m ago`;
  if (ago < 1440) return `${Math.floor(ago / 60)}h ago`;
  return `${Math.floor(ago / 1440)}d ago`;
}

export default function MyRoomsCard({ meetings, loading, error, onRefresh }) {
  const router = useRouter();

  const openRoom = (meeting) => {
    router.push(meeting.open ? `/room/${meeting.roomId}` : `/waiting/${meeting.roomId}`);
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><CalendarClock size={18} className="text-cyan-300" /><h2 className="text-xl font-semibold text-white">My Rooms</h2></div>
          <p className="mt-1 text-xs text-white/40">Every meeting you have scheduled, with live room status.</p>
        </div>
        <button onClick={onRefresh} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white">Refresh</button>
      </div>

      <div className="mt-5 space-y-3">
        {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/45">Loading your meetings…</div>}
        {!loading && error && <div className="rounded-2xl border border-red-400/15 bg-red-400/5 p-5 text-sm text-red-300">{error}</div>}
        {!loading && !error && meetings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><CalendarClock size={20} /></div>
            <div className="mt-3 text-sm font-medium text-white">No scheduled rooms yet</div>
            <div className="mt-1 text-xs text-white/35">Schedule a meeting and it will appear here automatically.</div>
          </div>
        )}

        {!loading && !error && meetings.map((meeting) => (
          <div
            key={meeting.roomId}
            role="button"
            tabIndex={0}
            onClick={() => openRoom(meeting)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openRoom(meeting);
            }}
            className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.055]"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Video size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">{meeting.title}</span>
                  <MeetingStatusBadge meeting={meeting} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
                  <span className="inline-flex items-center gap-1.5"><CalendarClock size={12} />{new Date(meeting.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={12} />{relativeTime(meeting.scheduledAt)}</span>
                  <span className="inline-flex items-center gap-1.5"><UsersRound size={12} />{meeting.ongoing ? `${meeting.activeParticipants} in room` : `${meeting.waitingCount || 0} waiting`}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-white/25">
                  <span>Room ID</span><span className="font-mono text-white/45">{meeting.roomId}</span>
                  <button
                    type="button"
                    aria-label="Copy room ID"
                    onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(meeting.roomId); }}
                    className="rounded-md p-1 text-white/30 hover:bg-white/10 hover:text-white/70"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>
              <ChevronRight size={18} className="mt-3 shrink-0 text-white/25 transition group-hover:translate-x-1 group-hover:text-white/70" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
