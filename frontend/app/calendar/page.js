"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function formatMonth(date) { return date.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }

export default function CalendarPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [meetings, setMeetings] = useState([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=/calendar");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.backendToken) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/meetings`, { headers: { Authorization: `Bearer ${session.backendToken}` }, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your calendar.");
        if (!cancelled) { setMeetings(data); setError(""); }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [status, session?.backendToken]);

  const visible = useMemo(() => meetings.filter((meeting) => {
    const d = new Date(meeting.scheduledAt);
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)), [meetings, month]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(month);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  const meetingsOnDay = (date) => !date ? [] : visible.filter((meeting) => new Date(meeting.scheduledAt).toDateString() === date.toDateString());

  if (status === "loading" || !session) return <main className="grid min-h-screen place-items-center bg-white text-[#334155]">Loading...</main>;

  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#111827]">
      <div className="mx-auto max-w-[1380px] px-6 py-7 lg:px-10">
        <header className="flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#176df3] text-white shadow-[0_10px_24px_rgba(23,109,243,0.18)]"><Video className="h-5 w-5" /></span><span className="text-[21px] font-semibold tracking-[-0.03em]">Rauma</span></button>
          <button onClick={() => router.push("/")} className="rounded-[11px] border border-[#dbe3ed] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#344054] hover:bg-[#f8fafc]">Back home</button>
        </header>

        <section className="mt-8 rounded-[28px] border border-[#e4eaf2] bg-white p-6 shadow-[0_20px_70px_rgba(24,45,80,0.06)] lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7b8aa0]">Your calendar</p><h1 className="mt-1 text-[31px] font-semibold tracking-[-0.04em]">{formatMonth(month)}</h1><p className="mt-1 text-[13px] text-[#728095]">All meetings you scheduled or added from a room code.</p></div><div className="flex items-center gap-2"><button onClick={() => setMonth(startOfMonth(new Date()))} className="rounded-[11px] border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#536173] hover:bg-[#f6f9fc]">Today</button><button onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="grid h-10 w-10 place-items-center rounded-[11px] border border-[#e2e8f0] hover:bg-[#f6f9fc]"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="grid h-10 w-10 place-items-center rounded-[11px] border border-[#e2e8f0] hover:bg-[#f6f9fc]"><ChevronRight className="h-4 w-4" /></button></div></div>

          <div className="mt-7 grid grid-cols-7 overflow-hidden rounded-[20px] border border-[#e8edf3]">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => <div key={day} className="bg-[#f8fbfe] px-3 py-3 text-center text-[11px] font-semibold text-[#7d8999]">{day}</div>)}
            {calendarDays.map((day, index) => {
              const dayMeetings = meetingsOnDay(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              return <div key={`${day?.toISOString() || "empty"}-${index}`} className="min-h-[128px] border-t border-r border-[#eef2f6] bg-white p-2.5 last:border-r-0">
                {day && <><div className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-semibold ${isToday ? "bg-[#e7f1ff] text-[#176df3]" : "text-[#526074]"}`}>{day.getDate()}</div><div className="mt-2 space-y-1.5">{dayMeetings.slice(0, 3).map((meeting) => <button key={meeting.roomId} onClick={() => router.push(meeting.open ? `/room/${meeting.roomId}` : `/waiting/${meeting.roomId}`)} className="block w-full rounded-[9px] bg-[#eef6ff] px-2.5 py-2 text-left hover:bg-[#e4f0ff]"><div className="truncate text-[11px] font-semibold text-[#1b5fbf]">{meeting.title}</div><div className="mt-0.5 text-[10px] text-[#738196]">{new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div></button>)}{dayMeetings.length > 3 && <div className="px-2 text-[10px] font-semibold text-[#7a879a]">+{dayMeetings.length - 3} more</div>}</div></>}
              </div>;
            })}
          </div>

          <div className="mt-8"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#176df3]" /><h2 className="text-[16px] font-semibold">Meetings this month</h2></div>{error && <p className="mt-4 rounded-[13px] bg-[#fff0f1] px-4 py-3 text-[13px] font-medium text-[#c53b4a]">{error}</p>}{loading ? <p className="mt-4 text-[13px] text-[#7c8999]">Loading meetings...</p> : visible.length === 0 ? <p className="mt-4 rounded-[16px] bg-[#f7f9fc] px-4 py-5 text-[13px] text-[#778397]">No scheduled meetings in this month.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{visible.map((meeting) => <div key={meeting.roomId} className="flex items-center justify-between rounded-[16px] border border-[#e7edf3] bg-white p-4"><div className="min-w-0"><div className="truncate text-[14px] font-semibold text-[#182334]">{meeting.title}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-[#7d8999]"><Clock3 className="h-3.5 w-3.5" />{new Date(meeting.scheduledAt).toLocaleString()} {meeting.isHost ? "· Host" : "· Added"}</div></div><button onClick={() => router.push(meeting.open ? `/room/${meeting.roomId}` : `/waiting/${meeting.roomId}`)} className="ml-3 rounded-[10px] bg-[#176df3] px-3.5 py-2 text-[11px] font-semibold text-white">{meeting.open ? "Join" : "Open"}</button></div>)}</div>}</div>
        </section>
      </div>
    </main>
  );
}
