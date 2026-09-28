"use client";

import FeatureCard from "./FeatureCard";
import { CalendarDays, ShieldCheck, UsersRound, Video } from "lucide-react";

export default function FeatureStrip() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FeatureCard icon={Video} title="Meet instantly" description="Start a video meeting with one click." tone="blue" />
      <FeatureCard icon={CalendarDays} title="Schedule meetings" description="Plan ahead and keep your team aligned." tone="green" />
      <FeatureCard icon={UsersRound} title="Join with a code" description="Join any meeting using a meeting code." tone="purple" />
      <FeatureCard icon={ShieldCheck} title="Built for teams" description="Reliable, secure, and simple to use." tone="orange" />
    </section>
  );
}
