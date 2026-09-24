"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarClock, Clock, Play, Video } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function WaitingRoomPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace(`/login?callbackUrl=${encodeURIComponent(`/waiting/${roomId}`)}`);
  }, [sessionStatus, router, roomId]);

  useEffect(() => {
    if (!roomId || sessionStatus === "loading") return;
    let cancelled = false;
    let timer;

    const load = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}`, {
          headers: session?.backendToken
            ? { Authorization: `Bearer ${session.backendToken}` }
            : undefined,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Meeting not found.");
        if (cancelled) return;
        setMeeting(data);
        if (data.open) {
          router.replace(`/room/${roomId}`);
          return;
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
      timer = window.setTimeout(load, 2000);
    };

    load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [roomId, router, session?.backendToken, sessionStatus]);

  const startMeeting = async () => {
    if (!session?.backendToken) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.backendToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start meeting.");
      router.replace(`/room/${roomId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  if (sessionStatus === "loading" || !meeting) return <main className="min-h-screen bg-[#030712] text-white grid place-items-center">{error ? error : "Loading waiting room..."}</main>;

  return (
    <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl p-8 text-center shadow-2xl">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-cyan-400/10"><Clock className="h-10 w-10 text-cyan-300" /></div>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-cyan-300">Waiting room</p>
        <h1 className="mt-2 text-4xl font-bold">{meeting.title}</h1>
        <p className="mt-3 text-white/60">Hosted by {meeting.hostName}. The meeting is not open yet.</p>
        <div className="mt-8 grid gap-3 rounded-2xl bg-black/20 p-5 text-left sm:grid-cols-2"><div className="flex items-center gap-3"><CalendarClock className="text-cyan-300" /><div><div className="text-xs text-white/40">Scheduled for</div><div className="font-medium">{new Date(meeting.scheduledAt).toLocaleString()}</div></div></div><div className="flex items-center gap-3"><Video className="text-cyan-300" /><div><div className="text-xs text-white/40">Room</div><div className="break-all font-medium">{roomId}</div></div></div></div>
        {error && <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-red-300">{error}</p>}
        {meeting.isHost && <button onClick={startMeeting} disabled={starting} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold disabled:opacity-50"><Play size={18} /> {starting ? "Starting..." : "Start meeting now"}</button>}
        {!meeting.isHost && <p className="mt-6 text-sm text-white/40">This page checks automatically and will enter the meeting when it opens.</p>}
      </div>
    </main>
  );
}
