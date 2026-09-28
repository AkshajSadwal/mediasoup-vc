import express from "express";
import {
  addMeetingToCalendar,
  cancelMeeting,
  createMeeting,
  getMeeting,
  isMeetingOpen,
  listMeetingsForUser,
  startMeeting,
} from "../meetings/meetingStore.js";
import { requireAuth, readBearerToken } from "./authMiddleware.js";
import { verifyAuthToken } from "../auth/authStore.js";

const router = express.Router();

const publicMeeting = (meeting, userId = null) => ({
  roomId: meeting.roomId,
  title: meeting.title,
  hostName: meeting.hostName,
  scheduledAt: meeting.scheduledAt,
  startedAt: meeting.startedAt,
  status: meeting.status,
  open: isMeetingOpen(meeting),
  isHost: Boolean(userId && userId === meeting.hostUserId),
  inCalendar: Boolean(userId && (userId === meeting.hostUserId || meeting.attendeeUserIds?.includes(userId))),
});

router.post("/", requireAuth, (req, res) => {
  try {
    const meeting = createMeeting({
      hostUserId: req.user.id,
      hostName: req.user.name || req.user.username || "Host",
      title: req.body?.title,
      scheduledAt: req.body?.scheduledAt,
    });
    res.status(201).json(publicMeeting(meeting, req.user.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/", requireAuth, (req, res) => {
  res.json(listMeetingsForUser(req.user.id).map((meeting) => publicMeeting(meeting, req.user.id)));
});

router.get("/:roomId", (req, res) => {
  const meeting = getMeeting(req.params.roomId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found." });
  const user = verifyAuthToken(readBearerToken(req));
  res.json(publicMeeting(meeting, user?.id || null));
});

router.post("/:roomId/calendar", requireAuth, (req, res) => {
  try {
    const meeting = addMeetingToCalendar(req.params.roomId, req.user.id);
    res.json({ meeting: publicMeeting(meeting, req.user.id), open: isMeetingOpen(meeting) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:roomId/start", requireAuth, (req, res) => {
  try {
    const meeting = startMeeting(req.params.roomId, req.user.id);
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:roomId/cancel", requireAuth, (req, res) => {
  try {
    const meeting = cancelMeeting(req.params.roomId, req.user.id);
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
