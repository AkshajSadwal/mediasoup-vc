"use client";

import { useEffect, useRef } from "react";
import {
  Crown,
  MessageCircle,
  Mic,
  MicOff,
  Send,
  Users,
  Video,
  VideoOff,
  Volume2,
  UserX,
  X,
} from "lucide-react";

export default function MeetingPanel({
  open,
  tab,
  onTabChange,
  onClose,
  messages,
  draft,
  setDraft,
  onSendMessage,
  participants,
  localPeerId,
  localName,
  localAudioEnabled,
  localVideoEnabled,
  localAdminMuted,
  isAdmin,
  onAdminMute,
  onAdminRemove,
  adminBusyPeerId,
}) {
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-20 bottom-0 z-40 flex w-full max-w-md flex-col border-l border-white/10 bg-[#0d111a]/95 backdrop-blur-2xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="font-semibold">Meeting</div>
          <div className="text-xs text-white/40">{participants.length + 1} participant{participants.length + 1 === 1 ? "" : "s"}</div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={18} /></button>
      </div>

      <div className="flex border-b border-white/10">
        <button onClick={() => onTabChange("chat")} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm ${tab === "chat" ? "border-b-2 border-cyan-400 text-white" : "text-white/50"}`}><MessageCircle size={16} /> Chat</button>
        <button onClick={() => onTabChange("participants")} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm ${tab === "participants" ? "border-b-2 border-cyan-400 text-white" : "text-white/50"}`}><Users size={16} /> Participants</button>
      </div>

      {tab === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-sm text-white/40">No messages yet.<br />Start the conversation.</div>
            ) : messages.map((message) => (
              <div key={message.id} className={`${message.peerId === localPeerId ? "ml-8" : "mr-8"}`}>
                <div className="mb-1 flex items-center gap-2 text-xs text-white/40">
                  <span className="font-medium text-white/60">{message.name || message.username || "Participant"}</span>
                  <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm ${message.peerId === localPeerId ? "bg-cyan-500/20" : "bg-white/10"}`}>{message.text}</div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
          <form onSubmit={onSendMessage} className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Type a message..." className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/30" />
              <button disabled={!draft.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-slate-900 disabled:opacity-40"><Send size={17} /></button>
            </div>
          </form>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            <ParticipantRow
              participant={{
                peerId: localPeerId,
                name: localName,
                isAdmin,
                audioEnabled: localAudioEnabled,
                videoEnabled: localVideoEnabled,
                adminMuted: localAdminMuted,
              }}
              local={true}
              admin={false}
            />
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.peerId}
                participant={participant}
                local={false}
                admin={isAdmin}
                busy={adminBusyPeerId === participant.peerId}
                onMute={() => onAdminMute?.(participant.peerId, !participant.adminMuted)}
                onRemove={() => onAdminRemove?.(participant.peerId)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function ParticipantRow({ participant, local, admin, busy, onMute, onRemove }) {
  const displayName = local ? participant.name || "You" : participant.name || participant.username || "Participant";
  const audioOn = Boolean(participant.audioEnabled);
  const videoOn = Boolean(participant.videoEnabled);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">{displayName.charAt(0).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{displayName}{local ? " (You)" : ""}</span>
          {participant.isAdmin && <Crown size={14} className="text-cyan-300" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${audioOn ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-white/50"}`}>
            {audioOn ? <Mic size={12} /> : <MicOff size={12} />}
            {participant.adminMuted ? "Mic muted by admin" : audioOn ? "Mic on" : "Mic off"}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${videoOn ? "bg-cyan-400/10 text-cyan-300" : "bg-white/10 text-white/50"}`}>
            {videoOn ? <Video size={12} /> : <VideoOff size={12} />}
            {videoOn ? "Camera on" : "Camera off"}
          </span>
        </div>
      </div>
      {!local && admin && !participant.isAdmin && (
        <div className="flex items-center gap-1">
          <button disabled={busy} onClick={onMute} title={participant.adminMuted ? "Allow microphone" : "Mute microphone"} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40">{participant.adminMuted ? <Volume2 size={16} /> : <MicOff size={16} />}</button>
          <button disabled={busy} onClick={onRemove} title="Remove participant" className="rounded-lg p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-40"><UserX size={16} /></button>
        </div>
      )}
    </div>
  );
}
