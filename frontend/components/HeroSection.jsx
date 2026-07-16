"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Video, PlusCircle, LogIn } from "lucide-react";

export default function HeroSection() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  const createRoom = () => {
    const id = crypto.randomUUID();
    router.push(`/room/${id}`);
  };

  const joinRoom = () => {
    if (!roomId.trim()) return;
    router.push(`/room/${roomId}`);
  };

  return (
    <section
      className="
    w-full
    "
    >
      <motion.div
        initial={{
          opacity: 0,
          y: 50,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.8,
        }}
        className="
          w-full
          rounded-3xl
          bg-white/10
          backdrop-blur-2xl
          border
          border-white/20
          shadow-2xl
          p-10
        "
      >
        {/* Icon */}
        <div
          className="
          flex
          justify-center
          mb-6
        "
        >
          <div
            className="
            p-5
            rounded-full
            bg-white/20
            shadow-lg
          "
          >
            <Video size={45} className="text-white" />
          </div>
        </div>

        {/* Heading */}
        <h1
          className="
          text-center
          text-5xl
          md:text-6xl
          font-bold
          text-white
          tracking-tight
        "
        >
          Video Meetings
          <br />
          <span className="text-cyan-300">Reimagined</span>
        </h1>

        <p
          className="
          mt-5
          text-center
          text-white/70
          text-lg
        "
        >
          Create secure HD video rooms instantly. Connect with anyone, anywhere.
        </p>

        {/* Create Button */}
        <button
          onClick={createRoom}
          className="
            mt-8
            w-full
            flex
            items-center
            justify-center
            gap-3
            py-4
            rounded-xl
            font-semibold
            text-lg
            bg-gradient-to-r
            from-cyan-400
            to-blue-500
            text-white
            shadow-lg
            hover:scale-105
            hover:shadow-cyan-500/50
            transition
          "
        >
          <PlusCircle />
          Create New Room
        </button>

        {/* Divider */}
        <div
          className="
          flex
          items-center
          gap-4
          my-8
        "
        >
          <div className="h-px bg-white/30 flex-1" />
          <span className="text-white/60">OR</span>
          <div className="h-px bg-white/30 flex-1" />
        </div>

        {/* Join */}
        <div className="flex gap-3">
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="
              flex-1
              rounded-xl
              bg-black/20
              border
              border-white/20
              px-4
              text-white
              placeholder:text-white/40
              outline-none
              focus:ring-2
              focus:ring-cyan-400
            "
          />

          <button
            onClick={joinRoom}
            className="
              px-5
              rounded-xl
              bg-white
              text-blue-700
              font-semibold
              hover:scale-105
              transition
            "
          >
            <LogIn />
          </button>
        </div>

        {/* Features */}
        <div
          className="
          mt-8
          flex
          justify-center
          gap-6
          text-sm
          text-white/70
        "
        >
          <span>⚡ Fast</span>
          <span>🔒 Secure</span>
          <span>🎥 HD</span>
        </div>
      </motion.div>
    </section>
  );
}
