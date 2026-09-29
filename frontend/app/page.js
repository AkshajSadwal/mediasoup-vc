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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
    router.push(`/room/${crypto.randomUUID()}`);
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
    if (!normalized) throw new Error("Enter a meeting code.");
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
    <main className="min-h-screen overflow-x-hidden bg-white text-[#111827]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[780px] overflow-hidden"><div className="absolute -left-[12%] top-[150px] h-[420px] w-[520px] rounded-full bg-[#e7f0ff] blur-[110px]" /><div className="absolute left-[48%] top-[70px] h-[420px] w-[520px] rounded-full bg-[#eef6ff] blur-[120px]" /><div className="absolute right-[-10%] top-[210px] h-[420px] w-[520px] rounded-full bg-[#f1f6ff] blur-[120px]" /></div>
      <LandingHeader session={session} onMeetingAction={meetingAction} />
      <div className="relative mx-auto max-w-[1580px] px-7 pb-10 lg:px-12">
        <section className="grid items-center gap-8 lg:grid-cols-[0.86fr_1.14fr]">
          <HeroCopy onCreate={() => setModal("create")} onJoin={() => setModal("join")} />
          <MeetingHeroVisual onAddMeeting={() => { if (ensureAuth("/")) setModal("add"); }} />
        </section>
        <div className="mt-2 sm:mt-5"><FeatureStrip /></div>
      </div>

      {(modal === "create" || modal === "join") && <MeetingActionModal mode={modal} onClose={() => setModal(null)} onCreateInstant={createInstantMeeting} onSchedule={scheduleMeeting} onJoin={async (roomId) => { try { await joinMeeting(roomId); } catch (error) { setJoinError(error.message); throw error; } }} />}
      {modal === "add" && <AddMeetingModal session={session} onClose={() => setModal(null)} onSaved={() => {}} />}
      {joinError && <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#d8e0ea] bg-white px-4 py-2 text-[12px] font-medium text-[#536173] shadow-[0_12px_30px_rgba(15,23,42,0.12)]">{joinError}</div>}
    </main>
  );
}
