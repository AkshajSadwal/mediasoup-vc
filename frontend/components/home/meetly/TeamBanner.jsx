"use client";

import Image from "next/image";

export default function TeamBanner() {
  return (
    <section className="relative mt-3 h-[166px] overflow-hidden rounded-[13px] border border-[#e1e7df] bg-[#edf2eb]">
      <div className="absolute inset-y-0 left-0 z-10 w-[42%] bg-[linear-gradient(90deg,#edf2eb_0%,#edf2eb_84%,rgba(237,242,235,0)_100%)]" />
      <div className="absolute inset-y-0 left-0 z-20 flex flex-col justify-center px-5 sm:px-8">
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-[#d7e0d7] bg-[#f4f8f3] px-2.5 py-1 text-[9px] font-medium text-[#688071]">
          <span className="text-[10px]">✣</span>
          Team collaboration
        </span>
        <h2 className="max-w-[250px] text-[26px] font-medium leading-[1.04] tracking-[-0.04em] text-[#223028] sm:text-[28px]">
          Connection that
          <br />
          feels effortless
        </h2>
      </div>
      <Image
        src="/images/meeting-team-photo.jpg"
        alt="Team collaborating in a video meeting"
        fill
        sizes="100vw"
        className="object-cover object-center"
        priority
      />
    </section>
  );
}
