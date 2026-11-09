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
    setCallbackUrl(value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/");
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-12 text-[#111827]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md rounded-[28px] border border-[#e2eaf4] bg-white p-8 shadow-[0_24px_80px_rgba(31,75,130,0.12)] sm:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-[#176df3] p-3 text-white shadow-[0_10px_24px_rgba(23,109,243,0.22)]"><Video size={22} /></div>
          <span className="text-2xl font-bold">Rauma</span>
        </div>

        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-[#64748b]">Sign in to schedule and host meetings.</p>

        <button onClick={() => signIn("google", { callbackUrl })} className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl border border-[#dce5f0] bg-[#f8fbff] px-4 py-3 font-semibold text-[#172033] hover:bg-[#eef5ff] transition">
          <Globe size={20} /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[#94a3b8]"><div className="h-px flex-1 bg-[#e7edf5]" /> OR <div className="h-px flex-1 bg-[#e7edf5]" /></div>

        <form onSubmit={submit} className="space-y-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" className="w-full rounded-xl border border-[#dce5f0] bg-[#f8fbff] px-4 py-3 text-[#172033] outline-none placeholder:text-[#91a0b2] focus:border-[#176df3] focus:ring-2 focus:ring-[#176df3]/15" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" className="w-full rounded-xl border border-[#dce5f0] bg-[#f8fbff] px-4 py-3 text-[#172033] outline-none placeholder:text-[#91a0b2] focus:border-[#176df3] focus:ring-2 focus:ring-[#176df3]/15" />
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#176df3] text-white shadow-[0_12px_26px_rgba(23,109,243,0.20)] hover:bg-[#0f63e8] px-4 py-3 font-semibold disabled:opacity-50">
            <LogIn size={18} /> {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748b]">New to Rauma? <Link className="text-[#176df3] hover:text-[#0f63e8]" href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create an account</Link></p>
      </motion.div>
    </main>
  );
}
