"use client";

import { ArrowRight, Link2, ShieldCheck, Sparkles, Video } from "lucide-react";

export default function HeroCopy({ onCreate, onJoin }) {
  return (
    <section className="relative z-10 flex flex-col justify-center py-8 lg:py-16">
      <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-[#dfe5ff] bg-white/80 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#5869d2] shadow-[0_6px_24px_rgba(68,93,167,.04)]"><Sparkles size={14} /> Your space to connect</div>
      <h1 className="max-w-[720px] text-[clamp(2.45rem,4.6vw,5.95rem)] sm:text-[clamp(3.6rem,5.55vw,5.95rem)] font-bold leading-[1.025] tracking-[-.074em] text-[#121a34]">
        Make room for <span className="relative inline-block text-[#536cf6]">better<span className="absolute bottom-[.02em] left-1 right-0 -z-10 h-[.16em] -rotate-[2deg] rounded-full bg-[#dfe5ff]" /></span> conversations.
      </h1>
      <p className="mt-7 max-w-[520px] text-[16px] leading-[1.8] text-[#68758d] sm:text-[18px]">From a quick catch-up to your team's next big idea. Bring everyone together with effortless video meetings and tools that keep you in sync.</p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onCreate} className="primary-button group"><Video size={20} /> Start a meeting <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
        <button type="button" onClick={onJoin} className="secondary-button"><Link2 size={19} /> Join with a code</button>
      </div>
      <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] font-medium text-[#78839a]"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#2ea893]" /> Host-controlled rooms</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#38c4a9]" /> Built for real-time teamwork</span></div>
    </section>
  );
}
