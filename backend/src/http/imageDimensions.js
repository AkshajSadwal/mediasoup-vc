// Inspect image container metadata before accepting profile pictures. This is
// not a complete decoder; a production image pipeline should additionally
// decode and re-encode uploaded files with a hardened imaging library.
const validDimensions = (width, height) =>
  Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
  width <= 4096 && height <= 4096 && width * height <= 16_000_000;

export function safeImageDimensions(bytes, mime) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (mime === "image/png") {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") return null;
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return validDimensions(width, height) ? { width, height } : null;
  }
  if (mime !== "image/jpeg" || bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at++] !== 0xff) return null;
    while (at < bytes.length && bytes[at] === 0xff) at++;
    if (at >= bytes.length) return null;
    const marker = bytes[at++];
    if (marker === 0xd9 || marker === 0xda) return null; // no dimensions found before image data
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (at + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(at);
    if (length < 2 || at + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 7) return null;
      const height = bytes.readUInt16BE(at + 3);
      const width = bytes.readUInt16BE(at + 5);
      return validDimensions(width, height) ? { width, height } : null;
    }
    at += length;
  }
  return null;
}
