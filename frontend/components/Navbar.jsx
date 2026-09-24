"use client";

import { motion } from "framer-motion";
import { Video, CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <motion.nav initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-6xl">
      <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/")}>
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600"><Video size={22} className="text-white" /></div>
          <span className="text-xl font-bold text-white">Rauma</span>
        </div>

        <div className="hidden md:flex items-center gap-5 text-white/70">
          <button onClick={() => router.push("/schedule")} className="hover:text-white transition flex items-center gap-2"><CalendarClock size={16} /> Schedule</button>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden sm:block text-sm text-white/70">{session.user?.name || session.user?.username}</span>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => router.push("/login")} className="px-4 py-2 rounded-xl text-white/80 hover:text-white transition">Sign in</button>
              <button onClick={() => router.push("/signup")} className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold hover:scale-105 transition shadow-lg">Sign up</button>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
