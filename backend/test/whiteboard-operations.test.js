import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { boardAction } from "../src/live/collaboration.js";

function makeRoom() { return { board: new Map(), boardOrder: 0 }; }
const alice = { userId: "alice" };
const bob = { userId: "bob" };
const create = (tool, additional = {}) => ({
  id: crypto.randomUUID(), tool, color: "#2563eb", size: 4,
  points: [[100, 100], [300, 300]], ...additional,
});

test("Zoom-style drawing tools are validated and saved", () => {
  const room = makeRoom();
  for (const tool of ["pen", "highlighter", "eraser", "line", "arrow", "rectangle", "ellipse", "text", "sticky"]) {
    const op = create(tool, { text: ["text", "sticky"].includes(tool) ? "Test note" : undefined });
    const saved = boardAction(room, alice, "board-add", op);
    assert.equal(saved.tool, tool);
    assert.equal(saved.size, 4);
    assert.equal(room.board.get(op.id)?.id, op.id);
  }
  assert.equal(room.board.size, 9);
});

test("Authors can move their own objects, and shared coordinates stay valid", () => {
  const room = makeRoom();
  const op = create("sticky", { color: "#fff3a3", text: "Move me" });
  boardAction(room, alice, "board-add", op);
  const updated = boardAction(room, alice, "board-move", { id: op.id, dx: 70, dy: -40 });
  assert.deepEqual(updated.points, [[170, 60], [370, 260]]);
  assert.equal(room.board.get(op.id), updated);
  assert.throws(() => boardAction(room, bob, "board-move", { id: op.id, dx: 1, dy: 1 }), /Only the author/);
  assert.throws(() => boardAction(room, alice, "board-move", { id: op.id, dx: 700, dy: 0 }), /remain on the board/);
  assert.throws(() => boardAction(room, alice, "board-move", { id: op.id, dx: 0.5, dy: 0 }), /Invalid request/);
});

test("New tools still work with existing undo and redo semantics", () => {
  const room = makeRoom();
  const op = create("arrow");
  boardAction(room, alice, "board-add", op);
  assert.equal(boardAction(room, alice, "board-undo", { id: op.id }).undone, true);
  assert.equal(boardAction(room, alice, "board-redo", { id: op.id }).undone, false);
  assert.throws(() => boardAction(room, alice, "board-add", create("sticky", { text: "" })), /Invalid request/);
});
