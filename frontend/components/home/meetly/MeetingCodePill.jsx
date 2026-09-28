"use client";

export default function MeetingCodePill() {
  return (
    <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full border border-[#e0e6df] bg-white/70 px-3 py-2 shadow-[0_4px_12px_rgba(70,92,77,0.05)]">
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((dot) => <span key={dot} className="h-1 w-1 rounded-full bg-[#96a099]" />)}
      </span>
      <span className="grid h-4 w-4 place-items-center rounded-full bg-[#6b9078] text-[9px] text-white">›</span>
    </span>
  );
}
