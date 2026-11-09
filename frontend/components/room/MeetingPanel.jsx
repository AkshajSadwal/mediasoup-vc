"use client";

import { useEffect, useRef } from "react";
import { Crown, MessageCircle, MicOff, Send, Users, Volume2, UserX, X, Settings, ShieldCheck, Check, Lock, Globe } from "lucide-react";

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
  localAvatarUrl,
  isAdmin,
  onAdminMute,
  onAdminRemove,
  adminBusyPeerId,
  isHost = false,
  isModerator = false,
  visibility = "public",
  onVisibilityChange,
  joinRequests = [],
  onApproveRequest,
  onPromoteModerator,
}) {
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-20 bottom-0 z-40 flex w-full max-w-md flex-col border-l border-[#dce6f2] bg-white/95 backdrop-blur-2xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#dce6f2] px-5 py-4">
        <div>
          <div className="font-semibold">Meeting</div>
          <div className="text-xs text-[#8795a8]">{participants.length + 1} participant{participants.length + 1 === 1 ? "" : "s"}</div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-[#64748b] hover:bg-white hover:text-[#172033]"><X size={18} /></button>
      </div>

      <div className="flex border-b border-[#dce6f2]">
        <button onClick={() => onTabChange("chat")} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm ${tab === "chat" ? "border-b-2 border-[#176df3] text-[#172033]" : "text-[#718096]"}`}><MessageCircle size={16} /> Chat</button>
        <button onClick={() => onTabChange("participants")} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm ${tab === "participants" ? "border-b-2 border-[#176df3] text-[#172033]" : "text-[#718096]"}`}><Users size={16} /> Participants</button>
        {(isHost || isModerator) && <button onClick={() => onTabChange("settings")} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm ${tab === "settings" ? "border-b-2 border-[#176df3] text-[#172033]" : "text-[#718096]"}`}><Settings size={16} /> Settings</button>}
      </div>

      {tab === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-sm text-[#8795a8]">No messages yet.<br />Start the conversation.</div>
            ) : messages.map((message) => (
              <div key={message.id} className={`${message.peerId === localPeerId ? "ml-8" : "mr-8"}`}>
                <div className="mb-1 flex items-center gap-2 text-xs text-[#8795a8]">
                  <span className="font-medium text-[#64748b]">{message.name || message.username || "Participant"}</span>
                  <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm ${message.peerId === localPeerId ? "bg-[#e8f1ff]" : "bg-white"}`}>{message.text}</div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
          <form onSubmit={onSendMessage} className="border-t border-[#dce6f2] p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[#dce6f2] bg-[#f4f8fd] p-2">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Type a message..." className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#172033]/30" />
              <button disabled={!draft.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-[#176df3] text-white disabled:opacity-40"><Send size={17} /></button>
            </div>
          </form>
        </div>
      ) : tab === "participants" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            <ParticipantRow participant={{ peerId: localPeerId, name: localName, avatarUrl: localAvatarUrl, isAdmin, isModerator }} local={true} admin={false} />
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.peerId}
                participant={participant}
                local={false}
                admin={isAdmin || isModerator}
                isHost={isHost}
                onPromote={() => onPromoteModerator?.(participant.userId, !participant.isModerator)}
                busy={adminBusyPeerId === participant.peerId}
                onMute={() => onAdminMute?.(participant.peerId, !participant.adminMuted)}
                onRemove={() => onAdminRemove?.(participant.peerId)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {isHost && <section className="rounded-2xl border border-[#dce6f2] bg-[#f7faff] p-4">
            <h3 className="font-semibold text-[#172033]">Meeting access</h3>
            <p className="mt-1 text-sm text-[#718096]">Choose who can enter this meeting.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => onVisibilityChange?.("public")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium ${visibility === "public" ? "border-[#176df3] bg-[#e8f1ff] text-[#176df3]" : "border-[#dce6f2] bg-white text-[#526176]"}`}><Globe size={16}/> Public</button>
              <button onClick={() => onVisibilityChange?.("private")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium ${visibility === "private" ? "border-[#176df3] bg-[#e8f1ff] text-[#176df3]" : "border-[#dce6f2] bg-white text-[#526176]"}`}><Lock size={16}/> Private</button>
            </div>
            <p className="mt-2 text-xs text-[#8795a8]">Private meetings require host or moderator approval for new participants.</p>
          </section>}
          <section>
            <h3 className="font-semibold text-[#172033]">Join requests <span className="text-xs text-[#8795a8]">({joinRequests.filter((item) => item.status === "pending").length} pending)</span></h3>
            {joinRequests.filter((item) => item.status === "pending").length === 0 ? <p className="mt-3 text-sm text-[#8795a8]">No pending requests.</p> : <div className="mt-3 space-y-2">{joinRequests.filter((item) => item.status === "pending").map((request) => <div key={request.userId} className="flex items-center gap-2 rounded-xl border border-[#dce6f2] bg-white p-3"><span className="min-w-0 flex-1 truncate text-sm font-medium">{request.userName}</span><button onClick={() => onApproveRequest?.(request.userId, true)} className="rounded-lg bg-[#176df3] px-3 py-2 text-xs font-semibold text-white"><Check size={14}/></button><button onClick={() => onApproveRequest?.(request.userId, false)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Deny</button></div>)}</div>}
          </section>
        </div>
      )}
    </aside>
  );
}

function ParticipantRow({ participant, local, admin, isHost, busy, onMute, onRemove, onPromote }) {
  const displayName = local ? participant.name || "You" : participant.name || participant.username || "Participant";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#dce6f2] bg-[#f4f8fd] px-3 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-sm font-semibold">{participant.avatarUrl ? <img src={participant.avatarUrl.startsWith("http") ? participant.avatarUrl : `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${participant.avatarUrl}`} alt="" className="h-full w-full object-cover"/> : displayName.charAt(0).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{displayName}{local ? " (You)" : ""}</span>
          {participant.isAdmin && <Crown size={14} className="text-[#176df3]" />}{participant.isModerator && <ShieldCheck size={14} className="text-emerald-600" />}
        </div>
        <div className="text-xs text-[#8795a8]">{participant.adminMuted ? "Muted by admin" : participant.audioEnabled ? "Mic on" : "Mic off"}</div>
      </div>
      {!local && isHost && !participant.isAdmin && <button disabled={busy || !participant.userId} onClick={onPromote} title={participant.isModerator ? "Remove moderator" : "Make moderator"} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><ShieldCheck size={16}/></button>}
      {!local && admin && !participant.isAdmin && (!participant.isModerator || isHost) && (
        <div className="flex items-center gap-1">
          <button disabled={busy} onClick={onMute} title={participant.adminMuted ? "Allow microphone" : "Mute microphone"} className="rounded-lg p-2 hover:bg-white disabled:opacity-40">{participant.adminMuted ? <Volume2 size={16} /> : <MicOff size={16} />}</button>
          <button disabled={busy} onClick={onRemove} title="Remove participant" className="rounded-lg p-2 text-red-600 hover:bg-red-500/10 disabled:opacity-40"><UserX size={16} /></button>
        </div>
      )}
    </div>
  );
}

