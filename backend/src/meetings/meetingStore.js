import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../../data");
const meetingsPath = path.join(dataDir, "meetings.json");

const ensureStore = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(meetingsPath)) fs.writeFileSync(meetingsPath, "[]\n", "utf8");
};

const normalizeMeeting = (meeting) => ({
  ...meeting,
  attendeeUserIds: Array.isArray(meeting.attendeeUserIds) ? meeting.attendeeUserIds : [],
});

const readMeetings = () => {
  ensureStore();
  const parsed = JSON.parse(fs.readFileSync(meetingsPath, "utf8"));
  return Array.isArray(parsed) ? parsed.map(normalizeMeeting) : [];
};

const writeMeetings = (meetings) => {
  ensureStore();
  const tempPath = `${meetingsPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(meetings, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, meetingsPath);
};

export const createMeeting = ({ hostUserId, hostName, title, scheduledAt }) => {
  const timestamp = new Date(scheduledAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error("Invalid meeting time.");
  if (timestamp.getTime() <= Date.now() + 30_000) throw new Error("Meeting must be scheduled at least 30 seconds in the future.");

  const meetings = readMeetings();
  const meeting = {
    roomId: crypto.randomUUID(),
    hostUserId,
    hostName: String(hostName || "Host"),
    title: String(title || "Rauma Meeting").trim().slice(0, 120) || "Rauma Meeting",
    scheduledAt: timestamp.toISOString(),
    startedAt: null,
    status: "scheduled",
    attendeeUserIds: [],
    createdAt: new Date().toISOString(),
  };
  meetings.push(meeting);
  writeMeetings(meetings);
  return meeting;
};

export const getMeeting = (roomId) => {
  const meeting = readMeetings().find((item) => item.roomId === roomId) || null;
  return meeting ? normalizeMeeting(meeting) : null;
};

export const listMeetingsForUser = (userId) =>
  readMeetings()
    .filter((meeting) => meeting.status !== "cancelled" && (meeting.hostUserId === userId || meeting.attendeeUserIds.includes(userId)))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

export const addMeetingToCalendar = (roomId, userId) => {
  const meetings = readMeetings();
  const index = meetings.findIndex((meeting) => meeting.roomId === roomId);
  if (index < 0) throw new Error("Meeting not found.");
  const meeting = meetings[index];
  if (meeting.status === "cancelled") throw new Error("Meeting is cancelled.");
  if (meeting.hostUserId !== userId && !meeting.attendeeUserIds.includes(userId)) meeting.attendeeUserIds.push(userId);
  meetings[index] = normalizeMeeting(meeting);
  writeMeetings(meetings);
  return meetings[index];
};

export const isMeetingOpen = (meeting) => {
  if (!meeting) return false;
  if (meeting.status === "live") return true;
  if (meeting.status !== "scheduled") return false;
  return Date.now() >= new Date(meeting.scheduledAt).getTime();
};

export const startMeeting = (roomId, userId) => {
  const meetings = readMeetings();
  const index = meetings.findIndex((meeting) => meeting.roomId === roomId);
  if (index < 0) throw new Error("Meeting not found.");
  const meeting = meetings[index];
  if (meeting.hostUserId !== userId) throw new Error("Only the host can start this meeting.");
  if (meeting.status === "cancelled") throw new Error("Meeting is cancelled.");
  meeting.status = "live";
  meeting.startedAt = meeting.startedAt || new Date().toISOString();
  writeMeetings(meetings);
  return meeting;
};

export const cancelMeeting = (roomId, userId) => {
  const meetings = readMeetings();
  const index = meetings.findIndex((meeting) => meeting.roomId === roomId);
  if (index < 0) throw new Error("Meeting not found.");
  const meeting = meetings[index];
  if (meeting.hostUserId !== userId) throw new Error("Only the host can cancel this meeting.");
  meeting.status = "cancelled";
  writeMeetings(meetings);
  return meeting;
};

export const closeAllMeetingStores = () => {};
