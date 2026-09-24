import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../../data");
const usersPath = path.join(dataDir, "users.json");

const ensureStore = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, "[]\n", "utf8");
  }
};

const readUsers = () => {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`Could not read users store: ${error.message}`);
  }
};

const writeUsers = (users) => {
  ensureStore();
  const tempPath = `${usersPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, usersPath);
};

const normalizeUsername = (username) => String(username || "").trim().toLowerCase();
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username || null,
    email: user.email || null,
    name: user.name || user.username || user.email || "Guest",
    image: user.image || null,
    provider: user.provider,
  };
};

export const createPasswordUser = ({ username, password }) => {
  const cleanUsername = String(username || "").trim();
  const users = readUsers();

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(cleanUsername)) {
    throw new Error("Username must be 3-32 characters and use letters, numbers, _, ., or -.");
  }

  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters.");
  }

  if (users.some((user) => user.username?.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error("Username is already taken.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");

  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    email: null,
    name: cleanUsername,
    image: null,
    provider: "credentials",
    passwordSalt: salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);
  return sanitizeUser(user);
};

export const verifyPasswordUser = ({ username, password }) => {
  const cleanUsername = normalizeUsername(username);
  const users = readUsers();
  const user = users.find((item) => normalizeUsername(item.username) === cleanUsername);

  if (!user || !user.passwordHash || !user.passwordSalt) return null;

  const derived = crypto.scryptSync(password, user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, "hex");
  if (expected.length !== derived.length || !crypto.timingSafeEqual(expected, derived)) {
    return null;
  }

  return sanitizeUser(user);
};

export const upsertGoogleUser = ({ providerAccountId, email, name, image }) => {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  const index = users.findIndex(
    (user) =>
      user.provider === "google" &&
      user.providerAccountId === providerAccountId,
  );

  if (index >= 0) {
    const existing = users[index];
    existing.email = normalizedEmail || existing.email || null;
    existing.name = name || existing.name || existing.email || "Google User";
    existing.image = image || existing.image || null;
    writeUsers(users);
    return sanitizeUser(existing);
  }

  const emailOwnerIndex = normalizedEmail
    ? users.findIndex((user) => normalizeEmail(user.email) === normalizedEmail)
    : -1;

  if (emailOwnerIndex >= 0 && users[emailOwnerIndex].provider !== "google") {
    const existing = users[emailOwnerIndex];
    existing.provider = "google";
    existing.providerAccountId = providerAccountId;
    existing.name = name || existing.name;
    existing.image = image || existing.image;
    writeUsers(users);
    return sanitizeUser(existing);
  }

  const baseUsername = String((email || name || "google-user").split("@")[0])
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 24) || "google-user";

  let username = baseUsername;
  let counter = 1;
  while (users.some((user) => normalizeUsername(user.username) === normalizeUsername(username))) {
    username = `${baseUsername}${counter}`;
    counter += 1;
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    email: normalizedEmail || null,
    name: name || normalizedEmail || "Google User",
    image: image || null,
    provider: "google",
    providerAccountId,
    passwordSalt: null,
    passwordHash: null,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);
  return sanitizeUser(user);
};

export const getUserById = (userId) => {
  const users = readUsers();
  return sanitizeUser(users.find((user) => user.id === userId));
};

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return secret;
};

// Validate server-side auth configuration without creating or modifying any user.
export const assertAuthConfiguration = () => {
  getAuthSecret();
};

const encodePart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decodePart = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

export const createAuthToken = (user) => {
  const header = encodePart({ alg: "HS256", typ: "JWT" });
  const payload = encodePart({
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${signature}`;
};

export const verifyAuthToken = (token) => {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expected = crypto
      .createHmac("sha256", getAuthSecret())
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const decoded = decodePart(payload);
    if (!decoded?.sub || Number(decoded.exp) <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return getUserById(decoded.sub);
  } catch {
    return null;
  }
};
