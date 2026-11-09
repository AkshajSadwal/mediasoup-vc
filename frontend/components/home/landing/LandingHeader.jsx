"use client";

import { ChevronDown, Video, UserRound, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import AccountSettingsModal from "@/components/home/AccountSettingsModal";

export default function LandingHeader({ session, onMeetingAction }) {
  const router = useRouter();
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);
  const label = session?.user?.displayName || session?.user?.name || session?.user?.username || "";
  const avatar = session?.user?.image || "";
  const avatarSrc = avatar && !avatar.startsWith("http") ? `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${avatar}` : avatar;
  const initial = label ? label.trim().charAt(0).toUpperCase() : "R";

  useEffect(() => {
    const handleOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMeetingMenuOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const chooseMeeting = (action) => {
    setMeetingMenuOpen(false);
    onMeetingAction?.(action);
  };

  return (
    <header className="relative z-50 mx-auto flex w-full max-w-[1580px] items-center justify-between px-7 py-5 lg:px-12">
      <button type="button" onClick={() => router.push("/")} className="flex items-center gap-3" aria-label="Rauma home">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#136af6] text-white shadow-[0_10px_24px_rgba(19,106,246,0.22)]"><Video className="h-5 w-5" strokeWidth={2.15} /></span>
        <span className="text-[20px] font-semibold tracking-[-0.03em] text-[#0f1520] sm:text-[22px]">Rauma</span>
      </button>

      <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#171b24] md:flex">
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMeetingMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 hover:text-[#1468ee]">
            Meetings <ChevronDown className={`h-3.5 w-3.5 text-[#64748b] transition ${meetingMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {meetingMenuOpen && <div className="absolute left-1/2 top-[calc(100%+14px)] w-[210px] -translate-x-1/2 rounded-[16px] border border-[#e2e8f0] bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
            {[['instant','Instant meeting'],['schedule','Schedule meeting'],['join','Join meeting']].map(([value, text]) => (
              <button key={value} type="button" onClick={() => chooseMeeting(value)} className="flex w-full items-center rounded-[11px] px-3.5 py-2.5 text-left text-[13px] font-medium text-[#233044] hover:bg-[#f3f7fb]">{text}</button>
            ))}
          </div>}
        </div>

        <button type="button" onClick={() => router.push("/calendar")} className="inline-flex items-center gap-1.5 hover:text-[#1468ee]">Calendar <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" /></button>
        <button type="button" className="inline-flex items-center gap-1.5 hover:text-[#1468ee]">Resources <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" /></button>
        <button type="button" className="hover:text-[#1468ee]">Pricing</button>
      </nav>

      <div className="flex items-center gap-3">
        {session ? (
          <div ref={profileRef} className="relative">
            <button type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} aria-haspopup="menu" className="group flex items-center gap-2 rounded-full border border-[#dfe6ef] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#1a2330] shadow-sm transition hover:border-[#cbd5e1]" title="Open profile menu">
              {avatarSrc ? <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover"/> : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4ebff] text-[13px] font-semibold text-[#4051c8]">{initial}</span>}
              <span className="hidden max-w-32 truncate sm:block">{label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-[#64748b] transition ${profileMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {profileMenuOpen && <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-[100] w-48 rounded-2xl border border-[#e2e8f0] bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.14)]">
              <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setAccountOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#263449] hover:bg-[#f2f6fc]"><UserRound size={16}/>Account</button>
              <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#b42318] hover:bg-[#fff3f2]"><LogOut size={16}/>Log Out</button>
            </div>}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => router.push("/login")} className="rounded-[11px] border border-[#d5dce5] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#111827] shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition hover:border-[#bfc8d4] hover:bg-[#f9fafb]">Log in</button>
            <button type="button" onClick={() => router.push("/signup")} className="rounded-[12px] bg-[#091019] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(9,16,25,0.12)] transition hover:bg-[#151f2b]">Get started free</button>
          </>
        )}
      </div>
      {accountOpen && <AccountSettingsModal session={session} onClose={() => setAccountOpen(false)} />}
    </header>
  );
}
