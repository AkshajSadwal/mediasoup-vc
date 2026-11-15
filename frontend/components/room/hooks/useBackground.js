import { useEffect, useRef, useState } from "react";
import { BackgroundPipeline } from "./backgroundPipeline";

export function useBackground(media, rawTrack, replaceCamera, notify) {
  const pipeline = useRef(null);
  const [view, setView] = useState({ mode: "raw", media: null });
  useEffect(() => {
    if (!media) return;
    const entry = new BackgroundPipeline(replaceCamera, (state) => setView((prior) =>
      prior.media === media && prior.mode === state.mode && prior.id === state.id && prior.loading === state.loading ? prior : { ...state, media }), notify);
    pipeline.current = entry;
    return () => { entry.close(); pipeline.current = null; };
  }, [media, replaceCamera, notify]);

  useEffect(() => { pipeline.current?.attach(rawTrack); }, [media, rawTrack]);

  return { ...(view.media === media ? view : { mode: "raw" }),
    choose: (mode, image) => pipeline.current?.choose(mode, image) };
}
