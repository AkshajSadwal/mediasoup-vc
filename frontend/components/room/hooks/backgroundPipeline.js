const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304";
const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";
const within = (value) => Math.max(0, Math.min(1, value));
const surfaces = (count) => Array.from({ length: count }, () => document.createElement("canvas"));

let graphInitialization = Promise.resolve();

function createGraph(ImageSegmenter, vision, options) {
  // The pinned MediaPipe loader reads Module.printErr when creating its WASM instance.
  const creation = graphInitialization.then(async () => {
    const previous = globalThis.Module;
    const module = {
      ...previous,
      printErr: (...args) => {
        if (args.length === 1 && typeof args[0] === "string" &&
            args[0].trim() === "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.") {
          console.info(args[0]);
        } else {
          console.error(...args);
        }
      },
    };
    globalThis.Module = module;
    try {
      return await ImageSegmenter.createFromOptions(vision, options);
    } finally {
      if (globalThis.Module === module || globalThis.Module === undefined) {
        if (previous === undefined) delete globalThis.Module;
        else globalThis.Module = previous;
      }
    }
  });
  graphInitialization = creation.catch(() => undefined);
  return creation;
}

function size(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function cover(context, image, width, height) {
  const ratio = Math.max(width / image.width, height / image.height);
  const w = image.width * ratio;
  const h = image.height * ratio;
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function release(job) {
  if (!job) return;
  clearTimeout(job.timer);
  job.video?.pause();
  if (job.video) job.video.srcObject = null;
  job.stream?.getTracks().forEach((track) => track.stop());
  job.bitmap?.close();
  job.stream = job.bitmap = job.video = null;
}

export class BackgroundPipeline {
  constructor(replace, report, notify) {
    this.replace = replace;
    this.report = report;
    this.notify = notify;
    this.selection = { mode: "raw" };
    this.generation = 0;
  }

  graph() {
    this.graphPromise ??= (async () => {
      const moduleUrl = CDN + "/vision_bundle.mjs";
      const { FilesetResolver, ImageSegmenter } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl);
      const vision = await FilesetResolver.forVisionTasks(CDN + "/wasm");
      const graph = await createGraph(ImageSegmenter, vision, {
        baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "VIDEO",
        outputCategoryMask: false, outputConfidenceMasks: true,
      });
      if (this.closed) { graph.close(); throw new Error("Camera session ended."); }
      this.maskIndex = graph.getLabels().indexOf("selfie");
      if (this.maskIndex !== 0) { graph.close(); throw new Error("Unexpected selfie model labels."); }
      this.segmenter = graph;
      this.timestamp = -1;
      return graph;
    })().catch((error) => {
      this.graphPromise = null;
      throw error;
    });
    return this.graphPromise;
  }

  attach(track) {
    if (this.raw === track) return;
    this.raw = track;
    void this.apply();
  }

  choose(mode, image) {
    if (mode !== "raw" && (!this.raw || this.raw.readyState !== "live")) {
      this.notify("Turn on a working camera before starting background effects.");
      return;
    }
    this.selection = { mode, image };
    return this.apply();
  }

  async apply() {
    const generation = ++this.generation;
    const raw = this.raw;
    const { mode, image } = this.selection;
    const previous = this.job;
    this.job = null;
    const valid = () => !this.closed && generation === this.generation;
    let job;
    const fallback = async (error) => {
      if (!valid()) return release(job);
      console.error("Camera background processing failed", error);
      this.selection = { mode: "raw" };
      this.job = null;
      if (this.segmenter && !this.inference) {
        this.segmenter.close();
        this.segmenter = this.graphPromise = null;
      }
      try {
        if (raw?.readyState === "live") await this.replace(raw, raw);
        if (valid()) this.notify("Camera effects stopped. Check camera access or WebGL support, then retry in Camera settings.");
      } catch {
        if (valid()) this.notify("Camera effects stopped. Open Camera settings and select a working camera.");
      } finally {
        release(job);
        release(previous);
        if (valid()) this.report({ mode: "raw" });
      }
    };

    try {
      clearTimeout(previous?.timer);
      if (previous && raw?.readyState === "live") await this.replace(raw, raw);
      release(previous);
      if (!valid()) return;
      if (mode === "raw" || !raw) {
        this.report({ mode: "raw" });
        return;
      }

      if (!HTMLCanvasElement.prototype.captureStream) throw new Error("Canvas video capture is unavailable.");
      this.report({ mode, id: image?.id, loading: true });
      job = { video: document.createElement("video") };
      this.job = job;
      const graph = await this.graph();
      if (!valid()) return release(job);
      if (image) job.bitmap = await createImageBitmap(image.blob);
      if (!valid()) return release(job);
      const video = job.video;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([raw]);
      await video.play();
      if (!valid()) return release(job);

      const [output, foreground, mask, blurred, input] = surfaces(5);
      const out = output.getContext("2d", { alpha: false });
      const from = input.getContext("2d");
      const front = foreground.getContext("2d");
      const maskContext = mask.getContext("2d");
      const low = blurred.getContext("2d");
      let widthLimit = 480;
      let interval = 83;
      let slowFrames = 0;
      let lastFrame = -1;
      let pixels;
      let rendered = false;
      let frameDeadline = performance.now() + 3500;
      const render = async () => {
        if (!valid()) return;
        const started = performance.now();
        if (raw.readyState !== "live") throw new Error("Camera track ended.");
        if (!raw.enabled) frameDeadline = started + 3500;
        const ready = raw.enabled && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
        if (!ready && started >= frameDeadline) throw new Error("The selected camera did not deliver a video frame.");
        if (ready && video.currentTime !== lastFrame) {
          lastFrame = video.currentTime;
          const ratio = Math.min(1, widthLimit / video.videoWidth);
          const width = Math.max(2, Math.round(video.videoWidth * ratio / 2) * 2);
          const height = Math.max(2, Math.round(video.videoHeight * ratio / 2) * 2);
          size(input, width, height);
          size(output, width, height);
          size(foreground, width, height);
          from.drawImage(video, 0, 0, width, height);
          this.timestamp = Math.max(this.timestamp + 1, Math.ceil(started));
          let painted = false;
          this.inference = true;
          try {
            graph.segmentForVideo(input, this.timestamp, ({ confidenceMasks }) => {
              const person = confidenceMasks?.[this.maskIndex];
              if (!person?.width || !person.height) return;
              const scores = person.getAsFloat32Array();
              size(mask, person.width, person.height);
              if (!pixels || pixels.width !== person.width || pixels.height !== person.height) {
                pixels = maskContext.createImageData(person.width, person.height);
              }
              for (let i = 0; i < scores.length; i++) pixels.data[i * 4 + 3] = Math.round(within((scores[i] - .15) / .7) * 255);
              maskContext.putImageData(pixels, 0, 0);
              front.globalCompositeOperation = "copy";
              front.drawImage(input, 0, 0);
              front.globalCompositeOperation = "destination-in";
              front.drawImage(mask, 0, 0, width, height);
              if (job.bitmap) cover(out, job.bitmap, width, height);
              else {
                size(blurred, 24, Math.max(2, Math.round(24 * height / width)));
                low.drawImage(input, 0, 0, blurred.width, blurred.height);
                out.imageSmoothingQuality = "high";
                out.drawImage(blurred, 0, 0, width, height);
              }
              out.drawImage(foreground, 0, 0);
              painted = true;
            });
          } finally { this.inference = false; }
          if (!painted) throw new Error("The selfie graph did not return a confidence mask.");
          if (!rendered) {
            rendered = true;
            job.stream = output.captureStream(15);
            await this.replace(job.stream.getVideoTracks()[0], raw);
            if (!valid()) return release(job);
            this.report({ mode, id: image?.id });
          }
          slowFrames = performance.now() - started > interval * .75 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
          if (slowFrames >= 5) {
            if (widthLimit === 240 && interval >= 200) throw new Error("The camera effects exceeded the processing budget.");
            widthLimit = Math.max(240, Math.round(widthLimit * .75));
            interval = Math.min(220, interval * 1.4);
            slowFrames = 0;
          }
        }
        if (!raw.enabled && !rendered) this.report({ mode, id: image?.id });
        job.timer = setTimeout(() => { void render().catch(fallback); }, raw.enabled ? Math.max(16, interval - (performance.now() - started)) : 200);
      };
      await render();
    } catch (error) {
      await fallback(error);
    }
  }

  close() {
    this.closed = true;
    ++this.generation;
    release(this.job);
    this.segmenter?.close();
    this.job = this.segmenter = null;
  }
}
