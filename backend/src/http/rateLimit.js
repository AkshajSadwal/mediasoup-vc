// Per-account limits for storage-mutating HTTP routes. Per-process protection
// only: production replicas need a shared limiter at the edge or in Redis.
export function accountRateLimit({ max, windowMs = 15 * 60_000 }) {
  const attempts = new Map();
  return (req, res, next) => {
    const key = req.user?.id;
    if (!key) return res.status(401).json({ error: "Authentication required." });
    const now = Date.now();
    let current = attempts.get(key);
    if (!current && attempts.size >= 5000) {
      for (const [account, entry] of attempts) {
        if (now - entry.startedAt >= windowMs) attempts.delete(account);
      }
      if (attempts.size >= 5000) return res.status(429).json({ error: "Too many active requests." });
    }
    if (!current || now - current.startedAt >= windowMs) {
      current = { startedAt: now, count: 0 };
      attempts.set(key, current);
    }
    if (++current.count > max) {
      res.set("Retry-After", String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}
