import { verifyAuthToken } from "../auth/authStore.js";

export const readBearerToken = (req) => {
  const value = req.headers.authorization || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const requireAuth = (req, res, next) => {
  const user = verifyAuthToken(readBearerToken(req));
  if (!user) return res.status(401).json({ error: "Authentication required." });
  req.user = user;
  next();
};
