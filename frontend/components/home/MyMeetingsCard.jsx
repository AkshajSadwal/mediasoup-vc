"use client";

import { CalendarDays, ChevronRight, MoreVertical, Users, Video } from "lucide-react";
import MeetingStatusBadge from "./MeetingStatusBadge";

const getStatus = (meeting) => {
  if (Number(meeting?.activeParticipants || 0) > 0 && meeting?.open) return "ongoing";
  if (meeting?.status === "live") return "past";
  return "upcoming";
};

export default function MyMeetingsCard({ meetings, view, onViewChange, loading, onOpenMeeting, onJoin }) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_14px_42px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-bold tracking-tight text-slate-950">My meetings</p>
          <p className="mt-1 text-sm text-slate-400">Your scheduled and saved meeting rooms</p>
        </div>
        <div className="flex rounded-full bg-slate-50 p-1">
          {[["all", "All"], ["upcoming", "Upcoming"], ["ongoing", "Ongoing"], ["past", "Past"]].map(([key, label]) => (
            <button key={key} onClick={() => onViewChange(key)} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${view === key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        {loading && meetings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Loading meetings…</div>
        ) : meetings.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400"><CalendarDays className="h-5 w-5" /></div>
            <p className="mt-4 font-semibold text-slate-800">No meetings here</p>
            <p className="mt-1 text-sm text-slate-400">Schedule one or join a scheduled room to add it to your calendar.</p>
            <button onClick={onJoin} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Join meeting</button>
          </div>
        ) : (
          meetings.map((meeting) => {
            const status = getStatus(meeting);
            return (
              <div key={meeting.roomId} className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${status === "ongoing" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                    <Video className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{meeting.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {new Date(meeting.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      {meeting.status === "live" ? " · Live room" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:pl-4">
                  {status === "ongoing" && Number(meeting.activeParticipants || 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"><Users className="h-3.5 w-3.5" /> {meeting.activeParticipants}</span>
                  )}
                  <MeetingStatusBadge status={status} />
                  <button onClick={() => onOpenMeeting(meeting)} className="hidden h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-50 sm:grid" aria-label="Open meeting"><ChevronRight className="h-4 w-4" /></button>
                  <button className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-50" aria-label="Meeting options"><MoreVertical className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
