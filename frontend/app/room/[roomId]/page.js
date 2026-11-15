"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMeetingOutput } from "@/components/room/DeviceSettings";
import MeetingConfiguration, { emptyConfiguration } from "@/components/room/MeetingConfiguration";
import RoomHeader from "@/components/room/RoomHeader";
import VideoGrid, { MeetingAudio } from "@/components/room/VideoGrid";
import BottomControls from "@/components/room/BottomControls";
import MeetingPanel from "@/components/room/MeetingPanel";
import MeetingTools from "@/components/room/MeetingTools";
import Whiteboard from "@/components/room/Whiteboard";
import Polls from "@/components/room/Polls";
import Files from "@/components/room/Files";
import Recording from "@/components/room/Recording";
import Backgrounds from "@/components/room/Backgrounds";
import { useMeetingSession } from "@/components/room/hooks/useMeetingSession";
import { useMeetingAdmission } from "@/components/room/hooks/useMeetingAdmission";
import { useFiles } from "@/components/room/hooks/useFiles";
import { useRecorder } from "@/components/room/hooks/useRecorder";
import { useCaptions } from "@/components/room/hooks/useCaptions";
import { useBackground } from "@/components/room/hooks/useBackground";
import "@/components/room/meeting.css";

const corePanels = ["chat", "participants", "settings"];
const titles = { attach: "Attach to chat", poll: "New poll", vote: "New vote", files: "File sharing", permissions: "Permissions",
  hands: "Raised hands", breakouts: "Breakout rooms", recording: "Local recording", captions: "English server captions", backgrounds: "Camera background", sharing: "Screen sharing" };

function Countdown({ until, breakout, offset }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((until - Date.now() - offset) / 1000)));
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((until - Date.now() - offset) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [until, offset]);
  return <p className="meeting-banner" role={seconds <= 15 ? "status" : undefined}>{breakout && seconds <= 15 ? "Returning to the main room in " : "Breakouts end in "}
    {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>;
}

