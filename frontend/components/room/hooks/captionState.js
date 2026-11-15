export function applyCaption(previous, event, now = Date.now()) {
  const prior = previous[event.speakerId];
  if (prior?.streamId === event.streamId && event.sequence <= prior.sequence) return previous;
  if (event.type === "clear" && prior?.streamId !== event.streamId) return previous;
  if (!["partial", "final", "clear"].includes(event.type)) return previous;
  return { ...previous, [event.speakerId]: {
    streamId: event.streamId, sequence: event.sequence, utteranceId: event.utteranceId,
    text: event.type === "clear" ? "" : event.text, name: event.speaker, receivedAt: now,
    final: event.type === "final",
  } };
}

export function matchesCaption(event, scope) {
  return event.roomId === scope.roomId && event.roomToken === scope.roomToken && event.subscription === scope.subscription;
}
