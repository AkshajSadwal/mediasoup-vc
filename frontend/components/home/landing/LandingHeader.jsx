"use client";

import { CalendarDays, ChevronDown, ChevronRight, LogOut, Menu, Plus, Settings2, UserRound, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import AccountSettingsModal from "@/components/home/AccountSettingsModal";

const meetingItems = [
  { id: "instant", title: "Instant meeting", detail: "Start a room right now", icon: Video },
  { id: "schedule", title: "Schedule meeting", detail: "Pick a time for later", icon: CalendarDays },
  { id: "config", title: "Advanced setup", detail: "Manage teams and permissions", icon: Settings2 },
  { id: "join", title: "Join with a code", detail: "Enter an existing room", icon: Plus },
];

export default function LandingHeader({ session, onMeetingAction }) {
  const router = useRouter();
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const headerRef = useRef(null);
  const label = session?.user?.displayName || session?.user?.name || session?.user?.username || "Account";
  const avatar = session?.user?.image || "";
  const avatarSrc = avatar && !avatar.startsWith("http") ? `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${avatar}` : avatar;

  useEffect(() => {
    const outside = (event) => {
      if (!headerRef.current?.contains(event.target)) { setMeetingMenuOpen(false); setProfileMenuOpen(false); setMobileOpen(false); }
    };
    const escape = (event) => {
      if (event.key === "Escape") { setMeetingMenuOpen(false); setProfileMenuOpen(false); setMobileOpen(false); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  const chooseMeeting = (action) => {
    setMeetingMenuOpen(false); setMobileOpen(false);
    onMeetingAction?.(action);
  };

  return (
    <header ref={headerRef} className="relative z-50 mx-auto w-full max-w-[1440px] px-5 pt-5 sm:px-8 lg:px-12">
      <div className="flex h-[74px] items-center justify-between gap-4 rounded-[22px] border border-white/90 bg-white/90 px-4 shadow-[0_12px_48px_rgba(30,45,88,.06)] backdrop-blur-xl sm:px-6">
        <button type="button" onClick={() => router.push("/")} className="flex shrink-0 items-center gap-2.5" aria-label="Rauma home">
          <span className="brand-symbol"><Video size={20} strokeWidth={2.4} /></span>
          <span className="text-[22px] font-bold tracking-[-.06em] text-[#151c38]">rauma<span className="text-[#526bf6]">.</span></span>
        </button>

        <nav className="hidden items-center gap-1 rounded-full bg-[#f4f6fc] p-1 text-[13px] font-semibold text-[#64708a] lg:flex" aria-label="Primary navigation">
          <div className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={meetingMenuOpen} onClick={() => { setMeetingMenuOpen((open) => !open); setProfileMenuOpen(false); }} className={`nav-pill ${meetingMenuOpen ? "nav-pill-active" : ""}`}>Meetings <ChevronDown size={14} className={meetingMenuOpen ? "rotate-180" : ""} /></button>
            {meetingMenuOpen && <div role="menu" className="absolute left-0 top-[calc(100%+14px)] w-[294px] rounded-[20px] border border-[#e7ebf5] bg-white p-2 shadow-[0_24px_70px_rgba(24,39,80,.16)]">
              {meetingItems.map(({ id, title, detail, icon: Icon }) => <button role="menuitem" key={id} onClick={() => chooseMeeting(id)} className="group flex w-full items-center gap-3 rounded-[13px] px-3 py-2.5 text-left hover:bg-[#f4f6ff]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff2ff] text-[#526bf6]"><Icon size={18} /></span><span className="flex-1"><span className="block text-sm font-semibold text-[#18213b]">{title}</span><span className="block text-[11px] font-normal text-[#7c879d]">{detail}</span></span><ChevronRight size={14} className="text-[#9aa4b7]" /></button>)}
            </div>}
          </div>
          <button type="button" onClick={() => router.push("/calendar")} className="nav-pill">Calendar</button>
          <button type="button" onClick={() => router.push("/schedule")} className="nav-pill">Schedule</button>
        </nav>

        <div className="flex items-center gap-2">
          {session ? <div className="relative">
            <button type="button" onClick={() => { setProfileMenuOpen((open) => !open); setMeetingMenuOpen(false); }} aria-expanded={profileMenuOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-[#e5e9f3] bg-white p-1.5 pr-3 text-[12px] font-semibold text-[#263250] transition hover:border-[#aebefa]" title="Open account menu">
              {avatarSrc ? <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e9edff] font-bold text-[#5064dd]">{label.trim().charAt(0).toUpperCase()}</span>}
              <span className="hidden max-w-28 truncate sm:block">{label}</span><ChevronDown size={14} />
            </button>
            {profileMenuOpen && <div role="menu" className="absolute right-0 top-[calc(100%+12px)] w-48 rounded-2xl border border-[#e5e9f3] bg-white p-2 shadow-[0_20px_50px_rgba(20,30,60,.16)]">
              <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setAccountOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#263250] hover:bg-[#f4f6ff]"><UserRound size={16} /> Account settings</button>
              <button role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#c0444c] hover:bg-[#fff1f3]"><LogOut size={16} /> Sign out</button>
            </div>}
          </div> : <><button onClick={() => router.push("/login")} className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-[#263250] hover:bg-[#f4f6fc] sm:block">Sign in</button><button onClick={() => router.push("/signup")} className="primary-button !min-h-10 !px-4 !py-2.5 text-[13px]">Get started <ChevronRight size={16} /></button></>}
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-[#263250] hover:bg-[#f4f6fc] lg:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => { setMobileOpen((open) => !open); setMeetingMenuOpen(false); }} >{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {mobileOpen && <nav aria-label="Mobile navigation" className="absolute left-5 right-5 top-[calc(100%+8px)] z-50 rounded-2xl border border-[#e5e9f3] bg-white p-3 shadow-[0_24px_60px_rgba(24,39,80,.18)] sm:left-8 sm:right-8 lg:hidden">
        {meetingItems.map(({ id, title, icon: Icon }) => <button key={id} onClick={() => chooseMeeting(id)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#263250] hover:bg-[#f4f6ff]"><Icon size={17} className="text-[#526bf6]" />{title}</button>)}
        <div className="my-2 h-px bg-[#edf0f6]" />
        <button onClick={() => { setMobileOpen(false); router.push("/calendar"); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#263250] hover:bg-[#f4f6ff]"><CalendarDays size={17} className="text-[#526bf6]" />Calendar</button>
      </nav>}
      {accountOpen && <AccountSettingsModal session={session} onClose={() => setAccountOpen(false)} />}
    </header>
  );
}
