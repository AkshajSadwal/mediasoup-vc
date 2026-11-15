export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10_000_000;

function imageSize(view, type) {
  const ascii = (offset, value) => [...value].every((letter, index) => view.getUint8(offset + index) === letter.charCodeAt(0));
  if (type === "image/png" && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && ascii(12, "IHDR")) {
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (type === "image/webp" && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    const uint24 = (offset) => view.getUint8(offset) + (view.getUint8(offset + 1) << 8) + (view.getUint8(offset + 2) << 16);
    if (ascii(12, "VP8X")) return [1 + uint24(24), 1 + uint24(27)];
    if (ascii(12, "VP8L") && view.getUint8(20) === 0x2f) {
      const bits = view.getUint32(21, true);
      return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
    }
    if (ascii(12, "VP8 ") && uint24(23) === 0x2a019d) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
  }
  if (type === "image/jpeg" && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < view.byteLength && view.getUint8(offset) === 0xff) {
      const marker = view.getUint8(offset + 1);
      if (marker === 0xff) { offset++; continue; }
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 8) {
        return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      }
      if (length < 2 || marker === 0xda || marker === 0xd9) break;
      offset += length + 2;
    }
  }
  return [];
}

const validDimensions = (width, height) => width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 24_000_000;

export async function prepareBackground(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 32 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Choose a valid JPEG, PNG, or WebP image up to 10 MB.");
  }
  const view = new DataView(await file.arrayBuffer());
  if (!validDimensions(...imageSize(view, file.type))) throw new Error("The image is invalid or its dimensions are too large.");
  const bitmap = await createImageBitmap(file);
  try {
    if (!validDimensions(bitmap.width, bitmap.height)) throw new Error("The image dimensions are too large.");
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not resize this image.")), "image/webp", .85));
  } finally { bitmap.close(); }
}

function openImages() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rauma-backgrounds", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("images", { keyPath: ["account", "id"] }).createIndex("account", "account"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Rauma tabs and try again."));
  });
}

export async function imagesFor(account, mutation, value) {
  const database = await openImages();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction("images", mutation ? "readwrite" : "readonly");
      const store = transaction.objectStore("images");
      const query = store.index("account").getAll(account, MAX_IMAGES);
      let result;
      let error;
      query.onsuccess = () => {
        result = query.result;
        if (mutation === "add") {
          if (result.length >= MAX_IMAGES) {
            error = new Error("Delete one of your five custom backgrounds first.");
            transaction.abort();
            return;
          }
          const entry = { account, id: crypto.randomUUID(), ...value };
          store.add(entry);
          result = [...result, entry];
        } else if (mutation === "delete") {
          store.delete([account, value]);
          result = result.filter(({ id }) => id !== value);
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(error || transaction.error || new Error("Browser storage is unavailable."));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
