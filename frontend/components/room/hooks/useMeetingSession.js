import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { captureInput, inputConstraints, mediaPreferences, saveMediaPreferences } from "./mediaDevices";
import { request, RoomMedia } from "./roomMedia";

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";

async function captureDevices(audio, video, userId) {
  const prefs = mediaPreferences(userId);
  const mic = inputConstraints("audio", prefs.audio);
  const camera = inputConstraints("video", prefs.video, prefs.quality);
  const devices = navigator.mediaDevices;
  try { return await devices.getUserMedia({ audio: audio && mic.audio, video: video && camera.video }); }
  catch (error) {
    if (!["NotFoundError", "NotReadableError", "OverconstrainedError"].includes(error.name)) throw error;
    const sources = await Promise.allSettled([
      ...(video ? [captureInput("video", prefs.video, prefs.quality, true)] : []),
      ...(audio ? [captureInput("audio", prefs.audio, null, true)] : []),
    ]);
    const tracks = sources.flatMap((source) => source.status === "fulfilled" ? source.value.getTracks() : []);
    if (!tracks.length) throw error;
    return new MediaStream(tracks);
  }
}

function readTeamToken(meetingId) {
  const key = "rauma-team:" + meetingId;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get("team");
  if (token !== null) {
    try { sessionStorage.setItem(key, token); } catch { return token; }
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }
  try { return sessionStorage.getItem(key) ?? undefined; } catch { return undefined; }
}

