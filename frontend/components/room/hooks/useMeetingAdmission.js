import { useCallback, useEffect, useState } from "react";

// HTTP requests go through the Next/Nginx same-origin API proxy, never an
// absolute browser URL that may be mixed-content blocked or fail CORS.
export function useMeetingAdmission(roomName, token, localIsHost, showMessage) {
  const [meetingVisibility, setMeetingVisibility] = useState("public");
  const [configuration, setConfiguration] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadError, setLoadError] = useState("");
  const meetingApi = useCallback(async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`/api/meetings/${encodeURIComponent(roomName)}${path}`, {
        ...options, cache: "no-store",
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
    } catch {
      throw new Error("Cannot reach the meeting server. Check that the backend and API proxy are running.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Meeting request failed (${response.status}).`);
    return data;
  }, [roomName, token]);

  const refreshMeeting = useCallback(async () => {
    const data = await meetingApi("");
    setMeetingVisibility(data.visibility || "public");
    setConfiguration(data.configuration || null);
    setJoinRequests(data.joinRequests || []);
    setLoadError("");
    return data;
  }, [meetingApi]);

  const saveConfiguration = async (next) => {
    const data = await meetingApi("/config", { method: "PATCH", body: JSON.stringify({ configuration: next }) });
    setConfiguration(data.configuration);
    return data;
  };

  const issueTeam = async (options) => {
    const data = await meetingApi("/teams", { method: "POST", body: JSON.stringify(options) });
    setConfiguration(data.configuration);
    return data;
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
    let timer;
    let lastError = "";
    const poll = async () => {
      let nextDelay = 5000;
      try {
        if (document.visibilityState !== "hidden") {
          await refreshMeeting();
          lastError = "";
        }
      } catch (error) {
        nextDelay = 15000; // avoid flooding the console/API while offline
        if (active) setLoadError(error.message);
        if (lastError !== error.message) console.warn("MEETING SETTINGS LOAD FAILED:", error.message);
        lastError = error.message;
      } finally {
        if (active) timer = window.setTimeout(poll, nextDelay);
      }
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [roomName, token, refreshMeeting]);

  return { meetingVisibility, configuration, saveConfiguration, issueTeam, refreshMeeting,
    loadError, joinRequests, changeVisibility, resolveJoinRequest, toggleModerator };
}
