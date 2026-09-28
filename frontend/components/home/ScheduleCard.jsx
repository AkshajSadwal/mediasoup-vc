"use client";

import { CalendarClock, ChevronRight, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ScheduleCard({ nextMeeting }) {
  const router = useRouter();
  const dateValue = nextMeeting ? new Date(nextMeeting.scheduledAt) : null;

  return (
    <div className="rounded-[28px] border border-cyan-300/20 bg-slate-950/45 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <CalendarClock size={18} />
            <span className="text-sm font-medium">Schedule a Meeting</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-white">Plan your next meeting.</h2>
          <p className="mt-1 text-sm leading-6 text-white/50">Reserve a room now and let guests wait until it opens.</p>
        </div>
      </div>

      {nextMeeting ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/40">Next meeting</div>
            <div className="mt-1 truncate font-medium text-white">{nextMeeting.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-white/45"><CalendarClock size={14} />Date</div>
              <div className="mt-1 text-sm text-white">{dateValue.toLocaleDateString([], { month: "short", day: "numeric" })}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-white/45"><Clock3 size={14} />Time</div>
              <div className="mt-1 text-sm text-white">{dateValue.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
          No upcoming meetings yet. Your next room can start here.
        </div>
      )}

      <button
        onClick={() => router.push("/schedule")}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
      >
        <CalendarClock size={17} />
        Schedule meeting
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
