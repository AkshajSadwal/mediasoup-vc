'use client';

import { motion } from "framer-motion";
import { Mic, Video, PhoneOff } from "lucide-react";


export default function MeetingPreview() {

  return (

    <motion.div

      initial={{
        opacity:0,
        x:80
      }}

      animate={{
        opacity:1,
        x:0
      }}

      transition={{
        duration:1
      }}

      className="
        hidden
        lg:block
        w-full
        max-w-[420px]
        justify-self-center
      "

    >


      <div
        className="
          rounded-3xl
          bg-white/10
          backdrop-blur-2xl
          border
          border-white/20
          shadow-2xl
          overflow-hidden
        "
      >


        {/* Header */}

        <div
          className="
            flex
            items-center
            justify-between
            px-5
            py-4
            bg-black/20
          "
        >

          <span className="text-white font-semibold">
            Live Meeting
          </span>


          <div className="
            flex
            items-center
            gap-2
            text-red-400
            text-sm
          ">
            <span className="
              w-2
              h-2
              bg-red-500
              rounded-full
              animate-pulse
            "/>

            LIVE
          </div>


        </div>



        {/* Video Area */}

        <div
          className="
            h-[260px]
            bg-gradient-to-br
            from-slate-800
            to-slate-950
            flex
            items-center
            justify-center
            gap-5
          "
        >


          {/* Fake users */}

          <div
            className="
              w-28
              h-28
              rounded-2xl
              bg-gradient-to-br
              from-cyan-400
              to-blue-600
              flex
              items-center
              justify-center
              text-4xl
            "
          >
            👨‍💻
          </div>


          <div
            className="
              w-28
              h-28
              rounded-2xl
              bg-gradient-to-br
              from-purple-400
              to-pink-600
              flex
              items-center
              justify-center
              text-4xl
            "
          >
            👩‍💻
          </div>


        </div>




        {/* Controls */}

        <div
          className="
            flex
            justify-center
            gap-5
            py-5
          "
        >

          <button
            className="
              p-3
              rounded-full
              bg-white/10
              text-white
              hover:bg-white/20
            "
          >
            <Mic size={22}/>
          </button>


          <button
            className="
              p-3
              rounded-full
              bg-white/10
              text-white
              hover:bg-white/20
            "
          >
            <Video size={22}/>
          </button>


          <button
            className="
              p-3
              rounded-full
              bg-red-500
              text-white
            "
          >
            <PhoneOff size={22}/>
          </button>


        </div>



      </div>


    </motion.div>

  );
}