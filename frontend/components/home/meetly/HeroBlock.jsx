"use client";

import { ArrowRight, Link2, Video } from "lucide-react";

export default function HeroBlock({ username, onStart, onJoin }) {
  const router = useRouter();
  return (
    <section className="pt-8 sm:pt-10">
      <p className="text-[11px] font-medium text-[#65716a]">
        Welcome back, {username} <span className="ml-0.5">👋</span>
      </p>
      <h1 className="mt-4 max-w-[420px] text-[48px] font-semibold leading-[0.93] tracking-[-0.05em] text-[#15211a] sm:text-[58px]">
        <span className="text-[#62816f]">Meet smarter</span>
        <br />
        <span>together</span>
      </h1>
      <p className="mt-4 max-w-[390px] text-[15px] leading-6 text-[#78827c] sm:text-[16px]">
        Simple video calls, designed around your team.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2.5 rounded-[15px] bg-[#659078] px-5 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_25px_rgba(89,128,105,0.15)] transition hover:-translate-y-0.5 hover:bg-[#5b846b]"
        >
          <Video className="h-[17px] w-[17px]" strokeWidth={2} />
          Start a meeting
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onJoin}
          className="inline-flex items-center gap-2.5 rounded-[15px] bg-[#f0f4ee] px-5 py-3.5 text-[14px] font-semibold text-[#18241c] transition hover:bg-[#e8eee6]"
        >
          <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
          Join with a code
        </button>
      </div>
    </section>
  );
}
