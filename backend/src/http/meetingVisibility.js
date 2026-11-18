import { canJoinMeeting, isMeetingOpen } from "../meetings/meetingStore.js";

// Allows access requests from the waiting room without disclosing the meeting's
// title, host identity, schedule or configuration to unapproved accounts.
export function restrictedPrivateMeetingPreview(meeting, accountId) {
  if (!meeting || meeting.visibility !== "private" || canJoinMeeting(meeting, accountId)) return null;
  return {
    roomId: meeting.roomId, visibility: "private", status: meeting.status,
    open: isMeetingOpen(meeting), isHost: false, isModerator: false,
    inCalendar: false, canJoin: false,
  };
}
