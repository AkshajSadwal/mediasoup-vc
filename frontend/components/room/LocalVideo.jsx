'use client';

import { Mic, MicOff, VideoOff } from "lucide-react";

export default function LocalVideo({
  localVideoRef,
  audioEnabled,
  videoEnabled,
  name = "You",
  isAdmin = false,
  avatarUrl = null,
}) {

  return (
    <div
      className="
        absolute
        bottom-6
        right-6
        w-80
        aspect-video
        rounded-2xl
        overflow-hidden
        border
        border-[#dce6f2]
        bg-[#14243a]
        shadow-[0_18px_45px_rgba(30,55,90,0.14)]
      "
    >

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="
          h-full
          w-full
          object-cover
        "
      />


      {/* Camera off overlay */}

      {!videoEnabled && (
        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            bg-[#14243a]
          "
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white/15" /> : <VideoOff size={40} className="text-white" />}
        </div>
      )}



      {/* Bottom Info */}

      <div
        className="
          absolute
          bottom-3
          left-3
          right-3
          flex
          items-center
          justify-between
        "
      >
        <span
          className="
            rounded-full
            bg-black/65
            px-3
            text-white
            py-1
            text-sm
            backdrop-blur
          "
        >
          <span className="flex items-center gap-2">
            {name}
            {isAdmin && (
              <span className="rounded-full bg-[#176df3]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                Admin
              </span>
            )}
          </span>
        </span>

        <div className="flex gap-2">
          <div className="rounded-full bg-black/65 p-2 text-white">
            {audioEnabled ? (
              <Mic size={16} />
            ) : (
              <MicOff size={16} className="text-red-400" />
            )}
          </div>
        </div>
      </div>


    </div>
  );
}