export default function MeetingPage() {
  const { roomId: meetingId } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [message, setMessage] = useState("");
  const timeout = useRef(null);
  const notify = useCallback((text) => {
    clearTimeout(timeout.current);
    setMessage(text);
    timeout.current = setTimeout(() => setMessage(""), 4500);
  }, []);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const call = useMeetingSession({ meetingId, userId, authReady: status !== "loading", token: session?.backendToken, router, notify });
  const { live } = call;
  const output = useMeetingOutput(userId, notify);
  const isHost = live?.role === "host";
  const isModerator = live?.role === "moderator";
  const admission = useMeetingAdmission(meetingId, session?.backendToken, isHost, notify);
  const [panel, setPanel] = useState(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(null);
  const [pin, setPin] = useState(null);
  const [page, setPage] = useState(0);
  const [localBoard, setLocalBoard] = useState(false);
  const [hideBoard, setHideBoard] = useState(false);
  const body = useRef(null);
  const panelContainer = useRef(null);
  const priorFocus = useRef(null);

  const openPanel = (name) => {
    if (!panel) priorFocus.current = document.activeElement;
    setPanel(name);
  };
  const closePanel = useCallback(() => {
    setPanel(null);
    requestAnimationFrame(() => {
      if (priorFocus.current instanceof HTMLElement && priorFocus.current.isConnected) priorFocus.current.focus();
    });
  }, []);
  useEffect(() => {
    if (!panel) return;
    panelContainer.current?.querySelector("button")?.focus();
    const escape = (event) => { if (event.key === "Escape") closePanel(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [panel, closePanel]);
  const [workspaceToken, setWorkspaceToken] = useState(null);
  const roomToken = live?.roomToken ?? null;
  if (workspaceToken !== roomToken) {
    setWorkspaceToken(roomToken);
    setDraft(""); setPin(null); setPage(0); setLocalBoard(false); setHideBoard(false);
  }

  const localName = call.self?.name || session?.user?.displayName || session?.user?.name || "You";
  const local = { ...call.self, name: localName + " (you)", userId, peerId: call.self?.peerId || "local",
    videoEnabled: call.videoEnabled, audioEnabled: call.audioEnabled };
  const people = [local, ...call.participants];
  const cameras = new Map(call.remote.filter((item) => item.source === "camera").map((item) => [item.peerId, item.stream]));
  if (call.camera) cameras.set(local.peerId, call.camera);
  const sharing = call.remote.find((item) => item.source === "screen-video");
  const display = call.display ? { person: local, stream: call.display } :
    sharing && { person: people.find((person) => person.peerId === sharing.peerId), stream: sharing.stream };
  const remoteAudio = useMemo(() => call.remote.filter((item) => item.source === "microphone" || item.source === "screen-audio"), [call.remote]);
  const speech = useMemo(() => [...remoteAudio.map((item) => item.stream), ...(call.audioEnabled && call.mic ? [call.mic] : [])],
    [remoteAudio, call.audioEnabled, call.mic]);
  const selfMember = live?.members.find((member) => member.userId === userId);
  const recordedAudio = useMemo(() => {
    const displayAudio = call.display?.getAudioTracks().filter((track) => track.readyState === "live") || [];
    return [...speech, ...(displayAudio.length && !live?.muted && !selfMember?.awaitingUnmute ? [new MediaStream(displayAudio)] : [])];
  }, [speech, call.display, live?.muted, selfMember?.awaitingUnmute]);

  const recorder = useRecorder(call.media, live?.features.recording, body, recordedAudio, notify);
  const captions = useCaptions(call.media);
  const files = useFiles(call.media, notify);
  const background = useBackground(call.media, call.rawVideoTrack, call.replaceCamera, notify);

  const action = async (name, data) => {
    try { await call.action(name, data); return true; }
    catch (error) { notify(error.message); return false; }
  };
  const chat = async (event) => {
    event.preventDefault();
    if (!draft.trim() || live?.features.chat === false) return;
    try { await call.ask("chat-message", { text: draft }); setDraft(""); }
    catch (error) { notify(error.message); }
  };
  const admin = async (name, data) => {
    try { await call.ask(name, data); } catch (error) { notify(error.message); }
  };
  const invite = async () => {
    const url = new URL("/room/" + encodeURIComponent(meetingId), window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: "Join my Rauma meeting", url });
      else { await navigator.clipboard.writeText(url); notify("Invite link copied."); }
    } catch (error) { if (error.name !== "AbortError") notify("Could not share the invite link."); }
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(meetingId); notify("Meeting code copied."); }
    catch { notify("Could not copy the meeting code."); }
  };
  const tools = [
    ["Chat", () => openPanel("chat")], ["Participants", () => openPanel("participants")],
    ...(isHost ? [["Host settings", () => openPanel("settings")]] : []),
    ["Screen sharing", () => openPanel("sharing")], ["Share invite link", invite],
    ["Copy meeting code", copyCode],
    ["Whiteboard", () => { setHideBoard(false); setLocalBoard(true); }], ["Raised hands", () => openPanel("hands")],
    ["Local recording", () => openPanel("recording")], ["English captions", () => openPanel("captions")],
    ["Camera background", () => openPanel("backgrounds")], ["Permissions", () => openPanel("permissions")],
    ["Breakout rooms", () => openPanel("breakouts")],
  ];
  const end = live?.closingAt ?? (live?.roomId !== "main" || isHost ? live?.endsAt : null);
  const boardVisible = live && (localBoard || (live.boardPresented && !hideBoard));
  const board = boardVisible && <Whiteboard live={live} userId={userId} action={action} close={() => { setLocalBoard(false); setHideBoard(true); }} />;

  return <main className="meeting-shell">
    <RoomHeader roomName={meetingId} live={live} ready={Boolean(call.media)} participantCount={live ? people.length : 0}
      fileOffer={files.state?.phase === "offer"} onFile={() => openPanel("files")} onRecording={() => openPanel("recording")}
      onChat={() => openPanel("chat")} onPeople={() => openPanel("participants")} />
    {end && <Countdown key={end} until={end} offset={live.clockOffset} breakout={live.roomId !== "main"} />}
    {live?.notice && <p className="meeting-banner" role="status">Host notice · {live.notice.text}</p>}
    {live?.muted && <p className="meeting-banner">Speaking is restricted by the host or a moderator.</p>}
    {captions.status === "Captions unavailable" && panel !== "captions" && <p className="meeting-banner"><button onClick={() => openPanel("captions")}>{captions.status}</button></p>}
    {recorder.output && panel !== "recording" && <p className="meeting-banner"><button onClick={() => openPanel("recording")}>Recording ready to save</button></p>}
    <div className="meeting-body" ref={body}>
      <VideoGrid people={people} cameras={cameras} screen={localBoard && board ? null : display} board={board} pinned={people.some((person) => person.userId === pin) ? pin : null}
        setPin={setPin} spotlight={live?.spotlight} activeSpeaker={call.activeSpeaker} onSpotlight={isHost || isModerator ? (id) => action("spotlight", { userId: id }) : null}
        page={page} setPage={setPage} />
      <MeetingAudio items={remoteAudio} sink={output.output} onSinkError={output.unavailable} />
      {captions.lines.length > 0 && <div className="meeting-indicator meeting-caption" aria-label="Meeting captions">
        {captions.lines.map(([id, line]) => <p key={id} data-caption-final={line.final}><strong>{line.name}</strong> {line.text}</p>)}
      </div>}
      {call.reaction && <p aria-live="polite" className="meeting-indicator meeting-reaction-overlay">{call.reaction.emoji} {call.reaction.name}</p>}
      {panel && <div className="contents" ref={panelContainer}>
        {corePanels.includes(panel) ? <MeetingPanel open tab={panel} onTabChange={setPanel} onClose={closePanel}
          participants={call.participants} messages={call.chat} draft={draft} setDraft={setDraft} onSendMessage={chat}
          localPeerId={call.self?.peerId} localName={localName} localAvatarUrl={call.self?.avatarUrl}
          isAdmin={isHost} isHost={isHost} isModerator={isModerator} onAttachment={() => setPanel("attach")}
          canChat={live?.features.chat !== false} meetingConfiguration={isHost && panel === "settings" && <MeetingConfiguration
            initial={{ ...(admission.configuration || emptyConfiguration()), defaults: live.defaults, overrides: live.overrides }}
            participants={live.members} onSave={admission.saveConfiguration} />}
          pollCards={live?.polls.length > 0 && <Polls live={live} action={action} />}
          visibility={admission.meetingVisibility} onVisibilityChange={admission.changeVisibility}
          joinRequests={admission.joinRequests} onApproveRequest={admission.resolveJoinRequest} onPromoteModerator={admission.toggleModerator}
          onAdminMute={(targetPeerId, muted) => admin("admin-mute-participant", { targetPeerId, muted })}
          onAdminRemove={(targetPeerId) => admin("admin-remove-participant", { targetPeerId })} />
          : <aside className="meeting-panel" aria-label={titles[panel]}>
            <div className="meeting-inline justify-between border-b border-[#dce6f2] px-3">
              <h2 className="font-semibold">{titles[panel]}</h2>
              <button aria-label="Close meeting panel" onClick={closePanel}>✕</button>
            </div>
            {!live ? <p className="p-3">Waiting for the meeting connection.</p> : <>
              {panel === "attach" && <div className="meeting-tool">{["poll", "vote", "files"].map((type) => <button key={type} onClick={() => setPanel(type)}>{type === "files" ? "File" : type === "poll" ? "Poll" : "Vote"}</button>)}</div>}
              {["poll", "vote"].includes(panel) && <Polls key={panel} type={panel} live={live} action={action} done={() => setPanel("chat")} />}
              {panel === "files" && <Files files={files} live={live} people={people} userId={userId} action={action} />}
              {panel === "recording" && <Recording recorder={recorder} live={live} action={action} />}
              {panel === "backgrounds" && <Backgrounds effects={background} userId={userId} />}
              {panel === "captions" && <section className="meeting-tool">
                <p>The meeting server transcribes unmuted microphones in this room while viewers subscribe. Captions appear only for viewers who turn them on.</p>
                {captions.status && <p role="status">{captions.status}</p>}
                <button onClick={captions.toggle}>{captions.enabled ? "Turn captions off" : "Turn English captions on"}</button>
              </section>}
              {panel === "sharing" && <section className="meeting-tool">
                <p>Your browser opens its tab, window, or screen picker. Available sources and audio depend on your browser and operating system.</p>
                {call.display ? <>
                  <button onClick={() => call.startScreen()}>Change shared source</button>
                  <button onClick={() => call.stopScreen()}>Stop sharing screen</button>
                </> : <button onClick={() => call.startScreen()} disabled={Boolean(live.presenter) || !live.features.screen}>Share screen</button>}
                {isHost && live.presenter && <button onClick={() => action("stop-presentation")}>Stop room presentation</button>}
              </section>}
              {["permissions", "hands", "breakouts"].includes(panel) && <MeetingTools live={live} userId={userId} action={action} panel={panel} />}
            </>}
          </aside>}
      </div>}
    </div>
    <BottomControls deviceProps={{ output, userId, notify }} openEffects={() => openPanel("backgrounds")} call={call} raised={Boolean(selfMember?.raisedAt)} menu={menu} setMenu={setMenu} action={action} tools={tools}
      leave={async () => { await recorder.stop("left"); router.push("/"); }} />
    {message && <div className="meeting-toast" role="status">{message}</div>}
  </main>;
}
