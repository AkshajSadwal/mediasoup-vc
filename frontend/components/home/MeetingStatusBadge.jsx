"use client";

const labels = { upcoming: "Upcoming", ongoing: "Ongoing", past: "Past" };

export default function MeetingStatusBadge({ status }) {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold";
  if (status === "ongoing") return <span className={`${base} bg-emerald-50 text-emerald-700`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{labels[status]}</span>;
  if (status === "past") return <span className={`${base} bg-slate-100 text-slate-500`}>{labels[status]}</span>;
  return <span className={`${base} bg-blue-50 text-blue-600`}>{labels[status]}</span>;
}
