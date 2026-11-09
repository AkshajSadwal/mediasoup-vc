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
  visibility: meeting.visibility === "private" ? "private" : "public",
  approvedUserIds: Array.isArray(meeting.approvedUserIds) ? meeting.approvedUserIds : [],
  joinRequests: Array.isArray(meeting.joinRequests) ? meeting.joinRequests : [],
  moderatorUserIds: Array.isArray(meeting.moderatorUserIds) ? meeting.moderatorUserIds : [],
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

export const createMeeting = ({ hostUserId, hostName, title, scheduledAt, visibility = "public" }) => {
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
    visibility: visibility === "private" ? "private" : "public",
    approvedUserIds: [],
    joinRequests: [],
    moderatorUserIds: [],
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


export const canJoinMeeting = (meeting, userId) => {
  if (!meeting || !userId) return false;
  if (meeting.hostUserId === userId) return true;
  if (meeting.visibility !== "private") return true;
  return meeting.approvedUserIds.includes(userId) || meeting.moderatorUserIds.includes(userId);
};

const updateMeeting = (roomId, updater) => {
  const meetings = readMeetings();
  const index = meetings.findIndex((item) => item.roomId === roomId);
  if (index < 0) throw new Error("Meeting not found.");
  const meeting = normalizeMeeting(meetings[index]);
  updater(meeting);
  meetings[index] = meeting;
  writeMeetings(meetings);
  return meeting;
};

export const updateMeetingSettings = (roomId, userId, { visibility }) => updateMeeting(roomId, (meeting) => {
  if (meeting.hostUserId !== userId) throw new Error("Only the meeting host can change meeting settings.");
  if (!["public", "private"].includes(visibility)) throw new Error("Invalid meeting visibility.");
  meeting.visibility = visibility;
});

export const requestMeetingAccess = (roomId, userId, userName) => updateMeeting(roomId, (meeting) => {
  if (meeting.status === "cancelled") throw new Error("This meeting has been cancelled.");
  if (canJoinMeeting(meeting, userId)) return;
  const existing = meeting.joinRequests.find((request) => request.userId === userId);
  if (existing && existing.status === "denied") { existing.status = "pending"; existing.requestedAt = new Date().toISOString(); existing.resolvedAt = null; }
  else if (!existing) meeting.joinRequests.push({ userId, userName: String(userName || "Guest").slice(0, 80), status: "pending", requestedAt: new Date().toISOString() });
});

export const approveMeetingRequest = (roomId, actorUserId, targetUserId, approved) => updateMeeting(roomId, (meeting) => {
  if (meeting.hostUserId !== actorUserId && !meeting.moderatorUserIds.includes(actorUserId)) throw new Error("Only the host or a moderator can approve requests.");
  if (meeting.hostUserId === targetUserId || meeting.moderatorUserIds.includes(targetUserId)) throw new Error("The host and moderators already have access.");
  const request = meeting.joinRequests.find((item) => item.userId === targetUserId);
  if (!request || request.status !== "pending") throw new Error("Pending join request not found.");
  request.status = approved ? "approved" : "denied";
  request.resolvedAt = new Date().toISOString();
  if (approved && !meeting.approvedUserIds.includes(targetUserId)) meeting.approvedUserIds.push(targetUserId);
  if (!approved) meeting.approvedUserIds = meeting.approvedUserIds.filter((id) => id !== targetUserId);
});

export const setMeetingModerator = (roomId, hostUserId, targetUserId, enabled) => updateMeeting(roomId, (meeting) => {
  if (meeting.hostUserId !== hostUserId) throw new Error("Only the meeting host can manage moderators.");
  if (!targetUserId || targetUserId === hostUserId) throw new Error("Invalid moderator.");
  if (enabled && !meeting.moderatorUserIds.includes(targetUserId)) meeting.moderatorUserIds.push(targetUserId);
  if (!enabled) meeting.moderatorUserIds = meeting.moderatorUserIds.filter((id) => id !== targetUserId);
});
