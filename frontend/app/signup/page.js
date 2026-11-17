"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import AuthScaffold from "@/components/auth/AuthScaffold";

const BACKEND_URL = "";
function getSafeCallbackUrl() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("callbackUrl");
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export default function SignupPage() {
  const router = useRouter();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { getProviders().then((providers) => setGoogleEnabled(Boolean(providers?.google))).catch(() => setGoogleEnabled(false)); }, []);

  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create account. Please try again.");
      const callbackUrl = getSafeCallbackUrl();
      const result = await signIn("credentials", { username: username.trim(), password, redirect: false, callbackUrl });
      if (!result?.ok) throw new Error("Your account was created, but automatic sign-in failed. Please sign in.");
      router.push(result.url || callbackUrl);
    } catch (failure) { setError(failure.message || "Could not create your account."); }
    finally { setLoading(false); }
  };

  return <AuthScaffold eyebrow="Join the conversation" title="Create your account" description="Set up your space for better meetings in just a moment.">
    {googleEnabled && <button type="button" onClick={() => signIn("google", { callbackUrl: getSafeCallbackUrl() })} className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[13px] border border-[#dfe5ef] bg-white px-4 text-[13px] font-semibold text-[#2c3a56] hover:bg-[#f7f9ff]"><Globe size={19} className="text-[#526bf6]"/> Continue with Google</button>}
    {googleEnabled && <div className="auth-divider">or create an account</div>}
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="auth-label">Username</span><input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" className="auth-input" /></label>
      <label className="block"><span className="auth-label">Password</span><span className="relative block"><input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" className="auth-input !pr-14" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-2 grid w-11 place-items-center text-[#8693aa] hover:text-[#536cf6]">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>
      <label className="block"><span className="auth-label">Confirm password</span><input required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter password" className="auth-input" /></label>
      {error && <p role="alert" className="rounded-xl border border-[#f5d5db] bg-[#fff3f5] px-4 py-3 text-[13px] text-[#a83f53]">{error}</p>}
      <button type="submit" disabled={loading} className="primary-button !mt-6 w-full disabled:opacity-60">{loading ? "Creating your account..." : "Create account"}{!loading && <ArrowRight size={18}/>}</button>
    </form>
    <p className="mt-6 text-center text-[13px] text-[#7b879d]">Already have an account? <Link href="/login" className="font-bold text-[#526bf6] hover:underline" onClick={(event) => { event.preventDefault(); router.push(`/login?callbackUrl=${encodeURIComponent(getSafeCallbackUrl())}`); }}>Sign in</Link></p>
  </AuthScaffold>;
}
