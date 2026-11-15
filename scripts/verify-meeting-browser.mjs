import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { Server } from "../backend/node_modules/socket.io/dist/index.js";
import registerSocketHandlers from "../backend/src/socket/socketHandlers.js";
import { initializeWorker } from "../backend/src/mediasoup/workers/workerManager.js";
import { createConfiguredMeeting } from "../backend/src/meetings/meetingStore.js";
import { publicConfiguration } from "../backend/src/meetings/configuration.js";
import { getProducers } from "../backend/src/mediasoup/producers/producerManager.js";

const testData = mkdtempSync(join(tmpdir(), "rauma-test-"));
process.env.RAUMA_MEETINGS_FILE = join(testData, "meetings.json");
const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require(process.env.RAUMA_PLAYWRIGHT || "playwright");
const fixture = process.env.RAUMA_SPEECH_FIXTURE ? await readFile(process.env.RAUMA_SPEECH_FIXTURE) : null;
const fullSize = process.env.RAUMA_FULL_FILE === "1" ? 100_000_000 : 350_000;
const clientCount = Math.min(10, Math.max(2, Number(process.env.RAUMA_BROWSER_CLIENTS) || 2));
const wait = async (condition, time = 10000) => {
  const deadline = performance.now() + time;
  while (!await condition()) {
    if (performance.now() > deadline) throw new Error("Timed out waiting for browser condition.");
    await sleep(100);
  }
};
const frontend = "http://localhost:3300";
const backend = "http://localhost:4400";
const roomId = "browser-verification-" + Date.now();
const http = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", frontend);
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method === "POST" && req.url === "/api/meetings/config") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { configuration, title, visibility } = JSON.parse(body);
      const { meeting, links } = createConfiguredMeeting({ config: configuration, title, visibility, hostUserId: "Browser 0", hostName: "Browser 0" });
      return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        roomId: meeting.roomId, title, links, configuration: publicConfiguration(meeting.configuration),
      }));
    } catch { return res.writeHead(400).end(); }
  }
  if (req.url === "/speech.wav" && fixture) return res.writeHead(200, { "Content-Type": "audio/wav" }).end(fixture);
  if (req.url === "/api/meetings/" + roomId) return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ open: true }));
  res.writeHead(404).end();
});
const io = new Server(http, { cors: { origin: frontend } });
const namespace = io.of("/mediasoup");
namespace.use((socket, next) => {
  const user = socket.handshake.auth.token;
  if (!/^Browser [0-9]+$/.test(user)) return next(new Error("AUTH_REQUIRED"));
  socket.user = { id: user, displayName: user };
  next();
});
namespace.on("connection", registerSocketHandlers);

