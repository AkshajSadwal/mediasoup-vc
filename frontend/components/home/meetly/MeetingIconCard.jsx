"use client";

export default function MeetingIconCard({ icon: Icon, title, description, onClick, iconClass = "bg-[#dce7dd] text-[#66816e]" }) {
  return (
    <button onClick={onClick} className="group relative min-h-[98px] rounded-[14px] border border-[#e6ece5] bg-[#edf2eb] p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#e9f0e8] hover:shadow-[0_10px_24px_rgba(88,111,95,0.07)]">
      <p className="text-[13px] font-medium text-[#263229]">{title}</p>
      <p className="mt-2 max-w-[150px] text-[10px] leading-4 text-[#89938c]">{description}</p>
      <span className={`absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full ${iconClass}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="absolute bottom-4 left-4 text-[14px] text-[#405249] transition group-hover:translate-x-0.5">→</span>
    </button>
  );
}
