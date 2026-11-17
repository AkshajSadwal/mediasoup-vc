import DeviceSettings from "./DeviceSettings";
import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Hand, ChevronDown, MoreHorizontal, MonitorUp } from "lucide-react";

const reactions = ["👍", "❤️", "👏", "😂", "🎉", "😮"];

export default function BottomControls({ call, raised, menu, setMenu, action, tools, leave, deviceProps, openEffects }) {
  const bar = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !bar.current?.contains(event.target)) {
        if (event.type === "keydown") bar.current?.querySelector("[aria-expanded=true]")?.focus();
        setMenu(null);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, [menu, setMenu]);
  const pick = (command) => { bar.current?.querySelector("[aria-expanded=true]")?.focus(); setMenu(null); command(); };
  return <footer className="meeting-footer" ref={bar} aria-label="Meeting controls">
    <div className="meeting-toolbar">
      <div className="meeting-device-group">
        <button className={call.audioEnabled ? "" : "meeting-control-off"} title={call.audioEnabled ? "Mute microphone" : "Unmute microphone"} aria-label={call.audioEnabled ? "Mute microphone" : "Unmute microphone"} aria-pressed={!call.audioEnabled} onClick={call.toggleAudio}>{call.audioEnabled ? <Mic size={20}/> : <MicOff size={20}/>}<span className="meeting-control-text">Mic</span></button>
        <button className="meeting-control-chevron" title="Microphone settings" aria-label="Microphone settings" aria-expanded={menu === "mic"} onClick={() => setMenu(menu === "mic" ? null : "mic")}><ChevronDown size={16}/></button>
      </div>
      <div className="meeting-device-group">
        <button className={call.videoEnabled ? "" : "meeting-control-off"} title={call.videoEnabled ? "Turn camera off" : "Turn camera on"} aria-label={call.videoEnabled ? "Turn camera off" : "Turn camera on"} aria-pressed={!call.videoEnabled} onClick={call.toggleVideo}>{call.videoEnabled ? <Video size={20}/> : <VideoOff size={20}/>}<span className="meeting-control-text">Camera</span></button>
        <button className="meeting-control-chevron" title="Camera settings" aria-label="Camera settings" aria-expanded={menu === "camera"} onClick={() => setMenu(menu === "camera" ? null : "camera")}><ChevronDown size={16}/></button>
      </div>
      <span className="meeting-toolbar-divider" aria-hidden="true" />
      <div className="meeting-hand-group">
        <button title={raised ? "Lower hand" : "Raise hand"} aria-label={raised ? "Lower hand" : "Raise hand"} aria-pressed={raised} disabled={!raised && call.live?.features.hands === false} onClick={() => action("raise-hand", { raised: !raised })}><Hand size={20}/><span className="meeting-control-text">Hand</span></button>
        <button className="meeting-control-chevron" title="Reactions" aria-label="Reactions" disabled={call.live?.features.reactions === false} aria-expanded={menu === "reactions"} onClick={() => setMenu(menu === "reactions" ? null : "reactions")}><ChevronDown size={16}/></button>
      </div>
      <button className="meeting-desktop-share" title={call.display ? "Stop sharing screen" : "Share screen"} aria-label={call.display ? "Stop sharing screen" : "Share screen"} aria-pressed={Boolean(call.display)} disabled={!call.display && call.live?.features.screen === false} onClick={() => call.display ? call.stopScreen() : call.startScreen()}><MonitorUp size={20}/><span className="meeting-control-text">Present</span></button>
      <button title="More tools" aria-label="More tools" aria-expanded={menu === "more"} onClick={() => setMenu(menu === "more" ? null : "more")}><MoreHorizontal size={22}/><span className="meeting-control-text">More</span></button>
      <span className="meeting-toolbar-divider" aria-hidden="true" />
      <button className="meeting-leave" title="Leave meeting" aria-label="Leave meeting" onClick={leave}><PhoneOff size={20}/><span className="meeting-control-text">Leave</span></button>
    </div>
    {menu === "reactions" && <div className="meeting-menu meeting-reactions" aria-label="Send a reaction">{reactions.map((emoji) => <button key={emoji} aria-label={"React " + emoji} onClick={() => pick(() => action("reaction", { emoji }))}>{emoji}</button>)}</div>}
    {["mic", "camera"].includes(menu) && <div className="meeting-menu meeting-device-menu" aria-label={menu === "mic" ? "Microphone settings" : "Camera settings"}><DeviceSettings key={menu} kind={menu === "mic" ? "audio" : "video"} call={call} {...deviceProps} onEffects={() => pick(openEffects)}/></div>}
    {menu === "more" && <div className="meeting-menu meeting-more-menu" aria-label="Meeting tools">{tools.map(([label, command]) => <button key={label} onClick={() => pick(command)}>{label}</button>)}</div>}
  </footer>;
}