export function useMeetingSession({ meetingId, userId, token, authReady, router, notify }) {
  const connection = useRef(null);
  const capture = useRef(null);
  const screen = useRef(null);
  const cameraTrack = useRef(null);
  const mediaIntent = useRef({ audio: null, video: null });
  const switches = useRef({});
  const [rawVideoTrack, setRawVideoTrack] = useState(null);
  const screenAttempt = useRef(null);
  const current = useRef(null);
  const [media, setMedia] = useState(null);
  const [camera, setCamera] = useState(null);
  const [mic, setMic] = useState(null);
  const [display, setDisplay] = useState(null);
  const [audioEnabled, setAudio] = useState(true);
  const [videoEnabled, setVideo] = useState(true);
  const [remote, setRemote] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [self, setSelf] = useState(null);
  const [live, setLive] = useState(null);
  const [chat, setChat] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [reaction, setReaction] = useState(null);

  const ask = useCallback((event, data) => {
    if (!current.current) return Promise.reject(new Error("Waiting for the meeting connection."));
    return current.current.ask(event, data);
  }, []);

  const stopScreen = useCallback(async (signal = true, expected = screen.current) => {
    if (!expected || screen.current !== expected) return;
    screen.current = null;
    expected.getTracks().forEach((track) => track.stop());
    setDisplay(null);
    const room = current.current;
    if (signal && room && !room.closed) {
      await Promise.allSettled([room.stopSource("screen-audio"), room.stopSource("screen-video")]);
    } else if (room) {
      for (const source of ["screen-audio", "screen-video"]) {
        room.producers.get(source)?.close();
        room.producers.delete(source);
      }
    }
  }, []);

  const startScreen = async () => {
    if (screenAttempt.current) return;
    const room = current.current;
    if (!room?.send) return notify("Wait for the meeting to connect.");
    if (room.live?.features.screen === false) return notify("The host has restricted screen sharing.");
    if (room.live?.presenter && !screen.current) return notify("Someone is already presenting in this room.");
    if (!navigator.mediaDevices?.getDisplayMedia) return notify("Screen sharing is unavailable in this browser or context.");
    const attempt = {};
    screenAttempt.current = attempt;
    let next;
    try {
      next = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (room !== current.current || room.closed) return next.getTracks().forEach((track) => track.stop());
      await stopScreen();
      if (room.closed) return next.getTracks().forEach((track) => track.stop());
      const track = next.getVideoTracks()[0];
      if (!track || track.readyState === "ended") return next.getTracks().forEach((item) => item.stop());
      screen.current = next;
      track.addEventListener("ended", () => { void stopScreen(true, next); }, { once: true });
      await room.produce("screen-video", track);
      if (screen.current !== next || room.closed) {
        if (!room.closed) await room.stopSource("screen-video");
        return;
      }
      setDisplay(next);
      try {
        await room.produce("screen-audio", next.getAudioTracks()[0]);
        if (screen.current !== next && !room.closed) await room.stopSource("screen-audio");
      } catch (error) {
        next.getAudioTracks().forEach((item) => item.stop());
        if (!room.closed) notify(error.message);
      }
    } catch (error) {
      await stopScreen(true, next);
      if (error.name !== "NotAllowedError" && !room.closed) notify(error.message);
    } finally {
      if (screenAttempt.current === attempt) screenAttempt.current = null;
    }
  };

  const replaceCamera = useCallback(async (track, expectedRaw) => {
    const room = current.current;
    if (!room || room.closed) throw new Error("The camera is disconnected.");
    if (expectedRaw && capture.current?.getVideoTracks()[0] !== expectedRaw) throw new Error("The camera source changed.");
    track.enabled = room.videoEnabled;
    const producer = room.producers.get("camera");
    if (producer) await producer.replaceTrack({ track });
    else if (room.videoEnabled) await room.produce("camera", track);
    if (room !== current.current || (expectedRaw && capture.current?.getVideoTracks()[0] !== expectedRaw)) throw new Error("The camera connection changed.");
    cameraTrack.current = track;
    setCamera(new MediaStream([track]));
  }, []);

  const watchDevice = useCallback((kind, track) => {
    track.addEventListener("ended", () => {
      const stream = capture.current;
      if (!stream?.getTracks().includes(track)) return;
      stream.removeTrack(track);
      const room = current.current;
      if (kind === "video") { setRawVideoTrack(null); setCamera(null); cameraTrack.current = null; }
      else setMic(null);
      if (!room || room.closed) return;
      void room.ask(kind === "audio" ? "audio-state" : "video-state", { enabled: false }).catch(() => undefined);
      void room.stopSource(kind === "audio" ? "microphone" : "camera").catch(() => undefined);
      notify(kind === "audio" ? "Microphone disconnected. Choose an input in microphone settings." : "Camera disconnected. Choose a camera in camera settings.");
    }, { once: true });
  }, [notify]);

  const changeInput = async (kind, id, quality, restore = false) => {
    const room = current.current;
    if (!room?.send) throw new Error("Wait for the meeting media to connect.");
    const key = kind === "audio" ? "microphone" : "camera";
    if (room.live?.features[key] === false) throw new Error("The host has restricted this input.");
    const revision = {};
    switches.current[kind] = revision;
    const stream = await captureInput(kind, id, quality, restore);
    const track = stream.getTracks()[0];
    const valid = () => current.current === room && !room.closed && switches.current[kind] === revision;
    if (!track) throw new Error("The browser did not provide an input track.");
    try {
      if (!valid()) return track.stop();
      track.enabled = kind === "audio" ? room.audioEnabled : room.videoEnabled;
      const existing = room.producers.get(key);
      if (existing) await existing.replaceTrack({ track });
      else if (track.enabled) await room.produce(key, track);
      if (current.current !== room || room.closed) return track.stop();
      track.enabled = kind === "audio" ? room.audioEnabled : room.videoEnabled;
      capture.current ??= new MediaStream();
      for (const previous of capture.current.getTracks()) if (previous.kind === kind) {
        capture.current.removeTrack(previous);
        previous.stop();
      }
      capture.current.addTrack(track);
      watchDevice(kind, track);
      if (kind === "audio") setMic(new MediaStream([track]));
      else {
        cameraTrack.current = track;
        setCamera(new MediaStream([track]));
        setRawVideoTrack(track);
      }
      saveMediaPreferences(userId, { [kind]: track.getSettings().deviceId ?? id, ...(kind === "video" && quality ? { quality } : {}) });
    } catch (error) { track.stop(); throw error; }
  };

  useEffect(() => {
    if (!authReady) return;
    let disposed = false;
    let gen = 0;
    let socket;
    let reactionTimer;
    let permissionPrompt;
    const route = `/room/${meetingId}`;
    let teamToken = readTeamToken(meetingId);
    const clearRoom = (reason) => {
      const room = current.current;
      let finalized;
      if (room) {
        finalized = room.recording?.onLeaving(reason);
        room.close();
      }
      current.current = null;
      setMedia(null); setRemote([]); setParticipants([]); setSelf(null); setLive(null); setChat([]); setReaction(null); setActiveSpeaker(null);
      clearTimeout(reactionTimer);
      screenAttempt.current = null;
      void stopScreen(false);
      return finalized;
    };
    const begin = async () => {
      if (!token) return router.replace(`/login?callbackUrl=${encodeURIComponent(route)}`);
      const check = await fetch(`${backend}/api/meetings/${encodeURIComponent(meetingId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (disposed) return;
      if (check.ok && !(await check.json()).open) return router.replace(`/waiting/${meetingId}`);
      if (!check.ok && check.status !== 404) throw new Error(`Meeting check failed (${check.status}).`);
      if (disposed) return;
      socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL || ""}/mediasoup`, { path: "/socket.io", auth: { token } });
      connection.current = socket;
      let pending = new Map();
      let closed = new Set();
      let replaced = false;

      const join = async () => {
        const generation = ++gen;
        const valid = () => !disposed && generation === gen && socket.connected;
        try {
          const response = await request(socket, "joinRoom", { roomName: meetingId, teamToken });
          if (!valid()) return;
          teamToken = undefined;
          try { sessionStorage.removeItem("rauma-team:" + meetingId); } catch { /* storage is optional */ }
          const room = new RoomMedia(socket, response.live.roomToken, setRemote);
          current.current = room;
          room.audioEnabled = response.self.audioEnabled;
          room.videoEnabled = response.self.videoEnabled;
          setLive(room.mergeSnapshot(response.live)); setSelf(response.self); setParticipants(response.participants); setChat(response.chat);
          setActiveSpeaker(response.activeSpeaker);
          setAudio(response.self.audioEnabled);
          setVideo(response.self.videoEnabled);
          const existing = await room.load(response.rtpCapabilities);
          if (!valid()) return;
          if (mediaIntent.current.audio === false && room.audioEnabled) await room.ask("audio-state", { enabled: false });
          if (mediaIntent.current.video === false && room.videoEnabled) await room.ask("video-state", { enabled: false });
          if (!valid()) return;
          mediaIntent.current = { audio: room.audioEnabled, video: room.videoEnabled };
          for (const signal of [...existing, ...pending.values()]) if (!closed.has(signal.producerId)) void room.subscribe(signal);
          pending.clear();
          setMedia(room);

          if ((!capture.current || !capture.current.getTracks().length) && (room.audioEnabled || room.videoEnabled) && navigator.mediaDevices?.getUserMedia) {
            permissionPrompt ??= captureDevices(room.audioEnabled, room.videoEnabled, userId).then((stream) => {
              if (disposed) { stream.getTracks().forEach((track) => track.stop()); return null; }
              capture.current = stream;
              for (const track of stream.getTracks()) watchDevice(track.kind, track);
              return stream;
            }).finally(() => { permissionPrompt = null; });
            await permissionPrompt;
          }
          if (!valid() || !capture.current) return;
          const audio = capture.current.getAudioTracks()[0];
          const video = capture.current.getVideoTracks()[0];
          if (audio) {
            audio.enabled = room.audioEnabled;
            setMic(new MediaStream([audio]));
          }
          if (video) {
            video.enabled = room.videoEnabled;
            cameraTrack.current = video;
            setRawVideoTrack(video);
            setCamera(new MediaStream([video]));
            setVideo(video.enabled);
          }
          const result = await Promise.allSettled([room.videoEnabled && room.produce("camera", video), room.audioEnabled && room.produce("microphone", audio)]);
          if (valid()) {
            for (const [index, entry] of result.entries()) {
              if (entry.status === "rejected") {
                const source = index === 0 ? "Camera" : "Microphone";
                console.warn(source + " publication failed", entry.reason?.message);
                notify(source + " could not be published.");
              }
            }
          }

        } catch (error) {
          if (!valid()) return;
          if (error.message === "WAITING_ROOM" || error.message === "JOIN_APPROVAL_REQUIRED") return router.replace(`/waiting/${meetingId}`);
          if (error.message === "AUTH_REQUIRED") return router.replace(`/login?callbackUrl=${encodeURIComponent(route)}`);
          if (error.message === "ROOM_CHANGED") return void join();
          notify(error.name === "NotAllowedError" ? "Camera or microphone access was denied. You can still receive meeting media." : error.message);
        }
      };
      const reset = (reason) => {
        ++gen;
        pending = new Map();
        closed = new Set();
        return clearRoom(reason);
      };
      const updatePeer = (data) => {
        setParticipants((previous) => previous.map((entry) => entry.peerId === data.peerId ? { ...entry, ...data } : entry));
      };
      socket.on("connect", join);
      socket.on("disconnect", (reason) => {
        reset("disconnected");
        if (!disposed && !replaced && reason !== "io server disconnect") notify("Connection lost. Reconnecting…");
      });
      socket.on("session-replaced", () => {
        replaced = true;
        notify("This account joined from another connection.");
      });
      socket.on("connect_error", (error) => notify(error.message === "AUTH_REQUIRED" ? "Please sign in again." : "Server connection failed."));
      socket.on("room-move-prepare", async ({ roomToken, id }) => {
        const room = current.current;
        if (room?.token !== roomToken) return;
        await room.recording?.onLeaving("moved");
        if (!room.closed) void room.ask("room-move-ready", { id }).catch(() => undefined);
      });
      socket.on("room-move", async ({ roomToken }) => {
        if (current.current && current.current.token !== roomToken) return;
        const finalized = reset("moved");
        const movingGeneration = gen;
        if (finalized) {
          let timer;
          await Promise.race([finalized, new Promise((resolve) => { timer = setTimeout(resolve, 6000); })]);
          clearTimeout(timer);
        }
        if (!disposed && gen === movingGeneration && socket.connected) void join();
      });
      socket.on("new-producer", (data) => {
        if (closed.has(data.producerId)) return;
        if (current.current?.receive) void current.current.subscribe(data);
        else pending.set(data.producerId, data);
      });
      socket.on("producer-closed", ({ remoteProducerId, roomToken }) => {
        if (current.current?.token !== roomToken) return;
        closed.add(remoteProducerId);
        if (closed.size > 256) closed.delete(closed.values().next().value);
        pending.delete(remoteProducerId);
        current.current.remove(remoteProducerId);
      });
      socket.on("participant-joined", (data) => setParticipants((previous) => [...previous.filter((entry) => entry.peerId !== data.peerId), data]));
      socket.on("participant-left", ({ peerId }) => {
        setParticipants((previous) => previous.filter((entry) => entry.peerId !== peerId));
        for (const item of current.current?.consumers.values() || []) if (item.peerId === peerId) current.current.remove(item.producerId);
      });
      socket.on("participant-state", (data) => {
        if (data.peerId === socket.id) setSelf(data);
        else updatePeer(data);
      });
      socket.on("audio-state", (data) => updatePeer({ peerId: data.peerId, audioEnabled: data.enabled, adminMuted: data.mutedByAdmin }));
      socket.on("video-state", (data) => updatePeer({ peerId: data.peerId, videoEnabled: data.enabled }));
      socket.on("admin-audio-state", ({ roomToken, enabled, mutedByAdmin }) => {
        if (current.current?.token !== roomToken) return;
        current.current.audioEnabled = enabled;
        mediaIntent.current.audio = enabled;
        for (const track of capture.current?.getAudioTracks() || []) track.enabled = enabled;
        setAudio(enabled);
        setSelf((previous) => ({ ...previous, audioEnabled: enabled, adminMuted: mutedByAdmin }));
      });
      socket.on("host-video-state", ({ roomToken, enabled }) => {
        const room = current.current;
        if (room?.token !== roomToken) return;
        room.videoEnabled = enabled;
        mediaIntent.current.video = enabled;
        for (const track of capture.current?.getVideoTracks() || []) track.enabled = enabled;
        if (cameraTrack.current) cameraTrack.current.enabled = enabled;
        setVideo(enabled);
      });
      socket.on("presentation-stopped", ({ roomToken }) => {
        if (current.current?.token === roomToken) void stopScreen(false);
      });
      socket.on("live-state", (data) => {
        const room = current.current;
        if (room?.token !== data.roomToken) return;
        if (!data.features.recording) room.recording?.onRevoked();
        const next = room.mergeSnapshot(data);
        if (next) setLive(next);
        else if (!room.resyncing) {
          room.resyncing = room.ask("live-snapshot").then(({ live: snapshot }) => {
            if (room === current.current) setLive(room.mergeSnapshot(snapshot));
          }).catch((error) => notify(error.message)).finally(() => { room.resyncing = null; });
        }
      });
      socket.on("chat-message", (data) => setChat((previous) => [...previous, data].slice(-200)));
      socket.on("active-speaker", ({ userId }) => setActiveSpeaker(userId));
      socket.on("meeting-reaction", (data) => {
        setReaction(data);
        clearTimeout(reactionTimer);
        reactionTimer = setTimeout(() => setReaction(null), 2800);
      });
      socket.on("admin-removed", ({ reason }) => { notify(reason); router.replace("/"); });
    };
    begin().catch((error) => { if (!disposed) notify(error.message); });
    return () => {
      disposed = true;
      ++gen;
      clearRoom("left");
      socket?.removeAllListeners();
      socket?.disconnect();
      connection.current = null;
      capture.current?.getTracks().forEach((track) => track.stop());
      capture.current = null;
      mediaIntent.current = { audio: null, video: null };
      cameraTrack.current = null;
      setCamera(null); setMic(null); setRawVideoTrack(null);
    };
  }, [meetingId, userId, token, authReady, router, notify, stopScreen, watchDevice]);

  const toggle = async (kind) => {
    const room = current.current;
    const audio = kind === "audio";
    const signal = audio ? "audio-state" : "video-state";
    const enabled = !(audio ? room?.audioEnabled : room?.videoEnabled);
    try {
      if (!room) throw new Error("Wait for the meeting media to connect.");
      await room.ask(signal, { enabled });
      if (!enabled || room !== current.current) return;
      const raw = capture.current?.getTracks().find((track) => track.kind === kind && track.readyState === "live");
      if (!raw) {
        const prefs = mediaPreferences(userId);
        await changeInput(kind, prefs[kind], prefs.quality, true);
      } else if (!room.producers.has(audio ? "microphone" : "camera")) {
        raw.enabled = audio ? room.audioEnabled : room.videoEnabled;
        if (raw.enabled) await room.produce(audio ? "microphone" : "camera", raw);
      }
    } catch (error) {
      if (room && room === current.current && enabled) void room.ask(signal, { enabled: false }).catch(() => undefined);
      notify(error.name === "NotAllowedError" ? "Device access was denied. Check your browser permissions." : error.message);
    }
  };
  const action = useCallback((action, data) => ask("live-action", { action, ...data }), [ask]);
  return { media, audioEnabled, videoEnabled, toggleAudio: () => toggle("audio"), toggleVideo: () => toggle("video"), camera, mic, rawVideoTrack, changeInput,
    remote, participants, self, live, chat, reaction, activeSpeaker, ask, action, display, startScreen, stopScreen, replaceCamera };
}

