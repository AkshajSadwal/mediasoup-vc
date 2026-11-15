import { useCallback, useEffect, useRef, useState } from "react";
import { MicOff, Pin, PinOff, Presentation } from "lucide-react";

export function StreamElement({ stream, audio = false, onBlocked, sink, onSinkError }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (audio && element?.setSinkId) void element.setSinkId(sink || "").catch(() => { if (sink) onSinkError?.(); });
  }, [audio, sink, onSinkError]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    element.play().catch((error) => { if (error.name === "NotAllowedError") onBlocked?.(); });
    return () => { element.srcObject = null; };
  }, [stream, onBlocked]);
  return audio ? <audio ref={ref} autoPlay /> : <video ref={ref} autoPlay playsInline muted />;
}

export function MeetingAudio({ items, sink, onSinkError }) {
  const container = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const onBlocked = useCallback(() => setBlocked(true), []);
  const play = async () => {
    const result = await Promise.allSettled([...container.current.querySelectorAll("audio")].map((element) => element.play()));
    setBlocked(result.some(({ status }) => status === "rejected"));
  };
  return <>
    <div ref={container} className="hidden">{items.map(({ producerId, stream }) => <StreamElement key={producerId} audio stream={stream} onBlocked={onBlocked} sink={sink} onSinkError={onSinkError} />)}</div>
    {items.length > 0 && blocked && <button className="meeting-unblock-audio" onClick={play}>Enable meeting audio</button>}
  </>;
}

function Tile({ person, stream, presentation, pinned, onPin, onSpotlight, staged }) {
  const name = person?.name || "Participant";
  return (
    <div className="meeting-tile" data-record-tile data-name={presentation ? name + " • Sharing screen" : name}>
      {stream ? <StreamElement stream={stream} /> : <div className="meeting-avatar">
        {person?.avatarUrl ? <img alt="" src={person.avatarUrl.startsWith("http") ? person.avatarUrl : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + person.avatarUrl} /> : name.charAt(0).toUpperCase()}
      </div>}
      <div className="meeting-tile-caption">
        {!presentation && person?.audioEnabled === false && <MicOff size={14} />}
        <span>{name}{presentation ? " • Sharing screen" : ""}</span>
      </div>
      {!presentation && <div className="meeting-tile-actions">
        {onSpotlight && <button type="button" onClick={onSpotlight} title={staged ? "Remove spotlight" : "Spotlight for this room"} aria-label={staged ? "Remove spotlight" : "Spotlight for this room"}><Presentation size={16} /></button>}
        <button type="button" onClick={onPin} title={pinned ? "Unpin " + name : "Pin " + name} aria-label={pinned ? "Unpin " + name : "Pin " + name}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      </div>}
    </div>
  );
}

export default function VideoGrid({ people, cameras, screen, board, pinned, setPin, spotlight, activeSpeaker, onSpotlight, page, setPage }) {
  const featured = people.find((person) => person.userId === (pinned || spotlight || activeSpeaker));
  const stage = Boolean(screen || board || featured);
  const others = people.filter((person) => screen || board || person !== featured);
  const limit = 4;
  const lastPage = Math.max(0, Math.ceil(others.length / limit) - 1);
  const currentPage = Math.min(page, lastPage);
  const renderTile = (person) => <Tile key={person.peerId} person={person}
    stream={person.videoEnabled === false ? null : cameras.get(person.peerId)}
    pinned={pinned === person.userId} staged={spotlight === person.userId}
    onPin={() => setPin(pinned === person.userId ? null : person.userId)}
    onSpotlight={onSpotlight ? () => onSpotlight(spotlight === person.userId ? null : person.userId) : null} />;
  return (
    <section className="meeting-video-area" aria-label="Meeting stage">
      {pinned && spotlight && pinned !== spotlight && <button className="meeting-return" onClick={() => setPin(null)}>Return to spotlight</button>}
      <div className={stage ? "meeting-layout meeting-staged" : "meeting-layout"} data-record-layout>
        {stage && <div className="meeting-stage">
          {screen ? <Tile presentation person={screen.person} stream={screen.stream} /> : board || renderTile(featured)}
        </div>}
        <div className={stage ? "meeting-thumbnails" : "meeting-grid"} data-count={Math.min(others.length, 10)}>
          {others.map((person, index) => <div className={stage || Math.floor(index / limit) === currentPage ? "meeting-cell" : "meeting-cell meeting-mobile-hidden"} key={person.peerId}>{renderTile(person)}</div>)}
        </div>
      </div>
      {!stage && lastPage > 0 && <nav className="meeting-paging" aria-label="Participant pages">
        <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>{currentPage + 1} / {lastPage + 1}</span>
        <button disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next</button>
      </nav>}
    </section>
  );
}
