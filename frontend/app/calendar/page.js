"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const BACKEND_URL = "";
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const sameDay = (a, b) => Boolean(a && b) && a.toDateString() === b.toDateString();
const formatDay = (date) => date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export default function CalendarPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [meetings, setMeetings] = useState([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryDate = new URLSearchParams(window.location.search).get("date");
    if (!queryDate) return;
    const parsed = new Date(queryDate);
    if (Number.isFinite(parsed.getTime())) { setSelected(parsed); setMonth(startOfMonth(parsed)); }
  }, []);
  useEffect(() => { if (status === "unauthenticated") router.replace("/login?callbackUrl=/calendar"); }, [status, router]);
  useEffect(() => {
    if (status !== "authenticated" || !session?.backendToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/meetings`, { headers: { Authorization: `Bearer ${session.backendToken}` }, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your calendar.");
        if (!cancelled) { setMeetings(Array.isArray(data) ? data : []); setError(""); }
      } catch (failure) { if (!cancelled) setError(failure.message || "Could not load meetings."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [status, session?.backendToken]);

  const visible = useMemo(() => meetings.filter((meeting) => {
    const date = new Date(meeting.scheduledAt);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)), [meetings, month]);
  const selectedMeetings = useMemo(() => visible.filter((meeting) => sameDay(new Date(meeting.scheduledAt), selected)), [visible, selected]);
  const days = useMemo(() => {
    const offset = (startOfMonth(month).getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list = Array(offset).fill(null);
    for (let i = 1; i <= count; i++) list.push(new Date(month.getFullYear(), month.getMonth(), i));
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);
  const chooseMonth = (delta) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(next);
  };
  const openMeeting = (meeting) => router.push(meeting.open ? `/room/${meeting.roomId}` : `/waiting/${meeting.roomId}`);

  if (status === "loading" || !session) return <main className="grid min-h-screen place-items-center bg-[#f8faff] text-[#67758e]">Loading your calendar…</main>;

  return <main className="site-shell min-h-screen px-4 py-7 text-[#17213c] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-[1360px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => router.push("/")} aria-label="Rauma home" className="flex items-center gap-3"><span className="brand-symbol"><Video size={19}/></span><span className="text-[21px] font-bold tracking-[-.05em]">rauma<span className="text-[#526bf6]">.</span></span></button>
        <div className="flex items-center gap-2"><button onClick={() => router.push("/")} className="secondary-button !min-h-10 !px-4 !py-2.5 text-[12px]"><ArrowLeft size={16}/> Home</button><button onClick={() => router.push("/schedule")} className="primary-button !min-h-10 !px-4 !py-2.5 text-[12px]"><Plus size={17}/> New meeting</button></div>
      </header>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#526bf6]">Your workspace</p><h1 className="mt-2 text-[clamp(2.3rem,4.5vw,3.7rem)] font-bold tracking-[-.06em]">Meeting calendar<span className="text-[#526bf6]">.</span></h1><p className="mt-2 text-[14px] text-[#7d899e]">A clear view of what's on your schedule.</p></div><div className="rounded-2xl border border-[#dce4f0] bg-white px-5 py-3 shadow-[0_8px_25px_rgba(30,45,88,.04)]"><span className="block text-[11px] font-medium text-[#8793a8]">This month</span><span className="text-[22px] font-bold text-[#1b2844]">{visible.length} <span className="text-[12px] font-semibold text-[#8591a5]">meeting{visible.length === 1 ? "" : "s"}</span></span></div></div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#e2e7f2] bg-white shadow-[0_16px_50px_rgba(35,51,99,.055)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f6] px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8c98af]">Your schedule</p><h2 className="text-[24px] font-bold tracking-[-.04em]">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><div className="flex items-center gap-2"><button onClick={() => { const today = new Date(); setMonth(startOfMonth(today)); setSelected(today); }} className="min-h-10 rounded-xl border border-[#e2e7f1] px-4 text-[12px] font-bold text-[#5b6b87] hover:bg-[#f5f7ff]">Today</button><button onClick={() => chooseMonth(-1)} title="Previous month" aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e2e7f1] hover:bg-[#f5f7ff]"><ChevronLeft size={18}/></button><button onClick={() => chooseMonth(1)} title="Next month" aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e2e7f1] hover:bg-[#f5f7ff]"><ChevronRight size={18}/></button></div></div>
          <div className="overflow-x-auto" aria-label="Calendar grid; scroll horizontally on a small screen"><div className="min-w-[650px]">
            <div className="grid grid-cols-7 border-b border-[#edf0f6] bg-[#f8faff]">{weekDays.map((day) => <div key={day} className="py-3 text-center text-[11px] font-bold uppercase tracking-[.08em] text-[#8290a9]">{day}</div>)}</div>
            <div className="grid grid-cols-7">{days.map((day, index) => {
              const entries = day ? visible.filter((meeting) => sameDay(new Date(meeting.scheduledAt), day)) : [];
              const isToday = day && sameDay(day, new Date());
              const isSelected = day && sameDay(day, selected);
              return <div key={day ? day.toISOString() : `empty-${index}`} className={`min-h-[115px] border-b border-r border-[#edf0f6] p-1.5 sm:p-2 ${day ? "bg-white" : "bg-[#fafbfe]"} ${isSelected ? "!bg-[#f2f5ff]" : ""}`}>
                {day && <><button aria-label={`Select ${formatDay(day)}`} aria-pressed={isSelected} onClick={() => setSelected(day)} className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold ${isToday ? "bg-[#526bf6] text-white" : isSelected ? "bg-[#dfe5ff] text-[#526bf6]" : "text-[#62718b] hover:bg-[#eef2ff]"}`}>{day.getDate()}</button><div className="mt-2 space-y-1">{entries.slice(0, 2).map((meeting) => <button key={meeting.roomId} onClick={() => openMeeting(meeting)} title={meeting.title} className="block w-full truncate rounded-[7px] border-l-[3px] border-[#647bff] bg-[#e9eeff] px-1.5 py-1.5 text-left text-[10px] font-semibold text-[#4558ae] hover:bg-[#dae3ff]">{meeting.title}</button>)}{entries.length > 2 && <button onClick={() => setSelected(day)} className="px-1 text-[10px] font-bold text-[#6475b4]">+{entries.length - 2} more</button>}</div></>}
              </div>;
            })}</div>
          </div></div>
          <p className="border-t border-[#edf0f6] px-5 py-3 text-[11px] text-[#98a2b5] sm:hidden">Scroll sideways to see the full calendar.</p>
        </section>
        <aside className="flex flex-col gap-5">
          <section className="rounded-[24px] border border-[#e2e7f2] bg-white p-6 shadow-[0_16px_50px_rgba(35,51,99,.055)]"><div className="flex items-center gap-2 text-[#526bf6]"><CalendarDays size={18}/><span className="text-[11px] font-bold uppercase tracking-[.12em]">Selected day</span></div><h2 className="mt-3 text-[20px] font-bold tracking-[-.04em]">{formatDay(selected)}</h2><p className="mt-1 text-[12px] text-[#8a96a9]">{selectedMeetings.length ? `${selectedMeetings.length} meeting${selectedMeetings.length === 1 ? "" : "s"} planned` : "No meetings planned"}</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff3f5] p-3 text-[12px] text-[#b14756]">{error}</p>}
            {loading ? <p className="mt-5 text-[13px] text-[#8996a9]">Loading meetings…</p> : selectedMeetings.length ? <div className="mt-5 space-y-3">{selectedMeetings.map((meeting) => <button key={meeting.roomId} onClick={() => openMeeting(meeting)} className="flex w-full items-start gap-3 rounded-[14px] border border-[#e6eaf4] p-3 text-left hover:border-[#bfcbff] hover:bg-[#f7f9ff]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9eeff] text-[#526bf6]"><Video size={17}/></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-[#1f2d4c]">{meeting.title}</span><span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8793a8]"><Clock3 size={12}/>{new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#526bf6]">{meeting.open ? "Join meeting" : "View waiting room"}<ArrowRight size={12}/></span></span></button>)}</div> : <div className="mt-6 rounded-[15px] bg-[#f8faff] px-4 py-7 text-center"><CalendarDays size={24} className="mx-auto text-[#acb7cc]"/><p className="mt-2 text-[12px] text-[#8592a8]">Your day is open.</p><button onClick={() => router.push("/schedule")} className="mt-3 text-[12px] font-bold text-[#526bf6]">Schedule something</button></div>}
          </section>
          <section className="rounded-[23px] bg-[#1a2745] p-6 text-white"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#a5b5e5]">Make space to connect</p><h3 className="mt-3 text-[19px] font-bold tracking-[-.03em]">Meet in a moment.</h3><p className="mt-2 text-[12px] leading-6 text-[#b1bdd4]">Turn a free slot into a productive conversation.</p><button onClick={() => router.push("/schedule")} className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] font-bold text-[#273761] hover:bg-[#edf1ff]">Schedule a meeting <ArrowRight size={15}/></button></section>
        </aside>
      </div>
    </div>
  </main>;
}
