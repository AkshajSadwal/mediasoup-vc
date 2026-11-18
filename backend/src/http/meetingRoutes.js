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
  createConfiguredMeeting,
  issueTeamLink,
  updateMeetingConfiguration,
  saveBreakoutSession,
} from "../meetings/meetingStore.js";
import { emptyConfiguration, publicConfiguration, validateConfiguration } from "../meetings/configuration.js";
import { requireAuth } from "./authMiddleware.js";
import { accountRateLimit } from "./rateLimit.js";
import { restrictedPrivateMeetingPreview } from "./meetingVisibility.js";
import { applyConfiguration, findLiveMeeting, role } from "../live/state.js";
import { publish, reevaluate } from "../live/controller.js";
import { participantState } from "../socket/events/room.events.js";

const router = express.Router();
const limitCreation = accountRateLimit({ max: 20 });
const limitCalendar = accountRateLimit({ max: 40 });
const limitJoinRequests = accountRateLimit({ max: 30 });
const limitTeamLinks = accountRateLimit({ max: 30 });

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
  configuration: userId === meeting.hostUserId ? publicConfiguration(meeting.configuration) : undefined,
  joinRequests: Boolean(userId && (userId === meeting.hostUserId || meeting.moderatorUserIds?.includes(userId))) ? meeting.joinRequests || [] : undefined,
});

router.post("/config", requireAuth, limitCreation, (req, res) => {
  try {
    const { meeting, links } = createConfiguredMeeting({
      hostUserId: req.user.id, hostName: req.user.displayName || req.user.username,
      title: req.body?.title, visibility: req.body?.visibility, config: req.body?.configuration,
    });
    res.set("Cache-Control", "no-store").status(201).json({ ...publicMeeting(meeting, req.user.id), links });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post("/", requireAuth, limitCreation, (req, res) => {
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
  if (meeting) {
    const restricted = restrictedPrivateMeetingPreview(meeting, req.user.id);
    if (restricted) return res.set("Cache-Control", "no-store").json(restricted);
    return res.set("Cache-Control", "no-store").json(publicMeeting(meeting, req.user.id));
  }
  // Unscheduled rooms can exist in memory before the host saves any settings.
  // Only current members may read this temporary room's settings.
  const live = findLiveMeeting(req.params.roomId);
  if (!live?.members.get(req.user.id)?.peer?.ready) return res.status(404).json({ error: "Meeting not found." });
  const isHost = req.user.id === live.hostId;
  res.set("Cache-Control", "no-store").json({ roomId: live.id, title: "Rauma Meeting", status: "live",
    open: true, isHost, visibility: "public", canJoin: true, joinRequests: isHost ? [] : undefined,
    configuration: isHost ? publicConfiguration({ ...emptyConfiguration(), defaults: live.defaults,
      initial: live.initial, overrides: Object.fromEntries(live.overrides),
      rooms: [...live.rooms.values()].filter((room) => room.id !== "main" && !room.expired)
        .slice(0, 5).map(({ id, title }) => ({ id, title })),
      assignments: Object.fromEntries(live.assignments), duration: live.duration,
      teams: live.teams || [] }) : undefined });
});


router.get("/:roomId/access", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.roomId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found." });
  const request = meeting.joinRequests?.find((item) => item.userId === req.user.id);
  res.json({ canJoin: canJoinMeeting(meeting, req.user.id), requestStatus: request?.status || null, visibility: meeting.visibility || "public" });
});

router.post("/:roomId/request-access", requireAuth, limitJoinRequests, (req, res) => {
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

router.patch("/:roomId/config", requireAuth, (req, res) => {
  try {
    const live = findLiveMeeting(req.params.roomId);
    if (!getMeeting(req.params.roomId) && live?.hostId === req.user.id) {
      validateConfiguration(req.body?.configuration);
      saveBreakoutSession(live.id, live.hostId, null);
    }
    const meeting = updateMeetingConfiguration(req.params.roomId, req.user.id, req.body?.configuration);
    if (live) {
      live.saved = true;
      applyConfiguration(live, meeting.configuration);
      for (const member of live.members.values()) {
        const peer = member.peer;
        const team = live.teams.find(({ id }) => id === member.teamId);
        if (!team) continue;
        member.name = team.name;
        if (peer?.ready) {
          peer.displayName = team.name;
          const state = participantState(peer.socket.id);
          peer.socket.emit("participant-state", state);
          peer.socket.to(peer.roomName).emit("participant-state", state);
        }
      }
      reevaluate(live);
      publish(live);
    }
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post("/:roomId/teams", requireAuth, limitTeamLinks, (req, res) => {
  try {
    // The first participant is the host for an unscheduled/unsaved meeting.
    // Persist it only after verifying the authenticated host identity.
    const live = findLiveMeeting(req.params.roomId);
    if (!getMeeting(req.params.roomId) && live?.hostId === req.user.id &&
        live.members.get(req.user.id)?.peer?.ready) {
      saveBreakoutSession(live.id, live.hostId, null);
      const rooms = [...live.rooms.values()].filter((room) => room.id !== "main" && !room.expired)
        .slice(0, 5).map(({ id, title }) => ({ id, title }));
      const knownRooms = new Set(rooms.map(({ id }) => id));
      updateMeetingConfiguration(live.id, live.hostId, { ...emptyConfiguration(),
        defaults: live.defaults, initial: live.initial, overrides: Object.fromEntries(live.overrides),
        rooms, assignments: Object.fromEntries([...live.assignments].filter(([, room]) => room === "main" || knownRooms.has(room))),
        duration: live.duration });
    }
    const { meeting, teamId, token } = issueTeamLink(req.params.roomId, req.user.id, req.body || {});
    if (live) {
      live.saved = true;
      applyConfiguration(live, meeting.configuration);
      reevaluate(live);
      publish(live);
    }
    res.set("Cache-Control", "no-store").json({ ...publicMeeting(meeting, req.user.id), link: { id: teamId, token } });
  } catch (error) { res.status(400).json({ error: error.message }); }
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
    const live = findLiveMeeting(req.params.roomId);
    const member = live?.members.get(req.params.targetUserId);
    const peer = member?.peer;
    if (enabled && !peer?.ready) return res.status(400).json({ error: "The participant must be in the meeting before becoming a moderator." });
    const meeting = setMeetingModerator(req.params.roomId, req.user.id, req.params.targetUserId, enabled);
    if (member) member.lastRole = enabled ? "moderator" : "participant";
    if (peer) {
      peer.isModerator = enabled;
      member.lastRole = role(peer);
      if (peer.ready) {
        peer.socket.to(peer.roomName).emit("participant-state", participantState(peer.socket.id));
        reevaluate(live);
        publish(live);
      }
    }
    res.json(publicMeeting(meeting, req.user.id));
  } catch (error) { res.status(403).json({ error: error.message }); }
});

router.post("/:roomId/calendar", requireAuth, limitCalendar, (req, res) => {
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
