"use client";

import { ArrowUpRight, CalendarPlus, Hand, Link2, Mic, MonitorUp, MoreHorizontal, Video } from "lucide-react";

const guests = [
  { initials: "AL", name: "Alex Morgan", color: "from-[#fbb49d] to-[#d96e80]", label: "AM" },
  { initials: "JD", name: "Jordan Davis", color: "from-[#b0a1ff] to-[#6665cd]", label: "JD" },
  { initials: "SK", name: "Sam Kim", color: "from-[#8ddcd4] to-[#328f99]", label: "SK" },
];

export default function MeetingHeroVisual({ onAddMeeting }) {
  return (
    <div className="hero-visual relative mx-auto flex w-full max-w-[650px] items-center justify-center py-3 lg:py-14" aria-label="Illustration of a Rauma video call">
      <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[#e0e6ff] blur-[70px]" />
      <div className="relative w-full max-w-[590px] rounded-[30px] border border-[#25314c] bg-[#10192e] p-3.5 shadow-[0_35px_100px_rgba(32,49,111,.24)] sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1 pb-4 text-white">
          <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#526bfa]"><Video size={18} /></span><div><p className="text-[13px] font-semibold tracking-[-.02em]">Design catch-up</p><p className="text-[10px] text-[#8798b4]">Rauma meeting preview</p></div></div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-[#bac6db]">3 participants</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="relative col-span-2 flex h-[170px] items-center justify-center overflow-hidden rounded-[19px] bg-gradient-to-br from-[#283b66] via-[#273656] to-[#182543] sm:h-[215px]">
            <div className="absolute -right-14 -top-24 h-60 w-60 rounded-full border-[32px] border-white/5" />
            <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#fea68c] to-[#b55d6b] text-[27px] font-bold text-white shadow-[0_12px_35px_rgba(0,0,0,.2)] sm:h-24 sm:w-24">AL</div>
            <span className="absolute bottom-3 left-3 rounded-lg bg-[#0c1325]/70 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">Alex Morgan · host</span>
            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#203b49] px-2.5 py-1 text-[9px] font-medium text-[#8de4ce]"><span className="h-1.5 w-1.5 rounded-full bg-[#51d6ad]" /> Live</span>
          </div>
          {guests.slice(1).map((guest) => <div key={guest.name} className="relative flex h-[119px] items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#263450] to-[#19263f] sm:h-[151px]"><div className={`grid h-[62px] w-[62px] place-items-center rounded-full bg-gradient-to-br ${guest.color} text-[19px] font-bold text-white shadow-lg sm:h-[78px] sm:w-[78px]`}>{guest.initials}</div><span className="absolute bottom-2 left-2 rounded-md bg-[#0c1325]/65 px-2 py-1 text-[10px] text-white">{guest.name}</span></div>)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[.09] pt-4">
          <span className="hidden text-[10px] text-[#8fa0bf] sm:inline">Create. Connect. Collaborate.</span>
          <div className="mx-auto flex items-center gap-2 sm:mx-0">
            {[Mic, Video, Hand, MonitorUp, MoreHorizontal].map((Icon, i) => <span key={i} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.09] text-[#dde7fa] sm:h-10 sm:w-10"><Icon size={16} /></span>)}
            <span className="grid h-9 w-12 place-items-center rounded-xl bg-[#e75466] text-white sm:h-10"><Video size={17} /></span>
          </div>
        </div>
      </div>
      <button type="button" onClick={onAddMeeting} className="absolute -bottom-3 right-1 flex items-center gap-3 rounded-[18px] border border-[#e6eaff] bg-white px-4 py-3 text-left shadow-[0_20px_45px_rgba(42,60,109,.14)] transition hover:-translate-y-1 hover:shadow-[0_25px_55px_rgba(42,60,109,.19)] sm:bottom-4 sm:-right-4 sm:px-5 sm:py-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8edff] text-[#526bf6]"><CalendarPlus size={20} /></span>
        <span><span className="block text-[12px] font-bold text-[#17203c] sm:text-[13px]">Add to calendar</span><span className="mt-1 block text-[10px] text-[#8590a6]">Keep your meetings close</span></span><ArrowUpRight size={17} className="text-[#64749a]" />
      </button>
      <span className="absolute -left-2 top-7 hidden rotate-[-8deg] items-center gap-2 rounded-full border border-[#e4e9f7] bg-white px-4 py-2 text-[11px] font-semibold text-[#5f6c89] shadow-[0_12px_30px_rgba(37,50,96,.1)] sm:flex"><Link2 size={14} className="text-[#536cf6]" /> One link. Everyone together.</span>
    </div>
  );
}
