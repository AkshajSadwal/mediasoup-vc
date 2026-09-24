"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Video, Globe, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("callbackUrl");
    setCallbackUrl(value || "/");
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (!result?.ok) {
      setError("Invalid username or password.");
      return;
    }
    router.push(result.url || callbackUrl);
  };

  return (
    <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-3"><Video size={22} /></div>
          <span className="text-2xl font-bold">Rauma</span>
        </div>

        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-white/60">Sign in to schedule and host meetings.</p>

        <button onClick={() => signIn("google", { callbackUrl })} className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-white/90 transition">
          <Globe size={20} /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-white/40"><div className="h-px flex-1 bg-white/10" /> OR <div className="h-px flex-1 bg-white/10" /></div>

        <form onSubmit={submit} className="space-y-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" />
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold disabled:opacity-50">
            <LogIn size={18} /> {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">New to Rauma? <Link className="text-cyan-300 hover:text-cyan-200" href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create an account</Link></p>
      </motion.div>
    </main>
  );
}
