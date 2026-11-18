import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "rauma-access-"));
process.env.RAUMA_MEETINGS_FILE = path.join(root, "meetings.json");
const {
  addMeetingToCalendar, approveMeetingRequest, canJoinMeeting, createMeeting,
  getMeeting, listMeetingsForUser, requestMeetingAccess, updateMeetingSettings,
} = await import("../src/meetings/meetingStore.js");
const { restrictedPrivateMeetingPreview } = await import("../src/http/meetingVisibility.js");
after(() => fs.rmSync(root, { recursive: true, force: true }));

const scheduledAt = () => new Date(Date.now() + 600_000).toISOString();

test("private meeting details cannot be enrolled or listed by an unapproved account", () => {
  const meeting = createMeeting({ hostUserId: "host", hostName: "Host",
    scheduledAt: scheduledAt(), visibility: "private", title: "Sensitive review" });
  assert.equal(canJoinMeeting(getMeeting(meeting.roomId), "stranger"), false);
  assert.throws(() => addMeetingToCalendar(meeting.roomId, "stranger"), /approval is required/);
  assert.equal(listMeetingsForUser("stranger").length, 0);
  requestMeetingAccess(meeting.roomId, "stranger", "Stranger");
  assert.throws(() => addMeetingToCalendar(meeting.roomId, "stranger"), /approval is required/);
  approveMeetingRequest(meeting.roomId, "host", "stranger", true);
  addMeetingToCalendar(meeting.roomId, "stranger");
  assert.equal(listMeetingsForUser("stranger").length, 1);
});

test("a public calendar subscription does not retain access after a meeting becomes private", () => {
  const meeting = createMeeting({ hostUserId: "host2", hostName: "Host",
    scheduledAt: scheduledAt(), visibility: "public" });
  addMeetingToCalendar(meeting.roomId, "member");
  assert.equal(listMeetingsForUser("member").length, 1);
  updateMeetingSettings(meeting.roomId, "host2", { visibility: "private" });
  assert.equal(listMeetingsForUser("member").length, 0);
  assert.throws(() => addMeetingToCalendar(meeting.roomId, "member"), /approval is required/);
});

test("a malformed requested visibility is rejected rather than silently making a meeting public", () => {
  assert.throws(() => createMeeting({ hostUserId: "host", scheduledAt: scheduledAt(),
    visibility: "PRIVATE" }), /Invalid meeting visibility/);
});

test("meeting data files are only owner-readable on POSIX", () => {
  createMeeting({ hostUserId: "host", scheduledAt: scheduledAt() });
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(process.env.RAUMA_MEETINGS_FILE).mode & 0o777, 0o600);
  }
});

test("an unapproved private meeting preview excludes host and calendar metadata", () => {
  const meeting = createMeeting({ hostUserId: "h-private", hostName: "Confidential Host",
    title: "Confidential title", scheduledAt: scheduledAt(), visibility: "private" });
  const preview = restrictedPrivateMeetingPreview(getMeeting(meeting.roomId), "unknown");
  assert.equal(preview.roomId, meeting.roomId);
  assert.equal(preview.canJoin, false);
  assert.equal(preview.title, undefined);
  assert.equal(preview.hostName, undefined);
  assert.equal(preview.scheduledAt, undefined);
  assert.equal(preview.configuration, undefined);
  assert.equal(restrictedPrivateMeetingPreview(getMeeting(meeting.roomId), "h-private"), null);
});
