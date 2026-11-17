"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Clock3, Copy, Globe2, LockKeyhole, Video } from "lucide-react";

const BACKEND_URL = "";
function localMinDateTime() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("Rauma Meeting");
  const [scheduledAt, setScheduledAt] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [error, setError] = useState("");
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login?callbackUrl=/schedule"); }, [status, router]);

  const create = async (event) => {
    event.preventDefault(); setError("");
    if (!session?.backendToken) { setError("Please sign in again."); return; }
    const date = new Date(scheduledAt);
    if (!scheduledAt || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setError("Choose a future date and time."); return; }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` }, body: JSON.stringify({ title: title.trim(), scheduledAt: date.toISOString(), visibility }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not schedule meeting.");
      setMeeting(data);
    } catch (err) { setError(err.message || "Something went wrong."); }
    finally { setLoading(false); }
  };

  if (status === "loading" || !session) return <main className="grid min-h-screen place-items-center bg-[#f8faff] text-[#61708a]">Loading your workspace…</main>;

  return <main className="site-shell min-h-screen px-4 py-7 text-[#18223d] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-[980px]">
      <button type="button" onClick={() => router.push("/")} className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#e2e7f2] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#66738d] hover:text-[#536cf6]"><ArrowLeft size={16}/> Back to Rauma</button>
      <div className="mb-7"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#526bf6]">Rauma workspace</p><h1 className="mt-2 text-[clamp(2.1rem,4vw,3.3rem)] font-bold tracking-[-.06em]">Plan your next meeting.</h1><p className="mt-2 text-[14px] leading-6 text-[#78869e]">Set a time, choose your room access, and bring everyone together.</p></div>
      <div className="grid overflow-hidden rounded-[26px] border border-[#e1e7f1] bg-white shadow-[0_22px_70px_rgba(36,51,97,.08)] lg:grid-cols-[1fr_290px]">
        <section className="p-6 sm:p-9">
          {!meeting ? <form onSubmit={create} className="space-y-6">
            <div><div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-[#273652]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ebefff] text-[#526bf6]">1</span> Meeting details</div><label className="block"><span className="auth-label">Meeting name</span><input required value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="auth-input" placeholder="Weekly team sync" /></label></div>
            <div><div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-[#273652]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ebefff] text-[#526bf6]">2</span> Schedule</div><label className="block"><span className="auth-label">Date and time</span><input required type="datetime-local" min={localMinDateTime()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="auth-input" /></label><p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#8a96ab]"><Clock3 size={14}/> Uses your device's local time zone</p></div>
            <div><div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-[#273652]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ebefff] text-[#526bf6]">3</span> Who can join?</div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setVisibility("public")} aria-pressed={visibility === "public"} className={`rounded-[17px] border p-4 text-left ${visibility === "public" ? "border-[#6378f4] bg-[#f0f3ff]" : "border-[#dfe5f0] hover:bg-[#f8faff]"}`}><Globe2 size={19} className="text-[#526bf6]"/><span className="mt-2 block text-[13px] font-bold">Public</span><span className="mt-1 block text-[11px] leading-5 text-[#79879f]">Anyone with the meeting link can join.</span></button><button type="button" onClick={() => setVisibility("private")} aria-pressed={visibility === "private"} className={`rounded-[17px] border p-4 text-left ${visibility === "private" ? "border-[#6378f4] bg-[#f0f3ff]" : "border-[#dfe5f0] hover:bg-[#f8faff]"}`}><LockKeyhole size={19} className="text-[#526bf6]"/><span className="mt-2 block text-[13px] font-bold">Private</span><span className="mt-1 block text-[11px] leading-5 text-[#79879f]">New participants need approval.</span></button></div></div>
            {error && <p role="alert" className="rounded-xl border border-[#f5d5db] bg-[#fff3f5] px-4 py-3 text-[13px] text-[#a83f53]">{error}</p>}
            <button type="submit" disabled={loading} className="primary-button w-full disabled:opacity-60">{loading ? "Scheduling..." : "Schedule meeting"} {!loading && <ArrowRight size={18}/>}</button>
          </form> : <div className="flex min-h-[420px] flex-col justify-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#def6ec] text-[#12956e]"><CheckCircle2 size={28}/></span><h2 className="mt-5 text-[27px] font-bold tracking-[-.04em]">You're all set.</h2><p className="mt-2 text-[14px] leading-6 text-[#78869e]">Your meeting is scheduled and its room is ready to share.</p>
            <div className="mt-6 rounded-2xl border border-[#e2e7f1] bg-[#fafbff] p-5"><p className="text-[15px] font-bold">{meeting.title}</p><p className="mt-2 text-[13px] text-[#718099]">{new Date(meeting.scheduledAt).toLocaleString()}</p><p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-[#8994a8]">Meeting code</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded-xl bg-white px-3 py-3 text-[13px] text-[#3c4a68]">{meeting.roomId}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(meeting.roomId); setCopied(true); } catch { setError("Copy failed. Select the room ID to copy manually."); } }} className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf1ff] text-[#526bf6]" title="Copy meeting code" aria-label="Copy meeting code">{copied ? <Check size={19}/> : <Copy size={19}/>}</button></div></div>
            {error && <p role="alert" className="mt-3 text-[13px] text-[#a83f53]">{error}</p>}
            <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => router.push(`/waiting/${meeting.roomId}`)} className="primary-button">Open waiting room <ArrowRight size={17}/></button><button onClick={() => router.push("/calendar")} className="secondary-button">View calendar</button></div>
          </div>}
        </section>
        <aside className="border-t border-[#e5eaf3] bg-[#f6f8ff] p-7 lg:border-l lg:border-t-0 lg:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6ecff] text-[#526bf6]"><CalendarClock size={24}/></span><h2 className="mt-6 text-[20px] font-bold tracking-[-.03em]">A little planning goes a long way.</h2><p className="mt-3 text-[13px] leading-6 text-[#77869e]">Every scheduled meeting gets its own room code, so you can share the details when you're ready.</p><div className="mt-7 space-y-5 border-t border-[#e2e7f1] pt-6">{["Share a dedicated room link", "Control access with approval", "Find meetings in your calendar"].map((item) => <div key={item} className="flex gap-3 text-[12px] font-medium text-[#62718c]"><CheckCircle2 size={17} className="shrink-0 text-[#2ca38a]"/>{item}</div>)}</div></aside>
      </div>
    </div>
  </main>;
}
