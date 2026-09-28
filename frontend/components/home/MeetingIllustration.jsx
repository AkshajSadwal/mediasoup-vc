"use client";

export default function MeetingIllustration() {
  return (
    <div className="mx-auto w-full max-w-[620px] select-none opacity-85" aria-hidden="true">
      <svg viewBox="0 0 760 300" className="h-auto w-full">
        <defs>
          <linearGradient id="screen" x1="0" x2="1">
            <stop offset="0%" stopColor="#c7ddff" />
            <stop offset="100%" stopColor="#8fb5ff" />
          </linearGradient>
        </defs>
        <ellipse cx="365" cy="260" rx="300" ry="9" fill="#d7dce7" />
        <path d="M90 246C144 202 210 199 249 232" fill="none" stroke="#c9d5e8" strokeWidth="3" />
        <path d="M590 232v-96m0 12 38 27m-38 4 29 20" fill="none" stroke="#c9d5e8" strokeWidth="3" strokeLinecap="round" />
        <rect x="305" y="122" width="184" height="112" rx="12" transform="rotate(7 305 122)" fill="#fff" stroke="#97a8c2" strokeWidth="3" />
        <rect x="324" y="137" width="146" height="79" rx="6" transform="rotate(7 324 137)" fill="url(#screen)" />
        <path d="M303 235h187l20 20H282z" fill="#dde4ef" stroke="#97a8c2" strokeWidth="3" />
        <path d="M394 163c-10 0-18 8-18 18v10c0 10 8 18 18 18s18-8 18-18v-10c0-10-8-18-18-18Zm-6 16h-6l12 8 12-8h-6v-7h-12z" fill="#5f8fe8" />
        <path d="M168 246c0-40 18-89 43-103 26 16 45 63 45 103" fill="#dcefe5" />
        <path d="M181 246c-1-42 7-81 30-101 24 21 30 60 27 101" fill="none" stroke="#789e8b" strokeWidth="3" />
        <path d="M206 157l-19-37m20 33 31-41m-31 41 7-51" stroke="#789e8b" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="185" cy="119" rx="11" ry="25" transform="rotate(-27 185 119)" fill="#a9ccb5" />
        <ellipse cx="238" cy="112" rx="11" ry="24" transform="rotate(33 238 112)" fill="#b9dbc3" />
        <ellipse cx="214" cy="97" rx="10" ry="23" fill="#c2dfc9" />
        <path d="M136 248h88v14h-88z" fill="#edf1f7" stroke="#97a8c2" strokeWidth="2" />
        <path d="M512 248h70v19h-70z" fill="#fff" stroke="#97a8c2" strokeWidth="2" />
        <path d="M512 248h70" stroke="#5e7a9f" strokeWidth="4" />
        <path d="M601 244h42c2 0 4 2 4 4v22h-49v-26c0-0.5 1.5-1 3-1Z" fill="#fff" stroke="#97a8c2" strokeWidth="2" />
        <path d="M644 252h13c11 0 15 7 15 12s-4 12-15 12h-10" fill="none" stroke="#97a8c2" strokeWidth="2" />
      </svg>
    </div>
  );
}
