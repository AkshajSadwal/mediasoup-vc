import { MessageCircle, LockKeyhole } from "lucide-react";

export default function ChatDisabledCard() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-white/45"><MessageCircle size={19} /></span>
          <div>
            <h2 className="text-lg font-semibold text-white">Chat</h2>
            <p className="text-xs text-white/40">Disabled on the dashboard</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35"><LockKeyhole size={11} />Disabled</span>
      </div>
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/35">
        Chat stays available inside active meetings. The home dashboard keeps it turned off for now.
      </div>
    </div>
  );
}
