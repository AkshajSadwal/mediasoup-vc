import assert from "node:assert/strict";
import { test } from "node:test";
import { safeImageDimensions } from "../src/http/imageDimensions.js";

function png(width, height) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}
function jpeg(width, height) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 8,
    height >> 8, height & 255, width >> 8, width & 255,
    3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 0xff, 0xd9]);
}

test("accepts bounded PNG and JPEG dimensions", () => {
  assert.deepEqual(safeImageDimensions(png(640, 480), "image/png"), { width: 640, height: 480 });
  assert.deepEqual(safeImageDimensions(jpeg(1024, 768), "image/jpeg"), { width: 1024, height: 768 });
});
test("rejects forged, huge and truncated image headers", () => {
  assert.equal(safeImageDimensions(Buffer.from("not a png"), "image/png"), null);
  assert.equal(safeImageDimensions(png(5000, 100), "image/png"), null);
  assert.equal(safeImageDimensions(png(4000, 4001), "image/png"), null);
  assert.equal(safeImageDimensions(jpeg(5000, 200), "image/jpeg"), null);
  assert.equal(safeImageDimensions(jpeg(100, 100).subarray(0, 6), "image/jpeg"), null);
});
