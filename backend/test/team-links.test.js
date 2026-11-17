import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { emptyConfiguration, publicConfiguration, teamForToken } from "../src/meetings/configuration.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rauma-teams-"));
process.env.RAUMA_MEETINGS_FILE = path.join(dir, "meetings.json");
const { createMeeting, createConfiguredMeeting, getMeeting, issueTeamLink } = await import("../src/meetings/meetingStore.js");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("host can issue team links for a normal scheduled meeting, without storing plaintext", () => {
  const meeting = createMeeting({ hostUserId: "host", hostName: "Host", title: "Normal meeting",
    scheduledAt: new Date(Date.now() + 120_000).toISOString() });
  const { teamId, token } = issueTeamLink(meeting.roomId, "host", { name: "Design" });
  const saved = getMeeting(meeting.roomId);
  assert.equal(teamForToken(saved.configuration, token).name, "Design");
  assert.equal(saved.configuration.teams[0].revision, 1);
  assert.ok(!fs.readFileSync(process.env.RAUMA_MEETINGS_FILE, "utf8").includes(token));
  assert.ok(!JSON.stringify(publicConfiguration(saved.configuration)).includes("hash"));
  assert.throws(() => issueTeamLink(meeting.roomId, "member", { teamId }), /Only the meeting host/);
});

test("reissuing a team link invalidates old URLs and updates the public revision", () => {
  const config = emptyConfiguration();
  config.teams.push({ id: crypto.randomUUID(), name: "Alpha", room: null, enabled: true });
  const { meeting, links } = createConfiguredMeeting({ hostUserId: "host", hostName: "Host",
    title: "Configured meeting", visibility: "private", config });
  assert.equal(links.length, 1);
  assert.ok(teamForToken(meeting.configuration, links[0].token));
  const replacement = issueTeamLink(meeting.roomId, "host", { teamId: links[0].id });
  assert.notEqual(replacement.token, links[0].token);
  assert.throws(() => teamForToken(getMeeting(meeting.roomId).configuration, links[0].token), /invalid or revoked/);
  assert.equal(teamForToken(getMeeting(meeting.roomId).configuration, replacement.token).name, "Alpha");
  assert.equal(publicConfiguration(getMeeting(meeting.roomId).configuration).teams[0].revision, 2);
});

test("a previously disabled team can be re-enabled with a new secret", async () => {
  const meeting = createMeeting({ hostUserId: "host", hostName: "Host",
    scheduledAt: new Date(Date.now() + 120_000).toISOString() });
  const first = issueTeamLink(meeting.roomId, "host", { name: "Alpha" });
  const config = getMeeting(meeting.roomId).configuration;
  config.teams[0].enabled = false;
  // Configuration is validated and persists a revoked link.
  const { updateMeetingConfiguration } = await import("../src/meetings/meetingStore.js");
  updateMeetingConfiguration(meeting.roomId, "host", config);
  assert.throws(() => teamForToken(getMeeting(meeting.roomId).configuration, first.token), /invalid or revoked/);
  const fresh = issueTeamLink(meeting.roomId, "host", { teamId: first.teamId });
  assert.ok(teamForToken(getMeeting(meeting.roomId).configuration, fresh.token));
});
