import { useEffect, useRef, useState } from "react";
import { applyCaption, matchesCaption } from "./captionState";

export function useCaptions(media) {
  const subscription = useRef(null);
  const [view, setView] = useState({ media: null, status: null, entries: {} });
  useEffect(() => {
    if (!globalThis.caches) return;
    void caches.has("transformers-cache").then(async (exists) => {
      if (!exists) return;
      const cache = await caches.open("transformers-cache");
      const entries = await cache.keys();
      await Promise.all(entries.filter(({ url }) => /\/Xenova\/whisper-tiny\.en\//.test(url)).map((request) => cache.delete(request)));
    }).catch(() => undefined);
  }, []);
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
      if (event.roomToken !== media.token || event.subscription !== subscription.current?.id) return;
      subscription.current = null;
      setView({ media, status: "Captions unavailable", entries: {} });
    };
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
        subscription.current = null;
        if (!media.closed) void media.ask("caption-subscribe", { enabled: false, subscription: crypto.randomUUID() }).catch(() => undefined);
      }
      media.socket.off("caption-update", receive);
      media.socket.off("caption-status", unavailable);
      clearInterval(timer);
      setView((prior) => prior.media === media ? { media: null, status: null, entries: {} } : prior);
    };
  }, [media]);

  const toggle = async () => {
    if (!media) return;
    const id = crypto.randomUUID();
    if (subscription.current?.media === media) {
      subscription.current = null;
      setView({ media, status: null, entries: {} });
      await media.ask("caption-subscribe", { enabled: false, subscription: id }).catch(() => undefined);
      return;
    }
    subscription.current = { id, media };
    setView({ media, status: "Connecting to server captions…", entries: {} });
    try {
      await media.ask("caption-subscribe", { enabled: true, subscription: id });
      if (subscription.current?.id === id) setView((prior) => ({ ...prior, status: "English server captions are on." }));
    } catch {
      if (subscription.current?.id !== id) return;
      subscription.current = null;
      setView({ media, status: "Captions unavailable", entries: {} });
      void media.ask("caption-subscribe", { enabled: false, subscription: crypto.randomUUID() }).catch(() => undefined);
    }
  };

  const visible = view.media === media ? view : { status: null, entries: {} };
  return { toggle, status: visible.status, enabled: !!visible.status && visible.status !== "Captions unavailable",
    lines: Object.entries(visible.entries).filter(([, entry]) => entry.text).sort((a, b) => b[1].receivedAt - a[1].receivedAt).slice(0, 2) };
}
