'use client';

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function ToastMessage({ message }) {
  return (
    <AnimatePresence>

      {message && (
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            scale: 0.9
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: -20,
            scale: 0.9
          }}
          transition={{
            duration: 0.25
          }}
          className="
            fixed
            top-24
            left-1/2
            -translate-x-1/2
            z-50
            flex
            items-center
            gap-2
            rounded-full
            border
            border-white/10
            bg-white/10
            px-5
            py-3
            text-white
            backdrop-blur-xl
            shadow-2xl
          "
        >

          <Check
            size={18}
            className="text-emerald-400"
          />

          <span className="text-sm font-medium">
            {message}
          </span>

        </motion.div>
      )}

    </AnimatePresence>
  );
}