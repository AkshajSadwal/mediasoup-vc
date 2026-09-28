"use client";

import { ArrowRight, CalendarClock, Link2, Plus, Video } from "lucide-react";

const ICONS = { create: Plus, join: Link2, rooms: CalendarClock };

export default function QuickAccessCard({ type, title, subtitle, onClick }) {
  const Icon = ICONS[type] || Video;
  return (
    <button
      onClick={onClick}
      className="group rounded-[24px] border border-white/10 bg-slate-950/35 p-4 text-left shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-slate-950/50"
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          <Icon size={19} />
        </span>
        <ArrowRight size={17} className="text-white/30 transition group-hover:translate-x-1 group-hover:text-white/70" />
      </div>
      <div className="mt-4 text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/40">{subtitle}</div>
    </button>
  );
}
