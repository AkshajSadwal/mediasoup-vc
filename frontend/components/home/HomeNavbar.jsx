"use client";

import { Settings, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function HomeNavbar({ session }) {
  const router = useRouter();
  const label = session?.user?.username || session?.user?.name || "Guest";
  const initial = label.trim().charAt(0).toUpperCase() || "R";

  return (
    <header className="px-4 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between rounded-[28px] border border-white/90 bg-white px-6 py-4 shadow-[0_8px_35px_rgba(15,23,42,0.07)] sm:px-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-4 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-200">
            <Video className="h-6 w-6 text-white" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-slate-950">Rauma</span>
        </button>

        <div className="flex items-center gap-3 sm:gap-5">
          {session ? (
            <>
              <button aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-2xl text-slate-800 transition hover:bg-slate-100">
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-300 to-violet-500 text-lg font-bold text-white shadow-sm"
                title={`Sign out ${label}`}
              >
                {initial}
              </button>
            </>
          ) : (
            <button onClick={() => router.push("/login")} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
