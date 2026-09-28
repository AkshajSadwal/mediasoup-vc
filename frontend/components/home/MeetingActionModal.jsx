"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Link2, Video, X } from "lucide-react";

export default function MeetingActionModal({ mode = "create", onClose, onCreateInstant, onSchedule, onJoin }) {
  const [activeMode, setActiveMode] = useState(mode === "join" ? "join" : "create");
  const [activeCreateMode, setActiveCreateMode] = useState("instant");
  const [title, setTitle] = useState("Rauma Meeting");
  const [scheduledAt, setScheduledAt] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (activeMode === "join") {
        await onJoin(roomId);
        return;
      }

      if (activeCreateMode === "instant") {
        await onCreateInstant();
        return;
      }

      if (!scheduledAt) throw new Error("Choose a date and time.");
      await onSchedule({ title, scheduledAt });
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#132033]/28 p-5 backdrop-blur-[7px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[510px] overflow-hidden rounded-[28px] border border-[#e6ebf2] bg-white shadow-[0_30px_100px_rgba(22,38,66,0.22)]">
        <div className="flex items-start justify-between px-7 pb-4 pt-6">
          <div>
            <h2 className="text-[23px] font-semibold tracking-[-0.03em] text-[#111827]">{activeMode === "join" ? "Join a meeting" : "New meeting"}</h2>
            <p className="mt-1 text-[13px] text-[#778397]">{activeMode === "join" ? "Enter a room code to join." : "Start now or reserve a room for later."}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[#738096] transition hover:bg-[#f3f6fa] hover:text-[#111827]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-7 pb-7">
          {activeMode === "join" ? (
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-[18px] bg-[#f4f8fd] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#e4efff] text-[#1a6ef3]"><Link2 className="h-5 w-5" /></span>
                  <div>
                    <div className="text-[14px] font-semibold text-[#17202d]">Meeting code</div>
                    <div className="mt-0.5 text-[12px] text-[#728095]">Paste the scheduled or instant room ID.</div>
                  </div>
                </div>
              </div>
              <input autoFocus value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter meeting code" className="h-13 w-full rounded-[14px] border border-[#dfe5ee] bg-white px-4 text-[15px] outline-none transition focus:border-[#2a77f4] focus:ring-4 focus:ring-[#2a77f4]/10" />
              {error && <p className="rounded-[13px] bg-[#fff0f1] px-4 py-3 text-[13px] font-medium text-[#c53b4a]">{error}</p>}
              <button disabled={busy} className="h-[54px] w-full rounded-[15px] bg-[#176df3] text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(23,109,243,0.2)] transition hover:bg-[#0f62e6] disabled:opacity-60">{busy ? "Joining..." : "Join meeting"}</button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#f0f4f9] p-1">
                <button type="button" onClick={() => { setActiveMode("create"); setActiveCreateMode("instant"); setError(""); }} className={`rounded-[11px] px-4 py-2.5 text-[13px] font-semibold transition ${activeCreateMode === "instant" ? "bg-white text-[#176df3] shadow-sm" : "text-[#6b7789]"}`}>Instant meeting</button>
                <button type="button" onClick={() => { setActiveMode("create"); setActiveCreateMode("schedule"); setError(""); }} className={`rounded-[11px] px-4 py-2.5 text-[13px] font-semibold transition ${activeCreateMode === "schedule" ? "bg-white text-[#176df3] shadow-sm" : "text-[#6b7789]"}`}>Schedule meeting</button>
              </div>

              {activeCreateMode === "instant" ? (
                <div className="rounded-[18px] bg-[#edf5ff] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#dcecff] text-[#176df3]"><Video className="h-5 w-5" /></span>
                    <div>
                      <div className="text-[14px] font-semibold text-[#142033]">Start a room right now</div>
                      <div className="mt-1 text-[12px] leading-5 text-[#718096]">Rauma will create a fresh room code and take you straight into the meeting.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#596679]">Meeting title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-13 w-full rounded-[14px] border border-[#dfe5ee] px-4 outline-none focus:border-[#2a77f4] focus:ring-4 focus:ring-[#2a77f4]/10" /></label>
                  <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#596679]">Date and time</span><input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-13 w-full rounded-[14px] border border-[#dfe5ee] px-4 outline-none focus:border-[#2a77f4] focus:ring-4 focus:ring-[#2a77f4]/10" /></label>
                </div>
              )}

              {error && <p className="rounded-[13px] bg-[#fff0f1] px-4 py-3 text-[13px] font-medium text-[#c53b4a]">{error}</p>}
              <button disabled={busy} className="h-[54px] w-full rounded-[15px] bg-[#176df3] text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(23,109,243,0.2)] transition hover:bg-[#0f62e6] disabled:opacity-60">{busy ? (activeCreateMode === "instant" ? "Starting..." : "Scheduling...") : (activeCreateMode === "instant" ? "Start instant meeting" : "Schedule meeting")}</button>
              {activeCreateMode === "schedule" && <div className="flex items-center justify-center gap-2 text-[11px] text-[#93a0b2]"><CalendarClock className="h-3.5 w-3.5" />Scheduled rooms stay reserved until opened.</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
