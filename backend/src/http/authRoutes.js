import express from "express";
import {
  assertAuthConfiguration,
  createPasswordUser,
  verifyPasswordUser,
  upsertGoogleUser,
  createAuthToken,
} from "../auth/authStore.js";

const router = express.Router();

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

router.post("/signup", (req, res) => {
  if (!requireAuthConfiguration(res)) return;

  try {
    // Validate auth configuration before writing the user so a broken secret
    // can never leave a partially-created account behind.
    const user = createPasswordUser(req.body || {});
    const authToken = createAuthToken(user);
    res.status(201).json({ user, authToken });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    res.status(400).json({ error: error.message || "Could not create account." });
  }
});

router.post("/login", (req, res) => {
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

router.post("/google", (req, res) => {
  if (!requireAuthConfiguration(res)) return;

  try {
    if (req.headers["x-auth-bridge-secret"] !== process.env.AUTH_BRIDGE_SECRET) {
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
