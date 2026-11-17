import { Copy, Link2, MessageCircle, Radio, Users, Video } from "lucide-react";

export default function RoomHeader({ roomName, live, participantCount, ready, fileOffer, onFile, onRecording, onChat, onPeople, onInvite, onCopyCode }) {
  const recorders = live?.members?.filter((member) => member.recording && member.room === live.roomId) || [];
  return <header className="meeting-header">
    <div className="meeting-brand">
      <span className="meeting-brand-icon"><Video size={21} aria-hidden="true" /></span>
      <div className="min-w-0">
        <h1 title={live?.title || roomName}>{live?.title || "Rauma meeting"}</h1>
        <button type="button" className="meeting-code" onClick={onCopyCode} title="Copy meeting code" aria-label="Copy meeting code"><span>{roomName}</span><Copy size={12}/></button>
      </div>
    </div>
    <div className="meeting-header-actions">
      <span className="meeting-connection" role="status"><span className={ready ? "connected" : ""} /> {ready ? "Connected" : "Connecting"}</span>
      {fileOffer && <button className="meeting-file-offer" onClick={onFile}>File offer</button>}
      {recorders.length > 0 && <button className="meeting-recording-indicator" onClick={onRecording} title={recorders.map((member) => member.name).join(", ")} aria-label={"Recording by " + recorders.map((member) => member.name).join(", ")}><Radio size={16}/><span className="meeting-recording-name">Recording</span></button>}
      <button onClick={onChat} title="Open chat" aria-label="Open chat" className="meeting-header-chat"><MessageCircle size={17}/><span>Chat</span></button>
      <button onClick={onPeople} title="Participants" aria-label={"Participants, " + participantCount + " in this room"}><Users size={17}/><span>{participantCount}</span></button>
      <button onClick={onInvite} title="Share invite link" aria-label="Share invite link" className="meeting-invite"><Link2 size={17}/><span>Invite</span></button>
    </div>
  </header>;
}
