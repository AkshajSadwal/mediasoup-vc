"use client";

import { CalendarDays, ChevronRight, Link2, Mic, MoreHorizontal, MonitorUp, Video } from "lucide-react";

function Avatar({ tone = "blue", label }) {
  const styles = { blue: "bg-[#dfeaff] text-[#4f74df]", purple: "bg-[#eee5ff] text-[#8a5cf1]", green: "bg-[#dff5e5] text-[#2aa55b]" };
  return <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold ${styles[tone]}`}>{label}</span>;
}

export default function MeetingHeroVisual({ onAddMeeting }) {
  return (
    <div className="relative mx-auto hidden h-[520px] w-full max-w-[760px] lg:block select-none caret-transparent">
      <svg className="absolute left-[8%] top-[10%] h-[360px] w-[560px]" viewBox="0 0 560 360" fill="none" aria-hidden="true">
        <path d="M20 266C96 226 92 190 166 134C214 98 271 108 305 63C329 31 315 7 297 12" stroke="#9AB7F7" strokeWidth="3" strokeLinecap="round" />
        <path d="M292 12C327 2 350 15 369 44C392 79 427 78 482 50" stroke="#9AB7F7" strokeWidth="3" strokeLinecap="round" />
        <path d="M406 310C446 280 450 242 492 219C528 199 548 206 552 183" stroke="#9AB7F7" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="absolute right-[6%] top-[7%] w-[590px] rotate-[4deg] rounded-[18px] border border-[#dfe7f0] bg-white/95 p-3 shadow-[0_30px_70px_rgba(39,67,112,0.16)]">
        <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2 text-[#17212c]"><span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#e7f0ff] text-[#176bf2]"><Video className="h-4 w-4" /></span><span className="text-[13px] font-semibold">Rauma</span></div><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-[#1774f5]" /><div className="h-2.5 w-2.5 rounded-full bg-[#d9e0ea]" /></div></div>
        <div className="grid grid-cols-[110px_1fr] overflow-hidden rounded-[13px] border border-[#e8edf3] bg-white">
          <aside className="border-r border-[#e8edf3] bg-[#fbfdff] p-3"><div className="space-y-1.5 text-[10px] text-[#536071]"><div className="rounded-[9px] bg-[#e9f3ff] px-3 py-2 font-semibold text-[#1268ef]">Meetings</div><div className="px-3 py-2">Calendar</div><div className="px-3 py-2">Rooms</div></div></aside>
          <div className="p-4"><div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[#0f1720]">September 2026</h3><span className="rounded-full bg-[#f4f7fb] px-3 py-1.5 text-[9px] font-medium text-[#667085]">Today</span></div>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] text-[#6b7280]">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, index) => <div key={day} className={`rounded-[8px] px-1 py-2 ${index === 4 ? "bg-[#e8f2ff] text-[#0b6bf0]" : ""}`}><div>{day}</div><div className="mt-1 text-[13px] font-semibold text-inherit">{21 + index}</div></div>)}</div>
            <div className="mt-4 space-y-2">{[["Project Discussion","10:00 AM – 10:30 AM","blue"],["Design Review","12:00 PM – 1:00 PM","green"],["Team Sync","4:00 PM – 4:30 PM","purple"]].map(([title, time, tone]) => <div key={title} className="grid grid-cols-[1fr_auto] items-center rounded-[11px] border border-[#edf1f6] px-3 py-2.5"><div className="flex items-center gap-2.5"><span className={`grid h-8 w-8 place-items-center rounded-[9px] ${tone === "blue" ? "bg-[#e7f0ff] text-[#1d6cf4]" : tone === "green" ? "bg-[#e6f7eb] text-[#1ea760]" : "bg-[#eee7ff] text-[#7b55eb]"}`}><Video className="h-4 w-4" strokeWidth={1.8} /></span><div><div className="text-[10px] font-semibold text-[#111827]">{title}</div><div className="text-[8px] text-[#7b8794]">{time}</div></div></div><div className="flex items-center gap-2"><div className="flex -space-x-1.5"><Avatar label="A" tone="blue" /><Avatar label="R" tone="green" /><Avatar label="D" tone="purple" /></div><span className="rounded-[9px] bg-[#146df2] px-3 py-1.5 text-[8px] font-semibold text-white">Join</span></div></div>)}</div>
          </div>
        </div>
      </div>

      <div className="absolute left-[6%] top-[34%] w-[420px] -rotate-[6deg] rounded-[18px] border border-[#dbe5f0] bg-white p-3 shadow-[0_26px_56px_rgba(37,65,107,0.16)]">
        <div className="flex items-center gap-2 px-2 pb-2"><span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#e7f0ff] text-[#176bf2]"><Video className="h-4 w-4" /></span><span className="text-[12px] font-semibold text-[#19232f]">Rauma</span></div>
        <div className="rounded-[13px] bg-[#081625] p-2.5"><div className="grid grid-cols-2 gap-2"><div className="flex h-[140px] items-end rounded-[11px] bg-gradient-to-br from-[#1f3655] to-[#172b42] p-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#4d70d3] text-[12px] font-semibold text-white">D</span></div><div className="flex h-[140px] items-end rounded-[11px] bg-gradient-to-br from-[#25394f] to-[#152337] p-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#5a8bcf] text-[12px] font-semibold text-white">A</span></div></div><div className="mt-2 flex justify-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><Mic className="h-3.5 w-3.5" /></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><Video className="h-3.5 w-3.5" /></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><MonitorUp className="h-3.5 w-3.5" /></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><MoreHorizontal className="h-3.5 w-3.5" /></span><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f34d52] text-white">×</span></div></div>
      </div>

      <button type="button" onClick={onAddMeeting} className="absolute bottom-[8%] right-[4%] flex w-[300px] items-center justify-between rounded-[16px] border border-[#e3eaf4] bg-white px-5 py-4 text-left shadow-[0_18px_42px_rgba(35,57,94,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(35,57,94,0.16)]">
        <div className="flex items-center gap-3.5"><span className="grid h-12 w-12 place-items-center rounded-[13px] bg-[#eaf3ff] text-[#1a6ef3]"><CalendarDays className="h-6 w-6" strokeWidth={1.8} /></span><div><div className="text-[14px] font-semibold text-[#10161f]">Add meeting</div><div className="mt-1 text-[12px] text-[#65707f]">Add to your calendar</div></div></div>
        <ChevronRight className="h-5 w-5 text-[#6f7a8a]" />
      </button>
      <div className="absolute bottom-0 left-[31%] hidden rounded-full border border-[#e4eaf2] bg-white/90 px-3.5 py-2 text-[10px] font-medium text-[#4b5563] shadow-sm xl:flex xl:items-center xl:gap-2"><Link2 className="h-3.5 w-3.5 text-[#1d6cf4]" />Meet from anywhere</div>
    </div>
  );
}
