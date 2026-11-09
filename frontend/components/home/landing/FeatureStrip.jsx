"use client";

import FeatureCard from "./FeatureCard";
import { CalendarDays, UsersRound, Video } from "lucide-react";

export default function FeatureStrip({ onInstant, onSchedule, onJoin }) {
  return (
    <section aria-label="Meeting features" className="grid gap-4 md:grid-cols-3">
      <FeatureCard icon={Video} title="Meet instantly" description="Start a video meeting with one click." tone="blue" onClick={onInstant} />
      <FeatureCard icon={CalendarDays} title="Schedule meetings" description="Plan ahead and keep your team aligned." tone="green" onClick={onSchedule} />
      <FeatureCard icon={UsersRound} title="Join with a code" description="Join any meeting using a meeting code." tone="purple" onClick={onJoin} />
    </section>
  );
}
