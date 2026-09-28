"use client";

import { ArrowRight, Link2, Video } from "lucide-react";

export default function HeroIntro({ username, onCreate, onJoin }) {
  return (
    <div className="relative z-10 max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Welcome back, {username} <span className="ml-1 text-sm">👋</span></p>
      <h1 className="mt-5 text-[52px] font-extrabold leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-[64px]">
        Good meetings
        <br />
        <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 bg-clip-text text-transparent">build great things.</span>
      </h1>
      <p className="mt-7 max-w-lg text-lg leading-8 text-slate-500 sm:text-xl">
        Start an instant meeting, join with a code, or manage your scheduled meetings — all in one place.
      </p>

      <div className="mt-9 flex flex-wrap gap-4">
        <button onClick={onCreate} className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-7 py-4 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-xl">
          <Video className="h-5 w-5" />
          New meeting
          <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={onJoin} className="inline-flex items-center gap-3 rounded-2xl bg-slate-100 px-7 py-4 font-semibold text-slate-900 transition hover:bg-slate-200">
          <Link2 className="h-5 w-5" />
          Join meeting
        </button>
      </div>
    </div>
  );
}
