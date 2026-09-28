"use client";

import { ArrowRight } from "lucide-react";

export default function ActionCard({ icon: Icon, title, description, onClick, size = "large", children }) {
  const isLarge = size === "large";
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[14px] border border-[#e7ece6] bg-[#eef3ec] text-left transition hover:-translate-y-0.5 hover:border-[#d8e1d7] hover:shadow-[0_12px_28px_rgba(88,111,95,0.08)] ${isLarge ? "min-h-[114px] p-4.5" : "min-h-[98px] p-4"}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <p className={`font-medium tracking-[-0.02em] text-[#233027] ${isLarge ? "text-[14px]" : "text-[13px]"}`}>{title}</p>
          <p className={`mt-2 max-w-[145px] leading-4 text-[#8a948e] ${isLarge ? "text-[11px]" : "text-[10px]"}`}>{description}</p>
        </div>
        <ArrowRight className="mt-3 h-3.5 w-3.5 text-[#3f5448] transition group-hover:translate-x-0.5" strokeWidth={1.8} />
      </div>
      {Icon && (
        <span className={`absolute right-5 top-1/2 -translate-y-1/2 grid place-items-center rounded-full text-[#66816e] ${isLarge ? "h-12 w-12 bg-[#dde8de]" : "h-10 w-10 bg-[#dce7dd]"}`}>
          <Icon className={isLarge ? "h-6 w-6" : "h-5 w-5"} strokeWidth={1.8} />
        </span>
      )}
      {children}
    </button>
  );
}
