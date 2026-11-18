"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

import MeetingActionModal from "@/components/home/MeetingActionModal";
import AddMeetingModal from "@/components/home/AddMeetingModal";
import LandingHeader from "@/components/home/landing/LandingHeader";
import HeroCopy from "@/components/home/landing/HeroCopy";
import MeetingHeroVisual from "@/components/home/landing/MeetingHeroVisual";
import FeatureStrip from "@/components/home/landing/FeatureStrip";

const BACKEND_URL = "";

export default function Home() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [modal, setModal] = useState(null);
  const [joinError, setJoinError] = useState("");

  const ensureAuth = (path = "/") => {
    if (sessionStatus !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(path)}`);
      return false;
    }
    return true;
  };

  const createInstantMeeting = async () => {
    if (!ensureAuth("/")) return;
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    const response = await fetch(`${BACKEND_URL}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` },
      body: JSON.stringify({ title: "Instant Rauma Meeting", scheduledAt, visibility: "public" }),
    });
    const meeting = await response.json();
    if (!response.ok) throw new Error(meeting.error || "Could not create meeting.");
    const startResponse = await fetch(`${BACKEND_URL}/api/meetings/${meeting.roomId}/start`, {
      method: "POST", headers: { Authorization: `Bearer ${session.backendToken}` },
    });
    const started = await startResponse.json();
    if (!startResponse.ok) throw new Error(started.error || "Could not start meeting.");
    router.push(`/room/${meeting.roomId}`);
  };

  const scheduleMeeting = async ({ title, scheduledAt }) => {
    if (!ensureAuth("/schedule")) return;
    const response = await fetch(`${BACKEND_URL}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.backendToken}` },
      body: JSON.stringify({ title, scheduledAt: new Date(scheduledAt).toISOString() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not schedule meeting.");
    setModal(null);
    router.push(`/calendar?date=${encodeURIComponent(data.scheduledAt)}`);
  };

  const joinMeeting = async (roomId) => {
    setJoinError("");
    const normalized = String(roomId || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(normalized)) throw new Error("Enter a valid meeting code (letters, numbers, hyphens, or underscores).");
    if (!ensureAuth(`/room/${normalized}`)) return;

    const lookup = await fetch(`${BACKEND_URL}/api/meetings/${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${session.backendToken}` }, cache: "no-store",
    });

    if (lookup.status === 404) {
      setModal(null);
      router.push(`/room/${normalized}`);
      return;
    }

    const meeting = await lookup.json();
    if (!lookup.ok) throw new Error(meeting.error || "Could not find that meeting.");
    if (meeting.status === "cancelled") throw new Error("This meeting has been cancelled.");

    if (meeting.status === "scheduled") {
      if (meeting.visibility === "private" && !meeting.canJoin) {
        setModal(null);
        router.push(`/waiting/${normalized}`);
        return;
      }
      const calendarResponse = await fetch(`${BACKEND_URL}/api/meetings/${encodeURIComponent(normalized)}/calendar`, {
        method: "POST", headers: { Authorization: `Bearer ${session.backendToken}` },
      });
      const calendarData = await calendarResponse.json();
      if (!calendarResponse.ok) throw new Error(calendarData.error || "Could not save this meeting.");
      setModal(null);
      router.push(calendarData.open ? `/room/${normalized}` : `/waiting/${normalized}`);
      return;
    }

    setModal(null);
    router.push(`/room/${normalized}`);
  };

  const meetingAction = (action) => {
    if (action === "config") {
      if (ensureAuth("/config-meeting")) router.push("/config-meeting");
      return;
    }
    if (action === "schedule") {
      if (!ensureAuth("/schedule")) return;
      router.push("/schedule");
      return;
    }
    if (action === "instant") {
      setModal("create");
      return;
    }
    setModal("join");
  };

  return (
    <main className="site-shell relative min-h-screen overflow-x-hidden text-[#16203b]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[850px] overflow-hidden"><div className="absolute -left-[18%] top-[150px] h-[530px] w-[630px] rounded-full bg-[#e9edff] opacity-70 blur-[110px]" /><div className="absolute right-[-18%] top-[10px] h-[620px] w-[780px] rounded-full bg-[#eaf7ff] opacity-60 blur-[115px]" /></div>
      <LandingHeader session={session} onMeetingAction={meetingAction} />
      <div className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-5 sm:px-8 lg:px-12">
        <section className="grid items-center gap-5 lg:min-h-[600px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-9">
          <HeroCopy onCreate={() => setModal("create")} onJoin={() => setModal("join")} />
          <MeetingHeroVisual onAddMeeting={() => { if (ensureAuth("/")) setModal("add"); }} />
        </section>
        <div className="relative mt-12 sm:mt-8 lg:mt-4">
          <FeatureStrip
            onInstant={() => { if (ensureAuth("/")) void createInstantMeeting().catch((error) => setJoinError(error.message || "Could not start the meeting.")); }}
            onSchedule={() => { if (ensureAuth("/schedule")) router.push("/schedule"); }}
            onJoin={() => { if (ensureAuth("/")) setModal("join"); }}
          />
        </div>
        <footer className="relative mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e5f0] pt-6 text-[12px] text-[#8792a7]"><span>Rauma · A better place to meet</span><span>Made for meaningful collaboration</span></footer>
      </div>

      {(modal === "create" || modal === "join") && <MeetingActionModal mode={modal} onClose={() => setModal(null)} onCreateInstant={createInstantMeeting} onSchedule={scheduleMeeting} onConfigure={() => meetingAction("config")} onJoin={async (roomId) => { try { await joinMeeting(roomId); } catch (error) { setJoinError(error.message); throw error; } }} />}
      {modal === "add" && <AddMeetingModal session={session} onClose={() => setModal(null)} onSaved={() => {}} />}
      {joinError && <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#d8e0ea] bg-white px-4 py-2 text-[12px] font-medium text-[#536173] shadow-[0_12px_30px_rgba(15,23,42,0.12)]">{joinError}</div>}
    </main>
  );
}
