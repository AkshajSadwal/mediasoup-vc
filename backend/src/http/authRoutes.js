import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireAuth } from "./authMiddleware.js";
import { getUserById, updateUserProfile } from "../auth/authStore.js";
import {
  assertAuthConfiguration,
  createPasswordUser,
  verifyPasswordUser,
  upsertGoogleUser,
  createAuthToken,
} from "../auth/authStore.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.resolve(__dirname, "../../../data/profile-pictures");
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

router.get("/me", requireAuth, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ user });
});

router.patch("/profile", requireAuth, (req, res) => {
  try {
    const { displayName, avatarDataUrl, removeAvatar } = req.body || {};
    let avatarUrl;
    if (avatarDataUrl !== undefined) {
      if (avatarDataUrl === null || removeAvatar === true) {
        avatarUrl = null;
      } else {
        const match = String(avatarDataUrl).match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) return res.status(400).json({ error: "Upload a PNG or JPG image." });
        const mime = match[1];
        const bytes = Buffer.from(match[2], "base64");
        if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) {
          return res.status(400).json({ error: "Profile image must be 5 MB or smaller." });
        }
        const isPng = mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const isJpeg = mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (!isPng && !isJpeg) return res.status(400).json({ error: "The image content does not match its file type." });

        fs.mkdirSync(profileDir, { recursive: true });
        const filename = `${crypto.randomUUID()}.${isPng ? "png" : "jpg"}`;
        fs.writeFileSync(path.join(profileDir, filename), bytes, { flag: "wx" });
        avatarUrl = `/profile-pictures/${filename}`;
      }
    }

    const user = updateUserProfile(req.user.id, {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });
    if (!user) return res.status(404).json({ error: "Account not found." });
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not update profile." });
  }
});

// Basic per-process abuse control. Use a shared store (e.g. Redis) behind
// multiple replicas in production.
const authAttempts = new Map();
const authRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const windowMs = 15 * 60 * 1000;
  const limit = 30;
  const current = authAttempts.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    authAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > limit) {
    res.set("Retry-After", String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
    return res.status(429).json({ error: "Too many authentication attempts. Try again later." });
  }
  next();
};


const requireAuthConfiguration = (res) => {
  try {
    assertAuthConfiguration();
    return true;
  } catch (error) {
    console.error("AUTH CONFIGURATION ERROR:", error.message);
    res.status(500).json({
      error: "Authentication service is not configured correctly on the server.",
    });
    return false;
  }
};

router.post("/signup", authRateLimit, (req, res) => {
  if (!requireAuthConfiguration(res)) return;

  try {
    // Validate auth configuration before writing the user so a broken secret
    // can never leave a partially-created account behind.
    const user = createPasswordUser(req.body || {});
    res.status(201).json({ user });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    res.status(400).json({ error: error.message || "Could not create account." });
  }
});

router.post("/login", authRateLimit, (req, res) => {
  if (!requireAuthConfiguration(res)) return;

  try {
    const user = verifyPasswordUser(req.body || {});
    if (!user) return res.status(401).json({ error: "Invalid username or password." });
    res.json({ user, authToken: createAuthToken(user) });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(400).json({ error: "Could not sign in." });
  }
});

router.post("/google", authRateLimit, (req, res) => {
  if (!requireAuthConfiguration(res)) return;

  try {
    const bridgeSecret = process.env.AUTH_BRIDGE_SECRET;
    if (!bridgeSecret || bridgeSecret.length < 32 || req.headers["x-auth-bridge-secret"] !== bridgeSecret) {
      return res.status(401).json({ error: "Unauthorized auth bridge request." });
    }
    const { providerAccountId, email, name, image } = req.body || {};
    if (!providerAccountId) return res.status(400).json({ error: "Google account ID is required." });
    const user = upsertGoogleUser({ providerAccountId, email, name, image });
    res.json({ user, authToken: createAuthToken(user) });
  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error);
    res.status(400).json({ error: "Could not complete Google sign-in." });
  }
});

export default router;
