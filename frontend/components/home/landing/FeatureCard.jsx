"use client";

import { ArrowUpRight } from "lucide-react";

const tones = {
  blue: { icon: "bg-[#dee6ff] text-[#536cf6]" },
  green: { icon: "bg-[#d3f2e9] text-[#199e87]" },
  purple: { icon: "bg-[#e8deff] text-[#8665de]" },
};

export default function FeatureCard({ icon: Icon, title, description, tone = "blue", onClick }) {
  const colors = tones[tone] || tones.blue;
  return <button type="button" onClick={onClick} className="feature-card group flex h-full min-h-[193px] flex-col items-start rounded-[23px] border border-[#e8ebf4] bg-white p-6 text-left shadow-[0_12px_45px_rgba(30,48,96,.045)] transition duration-300 hover:-translate-y-1.5 hover:border-[#cfd7ff] hover:shadow-[0_20px_50px_rgba(52,74,140,.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#536cf6]/20 sm:p-7">
    <span className={`grid h-12 w-12 place-items-center rounded-[15px] ${colors.icon}`}><Icon size={22} strokeWidth={2} /></span>
    <span className="mt-5 flex w-full items-center justify-between gap-2 text-[16px] font-bold tracking-[-.025em] text-[#17213c]">{title}<ArrowUpRight size={17} className="shrink-0 text-[#9ba6bc] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#526bf6]" /></span>
    <span className="mt-2 max-w-[265px] text-[13px] leading-[1.65] text-[#7a869d]">{description}</span>
  </button>;
}
