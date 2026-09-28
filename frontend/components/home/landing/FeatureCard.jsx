"use client";

import { ArrowUpRight } from "lucide-react";

const tones = {
  blue: { card: "bg-[#eef6ff] border-[#e1ecfb]", icon: "bg-[#ddebff] text-[#216cf4]" },
  green: { card: "bg-[#eff9f2] border-[#e1eee4]", icon: "bg-[#ddf2e3] text-[#1ca65d]" },
  purple: { card: "bg-[#f5f1ff] border-[#e9e1ff]", icon: "bg-[#ebe2ff] text-[#7a55ef]" },
  orange: { card: "bg-[#fff7ef] border-[#f4e8da]", icon: "bg-[#ffe8d2] text-[#f06f32]" },
};

export default function FeatureCard({ icon: Icon, title, description, tone = "blue" }) {
  const colors = tones[tone] || tones.blue;

  return (
    <article className={`relative min-h-[184px] overflow-hidden rounded-[18px] border p-7 sm:p-8 ${colors.card}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-[15px] ${colors.icon}`}>
        <Icon className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <h3 className="mt-6 text-[18px] font-semibold tracking-[-0.025em] text-[#0f1720] sm:text-[19px]">{title}</h3>
      <p className="mt-2 max-w-[250px] text-[14px] leading-5 text-[#3c4653]">{description}</p>
      <ArrowUpRight className="absolute bottom-7 right-7 h-4 w-4 text-[#334155]" strokeWidth={1.8} />
    </article>
  );
}
