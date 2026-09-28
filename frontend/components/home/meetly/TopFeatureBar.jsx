"use client";

import { Globe2, LockKeyhole, SlidersHorizontal, Video } from "lucide-react";

const features = [
  { icon: LockKeyhole, label: "Private by design" },
  { icon: Video, label: "HD video" },
  { icon: SlidersHorizontal, label: "Simple meeting controls" },
  { icon: Globe2, label: "Works everywhere" },
];

export default function TopFeatureBar() {
  return (
    <div className="border-b border-[#e5ebe5] bg-[#f7faf7]">
      <div className="mx-auto flex h-9 max-w-[930px] items-center justify-between px-2 text-[11px] font-medium text-[#59665e] sm:px-0">
        {features.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 whitespace-nowrap">
            <Icon className="h-3.5 w-3.5 text-[#53695d]" strokeWidth={1.8} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
