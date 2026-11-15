import { useCallback, useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export function useMeetingAdmission(roomName, token, localIsHost, showMessage) {
  const [meetingVisibility, setMeetingVisibility] = useState("public");
  const [configuration, setConfiguration] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const meetingApi = useCallback(async (path, options = {}) => {
    const response = await fetch(`${BACKEND_URL}/api/meetings/${roomName}${path}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Meeting request failed.");
    return data;
  }, [roomName, token]);

  const saveConfiguration = async (configuration) => {
    const data = await meetingApi("/config", { method: "PATCH", body: JSON.stringify({ configuration }) });
    setConfiguration(data.configuration);
  };

  const changeVisibility = async (visibility) => {
    try {
      const data = await meetingApi("/settings", { method: "PATCH", body: JSON.stringify({ visibility }) });
      setMeetingVisibility(data.visibility);
      showMessage(`Meeting is now ${visibility}.`);
    } catch (error) { showMessage(error.message); }
  };

  const resolveJoinRequest = async (userId, approved) => {
    try {
      const data = await meetingApi(`/requests/${encodeURIComponent(userId)}`, { method: "POST", body: JSON.stringify({ approved }) });
      setJoinRequests(data.joinRequests || []);
      showMessage(approved ? "Join request approved." : "Join request denied.");
    } catch (error) { showMessage(error.message); }
  };

  const toggleModerator = async (userId, enabled) => {
    if (!userId || !localIsHost) return;
    try {
      const data = await meetingApi(`/moderators/${encodeURIComponent(userId)}`, { method: "POST", body: JSON.stringify({ enabled }) });
      setJoinRequests(data.joinRequests || []);
      showMessage(enabled ? "Moderator role granted." : "Moderator role removed.");

    } catch (error) { showMessage(error.message); }
  };

  useEffect(() => {
    if (!token || !roomName) return;
    let active = true;
    const refreshMeeting = async () => {
      try {
        const data = await meetingApi("");
        if (!active) return;
        setMeetingVisibility(data.visibility || "public");
        setConfiguration(data.configuration || null);
        setJoinRequests(data.joinRequests || []);
      } catch (error) { console.warn("MEETING SETTINGS LOAD FAILED", error); }
    };
    refreshMeeting();
    const timer = window.setInterval(refreshMeeting, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomName, token, meetingApi]);

  return { meetingVisibility, configuration, saveConfiguration, joinRequests, changeVisibility, resolveJoinRequest, toggleModerator };
}
