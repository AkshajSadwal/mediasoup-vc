"use client";

import { Link2, Video } from "lucide-react";

export default function HeroCopy({ onCreate, onJoin }) {
  return (
    <section className="flex flex-col justify-center pt-2 lg:min-h-[520px]">
      <h1 className="select-none caret-transparent cursor-default max-w-[710px] text-[58px] font-semibold leading-[0.98] tracking-[-0.055em] text-[#0b111a] sm:text-[74px] lg:text-[82px]">
        Good meetings
        <br />
        <span className="bg-gradient-to-r from-[#126cf2] via-[#2476f0] to-[#4b9af7] bg-clip-text text-transparent">build great things.</span>
      </h1>
      <p className="select-none caret-transparent mt-6 max-w-[620px] text-[18px] leading-7 text-[#4f5d70] sm:text-[20px]">
        Rauma is a video meeting platform that helps teams connect, collaborate, and get work done — all in one place.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <button type="button" onClick={onCreate} className="inline-flex items-center gap-3 rounded-[13px] bg-[#176df3] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_18px_36px_rgba(23,109,243,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0f63e8]">
          <Video className="h-5 w-5" strokeWidth={2} />
          Start a meeting
        </button>
        <button type="button" onClick={onJoin} className="inline-flex items-center gap-3 rounded-[13px] bg-[#f3f6fa] px-7 py-4 text-[15px] font-semibold text-[#16202d] shadow-[0_10px_28px_rgba(17,24,39,0.04)] transition hover:-translate-y-0.5 hover:bg-[#edf2f8]">
          <Link2 className="h-5 w-5" strokeWidth={1.9} />
          Join with a code
        </button>
      </div>
    </section>
  );
}
