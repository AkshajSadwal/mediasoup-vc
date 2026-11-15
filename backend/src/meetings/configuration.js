import crypto from "node:crypto";

export const FEATURES = ["microphone", "camera", "whiteboard", "hands", "reactions", "screen", "chat", "recording", "files", "polls"];
export const TIERS = ["participant", "moderator"];
export const DEFAULT_DURATION = 15;
const idPattern = /^[\w-]{1,128}$/;
const tokenPattern = /^[\w-]{43}$/;
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const check = (value, message = "Invalid meeting configuration.") => { if (!value) throw new Error(message); };
const id = (value) => typeof value === "string" && idPattern.test(value);
const title = (value) => {
  check(typeof value === "string" && value.trim() && value.length <= 50, "Names must contain 1 to 50 characters.");
  return value.trim();
};

export function duration(value) {
  check(Number.isInteger(value) && value >= 1 && value <= 180, "Enter a duration from 1 to 180 minutes.");
  return value;
}

function booleanRules(value, keys) {
  check(object(value));
  const result = {};
  for (const [key, setting] of Object.entries(value)) {
    check(keys.includes(key) && typeof setting === "boolean");
    result[key] = setting;
  }
  return result;
}

export function validateConfiguration(input, existingTeams = [], createTeams = false) {
  check(object(input) && object(input.defaults) && object(input.initial) && object(input.overrides) &&
    Array.isArray(input.rooms) && input.rooms.length <= 5 && object(input.assignments) &&
    Array.isArray(input.teams) && input.teams.length <= 10);
  const defaults = Object.fromEntries(TIERS.map((tier) => [tier, booleanRules(input.defaults[tier] ?? {}, FEATURES)]));
  const initial = Object.fromEntries(TIERS.map((tier) => [tier, booleanRules(input.initial[tier] ?? {}, ["microphone", "camera"])]));
  const overrides = {};
  check(Object.keys(input.overrides).length <= 100);
  for (const [account, rules] of Object.entries(input.overrides)) {
    check(id(account));
    Object.defineProperty(overrides, account, { enumerable: true, value: booleanRules(rules, FEATURES) });
  }

  const rooms = input.rooms.map((room) => {
    check(object(room) && id(room.id) && room.id !== "main");
    return { id: room.id, title: title(room.title) };
  });
  const roomIds = new Set(rooms.map((room) => room.id));
  check(roomIds.size === rooms.length, "Room IDs must be unique.");
  const assignments = {};
  check(Object.keys(input.assignments).length <= 100);
  for (const [account, room] of Object.entries(input.assignments)) {
    check(id(account) && (room === "main" || roomIds.has(room)));
    Object.defineProperty(assignments, account, { enumerable: true, value: room });
  }

  const links = [];
  const teams = input.teams.map((team) => {
    check(object(team) && (team.room == null || roomIds.has(team.room)));
    check(typeof team.enabled === "boolean");
    if (createTeams) {
      const teamId = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString("base64url");
      links.push({ id: teamId, token });
      return { id: teamId, name: title(team.name), room: team.room ?? null, enabled: team.enabled, hash: hashTeamToken(token) };
    }
    const prior = existingTeams.find((entry) => entry.id === team.id);
    check(prior && (prior.enabled || !team.enabled), "Teams can only be issued in Config meeting. Revoked links cannot be re-enabled.");
    return { ...prior, name: title(team.name), room: team.room ?? null, enabled: team.enabled };
  });
  check(createTeams || (teams.length === existingTeams.length && new Set(teams.map(({ id: key }) => key)).size === teams.length));
  return { configuration: { defaults, initial, overrides, rooms, assignments, duration: duration(input.duration), teams }, links };
}

export function emptyConfiguration() {
  return { defaults: { participant: {}, moderator: {} }, initial: { participant: {}, moderator: {} }, overrides: {},
    rooms: [], assignments: {}, duration: DEFAULT_DURATION, teams: [] };
}

export function publicConfiguration(config) {
  const { teams, ...settings } = config ?? emptyConfiguration();
  return { ...settings, teams: teams.map(({ id: key, name, room, enabled }) => ({ id: key, name, room, enabled })) };
}

const hashTeamToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function teamForToken(config, token) {
  check(typeof token === "string" && tokenPattern.test(token), "This team link is invalid or revoked.");
  const hash = Buffer.from(hashTeamToken(token), "hex");
  const team = config?.teams.find((entry) => entry.enabled && crypto.timingSafeEqual(hash, Buffer.from(entry.hash, "hex")));
  check(team, "This team link is invalid or revoked.");
  return team;
}