const worker = await initializeWorker();
worker.removeAllListeners("died");
const workerFailure = new Promise((_, reject) => worker.once("died", (error) => reject(error)));
workerFailure.catch(() => undefined);
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3300"], {
  cwd: fileURLToPath(new URL("../frontend", import.meta.url)),
  windowsHide: true, stdio: "inherit",
});
let browser;
try {
  await new Promise((resolve, reject) => { http.once("error", reject); http.listen(4400, resolve); });
  await wait(() => fetch(frontend).then(({ ok }) => ok).catch(() => false), 30_000);
  browser = await chromium.launch({
    channel: process.env.RAUMA_CHROMIUM_CHANNEL || "msedge",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const diagnostics = [];
  async function open(index) {
    const user = "Browser " + index;
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    await ctx.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: user, name: user },
      backendToken: user, expires: "2100-01-01T00:00:00.000Z" } }));
    const page = await ctx.newPage();
    page.on("pageerror", (error) => diagnostics.push(user + " " + error.message));
    page.on("console", (message) => { if (message.type() === "warning" || message.type() === "error") diagnostics.push(user + " " + message.text()); });
    await page.addInitScript(({ backend, speaker, index }) => {
      const PeerConnection = window.RTCPeerConnection;
      window.qaPeerConnections = [];
      window.RTCPeerConnection = class extends PeerConnection {
        constructor(...args) {
          super(...args);
          window.qaPeerConnections.push(this);
        }
      };
      const media = navigator.mediaDevices;
      window.qaDeviceTracks = [];
      window.qaOutputs = [];
      Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", { configurable: true,
        value: async function (id) { this.dataset.qaSink = id; window.qaOutputs.push(id); } });
      media.enumerateDevices = async () => [
        { kind: "audioinput", deviceId: "mic-1", label: "Synthetic mic one" },
        { kind: "audioinput", deviceId: "mic-2", label: "Synthetic mic two" },
        { kind: "videoinput", deviceId: "camera-1", label: "Synthetic camera one" },
        { kind: "videoinput", deviceId: "camera-2", label: "Synthetic camera two" },
        { kind: "audiooutput", deviceId: "speaker-1", label: "Synthetic speaker one" },
      ];
      const video = (input) => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 360;
        const context = canvas.getContext("2d");
        let frame = 0;
        const draw = () => {
          context.fillStyle = input === "camera-2" ? "#14bdea" : "hsl(" + (index * 36) + " 65% 48%)";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "white";
          context.fillRect((++frame * 4) % 580, 150, 60, 60);
        };
        draw();
        setInterval(draw, 67);
        return canvas.captureStream(15);
      };
      media.getDisplayMedia = async () => {
        const stream = video();
        window.testPresentation = stream;
        return stream;
      };
      media.getUserMedia = async (constraints) => {
        const tracks = constraints.video ? video(constraints.video?.deviceId?.exact).getTracks() : [];
        if (constraints.audio) {
          const audio = new AudioContext();
          await audio.resume();
          const output = audio.createMediaStreamDestination();
          if (speaker) {
            const decoded = await audio.decodeAudioData(await (await fetch(backend + "/speech.wav")).arrayBuffer());
            const padded = audio.createBuffer(1, decoded.length + 64000, audio.sampleRate);
            padded.copyToChannel(decoded.getChannelData(0), 0);
            let voice;
            window.qaStartSpeech = () => {
              voice?.stop();
              voice = audio.createBufferSource();
              voice.buffer = padded;
              voice.loop = true;
              voice.connect(output);
              voice.start();
            };
            window.qaStopSpeech = () => { voice.stop(); voice = null; };
            window.qaStartSpeech();
          }
          tracks.push(...output.stream.getTracks());
        }
        for (const track of tracks) window.qaDeviceTracks.push({ track,
          selected: constraints[track.kind]?.deviceId?.exact || "" });
        return new MediaStream(tracks);
      };
    }, { backend, speaker: index === 0 && Boolean(fixture), index });
    await page.goto(frontend + "/room/" + roomId);
    await page.getByText("Connected", { exact: true }).waitFor();
    return page;
  }
  const since = performance.now();
  const host = await open(0);
  const others = await Promise.all(Array.from({ length: clientCount - 1 }, (_, index) => open(index + 1)));
  const viewer = others[0];
  const pages = [host, ...others];
  const report = (message) => process.stdout.write(message + "\n");
  async function verify() {
    try {
      await wait(() => getProducers().filter(({ source }) => source === "camera").length === clientCount, 20_000);
    } catch (error) {
      const statuses = await Promise.all(pages.map((page) => page.locator(".meeting-header, .meeting-toast").allTextContents()));
      throw new Error("Camera setup failed: " + JSON.stringify({ statuses, sources: getProducers().map(({ source }) => source) }), { cause: error });
    }
    const playing = (page) => page.evaluate(() =>
      [...document.querySelectorAll("video")].filter((video) => video.readyState >= 2 && video.videoWidth > 0).length >= 2);
    try {
      await wait(async () => (await Promise.all(pages.map(playing))).every(Boolean), 30_000);
    } catch (error) {
      const playback = await Promise.all(pages.map((page) => page.evaluate(async () => {
        const stats = await Promise.all(window.qaPeerConnections.map((connection) => connection.getStats()));
        return {
          videos: [...document.querySelectorAll("video")].map((video) => [video.readyState, video.videoWidth, video.paused, video.closest("[data-name]")?.dataset.name]),
          frames: stats.flatMap((report) => [...report.values()]).filter((entry) => entry.type === "inbound-rtp" && entry.kind === "video")
            .map((entry) => [entry.framesReceived, entry.framesDecoded, entry.bytesReceived]),
        };
      })));
      throw new Error("Video playback did not start: " + JSON.stringify(playback), { cause: error });
    }
    report(clientCount + " Chromium clients received playing video in " + Math.round(performance.now() - since) + " ms.");
    if (process.env.RAUMA_CAPACITY_ONLY === "1") {
      const connections = (page) => page.evaluate(async () => {
        const reports = await Promise.all(window.qaPeerConnections.map((entry) => entry.getStats()));
        return reports.flatMap((report) => [...report.values()])
          .filter((entry) => entry.type === "inbound-rtp" && entry.kind === "video" && entry.framesDecoded > 0).length;
      });
      await wait(async () => (await Promise.all(pages.map(connections))).every((count) => count === clientCount - 1), 60_000);
      const loads = await worker.getResourceUsage();
      await sleep(5000);
      const final = await worker.getResourceUsage();
      report("All " + clientCount + " clients decoded all " + (clientCount - 1) + " incoming cameras. Five-second native worker CPU time " +
        (final.ru_utime + final.ru_stime - loads.ru_utime - loads.ru_stime) + " ms.");
      if (process.env.RAUMA_LOCAL_PROCESSING === "1" && fixture) {
        await host.evaluate(() => window.qaStopSpeech());
        await viewer.getByRole("button", { name: "More tools" }).click();
        await viewer.getByLabel("Meeting tools").getByRole("button", { name: "English captions", exact: true }).click();
        await viewer.getByRole("button", { name: "Turn English captions on" }).click();
        await viewer.getByText("English server captions are on.").waitFor({ timeout: 32_000 });
        await sleep(450);
        const onset = performance.now();
        await host.evaluate(() => window.qaStartSpeech());
        await viewer.locator('[data-caption-final="false"]').filter({ hasText: /good|morning|sunny|coffee/i }).first().waitFor({ timeout: 15000 });
        report("Server Vosk first partial with " + clientCount + " clients and one speaking fixture in " + Math.round(performance.now() - onset) + " ms.");
      }
      return;
    }
    await viewer.getByRole("button", { name: "Mute microphone", exact: true }).click();
    await viewer.getByRole("button", { name: "Unmute microphone", exact: true }).waitFor();

    async function tools(page, label) {
      await page.getByRole("button", { name: "More tools" }).click();
      await page.getByLabel("Meeting tools").getByRole("button", { name: label, exact: true }).click();
    }
    const close = (page) => page.getByRole("button", { name: "Close meeting panel" }).click();
    const files = async (page) => {
      await tools(page, "Chat");
      await page.getByRole("button", { name: "Attach poll, vote or file" }).click();
      await page.getByRole("button", { name: "File", exact: true }).click();
    };
    await tools(viewer, "Camera background");
    const backgroundFile = viewer.locator(".meeting-tool input[type=file]");
    const uploadImage = (name, size) => backgroundFile.evaluate(async (input, { name, size }) => {
      const canvas = document.createElement("canvas");
      const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const padding = new Uint8Array(Math.max(0, size - png.size));
      const data = new DataTransfer();
      data.items.add(new File([png, padding], name, { type: "image/png" }));
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { name, size });
    await uploadImage("too-large.png", 10_000_001);
    await viewer.getByText(/valid JPEG, PNG, or WebP image up to 10 MB/).waitFor();
    for (let index = 0; index < 5; index++) {
      await uploadImage("background-" + index + ".png", index === 0 ? 10_000_000 : 0);
      await viewer.getByRole("button", { name: "background-" + index + ".png" }).waitFor();
    }
    assert.equal(await backgroundFile.isDisabled(), true);
    await viewer.getByRole("button", { name: "Delete", exact: true }).first().click();
    await wait(() => backgroundFile.isEnabled());
    await uploadImage("replacement.png", 0);
    await viewer.getByRole("button", { name: "replacement.png" }).waitFor();
    report("Backgrounds accepted a 10,000,000-byte PNG, rejected one extra byte, and required deletion before a sixth image.");
    await close(viewer);

    for (const [width, height] of [[360, 740], [390, 844], [768, 1024], [1366, 768], [2560, 1080]]) {
      await viewer.setViewportSize({ width, height });
      for (const panel of [false, true]) {
        if (panel) await tools(viewer, "Permissions");
        const layout = await viewer.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          shell: document.querySelector("main").getBoundingClientRect().height,
          bottom: document.querySelector(".meeting-footer").getBoundingClientRect().bottom,
          controls: [...document.querySelectorAll(".meeting-footer button")].filter((el) => el.getBoundingClientRect().width)
            .map((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]),
        }));
        assert.ok(layout.width <= width && layout.shell <= height + 1 && layout.bottom <= height + 1, JSON.stringify({ width, height, layout }));
        assert.ok(layout.controls.every(([w, h]) => w >= 44 && h >= 44));
        if (panel) await close(viewer);
      }
    }
    report("Viewport and 44px primary-control checks passed at 360, 390, 768, 1366 and 2560 px.");
    await viewer.setViewportSize({ width: 360, height: 740 });
    await viewer.getByRole("button", { name: "Microphone settings", exact: true }).click();
    await viewer.getByLabel("Microphone input", { exact: true }).selectOption("mic-2");
    await wait(() => viewer.evaluate(() => window.qaDeviceTracks.some(({ track, selected }) => selected === "mic-2" && !track.enabled)));
    assert.ok(await viewer.getByRole("button", { name: "Unmute microphone", exact: true }).isVisible());
    assert.ok(await viewer.evaluate(() => window.qaDeviceTracks.find(({ track }) => track.kind === "audio").track.readyState === "ended"));
    await viewer.getByLabel("Speaker output", { exact: true }).selectOption("speaker-1");
    await wait(() => viewer.locator('audio[data-qa-sink="speaker-1"]').count().then((count) => count > 0));
    await viewer.getByRole("button", { name: "Play speaker test" }).click();
    await wait(() => viewer.evaluate(() => window.qaOutputs.filter((choice) => choice === "speaker-1").length >= 2));
    await viewer.keyboard.press("Escape");
    await viewer.getByRole("button", { name: "Camera settings", exact: true }).click();
    await viewer.getByLabel("Camera", { exact: true }).selectOption("camera-2");
    await wait(() => viewer.evaluate(() => window.qaDeviceTracks.some(({ track, selected }) => selected === "camera-2" && track.enabled)));
    assert.ok(await viewer.evaluate(() => window.qaDeviceTracks.find(({ track }) => track.kind === "video").track.readyState === "ended"));
    assert.equal(await viewer.evaluate(() => document.documentElement.scrollWidth), 360);
    await viewer.keyboard.press("Escape");
    await viewer.setViewportSize({ width: 1366, height: 768 });
    report("Mobile input menus switched camera and muted mic tracks, released former tracks, and routed playback plus a speaker test to the selected synthetic output.");

    const configurationPage = await host.context().newPage();
    await configurationPage.setViewportSize({ width: 390, height: 844 });
    await configurationPage.goto(frontend + "/config-meeting");
    await configurationPage.getByText("Participant defaults", { exact: true }).click();
    await configurationPage.getByLabel("Start muted", { exact: true }).first().check();
    await configurationPage.getByText("Team links", { exact: true }).click();
    await configurationPage.getByRole("button", { name: "Add team" }).click();
    await configurationPage.getByRole("button", { name: "Add team" }).click();
    assert.equal(await configurationPage.evaluate(() => document.documentElement.scrollWidth), 390);
    await configurationPage.getByRole("button", { name: "Save configuration" }).click();
    const urls = await configurationPage.locator('input[readonly]').evaluateAll((items) => items.map((item) => item.value));
    if (urls.length !== 2) await configurationPage.getByRole("button", { name: "Start configured meeting" }).waitFor();
    const savedUrls = await configurationPage.locator('input[readonly]').evaluateAll((items) => items.map((item) => item.value));
    assert.equal(savedUrls.length, 2);
    assert.notEqual(savedUrls[0], savedUrls[1]);
    assert.ok(savedUrls.every((url) => new URL(url).hash.startsWith("#team=")));
    await configurationPage.close();
    report("390 px configuration form saved role defaults and issued two independent fragment-based team links.");

    await tools(viewer, "Permissions");
    assert.equal(await viewer.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close meeting panel");
    await viewer.keyboard.press("Escape");
    await wait(() => viewer.evaluate(() => document.activeElement.getAttribute("aria-label") === "More tools"));

    await host.getByRole("button", { name: "Share screen", exact: true }).click();
    await viewer.getByText(/Sharing screen/).first().waitFor();
    assert.equal(getProducers().filter(({ source }) => source === "camera").length, clientCount);
    await host.evaluate(() => {
      const track = window.testPresentation.getVideoTracks()[0];
      track.stop();
      track.dispatchEvent(new Event("ended"));
    });
    await wait(() => !getProducers().some(({ source }) => source === "screen-video"));
    report("Injected browser Stop Sharing ended the presentation while all cameras remained published.");

    const chooseFile = (page, name, size) => page.locator("input[type=file]").evaluate((element, { name, size }) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 67; bytes[bytes.length - 1] = 75;
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name));
      element.files = transfer.files;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, { name, size });
    await files(host);
    await chooseFile(host, "meeting-check.bin", fullSize);
    await host.getByLabel("Recipient").selectOption("Browser 1");
    await host.getByRole("button", { name: "Offer file" }).click();
    await viewer.getByRole("button", { name: "File offer" }).click();
    await viewer.getByRole("button", { name: "Accept", exact: true }).click();
    await viewer.getByRole("button", { name: /Save meeting-check.bin/ }).waitFor({ timeout: 90_000 });
    const incoming = viewer.waitForEvent("download");
    await viewer.getByRole("button", { name: /Save meeting-check.bin/ }).click();
    const received = await incoming;
    const bytes = await readFile(await received.path());
    assert.equal(bytes.length, fullSize);
    assert.equal(bytes[0], 67); assert.equal(bytes[bytes.length - 1], 75);
    report("Real SCTP file transfer completed and saved " + fullSize + " bytes.");
    await chooseFile(host, "cancel-check.bin", 20_000_000);
    await host.getByRole("button", { name: "Offer file" }).click();
    await viewer.getByRole("button", { name: "Accept", exact: true }).click();
    const progress = viewer.getByRole("progressbar", { name: "File transfer progress" });
    await progress.waitFor();
    await wait(async () => Number(await progress.getAttribute("value")) > 0);
    await viewer.getByRole("button", { name: "Cancel", exact: true }).click();
    await host.getByText("File transfer cancelled.").waitFor();
    report("Recipient cancellation ended the unfinished SCTP transfer and notified the sender.");
    await close(host); await close(viewer);

    await tools(viewer, "Whiteboard");
    const board = viewer.getByLabel("Shared whiteboard");
    const rect = await board.boundingBox();
    await viewer.mouse.move(rect.x + 45, rect.y + 40);
    await viewer.mouse.down();
    await viewer.mouse.move(rect.x + 180, rect.y + 120, { steps: 10 });
    await viewer.mouse.up();
    await wait(() => viewer.getByRole("button", { name: "Undo" }).isEnabled());
    await viewer.getByRole("button", { name: "Present board", exact: true }).click();
    await host.getByLabel("Shared whiteboard").waitFor();

    await tools(viewer, "Local recording");
    await viewer.getByRole("button", { name: "Record in browser memory" }).click();
    await viewer.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await host.getByRole("button", { name: "Recording by Browser 1" }).waitFor();
    if (process.env.RAUMA_LOCAL_PROCESSING === "1") {
      await host.evaluate(() => window.qaStopSpeech());
      await tools(viewer, "English captions");
      await viewer.getByRole("button", { name: "Turn English captions on" }).click();
      await viewer.getByText("English server captions are on.").waitFor({ timeout: 15000 });
      await sleep(350);
      const speechStart = performance.now();
      await host.evaluate(() => window.qaStartSpeech());
      const partial = viewer.locator('[data-caption-final="false"]').filter({ hasText: /good|morning|sunny|coffee/i });
      await partial.first().waitFor({ timeout: 15000 });
      const firstPartial = Math.round(performance.now() - speechStart);
      const finalized = viewer.locator('[data-caption-final="true"]').filter({ hasText: /coffee|meeting|morning|sunny/i });
      await finalized.first().waitFor({ timeout: 15000 });
      assert.equal(await host.locator(".meeting-caption").count(), 0);
      report("Server Vosk onset-to-first-partial " + firstPartial + " ms; final in " + Math.round(performance.now() - speechStart) + " ms.");
      await close(viewer);

      await tools(viewer, "Camera background");
      const backgroundFile = viewer.locator(".meeting-tool input[type=file]");
      await viewer.getByRole("button", { name: "Delete", exact: true }).first().click();
      await wait(() => backgroundFile.isEnabled());
      await backgroundFile.evaluate(async (input) => {
        const canvas = document.createElement("canvas");
        canvas.getContext("2d").fillStyle = "#ff00ff";
        canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
        const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        const data = new DataTransfer();
        data.items.add(new File([png], "magenta.png", { type: "image/png" }));
        input.files = data.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const choose = async (name) => {
        const button = viewer.getByRole("button", { name, exact: true });
        await button.click();
        await wait(async () => await button.isEnabled() && await button.getAttribute("aria-pressed") === "true", 60_000);
      };
      await choose("Blur background");
      await choose("magenta.png");
      const hasMagenta = (page) => page.evaluate(() => [...document.querySelectorAll('video')].some((video) => {
        if (video.readyState < 2) return false;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        context.drawImage(video, 8, 8, 4, 4, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return r > 195 && g < 80 && b > 180;
      }));
      await wait(async () => await hasMagenta(host) && await hasMagenta(viewer), 12_000);
      await choose("Blur background");
      await choose("Raw camera");
      await choose("magenta.png");
      await wait(async () => await hasMagenta(host) && await hasMagenta(viewer), 12_000);
      await close(viewer);
      await viewer.getByRole("button", { name: "Camera settings", exact: true }).click();
      await viewer.getByLabel("Camera", { exact: true }).selectOption("camera-1");
      await wait(() => viewer.evaluate(() => window.qaDeviceTracks.some(({ track, selected }) =>
        selected === "camera-2" && track.readyState === "ended")));
      await viewer.keyboard.press("Escape");
      await tools(viewer, "Camera background");
      await wait(() => viewer.getByRole("button", { name: "magenta.png", exact: true }).isEnabled());
      await wait(async () => await hasMagenta(host) && await hasMagenta(viewer), 12_000);
      await close(viewer);
      await tools(viewer, "English captions");
      await viewer.getByRole("button", { name: "Turn captions off" }).click();
      assert.equal(await viewer.locator(".meeting-caption").count(), 0);
      await close(viewer);
      report("Repeated blur/image/raw changes reached both local preview and the remote camera; caption disable cleared the overlay.");
    }
    await sleep(3700);
    await tools(viewer, "Local recording");
    await viewer.getByRole("button", { name: "Pause", exact: true }).click();
    await viewer.getByRole("button", { name: "Resume", exact: true }).click();
    await sleep(2200);
    await viewer.getByRole("button", { name: "Stop recording", exact: true }).click();
    const saved = viewer.waitForEvent("download");
    await viewer.getByRole("button", { name: "Save recording", exact: true }).click();
    const recording = await saved;
    const blob = await readFile(await recording.path());
    const output = await viewer.evaluate(async ({ bytes, name }) => {
      const video = document.createElement("video");
      const data = Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0));
      video.src = URL.createObjectURL(new Blob([data], { type: name.endsWith(".mp4") ? "video/mp4" : "video/webm" }));
      video.muted = true;
      await video.play();
      const context = new AudioContext();
      const audio = await context.decodeAudioData(data.buffer.slice(0));
      let peak = 0;
      for (const sample of audio.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
      await context.close();
      video.pause();
      URL.revokeObjectURL(video.src);
      return { width: video.videoWidth, height: video.videoHeight, audioSeconds: audio.duration, peak };
    }, { bytes: blob.toString("base64"), name: recording.suggestedFilename() });
    assert.deepEqual([output.width, output.height], [1280, 720]);
    assert.ok(output.audioSeconds > 3);
    if (fixture) assert.ok(output.peak > 0.01, "Remote speech should be present in the recorded audio.");
    report("Decoded recording " + JSON.stringify(output));
    await viewer.getByRole("button", { name: "Record in browser memory" }).click();
    await viewer.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await tools(host, "Breakout rooms");
    await host.getByLabel("Breakout room name").fill("Focus room");
    await host.getByRole("button", { name: "Create room" }).click();
    const assignment = host.getByLabel("Assign Browser 1");
    await assignment.getByRole("option", { name: "Focus room" }).waitFor({ state: "attached" });
    await assignment.selectOption({ label: "Focus room" });
    await host.getByRole("button", { name: "Start breakouts" }).click();
    await viewer.getByText("Focus room", { exact: true }).waitFor();
    await viewer.getByRole("button", { name: "Save recording", exact: true }).waitFor();
    assert.equal(await viewer.getByLabel("Shared whiteboard").count(), 0);
    assert.equal(await viewer.locator("audio").count(), 0);
    await host.getByRole("button", { name: "Close room", exact: true }).click();
    await viewer.getByText(/Returning to the main room in/).waitFor();
    await viewer.getByText("Main room", { exact: true }).waitFor({ timeout: 25_000 });
    report("Browser recording finalized before breakout entry. Room media and board were isolated, and the countdown returned the viewer to main.");
  }
  try {
    await Promise.race([verify(), workerFailure]);
  } finally {
    for (const line of diagnostics.slice(-22)) report(line);
  }

  for (const [name, browserType] of [["Firefox", firefox], ["WebKit", webkit]]) {
    let implementation;
    try {
      implementation = await browserType.launch();
      const page = await implementation.newPage();
      await page.goto(frontend);
      const capabilities = await page.evaluate(() => ({
        display: !!navigator.mediaDevices?.getDisplayMedia, canvas: !!HTMLCanvasElement.prototype.captureStream,
        recorder: !!window.MediaRecorder, audioWorklet: !!window.AudioWorkletNode, webgpu: !!navigator.gpu,
        webm: window.MediaRecorder?.isTypeSupported("video/webm"), mp4: window.MediaRecorder?.isTypeSupported("video/mp4"),
      }));
      console.log(name + " capability probes", capabilities);
    } catch (error) { console.log(name + " unavailable:", error.message.split("\n")[0]); }
    finally { await implementation?.close(); }
  }
} finally {
  await browser?.close();
  io.close();
  worker.close();
  rmSync(testData, { recursive: true, force: true });
  next.kill();
}
