"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, CalendarClock, Clock, Play, Video } from "lucide-react";

const BACKEND_URL = "";

export default function WaitingRoomPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated")
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(`/waiting/${roomId}`)}`,
      );
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
        if (data.open && data.canJoin) {
          router.replace(`/room/${roomId}`);
          return;
        }
        if (data.visibility === "private" && !data.isHost) {
          const accessResponse = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/access`, { headers: { Authorization: `Bearer ${session.backendToken}` } });
          const access = await accessResponse.json();
          if (data.open && access.canJoin) { router.replace(`/room/${roomId}`); return; }
          setRequestStatus((prior) => access.requestStatus || (access.canJoin ? "approved" : null) || prior || "not_requested");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
      timer = window.setTimeout(load, 2000);
    };

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, router, session?.backendToken, session?.user?.id, sessionStatus]);

  const updateVisibility = async (visibility) => {
    if (!session?.backendToken) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` }, body: JSON.stringify({ visibility }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update meeting settings.");
      setMeeting(data);
    } catch (err) { setError(err.message); }
  };

  const requestAccess = async () => {
    if (!session?.backendToken) return;
    setRequesting(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/request-access`, { method: "POST", headers: { Authorization: `Bearer ${session.backendToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not request access.");
      if (data.canJoin) router.replace(`/room/${roomId}`);
      else setRequestStatus(data.requestStatus || "pending");
    } catch (err) { setError(err.message); }
    finally { setRequesting(false); }
  };

  const startMeeting = async () => {
    if (!session?.backendToken) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/meetings/${roomId}/start`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.backendToken}` },
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not start meeting.");
      router.replace(`/room/${roomId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  if (sessionStatus === "loading" || !meeting)
    return (
      <main className="site-shell grid min-h-screen place-items-center px-6 text-[#17213c]">
        {error ? error : "Loading waiting room..."}
      </main>
    );

  return (
    <main className="site-shell relative flex min-h-screen items-center justify-center px-4 pb-10 pt-24 text-[#17213c] sm:px-8">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="absolute left-5 top-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e2e7f2] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#66748b] shadow-sm transition hover:bg-[#f4f6ff] sm:left-9"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="w-full max-w-[710px] rounded-[26px] border border-[#e3e8f2] bg-white px-5 py-8 text-center shadow-[0_25px_80px_rgba(31,51,95,.10)] sm:px-10 sm:py-11">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[25px] bg-[#e9edff]">
          <Clock className="h-10 w-10 text-[#526bf6]" />
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[.18em] text-[#526bf6]">
          Waiting room
        </p>
        <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.7rem)] font-bold tracking-[-.05em]">{meeting.title || "Private meeting"}</h1>
        <p className="mt-3 text-[#64748b]">
          {meeting.hostName ? `Hosted by ${meeting.hostName}. ` : ""}
          {meeting.open ? "Waiting for permission to join." : "The meeting is not open yet."}
        </p>
        <div className="mt-8 grid gap-4 rounded-[18px] border border-[#e8ecf5] bg-[#f8faff] p-5 text-left sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <CalendarClock className="text-[#176df3]" />
            <div>
              <div className="text-xs text-[#8795a8]">{meeting.scheduledAt ? "Scheduled for" : "Opening"}</div>
              <div className="font-medium">
                {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : "When the host starts the meeting"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Video className="text-[#176df3]" />
            <div>
              <div className="text-xs text-[#8795a8]">Room</div>
              <div className="break-all font-medium">{roomId}</div>
            </div>
          </div>
        </div>
        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-red-700">
            {error}
          </p>
        )}
        {meeting.isHost && meeting.joinRequests?.some((item) => item.status === "pending") && <section className="mt-6 rounded-2xl border border-[#dce6f2] bg-white p-4 text-left">
          <h2 className="font-semibold">Pending join requests</h2>
          <div className="mt-3 space-y-2">{meeting.joinRequests.filter((item) => item.status === "pending").map((item) => <div key={item.userId} className="flex items-center gap-2 rounded-xl bg-[#f4f8fd] p-3"><span className="min-w-0 flex-1 truncate text-sm">{item.userName}</span><button onClick={async () => { try { const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/requests/${encodeURIComponent(item.userId)}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` }, body: JSON.stringify({ approved: true }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMeeting(data); } catch (err) { setError(err.message); } }} className="rounded-lg bg-[#176df3] px-3 py-2 text-xs font-semibold text-white">Approve</button><button onClick={async () => { try { const response = await fetch(`${BACKEND_URL}/api/meetings/${roomId}/requests/${encodeURIComponent(item.userId)}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` }, body: JSON.stringify({ approved: false }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMeeting(data); } catch (err) { setError(err.message); } }} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Deny</button></div>)}</div>
        </section>}
        {meeting.isHost && <div className="mt-6 rounded-2xl border border-[#dce6f2] bg-[#f7faff] p-4 text-left">
          <h2 className="font-semibold">Meeting access</h2>
          <p className="mt-1 text-sm text-[#64748b]">You can change this before or during the meeting.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => updateVisibility("public")} className={`rounded-xl border px-4 py-2 text-sm font-medium ${meeting.visibility !== "private" ? "border-[#176df3] bg-[#e8f1ff] text-[#176df3]" : "border-[#dce6f2] bg-white text-[#526176]"}`}>Public</button>
            <button onClick={() => updateVisibility("private")} className={`rounded-xl border px-4 py-2 text-sm font-medium ${meeting.visibility === "private" ? "border-[#176df3] bg-[#e8f1ff] text-[#176df3]" : "border-[#dce6f2] bg-white text-[#526176]"}`}>Private</button>
          </div>
        </div>}
        {meeting.isHost && (
          <button
            onClick={startMeeting}
            disabled={starting}
            className="primary-button mt-6 text-white disabled:opacity-50"
          >
            <Play size={18} /> {starting ? "Starting..." : "Start meeting now"}
          </button>
        )}
        {!meeting.isHost && meeting.visibility === "private" && !meeting.canJoin && <div className="mt-6 space-y-3">
          <p className="text-sm text-[#64748b]">This is a private meeting. Request access from the host or a moderator.</p>
          <button onClick={requestAccess} disabled={requesting || requestStatus === "pending" || requestStatus === "approved"} className="primary-button text-white disabled:opacity-50">{requesting ? "Sending request..." : requestStatus === "pending" ? "Request pending" : requestStatus === "approved" ? "Access approved — waiting for host" : "Request to join"}</button>
          {requestStatus === "denied" && <p className="text-sm text-red-600">Your request was denied. You can contact the host.</p>}
          {requestStatus === "approved" && <p className="text-sm text-emerald-700">Access approved. You can join when the host starts the meeting.</p>}
        </div>}
        {!meeting.isHost && !meeting.open && <p className="mt-6 text-sm text-[#8795a8]">This page updates automatically. You will enter the room when it opens.</p>}
      </div>
    </main>
  );
}
