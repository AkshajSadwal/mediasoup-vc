// Bound costly meeting joins across multiple sockets belonging to one account.
// This is only a per-process limit; use edge/shared controls in production.
const attempts = new Map();
export function rateAccount(accountId, operation, max, windowMs) {
  if (typeof accountId !== "string" || !accountId) throw new Error("AUTH_REQUIRED");
  const key = `${operation}:${accountId}`;
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry && attempts.size >= 5000) {
    for (const [id, value] of attempts) if (now - value.start >= value.windowMs) attempts.delete(id);
    if (attempts.size >= 5000) throw new Error("Too many active meeting requests.");
  }
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0, windowMs };
    attempts.set(key, entry);
  }
  if (++entry.count > max) throw new Error("Too many meeting joins. Try again later.");
}
