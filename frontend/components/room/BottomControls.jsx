'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Copy,
  Share2,
  PhoneOff
} from "lucide-react";

import { useRouter } from "next/navigation";


export default function BottomControls({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  copyRoomCode,
  shareRoom
}) {

  const router = useRouter();


  return (
    <div
      className="
        fixed
        bottom-6
        left-1/2
        -translate-x-1/2
        z-30
      "
    >

      <div
        className="
          flex
          items-center
          gap-4
          rounded-3xl
          border
          border-white/10
          bg-white/10
          backdrop-blur-xl
          px-6
          py-4
          shadow-2xl
        "
      >
        
        {/* Mic */}

        <button
          onClick={toggleAudio}
          className="
            h-14
            w-14
            rounded-full
            bg-white/10
            hover:bg-white/20
            transition
            flex
            items-center
            justify-center
          "
        >
          {audioEnabled
            ? <Mic />
            : <MicOff />
          }
        </button>

        {/* Camera */}

        <button
          onClick={toggleVideo}
          className="
            h-14
            w-14
            rounded-full
            bg-white/10
            hover:bg-white/20
            transition
            flex
            items-center
            justify-center
          "
        >

          {videoEnabled
            ? <Video />
            : <VideoOff />
          }

        </button>

        {/* Copy */}

        <button
          onClick={copyRoomCode}
          className="
            h-14
            w-14
            rounded-full
            bg-white/10
            hover:bg-white/20
            transition
            flex
            items-center
            justify-center
          "
        >
          <Copy />
        </button>


        {/* Share */}

        <button
          onClick={shareRoom}
          className="
            h-14
            w-14
            rounded-full
            bg-white/10
            hover:bg-white/20
            transition
            flex
            items-center
            justify-center
          "
        >
          <Share2 />
        </button>

        {/* Hangup */}

        <button
          onClick={() => router.push("/")}
          className="
            h-14
            w-14
            rounded-full
            bg-red-500
            hover:bg-red-600
            transition
            flex
            items-center
            justify-center
            shadow-lg
            shadow-red-500/30
          "
        >
          <PhoneOff />
        </button>


      </div>

    </div>
  );
}