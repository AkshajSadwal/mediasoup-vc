"use client";

import { Settings, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function HomeHeader({ session }) {
  const router = useRouter();
  const label = session?.user?.username || session?.user?.name || "Guest";
  const initial = label.trim().charAt(0).toUpperCase() || "R";

  return (
    <header className="mx-auto flex h-16 max-w-[930px] items-center justify-between px-0">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-3 text-left"
        aria-label="Rauma home"
      >
        <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#e3ebe3] text-[#4f6e5a]">
          <Video className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="text-[24px] font-semibold tracking-[-0.03em] text-[#152018]">Rauma</span>
      </button>

      <nav className="hidden items-center gap-8 text-[12px] font-medium text-[#707a74] md:flex">
        <button className="relative py-2 text-[#18241c]">
          Home
          <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-5 rounded-full bg-[#678773]" />
        </button>
        <button onClick={() => router.push("/schedule")} className="py-2 transition hover:text-[#18241c]">Meetings</button>
        <button className="py-2 transition hover:text-[#18241c]">Contacts</button>
        <button className="py-2 transition hover:text-[#18241c]">Settings</button>
      </nav>

      <div className="flex items-center gap-3">
        {session ? (
          <>
            <button aria-label="Settings" className="grid h-8 w-8 place-items-center rounded-full text-[#17221b] hover:bg-[#edf2ed]">
              <Settings className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title={`Sign out ${label}`}
              className="flex items-center gap-2 rounded-full px-1.5 py-1 text-[#3e4942] hover:bg-[#edf2ed]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dfe8df] text-[13px] font-semibold text-[#526557]">
                {initial}
              </span>
              <span className="hidden text-[12px] font-medium sm:block">{label}</span>
              <span className="hidden text-[12px] sm:block">⌄</span>
            </button>
          </>
        ) : (
          <button onClick={() => router.push("/login")} className="rounded-full bg-[#18251d] px-4 py-2 text-[12px] font-semibold text-white">
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
