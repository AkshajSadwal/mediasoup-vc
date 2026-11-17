"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import AuthScaffold from "@/components/auth/AuthScaffold";

function getSafeCallbackUrl() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("callbackUrl");
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { getProviders().then((providers) => setGoogleEnabled(Boolean(providers?.google))).catch(() => setGoogleEnabled(false)); }, []);

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const callbackUrl = getSafeCallbackUrl();
      const result = await signIn("credentials", { username: username.trim(), password, redirect: false, callbackUrl });
      if (!result?.ok) throw new Error("Incorrect username or password. Please try again.");
      router.push(result.url || callbackUrl);
    } catch (failure) { setError(failure.message || "Sign-in failed. Try again."); }
    finally { setLoading(false); }
  };

  return <AuthScaffold eyebrow="Welcome back" title="Sign in to Rauma" description="Good to see you again. Let's get you back to your meetings.">
    {googleEnabled && <button type="button" onClick={() => signIn("google", { callbackUrl: getSafeCallbackUrl() })} className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[13px] border border-[#dfe5ef] bg-white px-4 text-[13px] font-semibold text-[#2c3a56] hover:bg-[#f7f9ff]"><Globe size={19} className="text-[#526bf6]"/> Continue with Google</button>}
    {googleEnabled && <div className="auth-divider">or use your account</div>}
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="auth-label">Username</span><input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" className="auth-input" /></label>
      <label className="block"><span className="auth-label">Password</span><span className="relative block"><input required value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="auth-input !pr-14" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-2 grid w-11 place-items-center text-[#8693aa] hover:text-[#536cf6]">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>
      {error && <p role="alert" className="rounded-xl border border-[#f5d5db] bg-[#fff3f5] px-4 py-3 text-[13px] text-[#a83f53]">{error}</p>}
      <button type="submit" disabled={loading} className="primary-button !mt-6 w-full disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}{!loading && <ArrowRight size={18}/>}</button>
    </form>
    <p className="mt-7 text-center text-[13px] text-[#7b879d]">New to Rauma? <Link href="/signup" className="font-bold text-[#526bf6] hover:underline" onClick={(event) => { event.preventDefault(); router.push(`/signup?callbackUrl=${encodeURIComponent(getSafeCallbackUrl())}`); }}>Create an account</Link></p>
  </AuthScaffold>;
}
