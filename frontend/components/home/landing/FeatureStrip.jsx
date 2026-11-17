"use client";

import FeatureCard from "./FeatureCard";
import { CalendarDays, Link2, Video } from "lucide-react";

export default function FeatureStrip({ onInstant, onSchedule, onJoin }) {
  return <section aria-label="Ways to meet" className="grid gap-4 sm:grid-cols-3 lg:gap-5">
    <FeatureCard icon={Video} title="Meet instantly" description="Start a room in seconds and get the conversation flowing." tone="blue" onClick={onInstant} />
    <FeatureCard icon={CalendarDays} title="Plan ahead" description="Make time for the moments that matter to your team." tone="green" onClick={onSchedule} />
    <FeatureCard icon={Link2} title="Join a room" description="A meeting code is all you need to get connected." tone="purple" onClick={onJoin} />
  </section>;
}
