export function mixInputs(context, destination) {
  const sources = new Map();
  return {
    update(streams) {
      const tracks = new Map(streams.flatMap((stream) => (stream?.getAudioTracks() || [])
        .filter((track) => track.readyState === "live").map((track) => [track.id, track])));
      for (const [id, source] of sources) {
        if (tracks.has(id)) continue;
        source.disconnect();
        sources.delete(id);
      }
      for (const [id, track] of tracks) {
        if (sources.has(id)) continue;
        const source = context.createMediaStreamSource(new MediaStream([track]));
        source.connect(destination);
        sources.set(id, source);
      }
    },
    close() {
      for (const source of sources.values()) source.disconnect();
      sources.clear();
    },
  };
}
