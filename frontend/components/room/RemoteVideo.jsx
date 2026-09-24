"use client";

import { useEffect, useRef, useState } from "react";
import { VideoOff, Mic, MicOff, Volume2 } from "lucide-react";

export default function RemoteVideo({
  stream,
  trackSignature,
  name,
  audioEnabled = true,
  videoEnabled = true,
  isAdmin = false,
}) {
  const videoRef = useRef(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return undefined;

    let cancelled = false;
    let retryTimer = null;

    // Do not replace the MediaStream unless it is actually a different object.
    // Tracks are added/removed from this same stream by the parent.
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.autoplay = true;
    video.playsInline = true;
    video.controls = false;
    video.volume = 1;
    setPlayBlocked(false);

    const attemptPlayback = async () => {
      if (cancelled || !video.srcObject) return;

      try {
        await video.play();
        if (!cancelled) {
          setPlayBlocked(false);
          console.log("REMOTE VIDEO PLAYING", {
            name,
            trackSignature,
            videoReadyState: video.readyState,
            paused: video.paused,
          });
        }
      } catch (error) {
        if (cancelled) return;

        if (error?.name === "AbortError") {
          // Browser is replacing/loading the media element. Retry after the
          // current load settles instead of treating this as autoplay failure.
          retryTimer = window.setTimeout(() => {
            void attemptPlayback();
          }, 100);
          return;
        }

        if (error?.name === "NotAllowedError") {
          console.warn("REMOTE VIDEO AUTOPLAY REQUIRES CLICK", {
            name,
            trackSignature,
          });
          setPlayBlocked(true);
          return;
        }

        console.error("REMOTE VIDEO PLAY FAILED", error);
        setPlayBlocked(true);
      }
    };

    const schedulePlayback = () => {
      window.setTimeout(() => {
        void attemptPlayback();
      }, 0);
    };

    const handleLoadedMetadata = () => {
      console.log("REMOTE VIDEO LOADED METADATA", {
        name,
        trackSignature,
        videoReadyState: video.readyState,
      });
      schedulePlayback();
    };

    const handleCanPlay = () => {
      schedulePlayback();
    };

    const handlePlaying = () => {
      console.log("REMOTE VIDEO PLAYING EVENT", {
        name,
        trackSignature,
      });
      setPlayBlocked(false);
    };

    const handleWaiting = () => {
      console.warn("REMOTE VIDEO WAITING", {
        name,
        trackSignature,
      });
    };

    const handleStalled = () => {
      console.warn("REMOTE VIDEO STALLED", {
        name,
        trackSignature,
      });
    };

    const handleError = () => {
      console.error("REMOTE VIDEO ELEMENT ERROR", {
        name,
        trackSignature,
        mediaError: video.error,
      });
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("error", handleError);

    // The stream may already have live tracks when this effect runs.
    if (stream.getTracks().length > 0) {
      schedulePlayback();
    }

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }

      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("error", handleError);
      // Do not clear srcObject here. The same MediaStream may receive another
      // track immediately; React will dispose the element when the tile leaves.
    };
  }, [stream, trackSignature, name]);

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = false;
      await video.play();
      setPlayBlocked(false);
    } catch (error) {
      console.error("REMOTE MEDIA PLAY FAILED", error);
      // A user click is a gesture, so if audio autoplay was the blocker,
      // retry once in muted mode so the remote video is still visible.
      try {
        video.muted = true;
        await video.play();
        setPlayBlocked(false);
      } catch (secondError) {
        console.error("REMOTE MEDIA MUTED PLAY FAILED", secondError);
      }
    }
  };

  return (
    <div
      className="
        group
        relative
        min-h-0
        min-w-0
        aspect-video
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-black
        shadow-2xl
        transition
        hover:border-white/30
      "
      onClick={handlePlay}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="
          h-full
          w-full
          object-cover
        "
      />

      {!videoEnabled && (
        <div
          className="
            absolute
            inset-0
            flex
            flex-col
            items-center
            justify-center
            bg-[#111]
          "
        >
          <div
            className="
              flex
              h-24
              w-24
              items-center
              justify-center
              rounded-full
              bg-white/10
              text-3xl
              font-bold
            "
          >
            {name.charAt(name.length - 1)}
          </div>

          <VideoOff className="mt-4 text-gray-400" />
        </div>
      )}

      {playBlocked && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handlePlay();
          }}
          className="
            absolute
            left-1/2
            top-1/2
            flex
            -translate-x-1/2
            -translate-y-1/2
            items-center
            gap-2
            rounded-full
            bg-black/70
            px-4
            py-3
            text-sm
            backdrop-blur-xl
          "
        >
          <Volume2 size={17} />
          Click to play
        </button>
      )}

      <div
        className="
          absolute
          inset-x-0
          bottom-0
          h-28
          bg-gradient-to-t
          from-black/90
          to-transparent
        "
      />

      <div
        className="
          absolute
          bottom-4
          left-4
          right-4
          flex
          items-center
          justify-between
        "
      >
        <span
          className="
            flex
            items-center
            gap-2
            rounded-full
            bg-black/50
            px-4
            py-2
            text-sm
            backdrop-blur-xl
          "
        >
          {name}
          {isAdmin && (
            <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
              Admin
            </span>
          )}
        </span>

        <div
          className="
            rounded-full
            bg-black/50
            p-2
            backdrop-blur-xl
          "
        >
          {audioEnabled ? (
            <Mic size={16} />
          ) : (
            <MicOff size={16} className="text-red-400" />
          )}
        </div>
      </div>
    </div>
  );
}
