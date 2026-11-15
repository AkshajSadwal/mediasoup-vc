export const qualities = { low: [640, 360, 20], balanced: [1280, 720, 30], high: [1920, 1080, 30] };
const key = (userId) => "rauma-media:" + userId;

export function mediaPreferences(userId) {
  try { return userId ? JSON.parse(localStorage.getItem(key(userId))) || {} : {}; } catch { return {}; }
}

export function saveMediaPreferences(userId, values) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify({ ...mediaPreferences(userId), ...values })); } catch { /* storage is optional */ }
}

export function inputConstraints(kind, id, quality) {
  const device = id ? { deviceId: { exact: id } } : {};
  if (kind === "audio") return { audio: device };
  const [width, height, fps] = qualities[quality] || qualities.balanced;
  return { video: { ...device, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps } } };
}

export async function captureInput(kind, id, quality, restore = false) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera and microphone need a supported browser and secure context.");
  try { return await navigator.mediaDevices.getUserMedia(inputConstraints(kind, id, quality)); }
  catch (error) {
    if (!restore || !id || !["NotFoundError", "OverconstrainedError"].includes(error.name)) throw error;
    return navigator.mediaDevices.getUserMedia(inputConstraints(kind, "", quality));
  }
}
