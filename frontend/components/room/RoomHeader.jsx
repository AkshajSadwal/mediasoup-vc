import { Video, Users } from "lucide-react";

export default function RoomHeader({ roomName, live, participantCount, ready, fileOffer, onFile, onRecording, onChat, onPeople }) {
  const recorders = live?.members.filter((member) => member.recording && member.room === live.roomId) || [];
  return <header className="meeting-header">
    <div className="meeting-brand">
      <span><Video size={22} aria-hidden /></span>
      <div className="min-w-0">
        <h1>Rauma</h1>
        <p title={roomName}>{live?.title || roomName}</p>
      </div>
    </div>
    <div className="meeting-header-actions">
      {fileOffer && <button onClick={onFile}>File offer</button>}
      {recorders.length > 0 && <button className="meeting-recording-indicator" onClick={onRecording} title={recorders.map((member) => member.name).join(", ")} aria-label={"Recording by " + recorders.map((member) => member.name).join(", ")}>
        <span>●</span> <span className="meeting-recording-name">{recorders.map((member) => member.name).join(", ")}</span>
      </button>}
      <button className="meeting-header-chat" onClick={onChat}>Chat</button>
      <button onClick={onPeople} aria-label={"Participants, " + participantCount + " in this room"}><Users size={18} /> {participantCount}</button>
      <span className="meeting-connection" role="status"><span className={ready ? "connected" : ""} /> {ready ? "Connected" : "Connecting"}</span>
    </div>
  </header>;
}
