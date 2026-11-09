'use client';

import { Video, Users } from 'lucide-react';

export default function RoomHeader({
  roomName,
  participantCount = 1,
  localName = "You",
  localAvatarUrl = null,
  localIsAdmin = false,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dce6f2] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-[#176df3] p-3 shadow-lg shadow-blue-200">
            <Video className="h-6 w-6 text-white" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-wide text-[#172033]">
              Rauma
            </h1>

            <p className="text-sm text-[#64748b]">
              Secure Video Meetings
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">

          <div className="rounded-full border border-[#dce6f2] bg-[#f4f8fd] px-4 py-2 text-sm text-[#526176]">
            Room:{" "}
            <span className="font-semibold">
              {roomName}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-[#dce6f2] bg-[#f4f8fd] px-4 py-2">
            <Users className="h-4 w-4 text-[#526176]" />

            <span className="text-sm text-[#526176]">
              {participantCount}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 rounded-full border border-[#dce6f2] bg-[#f4f8fd] px-4 py-2">
            {localAvatarUrl ? <img src={localAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover"/> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e4ebff] text-xs font-semibold text-[#4051c8]">{localName.trim().charAt(0).toUpperCase()}</span>}<span className="max-w-40 truncate text-sm font-medium text-[#172033]">{localName}</span>
            {localIsAdmin && <span className="rounded-full bg-[#176df3]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#176df3]">Admin</span>}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">

            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />

            <span className="text-sm text-emerald-700">
              Connected
            </span>

          </div>

        </div>

      </div>
    </header>
  );
}