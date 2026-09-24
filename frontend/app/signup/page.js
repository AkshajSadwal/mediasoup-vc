"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Video, UserPlus, Globe } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function SignupPage() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("callbackUrl");
    setCallbackUrl(value || "/");
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not create account. Please try again.");
      }

      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!result?.ok) throw new Error("Account created, but automatic sign in failed.");
      router.push(result.url || callbackUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8"><div className="rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-3"><Video size={22} /></div><span className="text-2xl font-bold">Rauma</span></div>
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="mt-2 text-white/60">Use a username and password for your Rauma account.</p>

        <button onClick={() => signIn("google", { callbackUrl })} className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-white/90 transition">
          <Globe size={20} /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-white/40"><div className="h-px flex-1 bg-white/10" /> OR <div className="h-px flex-1 bg-white/10" /></div>

        <form onSubmit={submit} className="space-y-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" type="password" autoComplete="new-password" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" />
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" type="password" autoComplete="new-password" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400" />
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold disabled:opacity-50"><UserPlus size={18} /> {loading ? "Creating..." : "Create account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-white/60">Already have an account? <Link className="text-cyan-300" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link></p>
      </div>
    </main>
  );
}
