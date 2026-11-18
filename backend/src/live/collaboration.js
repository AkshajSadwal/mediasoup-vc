import crypto from "node:crypto";
import { roomMembers } from "./state.js";

export const requireCondition = (condition, message = "Invalid request.") => {
  if (!condition) throw new Error(message);
};

export function cleanText(value, max) {
  requireCondition(typeof value === "string" && value.trim().length > 0 && value.length <= max);
  return value.trim();
}

export function boardAction(room, peer, action, data) {
  const existing = room.board.get(data.id);
  if (action === "board-move") {
    requireCondition(existing?.userId === peer.userId, "Only the author can move this object.");
    requireCondition(Number.isInteger(data.dx) && Math.abs(data.dx) <= 1000 &&
      Number.isInteger(data.dy) && Math.abs(data.dy) <= 1000);
    const translated = existing.points.map(([x, y]) => [x + data.dx, y + data.dy]);
    requireCondition(translated.every(([x, y]) => x >= 0 && x <= 1000 && y >= 0 && y <= 1000), "Object must remain on the board.");
    existing.points = translated;
    return existing;
  }
  if (action === "board-add") {
    requireCondition(typeof data.id === "string" && /^[a-f0-9-]{36}$/i.test(data.id));
    if (existing) {
      requireCondition(existing.userId === peer.userId);
      return null;
    }
    requireCondition(room.board.size < 400, "The board is full. Ask the host to clear it.");
    const { tool, color, points } = data;
    requireCondition(["pen", "highlighter", "eraser", "line", "arrow", "rectangle", "ellipse", "text", "sticky"].includes(tool));
    requireCondition(typeof color === "string" && /^#[a-f0-9]{6}$/i.test(color));
    requireCondition(Array.isArray(points) && points.length >= 1 && points.length <= 96 &&
      points.every((point) => Array.isArray(point) && point.length === 2 &&
        point.every((value) => Number.isInteger(value) && value >= 0 && value <= 1000)));
    requireCondition(data.size === undefined || (Number.isInteger(data.size) && data.size >= 1 && data.size <= 30));
    const operation = {
      id: data.id, userId: peer.userId, order: ++room.boardOrder, tool, color, points,
      size: data.size ?? 4,
      text: ["text", "sticky"].includes(tool) ? cleanText(data.text, 120) : undefined, undone: false,
    };
    room.board.set(data.id, operation);
    return operation;
  }
  requireCondition(existing?.userId === peer.userId, "Only the author can undo or redo this action.");
  const undone = action === "board-undo";
  if (existing.undone === undone) return null;
  existing.undone = undone;
  return existing;
}

export function createPoll(room, peer, data, onDeadline) {
  requireCondition(room.polls.size < 30, "This room has reached its poll limit.");
  requireCondition(data.type === "poll" || data.type === "vote");
  const question = cleanText(data.question, 180);
  requireCondition(data.type === "vote" || (Array.isArray(data.options) && data.options.length >= 2 && data.options.length <= 8));
  const options = data.type === "vote" ? ["Yes", "No", "Abstain"] : data.options.map((option) => cleanText(option, 80));
  requireCondition(new Set(options).size === options.length, "Options must be unique.");
  const seconds = data.seconds;
  requireCondition((seconds === 0 && data.type === "poll") || (Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600));
  requireCondition(["anonymous", "multiple", "change", "live"].every((key) => typeof data[key] === "boolean"));
  const poll = {
    id: crypto.randomUUID(), type: data.type, author: peer.userId, question, options,
    multiple: data.type === "poll" && data.multiple, anonymous: data.anonymous,
    change: data.change, live: data.live, deadline: seconds ? Date.now() + seconds * 1000 : null,
    eligible: new Set(roomMembers(peer).map(({ userId }) => userId)), ballots: new Map(), closed: false,
  };
  room.polls.set(poll.id, poll);
  if (seconds) {
    poll.timer = setTimeout(() => {
      if (poll.closed) return;
      poll.closed = true;
      onDeadline();
    }, seconds * 1000);
    poll.timer.unref();
  }
}

export function castBallot(poll, userId, choices) {
  requireCondition(poll?.eligible.has(userId), "You were not eligible when this ballot opened.");
  requireCondition(!poll.closed && (!poll.deadline || poll.deadline > Date.now()), "Voting has closed.");
  requireCondition(Array.isArray(choices) && choices.length >= 1 && choices.length <= (poll.multiple ? poll.options.length : 1) &&
    new Set(choices).size === choices.length && choices.every((choice) => Number.isInteger(choice) && choice >= 0 && choice < poll.options.length));
  const previous = poll.ballots.get(userId);
  if (previous && previous.length === choices.length && previous.every((choice) => choices.includes(choice))) return;
  requireCondition(!previous || poll.change, "This ballot cannot be changed.");
  poll.ballots.set(userId, choices);
}

export function publicPoll(poll, peer) {
  const { id, type, question, options, author, multiple, anonymous, change, live, deadline, ballots, eligible } = poll;
  const closed = poll.closed || Boolean(deadline && deadline <= Date.now());
  const result = { id, type, question, options, multiple, anonymous, change, deadline, closed,
    canClose: peer.isAdmin || peer.userId === author, eligible: eligible.has(peer.userId),
    submitted: ballots.has(peer.userId) };
  if (live || closed) {
    result.totals = options.map((_, index) => [...ballots.values()].filter((choices) => choices.includes(index)).length);
    if (!anonymous) result.voters = [...ballots].map(([userId, choices]) => ({ name: peer.meeting.members.get(userId)?.name, choices }));
  }
  return result;
}
