"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageSquareText, ShieldCheck, Video, UsersRound } from "lucide-react";

export default function AuthScaffold({ eyebrow, title, description, children }) {
  return <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-6 text-[#18223d] sm:px-7 sm:py-10">
    <div className="auth-card grid w-full max-w-[1080px] overflow-hidden rounded-[28px] lg:min-h-[660px] lg:grid-cols-[.95fr_1.05fr] lg:rounded-[32px]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#131e37] p-10 text-white lg:flex xl:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-[45%] -top-[20%] h-[600px] w-[600px] rounded-full border-[75px] border-[#8192ff]/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[35%] -left-[45%] h-[620px] w-[620px] rounded-full bg-[#425ce4]/20 blur-[80px]" />
        <Link href="/" className="relative flex w-fit items-center gap-3 text-[22px] font-bold tracking-[-.06em]"><span className="brand-symbol"><Video size={20} /></span> rauma<span className="-ml-3 text-[#8a9bff]">.</span></Link>
        <div className="relative">
          <div className="mb-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-[.05em] text-[#afc1f8]"><CheckCircle2 size={14} /> A place to connect</div>
          <h2 className="max-w-[390px] text-[48px] font-bold leading-[1.09] tracking-[-.055em]">Great ideas start with a <span className="text-[#95a4ff]">conversation.</span></h2>
          <p className="mt-5 max-w-[320px] text-[15px] leading-7 text-[#a9b7d0]">Bring your team together with easy meetings, collaboration tools, and thoughtful controls.</p>
          <div className="mt-10 grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#526bf6]/25 text-[#b8c5ff]"><UsersRound size={20}/></span><span className="text-[13px] font-medium text-[#e6ecff]">Connect from wherever you are</span></div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#526bf6]/25 text-[#b8c5ff]"><MessageSquareText size={20}/></span><span className="text-[13px] font-medium text-[#e6ecff]">Create, share, and collaborate live</span></div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#526bf6]/25 text-[#b8c5ff]"><ShieldCheck size={20}/></span><span className="text-[13px] font-medium text-[#e6ecff]">Stay in control of your meetings</span></div>
          </div>
        </div>
        <p className="relative text-[12px] text-[#7f90b1]">Rauma · Meet, create, collaborate.</p>
      </aside>
      <section className="flex flex-col justify-center p-6 sm:p-10 lg:px-[min(5vw,68px)] lg:py-12">
        <Link href="/" className="mb-10 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#7c899f] hover:text-[#526bf6] lg:hidden"><ArrowLeft size={15}/> Back to Rauma</Link>
        <div className="lg:hidden"><span className="mb-6 inline-flex items-center gap-2 text-[19px] font-bold tracking-[-.04em]"><span className="brand-symbol !h-9 !w-9"><Video size={19}/></span>rauma<span className="text-[#526bf6]">.</span></span></div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[.15em] text-[#5c70d9]">{eyebrow}</p>
        <h1 className="text-[34px] font-bold leading-[1.16] tracking-[-.05em] text-[#18223d] sm:text-[40px]">{title}</h1>
        <p className="mt-3 max-w-sm text-[14px] leading-6 text-[#7a879e]">{description}</p>
        <div className="mt-8">{children}</div>
      </section>
    </div>
  </main>;
}
