import { useEffect, useRef, useState } from "react";
import { applyCaption, matchesCaption } from "./captionState";

// Web Speech is a voluntary compatibility mode. Some browsers may send audio
// to their speech provider; this is disclosed in the meeting UI.
function startBrowserSpeech(scope, setView) {
  if (!scope.active || scope.mode !== "browser" || scope.recognition) return;
  if (!scope.audioEnabled) {
    setView((prior) => ({ ...prior, status: "Browser captions on. Unmute to transcribe your microphone." }));
    return;
  }
  const Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Engine) {
    setView((prior) => ({ ...prior, status: "Browser captions on (receive only). This browser cannot recognize your microphone." }));
    return;
  }
  const recognizer = new Engine();
  const streamId = crypto.randomUUID();
  let utteranceId = crypto.randomUUID();
  let sequence = 0;
  let lastPartial = 0;
  let failed = false;
  scope.recognition = recognizer;
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = "en-US";
  recognizer.onresult = (event) => {
    if (!scope.active || scope.recognition !== recognizer || !scope.audioEnabled) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result?.[0]?.transcript?.trim().slice(0, 500);
      if (!text) continue;
      if (!result.isFinal && Date.now() - lastPartial < 450) continue;
      if (!result.isFinal) lastPartial = Date.now();
      const payload = { final: Boolean(result.isFinal), text, streamId, utteranceId, sequence: ++sequence };
      void scope.media.ask("browser-caption-publish", payload).catch(() => undefined);
      if (result.isFinal) utteranceId = crypto.randomUUID();
    }
  };
  recognizer.onerror = ({ error }) => {
    if (["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"].includes(error)) {
      failed = true;
      if (scope.active) setView((prior) => ({ ...prior,
        status: `Browser speech recognition stopped (${error}). You can still receive others' captions.` }));
    }
  };
  recognizer.onend = () => {
    if (scope.recognition !== recognizer) return;
    scope.recognition = null;
    if (!scope.active || !scope.audioEnabled || failed) return;
    scope.restart = window.setTimeout(() => startBrowserSpeech(scope, setView), 900);
  };
  try {
    recognizer.start();
    setView((prior) => ({ ...prior, status: "Browser captions on. Speech from participants who enable browser captions will appear here." }));
  } catch {
    scope.recognition = null;
    setView((prior) => ({ ...prior, status: "Browser recognition could not start. You can still receive others' captions." }));
  }
}

function stopBrowserSpeech(scope) {
  clearTimeout(scope.restart);
  scope.restart = null;
  const recognizer = scope.recognition;
  scope.recognition = null;
  if (recognizer) {
    recognizer.onend = null;
    recognizer.onresult = null;
    recognizer.onerror = null;
    try { recognizer.abort(); } catch { /* already stopped */ }
  }
}

export function useCaptions(media, audioEnabled = false) {
  const subscription = useRef(null);
  const [view, setView] = useState({ media: null, status: null, entries: {} });

  useEffect(() => {
    if (!media) return;
    const receive = (event) => {
      const id = subscription.current?.id;
      if (subscription.current?.media !== media || !matchesCaption(event, {
        roomId: media.live.roomId, roomToken: media.token, subscription: id,
      })) return;
      setView((prior) => prior.media === media ? { ...prior, entries: applyCaption(prior.entries, event) } : prior);
    };
    const unavailable = (event) => {
      const scope = subscription.current;
      if (event.roomToken !== media.token || event.subscription !== scope?.id || scope.media !== media) return;
      // The Vosk worker failed after subscribe; keep captions usable by
      // explicitly switching this viewer to browser fallback.
      void fallback(scope);
    };
    async function fallback(scope) {
      if (subscription.current !== scope || scope.mode === "browser") return;
      try {
        await media.ask("browser-caption-subscribe", { enabled: true, subscription: scope.id });
        if (subscription.current !== scope) {
          void media.ask("browser-caption-subscribe", { enabled: false, subscription: scope.id }).catch(() => undefined);
          return;
        }
        scope.mode = "browser";
        setView({ media, mode: "browser", status: "Browser captions on. Speech recognition is provided by your browser.", entries: {} });
        startBrowserSpeech(scope, setView);
      } catch (error) {
        if (subscription.current !== scope) return;
        subscription.current = null;
        setView({ media, status: `Captions unavailable: ${error.message}`, entries: {} });
      }
    }
    media.captionFallback = fallback;
    media.socket.on("caption-update", receive);
    media.socket.on("caption-status", unavailable);
    const timer = setInterval(() => {
      setView((prior) => {
        const stale = Object.values(prior.entries).some((entry) => entry.text && Date.now() - entry.receivedAt > 8000);
        if (!stale) return prior;
        return { ...prior, entries: Object.fromEntries(Object.entries(prior.entries).map(([id, entry]) =>
          [id, Date.now() - entry.receivedAt > 8000 ? { ...entry, text: "" } : entry])) };
      });
    }, 1000);
    return () => {
      if (subscription.current?.media === media) {
        const scope = subscription.current;
        subscription.current = null;
        scope.active = false;
        stopBrowserSpeech(scope);
        if (!media.closed) void media.ask(scope.mode === "browser" ? "browser-caption-subscribe" : "caption-subscribe",
          { enabled: false, subscription: scope.id }).catch(() => undefined);
      }
      media.captionFallback = null;
      media.socket.off("caption-update", receive);
      media.socket.off("caption-status", unavailable);
      clearInterval(timer);
      setView((prior) => prior.media === media ? { media: null, status: null, entries: {} } : prior);
    };
  }, [media]);

  useEffect(() => {
    const scope = subscription.current;
    if (!scope || scope.media !== media || scope.mode !== "browser") return;
    scope.audioEnabled = audioEnabled;
    if (audioEnabled) startBrowserSpeech(scope, setView);
    else {
      stopBrowserSpeech(scope);
      setView((prior) => ({ ...prior, status: "Browser captions on. Unmute to transcribe your microphone." }));
    }
  }, [media, audioEnabled]);

  const toggle = async () => {
    if (!media) return;
    const prior = subscription.current;
    if (prior?.media === media) {
      prior.active = false;
      subscription.current = null;
      stopBrowserSpeech(prior);
      setView({ media, status: null, entries: {} });
      await media.ask(prior.mode === "browser" ? "browser-caption-subscribe" : "caption-subscribe",
        { enabled: false, subscription: prior.id }).catch(() => undefined);
      return;
    }
    const scope = { id: crypto.randomUUID(), media, audioEnabled, active: true, mode: "server", recognition: null };
    subscription.current = scope;
    setView({ media, status: "Connecting to server captions…", entries: {} });
    try {
      await media.ask("caption-subscribe", { enabled: true, subscription: scope.id });
      if (subscription.current === scope && scope.mode === "server") {
        setView((prior) => ({ ...prior, status: "English server captions are on." }));
      }
    } catch {
      if (subscription.current !== scope) return;
      await media.captionFallback?.(scope);
    }
  };

  const visible = view.media === media ? view : { status: null, entries: {} };
  return { toggle, status: visible.status, mode: visible.mode || "server",
    enabled: subscription.current?.media === media,
    lines: Object.entries(visible.entries).filter(([, entry]) => entry.text)
      .sort((a, b) => b[1].receivedAt - a[1].receivedAt).slice(0, 2) };
}
