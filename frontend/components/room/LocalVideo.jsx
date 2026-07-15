'use client';

import { Mic, MicOff, VideoOff } from "lucide-react";

export default function LocalVideo({
  localVideoRef,
  audioEnabled,
  videoEnabled,
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
        border-white/10
        bg-black
        shadow-2xl
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
            bg-black
          "
        >
          <VideoOff
            size={40}
            className="text-gray-400"
          />
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
            bg-black/60
            px-3
            py-1
            text-sm
            backdrop-blur
          "
        >
          You
        </span>



        <div
          className="
            flex
            gap-2
          "
        >

          <div
            className="
              rounded-full
              bg-black/60
              p-2
            "
          >
            {audioEnabled
              ?
              <Mic size={16}/>
              :
              <MicOff
                size={16}
                className="text-red-400"
              />
            }
          </div>

        </div>

      </div>


    </div>
  );
}