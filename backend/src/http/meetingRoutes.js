import express from "express";
import {
  addMeetingToCalendar,
  cancelMeeting,
  createMeeting,
  getMeeting,
  isMeetingOpen,
  listMeetingsForUser,
  startMeeting,
  canJoinMeeting,
  updateMeetingSettings,
  requestMeetingAccess,
  approveMeetingRequest,
  setMeetingModerator,
} from "../meetings/meetingStore.js";
import { requireAuth } from "./authMiddleware.js";
import { getRoom } from "../mediasoup/rooms/roomManager.js";
import { getPeer } from "../mediasoup/peers/peerManager.js";

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
  visibility: meeting.visibility || "public",
  isModerator: Boolean(userId && meeting.moderatorUserIds?.includes(userId)),
  canJoin: canJoinMeeting(meeting, userId),
  joinRequests: Boolean(userId && (userId === meeting.hostUserId || meeting.moderatorUserIds?.includes(userId))) ? meeting.joinRequests || [] : undefined,
});

router.post("/", requireAuth, (req, res) => {
  try {
    const meeting = createMeeting({
      hostUserId: req.user.id,
      hostName: req.user.name || req.user.username || "Host",
      title: req.body?.title,
      scheduledAt: req.body?.scheduledAt,
      visibility: req.body?.visibility,
    });
    res.status(201).json(publicMeeting(meeting, req.user.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/", requireAuth, (req, res) => {
  res.json(listMeetingsForUser(req.user.id).map((meeting) => publicMeeting(meeting, req.user.id)));
});

router.get("/:roomId", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.roomId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found." });
  res.json(publicMeeting(meeting, req.user.id));
});


router.get("/:roomId/access", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.roomId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found." });
  const request = meeting.joinRequests?.find((item) => item.userId === req.user.id);
  res.json({ canJoin: canJoinMeeting(meeting, req.user.id), requestStatus: request?.status || null, visibility: meeting.visibility || "public" });
});

router.post("/:roomId/request-access", requireAuth, (req, res) => {
  try {
    const meeting = requestMeetingAccess(req.params.roomId, req.user.id, req.user.name || req.user.username);
    const request = meeting.joinRequests.find((item) => item.userId === req.user.id);
    res.json({ canJoin: canJoinMeeting(meeting, req.user.id), requestStatus: request?.status || null });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.patch("/:roomId/settings", requireAuth, (req, res) => {
  try {
    const meeting = updateMeetingSettings(req.params.roomId, req.user.id, { visibility: req.body?.visibility });
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) { res.status(403).json({ error: error.message }); }
});

router.post("/:roomId/requests/:targetUserId", requireAuth, (req, res) => {
  try {
    const approved = req.body?.approved === true;
    const meeting = approveMeetingRequest(req.params.roomId, req.user.id, req.params.targetUserId, approved);
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) { res.status(403).json({ error: error.message }); }
});

router.post("/:roomId/moderators/:targetUserId", requireAuth, (req, res) => {
  try {
    const enabled = req.body?.enabled === true;
    const room = getRoom(req.params.roomId);
    const targetIsPresent = (room?.peers || []).some((peerId) => getPeer(peerId)?.userId === req.params.targetUserId);
    if (enabled && !targetIsPresent) return res.status(400).json({ error: "The participant must be in the meeting before becoming a moderator." });
    const meeting = setMeetingModerator(req.params.roomId, req.user.id, req.params.targetUserId, enabled);
    for (const peerId of room?.peers || []) {
      const peer = getPeer(peerId);
      if (!peer || peer.userId !== req.params.targetUserId) continue;
      peer.isModerator = enabled;
      const payload = { peerId, userId: peer.userId, username: peer.username, name: peer.displayName, audioEnabled: peer.audioEnabled, videoEnabled: peer.videoEnabled, connected: true, isAdmin: peer.isAdmin, isModerator: peer.isModerator, adminMuted: peer.forcedAudioMuted };
      peer.socket.emit("participant-state", payload);
      peer.socket.to(req.params.roomId).emit("participant-state", payload);
    }
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) { res.status(403).json({ error: error.message }); }
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
