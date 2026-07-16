"use client";

import { motion } from "framer-motion";
import { Video } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  return (
    <motion.nav
      initial={{
        opacity: 0,
        y: -30,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.7,
      }}
      className="
        fixed
        top-6
        left-1/2
        -translate-x-1/2
        z-50
        w-[90%]
        max-w-6xl
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          px-6
          py-4
          rounded-2xl
          bg-white/10
          backdrop-blur-xl
          border
          border-white/20
          shadow-xl
        "
      >
        {/* Logo */}

        <div
          className="
            flex
            items-center
            gap-3
            cursor-pointer
          "
          onClick={() => router.push("/")}
        >
          <div
            className="
              p-2
              rounded-xl
              bg-gradient-to-br
              from-cyan-400
              to-blue-600
            "
          >
            <Video size={22} className="text-white" />
          </div>

          <span
            className="
              text-xl
              font-bold
              text-white
            "
          >
            Rauma
          </span>
        </div>

        {/* Links */}

        <div
          className="
            hidden
            md:flex
            items-center
            gap-8
            text-white/70
          "
        >
          <a
            className="
              hover:text-white
              transition
            "
          >
            Features
          </a>

          <a
            className="
              hover:text-white
              transition
            "
          >
            Security
          </a>

          <a
            className="
              hover:text-white
              transition
            "
          >
            About
          </a>
        </div>

        {/* Button */}

        <button
          onClick={() => {
            const id = crypto.randomUUID();
            router.push(`/room/${id}`);
          }}
          className="
            hidden
            sm:block
            px-5
            py-2.5
            rounded-xl
            bg-white
            text-blue-700
            font-semibold
            hover:scale-105
            transition
            shadow-lg
          "
        >
          Create Room
        </button>
      </div>
    </motion.nav>
  );
}
