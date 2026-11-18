"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Check, Circle, Download, Eraser, Hand, Highlighter,
  Maximize2, Minus, Pencil, Presentation, Redo2, Square, StickyNote,
  Trash2, Type, Undo2, X, ZoomIn, ZoomOut, MousePointer2,
} from "lucide-react";

// All shared operations use normalized [0..1000] coordinates. Keep the backing
// canvas resolution independent of the CSS size, the window, and local zoom.
const SIZE = [1200, 750];
const COLORS = ["#2563eb", "#111827", "#ef4444", "#f59e0b", "#16a34a", "#8b5cf6", "#ec4899", "#06b6d4"];
const NOTE_COLORS = ["#fff3a3", "#bff7d0", "#cbdcff", "#ffd3e6", "#e4d4ff"];
const TOOL_ITEMS = [
  { id: "select", label: "Select / move", Icon: MousePointer2 },
  { id: "hand", label: "Pan workspace", Icon: Hand },
  { id: "pen", label: "Pen", Icon: Pencil },
  { id: "highlighter", label: "Highlighter", Icon: Highlighter },
  { id: "eraser", label: "Eraser", Icon: Eraser },
  { id: "line", label: "Line", Icon: Minus },
  { id: "arrow", label: "Arrow", Icon: ArrowUpRight },
  { id: "rectangle", label: "Rectangle", Icon: Square },
  { id: "ellipse", label: "Ellipse", Icon: Circle },
  { id: "text", label: "Text", Icon: Type },
  { id: "sticky", label: "Sticky note", Icon: StickyNote },
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const normalized = (n) => clamp(Math.round(n), 0, 1000);

function bounds(operation) {
  const points = operation.points || [];
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  if (!xs.length) return [0, 0, 0, 0];
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (operation.tool === "text") {
    x1 = x0 + Math.min(400, Math.max(30, (operation.text || "").length * 10));
    y0 -= 34;
  }
  if (["pen", "highlighter", "eraser", "line", "arrow"].includes(operation.tool)) {
    const pad = (operation.size || 4) * 1.5 + 7;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  }
  return [x0, y0, x1, y1];
}

function paint(ctx, op) {
  if (!op?.points?.length) return;
  const points = op.points.map(([x, y]) => [x * SIZE[0] / 1000, y * SIZE[1] / 1000]);
  const [x, y] = points[0];
  const [lastX, lastY] = points.at(-1);
  const width = lastX - x, height = lastY - y;
  const tool = op.tool;
  const stroke = clamp(op.size || 4, 1, 30);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = tool === "eraser" ? Math.max(26, stroke * 4) : tool === "highlighter" ? Math.max(16, stroke * 3) : stroke;
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : op.color;
  ctx.fillStyle = ctx.strokeStyle;
  if (tool === "highlighter") ctx.globalAlpha = 0.30;
  if (tool === "text") {
    ctx.fillStyle = op.color;
    ctx.font = "24px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    // The server limits this text to 120 characters.
    (op.text || "").split("\n").forEach((line, index) => ctx.fillText(line, x, y + index * 29));
    ctx.restore();
    return;
  }
  if (tool === "sticky") {
    const w = Math.max(130, Math.abs(width));
    const h = Math.max(110, Math.abs(height));
    const sx = width < 0 ? x - w : x;
    const sy = height < 0 ? y - h : y;
    ctx.fillStyle = op.color;
    ctx.shadowColor = "#0f172a33";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 7;
    ctx.fillRect(sx, sy, w, h);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#283342";
    ctx.font = "18px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const maxWidth = w - 28;
    let line = "", lineIndex = 0;
    const flush = () => { if (lineIndex < Math.floor((h - 26) / 25)) ctx.fillText(line, sx + 14, sy + 14 + lineIndex++ * 25); line = ""; };
    for (const word of (op.text || "").split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) flush();
      line = ctx.measureText(word).width > maxWidth ? word.slice(0, 24) : line ? `${line} ${word}` : word;
    }
    if (line) flush();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  if (tool === "rectangle") ctx.rect(x, y, width, height);
  else if (tool === "ellipse") {
    if (Math.abs(width) > 1 && Math.abs(height) > 1) ctx.ellipse((x + lastX) / 2, (y + lastY) / 2, Math.abs(width) / 2, Math.abs(height) / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x, y);
    if (["line", "arrow"].includes(tool)) ctx.lineTo(lastX, lastY);
    else for (const point of points) ctx.lineTo(...point);
    if (points.length === 1) ctx.lineTo(x + 0.1, y);
  }
  ctx.stroke();
  if (tool === "arrow" && Math.hypot(width, height) > 6) {
    const angle = Math.atan2(height, width), head = Math.max(14, stroke * 5);
    ctx.beginPath();
    ctx.moveTo(lastX - head * Math.cos(angle - Math.PI / 6), lastY - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(lastX, lastY);
    ctx.lineTo(lastX - head * Math.cos(angle + Math.PI / 6), lastY - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
  ctx.restore();
}

function selectionOutline(ctx, op) {
  const [x0, y0, x1, y1] = bounds(op);
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(x0 * SIZE[0] / 1000 - 6, y0 * SIZE[1] / 1000 - 6,
    (x1 - x0) * SIZE[0] / 1000 + 12, (y1 - y0) * SIZE[1] / 1000 + 12);
  ctx.restore();
}

export default function Whiteboard({ live, userId, action, close }) {
  const canvas = useRef(null);
  const viewport = useRef(null);
  const gesture = useRef(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [size, setSize] = useState(4);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canEdit = Boolean(live.features.whiteboard);
  const operations = live.board || [];
  const own = operations.filter((op) => op.userId === userId);
  const undo = own.findLast((op) => !op.undone);
  const redo = own.find((op) => op.undone);

  // The stage is allowed to resize; the backing buffer never changes.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const scale = Math.min((rect.width - 12) / SIZE[0], (rect.height - 12) / SIZE[1]);
      const next = { width: Math.max(1, Math.floor(SIZE[0] * Math.max(0.01, scale))), height: Math.max(1, Math.floor(SIZE[1] * Math.max(0.01, scale))) };
      setSurfaceSize((prev) => prev.width === next.width && prev.height === next.height ? prev : next);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const draw = useCallback((showSelection = true) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ...SIZE);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ...SIZE);
    const current = gesture.current;
    const moved = current?.kind === "move" ? current.operation : null;
    for (const op of operations) {
      if (op.undone || (moved && moved.id === op.id)) continue;
      paint(ctx, op);
    }
    if (current?.kind === "draw" || moved) paint(ctx, current.operation);
    const selectedOp = moved || operations.find((op) => op.id === selected && !op.undone);
    if (showSelection && selectedOp) selectionOutline(ctx, selectedOp);
  }, [operations, selected]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!canEdit) { gesture.current = null; setSelected(null); }
  }, [canEdit]);

  const toPoint = (event) => {
    const r = canvas.current.getBoundingClientRect();
    return [normalized((event.clientX - r.left) / Math.max(r.width, 1) * 1000), normalized((event.clientY - r.top) / Math.max(r.height, 1) * 1000)];
  };

  const start = (event) => {
    if (event.button !== 0 || gesture.current) return;
    if (!canEdit && tool !== "hand") return;
    if (tool === "hand") {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { kind: "pan", pointer: event.pointerId, from: { x: event.clientX, y: event.clientY }, pan };
      return;
    }
    if (!canEdit) return;
    const point = toPoint(event);
    if (tool === "select") {
      const hit = [...operations].reverse().find((op) => {
        if (op.undone) return false;
        const [x0, y0, x1, y1] = bounds(op);
        return point[0] >= x0 - 12 && point[0] <= x1 + 12 && point[1] >= y0 - 12 && point[1] <= y1 + 12;
      });
      setSelected(hit?.id || null);
      if (hit?.userId === userId) {
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { kind: "move", pointer: event.pointerId, from: point, operation: { ...hit, points: hit.points.map((p) => [...p]) }, original: hit };
      }
      return;
    }
    if (["text", "sticky"].includes(tool) && !text.trim()) return;
    setSelected(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    const end = [normalized(point[0] + 160), normalized(point[1] + 165)];
    const operation = {
      id: crypto.randomUUID(), tool, color: tool === "sticky" ? noteColor : color,
      size, text: text.trim(), points: tool === "sticky" ? [point, end] : [point],
    };
    gesture.current = { kind: "draw", pointer: event.pointerId, operation };
    draw();
  };

  const move = (event) => {
    const current = gesture.current;
    if (current?.pointer !== event.pointerId) return;
    if (current.kind === "pan") {
      setPan({ x: current.pan.x + event.clientX - current.from.x, y: current.pan.y + event.clientY - current.from.y });
      return;
    }
    const point = toPoint(event);
    if (current.kind === "move") {
      const source = current.original.points;
      const dx = clamp(point[0] - current.from[0], -Math.min(...source.map(([x]) => x)), 1000 - Math.max(...source.map(([x]) => x)));
      const dy = clamp(point[1] - current.from[1], -Math.min(...source.map(([, y]) => y)), 1000 - Math.max(...source.map(([, y]) => y)));
      current.operation.points = source.map(([x, y]) => [x + dx, y + dy]);
    } else if (current.kind === "draw") {
      const points = current.operation.points;
      if (["pen", "highlighter", "eraser"].includes(tool)) {
        if (points.length >= 96) points.splice(0, points.length, ...points.filter((_, index) => index % 2 === 0));
        points.push(point);
      } else if (tool !== "text") points[1] = point;
    }
    draw();
  };

  const end = (event) => {
    const current = gesture.current;
    if (current?.pointer !== event.pointerId) return;
    gesture.current = null;
    if (current.kind === "move" && event.type === "pointerup") {
      const dx = current.operation.points[0][0] - current.original.points[0][0];
      const dy = current.operation.points[0][1] - current.original.points[0][1];
      if (dx || dy) void action("board-move", { id: current.operation.id, dx, dy });
    } else if (current.kind === "draw" && event.type === "pointerup" && canEdit) {
      void action("board-add", current.operation);
    }
    draw();
  };

  const save = () => {
    draw(false);
    const link = document.createElement("a");
    link.download = "rauma-whiteboard.png";
    link.href = canvas.current.toDataURL("image/png");
    link.click();
    draw(true);
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const adjustZoom = (diff) => setZoom((value) => clamp(Math.round((value + diff) * 10) / 10, 0.5, 2.5));

  return <div className="meeting-board meeting-board-zoom">
    <header className="meeting-board-header">
      <div className="meeting-board-heading">
        <span className="meeting-board-heading-icon"><Pencil size={18} /></span>
        <div><strong>Whiteboard</strong><span>Collaborate, sketch and share ideas</span></div>
        <span className="meeting-board-collab"><span aria-hidden /> {canEdit ? "You can edit" : "View only"}</span>
      </div>
      <div className="meeting-board-header-actions">
        {canEdit && <button type="button" disabled={!undo} aria-label="Undo" title="Undo" onClick={() => void action("board-undo", { id: undo.id })}><Undo2 size={17} /><span className="meeting-board-desktop-label">Undo</span></button>}
        {canEdit && <button type="button" disabled={!redo} aria-label="Redo" title="Redo" onClick={() => void action("board-redo", { id: redo.id })}><Redo2 size={17} /><span className="meeting-board-desktop-label">Redo</span></button>}
        <button type="button" onClick={save} title="Download board as PNG"><Download size={16} /><span className="meeting-board-desktop-label">Export</span></button>
        {canEdit && <button type="button" className={live.boardPresented ? "meeting-board-present is-presenting" : "meeting-board-present"} onClick={() => void action("present-board", { active: !live.boardPresented })}><Presentation size={16} /><span className="meeting-board-desktop-label">{live.boardPresented ? "Stop presenting" : "Present"}</span></button>}
        <button type="button" className="meeting-board-close" aria-label="Close whiteboard" title="Close whiteboard" onClick={close}><X size={18} /></button>
      </div>
    </header>
    <div className="meeting-board-workspace">
      <div className="meeting-board-surface" ref={viewport}>
        <canvas
          ref={canvas} data-record-tile data-name="Whiteboard" tabIndex={0} aria-label="Shared whiteboard drawing surface"
          width={SIZE[0]} height={SIZE[1]}
          style={surfaceSize.width ? { width: surfaceSize.width, height: surfaceSize.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` } : undefined}
          className={tool === "hand" ? "is-panning" : tool === "select" ? "is-selecting" : "is-drawing"}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        />
      </div>
      <div className="meeting-board-floating-tools" role="toolbar" aria-label="Whiteboard tools">
        {canEdit ? <>
          <div className="meeting-board-tool-stack">
            {TOOL_ITEMS.map(({ id, label, Icon }) => <button type="button" key={id} title={label} aria-label={label} aria-pressed={tool === id} onClick={() => { gesture.current = null; setTool(id); setSelected(null); }} className={tool === id ? "is-active" : ""}><Icon size={19} /></button>)}
          </div>
          {tool !== "hand" && tool !== "select" && <div className="meeting-board-palette">
            {tool === "sticky" ? <>
              <strong>Note colors</strong>
              <div className="meeting-board-swatches">{NOTE_COLORS.map((swatch) => <button type="button" key={swatch} title={swatch} aria-label={`Note color ${swatch}`} aria-pressed={noteColor === swatch} className={noteColor === swatch ? "is-picked" : ""} style={{ backgroundColor: swatch }} onClick={() => setNoteColor(swatch)}>{noteColor === swatch && <Check size={13} color="#1e293b" />}</button>)}</div>
            </> : <>
              <strong>Colors</strong>
              <div className="meeting-board-swatches">{COLORS.map((swatch) => <button type="button" key={swatch} title={swatch} aria-label={`Color ${swatch}`} aria-pressed={color === swatch} className={color === swatch ? "is-picked" : ""} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)}>{color === swatch && <Check size={13} color="#fff" />}</button>)}</div>
              {tool !== "text" && <label className="meeting-board-weight">Stroke size<select aria-label="Stroke size" value={size} onChange={(event) => setSize(Number(event.target.value))}><option value="2">Fine</option><option value="4">Normal</option><option value="8">Bold</option><option value="14">Extra bold</option></select></label>}
            </>}
            {["text", "sticky"].includes(tool) && <label className="meeting-board-text-label">{tool === "sticky" ? "Note text" : "Text"}<textarea aria-label={tool === "sticky" ? "Sticky note text" : "Whiteboard text"} value={text} maxLength={120} rows={3} onChange={(event) => setText(event.target.value)} placeholder="Write here, then click the canvas…" /></label>}
          </div>}
        </> : <div className="meeting-board-view-only"><span>View only</span><button type="button" onClick={() => setTool("hand")}><Hand size={15} /> Pan board</button><button type="button" disabled={live.requested.includes("whiteboard")} onClick={() => void action("request", { feature: "whiteboard" })}>{live.requested.includes("whiteboard") ? "Access requested" : "Request editing access"}</button></div>}
      </div>
      <div className="meeting-board-bottom-left">
        {live.role === "host" && canEdit && <button type="button" title="Clear all drawings for everyone" onClick={() => { if (window.confirm("Clear the whiteboard for everyone?")) void action("board-clear"); }}><Trash2 size={16} /> Clear</button>}
        <span className="meeting-board-hint">{tool === "select" ? "Drag your objects to move them" : tool === "hand" ? "Drag the board to pan" : ["text", "sticky"].includes(tool) ? "Type in the palette, then click the board" : "Draw with mouse, touch or pen"}</span>
      </div>
      <div className="meeting-board-zoom-controls" role="group" aria-label="Whiteboard zoom">
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => adjustZoom(-0.2)} disabled={zoom <= 0.5}><ZoomOut size={17}/></button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => adjustZoom(0.2)} disabled={zoom >= 2.5}><ZoomIn size={17}/></button>
        <button type="button" title="Fit to screen" aria-label="Fit to screen" onClick={resetView}><Maximize2 size={17}/></button>
      </div>
    </div>
  </div>;
}
