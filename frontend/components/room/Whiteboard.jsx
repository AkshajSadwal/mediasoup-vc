import { useEffect, useRef, useState } from "react";

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
  const position = (event) => {
    const box = canvas.current.getBoundingClientRect();
    const scale = (value, size) => Math.round(Math.max(0, Math.min(1, value / size)) * 1000);
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
    <div className="meeting-board-tools">
      {canEdit && <>
        <select aria-label="Drawing tool" value={tool} onChange={(event) => setTool(event.target.value)}>
          {tools.map((entry) => <option key={entry}>{entry}</option>)}
        </select>
        <input aria-label="Drawing color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        {tool === "text" && <input aria-label="Board text" maxLength={120} value={text} onChange={(event) => setText(event.target.value)} placeholder="Type text, then tap board" />}
        <button disabled={!undo} onClick={() => action("board-undo", { id: undo.id })}>Undo</button>
        <button disabled={!redo} onClick={() => action("board-redo", { id: redo.id })}>Redo</button>
        <button onClick={() => action("present-board", { active: !live.boardPresented })}>{live.boardPresented ? "Stop presenting" : "Present board"}</button>
      </>}
      {!canEdit && <button disabled={live.requested.includes("whiteboard")} onClick={() => action("request", { feature: "whiteboard" })}>{live.requested.includes("whiteboard") ? "Access requested" : "Request editing access"}</button>}
      {live.role === "host" && <button onClick={() => action("board-clear")}>Clear board</button>}
      <button onClick={save}>Export PNG</button>
      <button onClick={close}>Close my board</button>
    </div>
    <canvas ref={canvas} data-record-tile data-name="Whiteboard" aria-label="Shared whiteboard" width={dimensions[0]} height={dimensions[1]}
      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
  </div>;
}
