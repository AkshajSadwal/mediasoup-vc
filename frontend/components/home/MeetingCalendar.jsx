"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const startOfDay = (date) => { const value = new Date(date); value.setHours(0,0,0,0); return value; };
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

export default function MeetingCalendar({ selectedDate, today, onSelect, onPrev, onNext, onToday, meetings = [] }) {
  const center = new Date(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(center);
    day.setDate(center.getDate() + index - 3);
    return day;
  });

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-5 shadow-[0_14px_42px_rgba(15,23,42,0.06)] sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-950">{center.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
            <p className="text-xs text-slate-400">Your meeting calendar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToday} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Today</button>
          <button onClick={onPrev} aria-label="Previous day" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={onNext} aria-label="Next day" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const active = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const count = meetings.filter((meeting) => isSameDay(meeting.scheduledAt, day)).length;
          return (
            <button key={day.toISOString()} onClick={() => onSelect(day)} className={`rounded-2xl px-2 py-3 text-center transition ${active ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
              <div className="text-[11px] font-medium">{day.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className={`mt-1 text-xl font-semibold ${active ? "text-blue-600" : "text-slate-950"}`}>{day.getDate()}</div>
              <div className={`mx-auto mt-2 h-1.5 w-1.5 rounded-full ${count ? "bg-blue-500" : "bg-transparent"}`} />
              {isToday && !active ? <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Today</div> : <div className="mt-1 h-[11px]" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
