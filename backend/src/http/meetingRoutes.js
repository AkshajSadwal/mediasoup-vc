import express from "express";
import {
  createMeeting,
  getMeeting,
  listMeetingsForHost,
  startMeeting,
  cancelMeeting,
  isMeetingOpen,
} from "../meetings/meetingStore.js";
import { requireAuth, readBearerToken } from "./authMiddleware.js";
import { verifyAuthToken } from "../auth/authStore.js";

const router = express.Router();

const publicMeeting = (meeting) => ({
  roomId: meeting.roomId,
  title: meeting.title,
  hostName: meeting.hostName,
  scheduledAt: meeting.scheduledAt,
  startedAt: meeting.startedAt,
  status: meeting.status,
  open: isMeetingOpen(meeting),
});

router.post("/", requireAuth, (req, res) => {
  try {
    const meeting = createMeeting({
      hostUserId: req.user.id,
      hostName: req.user.name || req.user.username || "Host",
      title: req.body?.title,
      scheduledAt: req.body?.scheduledAt,
    });
    res.status(201).json(publicMeeting(meeting));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/", requireAuth, (req, res) => {
  res.json(listMeetingsForHost(req.user.id).map(publicMeeting));
});

router.get("/:roomId", (req, res) => {
  const meeting = getMeeting(req.params.roomId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found." });
  const user = verifyAuthToken(readBearerToken(req));

  res.json({
    ...publicMeeting(meeting),
    isHost: Boolean(user?.id && user.id === meeting.hostUserId),
  });
});

router.post("/:roomId/start", requireAuth, (req, res) => {
  try {
    const meeting = startMeeting(req.params.roomId, req.user.id);
    res.json(publicMeeting(meeting));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:roomId/cancel", requireAuth, (req, res) => {
  try {
    const meeting = cancelMeeting(req.params.roomId, req.user.id);
    res.json(publicMeeting(meeting));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
