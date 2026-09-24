"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, Video } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("Rauma Meeting");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=/schedule");
  }, [status, router]);

  const create = async (event) => {
    event.preventDefault();
    setError("");
    if (!session?.backendToken) return setError("Please sign in again.");
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.backendToken}`,
        },
        body: JSON.stringify({ title, scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not schedule meeting.");
      setMeeting(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !session) return <main className="min-h-screen bg-[#030712] text-white grid place-items-center">Loading...</main>;

  return (
    <main className="min-h-screen bg-[#030712] text-white p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.push("/")} className="mb-8 flex items-center gap-2 text-white/60 hover:text-white"><Video size={18} /> Back to Rauma</button>
        <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/20 p-3"><CalendarClock className="text-cyan-300" /></div><div><h1 className="text-3xl font-bold">Schedule a meeting</h1><p className="text-white/60">A room ID is reserved immediately and stays in the waiting room until the meeting opens.</p></div></div>

          {!meeting ? (
            <form onSubmit={create} className="mt-8 space-y-5">
              <label className="block"><span className="mb-2 block text-sm text-white/60">Meeting title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" /></label>
              <label className="block"><span className="mb-2 block text-sm text-white/60">Date and time</span><input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400 [color-scheme:dark]" /></label>
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
              <button disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold disabled:opacity-50">{loading ? "Scheduling..." : "Reserve meeting room"}</button>
            </form>
          ) : (
            <div className="mt-8 space-y-5">
              <div className="rounded-2xl bg-emerald-500/10 p-5"><p className="text-sm text-emerald-300">Meeting scheduled</p><h2 className="mt-1 text-xl font-semibold">{meeting.title}</h2><p className="mt-2 text-white/70">{new Date(meeting.scheduledAt).toLocaleString()}</p></div>
              <div><p className="text-sm text-white/50">Reserved Room ID</p><div className="mt-2 flex gap-2"><input readOnly value={meeting.roomId} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /><button onClick={() => navigator.clipboard.writeText(meeting.roomId)} className="rounded-xl bg-white/10 px-4 hover:bg-white/20"><Copy size={18} /></button></div></div>
              <div className="flex flex-wrap gap-3"><button onClick={() => router.push(`/waiting/${meeting.roomId}`)} className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900">Open waiting room</button><button onClick={() => router.push("/")} className="rounded-xl bg-white/10 px-5 py-3">Done</button></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
