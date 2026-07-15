'use client';

import { Video, Users } from 'lucide-react';

export default function RoomHeader({
  roomName,
  participantCount = 1,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/10 p-3 shadow-lg shadow-black/40">
            <Video className="h-6 w-6 text-white" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">
              Rauma
            </h1>

            <p className="text-sm text-gray-400">
              Secure Video Meetings
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200">
            Room:{" "}
            <span className="font-semibold">
              {roomName}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
            <Users className="h-4 w-4 text-gray-300" />

            <span className="text-sm text-gray-300">
              {participantCount}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">

            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />

            <span className="text-sm text-emerald-300">
              Connected
            </span>

          </div>

        </div>

      </div>
    </header>
  );
}