"use client";

export default function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Aurora Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="
          absolute
          inset-0
          w-full
          h-full
          object-cover
        "
      >
        <source src="/videos/aurora.mp4" type="video/mp4" />
      </video>

      {/* Dark cinematic overlay */}
      <div
        className="
          absolute
          inset-0
          bg-black/50
        "
      />

      {/* Blue-green color tint */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-b
          from-emerald-900/30
          via-blue-900/40
          to-black/70
        "
      />

      {/* Optional animated light glow */}
      <div
        className="
          absolute
          inset-0
          bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.6)_100%)]
        "
      />
    </div>
  );
}
