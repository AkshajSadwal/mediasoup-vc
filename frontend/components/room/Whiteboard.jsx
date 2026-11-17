import { useEffect, useRef, useState } from "react";
import { Download, PenLine, Presentation, Redo2, Trash2, Undo2, X } from "lucide-react";

const dimensions = [1200, 750];
const tools = ["pen", "eraser", "line", "rectangle", "ellipse", "text"];

function paint(context, operation) {
  const [width, height] = dimensions;
  const points = operation.points.map(([x, y]) => [x * width / 1000, y * height / 1000]);
  const [x, y] = points[0];
  const [endX, endY] = points.at(-1);
  context.strokeStyle = operation.tool === "eraser" ? "#ffffff" : operation.color;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = operation.tool === "eraser" ? 24 : 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (operation.tool === "rectangle") context.rect(x, y, endX - x, endY - y);
  else if (operation.tool === "ellipse") context.ellipse((x + endX) / 2, (y + endY) / 2, Math.abs(endX - x) / 2, Math.abs(endY - y) / 2, 0, 0, Math.PI * 2);
  else if (operation.tool === "text") {
    context.font = "24px sans-serif";
    context.fillText(operation.text, x, y);
    return;
  } else {
    context.moveTo(x, y);
    if (operation.tool === "line") context.lineTo(endX, endY);
    else for (const point of points) context.lineTo(...point);
    if (points.length === 1) context.lineTo(x + .1, y);
  }
  context.stroke();
}

export default function Whiteboard({ live, userId, action, close }) {
  const canvas = useRef(null);
  const surface = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const gesture = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#176df3");
  const [text, setText] = useState("");
  const canEdit = live.features.whiteboard;
  const ops = live.board || [];
  const own = ops.filter((op) => op.userId === userId);
  const undo = own.findLast((op) => !op.undone);
  const redo = own.find((op) => op.undone);
  const draw = () => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.fillStyle = "white";
    context.fillRect(0, 0, ...dimensions);
    for (const op of ops) if (!op.undone) paint(context, op);
    if (canEdit && gesture.current) paint(context, gesture.current.operation);
  };
  useEffect(() => {
    if (!canEdit) gesture.current = null;
    draw();
  });
  // The drawing buffer stays 1200x750 while its CSS size fits the actual stage.
  // Observe the *surface*, not the canvas, to avoid a resize feedback loop.
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const updateSize = () => {
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const availableWidth = Math.max(0, box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const availableHeight = Math.max(0, box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      const scale = Math.min(availableWidth / dimensions[0], availableHeight / dimensions[1]);
      const next = {
        width: Math.max(0, Math.floor(dimensions[0] * scale)),
        height: Math.max(0, Math.floor(dimensions[1] * scale)),
      };
      setCanvasSize((previous) => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const position = (event) => {
    const box = canvas.current.getBoundingClientRect();
    const scale = (value, size) => Math.round(Math.max(0, Math.min(1, value / Math.max(1, size))) * 1000);
    return [scale(event.clientX - box.left, box.width), scale(event.clientY - box.top, box.height)];
  };
  const start = (event) => {
    if (!canEdit || event.button !== 0 || gesture.current || (tool === "text" && !text.trim())) return;
    canvas.current.setPointerCapture(event.pointerId);
    gesture.current = { pointer: event.pointerId, operation: { id: crypto.randomUUID(), tool, color, text, points: [position(event)] } };
    draw();
  };
  const move = (event) => {
    if (gesture.current?.pointer !== event.pointerId) return;
    const { points } = gesture.current.operation;
    const point = position(event);
    if (tool === "pen" || tool === "eraser") {
      if (points.length === 96) {
        const decimated = points.filter((_, index) => index % 2 === 0);
        points.splice(0, points.length, ...decimated);
      }
      points.push(point);
    } else if (tool !== "text") points[1] = point;
    draw();
  };
  const end = (event) => {
    if (gesture.current?.pointer !== event.pointerId) return;
    const { operation } = gesture.current;
    gesture.current = null;
    draw();
    if (canEdit && event.type === "pointerup") action("board-add", operation);
  };
  const save = () => {
    const link = document.createElement("a");
    link.download = "rauma-whiteboard.png";
    link.href = canvas.current.toDataURL("image/png");
    link.click();
  };
  return <div className="meeting-board">
    <div className="meeting-board-header">
      <div className="meeting-board-heading">
        <span className="meeting-board-heading-icon"><PenLine size={18} /></span>
        <div>
          <strong>Whiteboard</strong>
          <span>Shared canvas · 1200 × 750</span>
        </div>
      </div>
      <div className="meeting-board-header-actions">
        <button type="button" className="meeting-board-export" onClick={save} title="Save a copy of the whiteboard"><Download size={16} /> <span>Export PNG</span></button>
        <button type="button" className="meeting-board-close" aria-label="Close my whiteboard" title="Close my whiteboard" onClick={close}><X size={18} /></button>
      </div>
    </div>
    <div className="meeting-board-tools" role="toolbar" aria-label="Whiteboard drawing tools">
      {canEdit && <>
        <label className="meeting-board-tool-label">Tool
          <select aria-label="Drawing tool" value={tool} onChange={(event) => setTool(event.target.value)}>
            {tools.map((entry) => <option key={entry} value={entry}>{entry[0].toUpperCase() + entry.slice(1)}</option>)}
          </select>
        </label>
        <label className="meeting-board-color-label" title="Choose drawing color">Color
          <input aria-label="Drawing color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        {tool === "text" && <input className="meeting-board-text-input" aria-label="Board text" maxLength={120} value={text} onChange={(event) => setText(event.target.value)} placeholder="Type text to place on the board" />}
        <span className="meeting-board-tool-divider" aria-hidden />
        <button type="button" disabled={!undo} onClick={() => action("board-undo", { id: undo.id })}><Undo2 size={16} /> Undo</button>
        <button type="button" disabled={!redo} onClick={() => action("board-redo", { id: redo.id })}><Redo2 size={16} /> Redo</button>
        <button type="button" className={live.boardPresented ? "meeting-board-present is-presenting" : "meeting-board-present"} onClick={() => action("present-board", { active: !live.boardPresented })}><Presentation size={16} /> {live.boardPresented ? "Stop presenting" : "Present board"}</button>
      </>}
      {!canEdit && <button type="button" disabled={live.requested.includes("whiteboard")} onClick={() => action("request", { feature: "whiteboard" })}>{live.requested.includes("whiteboard") ? "Access requested" : "Request editing access"}</button>}
      {live.role === "host" && <button type="button" className="meeting-board-clear" onClick={() => action("board-clear")}><Trash2 size={16} /> Clear board</button>}
    </div>
    <div className="meeting-board-surface" ref={surface}>
      <canvas ref={canvas} data-record-tile data-name="Whiteboard" aria-label="Shared whiteboard" width={dimensions[0]} height={dimensions[1]}
        style={canvasSize.width && canvasSize.height ? { width: canvasSize.width, height: canvasSize.height } : undefined}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
    </div>
  </div>;
}
