import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireAuth } from "./authMiddleware.js";
import { accountRateLimit } from "./rateLimit.js";
import { safeImageDimensions } from "./imageDimensions.js";
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
  res.set("Cache-Control", "no-store").json({ user });
});

router.patch("/profile", requireAuth, accountRateLimit({ max: 30 }), (req, res) => {
  let newAvatarPath = null;
  try {
    const { displayName, avatarDataUrl, removeAvatar } = req.body || {};
    if (displayName !== undefined && (typeof displayName !== "string" ||
        !displayName.trim() || displayName.trim().length > 40 || /[\x00-\x1f\x7f]/.test(displayName))) {
      return res.status(400).json({ error: "Display name must be 1-40 characters." });
    }
    let avatarUrl;
    const oldAvatar = getUserById(req.user.id)?.avatarUrl;
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
        if (!safeImageDimensions(bytes, mime)) {
          return res.status(400).json({ error: "Invalid image data or unsupported image dimensions (maximum 16 megapixels)." });
        }

        fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
        const filename = `${crypto.randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;
        newAvatarPath = path.join(profileDir, filename);
        fs.writeFileSync(newAvatarPath, bytes, { flag: "wx", mode: 0o600 });
        avatarUrl = `/profile-pictures/${filename}`;
      }
    }

    const user = updateUserProfile(req.user.id, {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });
    if (!user) return res.status(404).json({ error: "Account not found." });
    // Old images must not remain publicly accessible indefinitely after replacement.
    if (avatarUrl !== undefined && oldAvatar && oldAvatar !== avatarUrl &&
        /^\/profile-pictures\/[0-9a-f-]{36}\.(?:png|jpg)$/.test(oldAvatar)) {
      try { fs.rmSync(path.join(profileDir, path.basename(oldAvatar)), { force: true }); }
      catch (error) { console.error("OLD AVATAR CLEANUP FAILED:", error); }
    }
    newAvatarPath = null;
    res.set("Cache-Control", "no-store").json({ user });
  } catch (error) {
    if (newAvatarPath) {
      try { fs.rmSync(newAvatarPath, { force: true }); }
      catch (cleanupError) { console.error("FAILED AVATAR WRITE CLEANUP:", cleanupError); }
    }
    res.status(400).json({ error: error.message || "Could not update profile." });
  }
});

// Basic per-process abuse control. Use a shared store (e.g. Redis) behind
// multiple replicas in production.
const authAttempts = new Map();
const authRateLimit = (req, res, next) => {
  const now = Date.now();
  const remote = req.ip || req.socket.remoteAddress || "unknown";
  // NextAuth forwards credential logins from its server. Limiting only by the
  // backend connection IP would lock all users out after 30 shared attempts.
  const subject = req.path === "/login" ? String(req.body?.username || "").trim().toLowerCase().slice(0, 128) :
    req.path === "/google" ? String(req.body?.providerAccountId || "").slice(0, 128) : "";
  const key = `${req.path}:${remote}:${subject ? crypto.createHash("sha256").update(subject).digest("hex") : ""}`;
  const windowMs = 15 * 60 * 1000;
  const limit = 30;
  const current = authAttempts.get(key);
  // Prevent a flood of distinct source addresses from growing the limiter indefinitely.
  if (!current && authAttempts.size >= 5000) {
    for (const [address, entry] of authAttempts) {
      if (now - entry.startedAt >= windowMs) authAttempts.delete(address);
    }
    if (authAttempts.size >= 5000) return res.status(429).json({ error: "Authentication is temporarily busy." });
  }
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
    const providedSecret = req.headers["x-auth-bridge-secret"];
    const secretMatches = typeof bridgeSecret === "string" && bridgeSecret.length >= 32 &&
      typeof providedSecret === "string" && Buffer.byteLength(providedSecret) === Buffer.byteLength(bridgeSecret) &&
      crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(bridgeSecret));
    if (!secretMatches) return res.status(401).json({ error: "Unauthorized auth bridge request." });
    const { providerAccountId, email, name, image } = req.body || {};
    if (typeof providerAccountId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(providerAccountId) ||
        (email != null && (typeof email !== "string" || email.length > 320)) ||
        (name != null && (typeof name !== "string" || name.length > 120)) ||
        (image != null && (typeof image !== "string" || image.length > 2048 || !/^https:\/\//.test(image)))) {
      return res.status(400).json({ error: "Invalid Google profile data." });
    }
    const user = upsertGoogleUser({ providerAccountId, email, name, image });
    res.json({ user, authToken: createAuthToken(user) });
  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error);
    res.status(400).json({ error: "Could not complete Google sign-in." });
  }
});

export default router;
