// ─── Animation Export ─────────────────────────────────────────────────────────
// Exports animations as GIF, WebM, or PNG sequence.
// Renders at native canvas resolution × quality scale for crisp output.

import GIF from "gif.js";
import type { AnimationProject } from "./animationEngine";
import { getInterpolatedValues } from "./animationEngine";
import { downloadBlob } from "./utils";
import { buildLottieJSON } from "./lottieBuilder";
import type * as fabric from "fabric";

export type ExportFormat = "gif" | "webm" | "png-sequence" | "lottie";
export type ExportQuality = "low" | "medium" | "high";

interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  transparentBg?: boolean;
  onProgress?: (percent: number) => void;
}

interface ExportContext {
  fabricCanvas: fabric.Canvas;
  animProject: AnimationProject;
  objectMap: Map<string, fabric.FabricObject>;
  projectName: string;
  nativeWidth: number;
  nativeHeight: number;
}

// Quality presets — scale is relative to native project dimensions
const QUALITY_SETTINGS: Record<ExportQuality, { scale: number; gifQuality: number }> = {
  low: { scale: 0.5, gifQuality: 20 },
  medium: { scale: 1, gifQuality: 10 },
  high: { scale: 2, gifQuality: 1 },
};

// ─── Frame Rendering ──────────────────────────────────────────────────────────

function renderFrameToCanvas(
  ctx: ExportContext,
  frame: number
): void {
  const { fabricCanvas, animProject, objectMap } = ctx;

  animProject.tracks.forEach((track) => {
    const obj = objectMap.get(track.objectId);
    if (!obj) return;

    const values = getInterpolatedValues(track, frame);
    for (const [prop, val] of Object.entries(values)) {
      if (val !== undefined) {
        (obj as any).set(prop, val);
      }
    }
    obj.setCoords();
  });

  fabricCanvas.renderAll(); // Must be synchronous — drawImage() reads pixel buffer immediately after
}

function getCanvasElement(fabricCanvas: fabric.Canvas): HTMLCanvasElement {
  return (fabricCanvas as any).lowerCanvasEl || fabricCanvas.getElement();
}

/**
 * Sets the Fabric canvas to the target export resolution and returns the
 * previous zoom and dimensions so they can be restored later.
 */
function setExportResolution(
  fabricCanvas: fabric.Canvas,
  targetWidth: number,
  targetHeight: number,
  nativeWidth: number,
  nativeHeight: number,
) {
  const prevZoom = fabricCanvas.getZoom();
  const canvasEl = getCanvasElement(fabricCanvas);
  const prevWidth = canvasEl.width;
  const prevHeight = canvasEl.height;

  const exportZoom = targetWidth / nativeWidth;
  fabricCanvas.setZoom(exportZoom);
  fabricCanvas.setDimensions({ width: targetWidth, height: targetHeight });
  fabricCanvas.requestRenderAll();

  return { prevZoom, prevWidth, prevHeight };
}

function restoreResolution(
  fabricCanvas: fabric.Canvas,
  saved: { prevZoom: number; prevWidth: number; prevHeight: number },
) {
  fabricCanvas.setZoom(saved.prevZoom);
  fabricCanvas.setDimensions({ width: saved.prevWidth, height: saved.prevHeight });
  fabricCanvas.requestRenderAll();
}

// ─── GIF Export ───────────────────────────────────────────────────────────────

async function exportAsGif(
  ctx: ExportContext,
  options: ExportOptions
): Promise<void> {
  const { animProject, projectName, nativeWidth, nativeHeight } = ctx;
  const settings = QUALITY_SETTINGS[options.quality];
  const width = Math.round(nativeWidth * settings.scale);
  const height = Math.round(nativeHeight * settings.scale);

  const saved = setExportResolution(ctx.fabricCanvas, width, height, nativeWidth, nativeHeight);

  try {
    const canvasEl = getCanvasElement(ctx.fabricCanvas);

    return await new Promise<void>((resolve, reject) => {
      const gifOptions: any = {
        workers: 2,
        quality: settings.gifQuality,
        width,
        height,
        workerScript: "/gif.worker.js",
      };
      if (options.transparentBg) {
        gifOptions.transparent = 0x00000000;
      }
      const gif = new GIF(gifOptions);

      const totalFrames = animProject.totalFrames;
      const delay = Math.round(1000 / animProject.fps);

      for (let frame = 0; frame < totalFrames; frame++) {
        renderFrameToCanvas(ctx, frame);

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = "high";
        tempCtx.drawImage(canvasEl, 0, 0, width, height);

        gif.addFrame(tempCanvas, { delay, copy: true });

        options.onProgress?.(Math.round(((frame + 1) / totalFrames) * 80));
      }

      gif.on("finished", (blob: Blob) => {
        downloadBlob(blob, `${projectName}.gif`);
        options.onProgress?.(100);
        resolve();
      });

      gif.on("error", (err: Error) => {
        reject(err);
      });

      gif.render();
    });
  } finally {
    restoreResolution(ctx.fabricCanvas, saved);
  }
}

// ─── WebM Export (MediaRecorder) ──────────────────────────────────────────────

async function exportAsWebM(
  ctx: ExportContext,
  options: ExportOptions
): Promise<void> {
  const { animProject, projectName, nativeWidth, nativeHeight } = ctx;
  const settings = QUALITY_SETTINGS[options.quality];
  const width = Math.round(nativeWidth * settings.scale);
  const height = Math.round(nativeHeight * settings.scale);

  if (!MediaRecorder.isTypeSupported("video/webm")) {
    throw new Error("WebM export is not supported in this browser. Try Chrome or Firefox.");
  }

  const saved = setExportResolution(ctx.fabricCanvas, width, height, nativeWidth, nativeHeight);

  try {
    const canvasEl = getCanvasElement(ctx.fabricCanvas);
    const totalFrames = animProject.totalFrames;
    const fps = animProject.fps;
    const frameDuration = 1000 / fps;

    // Bitrate scales with pixel count
    const pixelCount = width * height;
    const baseBitrate = options.quality === "high" ? 12 : options.quality === "medium" ? 6 : 3;
    const videoBitsPerSecond = Math.round(baseBitrate * (pixelCount / (1920 * 1080)) * 1_000_000);

    return await new Promise<void>((resolve, reject) => {
      const stream = canvasEl.captureStream(0);
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: Math.max(2_000_000, videoBitsPerSecond),
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        downloadBlob(blob, `${projectName}.webm`);
        options.onProgress?.(100);
        resolve();
      };

      recorder.onerror = () => {
        reject(new Error("Recording failed"));
      };

      recorder.start();

      let frame = 0;

      const renderNext = () => {
        if (frame >= totalFrames) {
          recorder.stop();
          return;
        }

        renderFrameToCanvas(ctx, frame);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && "requestFrame" in videoTrack) {
          (videoTrack as any).requestFrame();
        }

        options.onProgress?.(Math.round(((frame + 1) / totalFrames) * 95));
        frame++;

        setTimeout(renderNext, frameDuration);
      };

      renderNext();
    });
  } finally {
    restoreResolution(ctx.fabricCanvas, saved);
  }
}

// ─── PNG Sequence Export ──────────────────────────────────────────────────────

async function exportAsPngSequence(
  ctx: ExportContext,
  options: ExportOptions
): Promise<void> {
  const { animProject, projectName, nativeWidth, nativeHeight } = ctx;
  const settings = QUALITY_SETTINGS[options.quality];
  const width = Math.round(nativeWidth * settings.scale);
  const height = Math.round(nativeHeight * settings.scale);
  const totalFrames = animProject.totalFrames;
  const padLen = String(totalFrames).length;

  const saved = setExportResolution(ctx.fabricCanvas, width, height, nativeWidth, nativeHeight);

  try {
    const canvasEl = getCanvasElement(ctx.fabricCanvas);
    const blobs: { name: string; blob: Blob }[] = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      renderFrameToCanvas(ctx, frame);

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";
      tempCtx.drawImage(canvasEl, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve) => {
        tempCanvas.toBlob((b) => resolve(b!), "image/png");
      });

      const frameStr = String(frame).padStart(padLen, "0");
      blobs.push({ name: `${projectName}_${frameStr}.png`, blob });

      options.onProgress?.(Math.round(((frame + 1) / totalFrames) * 90));
    }

    if (blobs.length <= 10) {
      for (const { name, blob } of blobs) {
        downloadBlob(blob, name);
      }
    } else {
      downloadBlob(blobs[0].blob, blobs[0].name);
      for (let i = 1; i < blobs.length; i++) {
        await new Promise((r) => setTimeout(r, 100));
        downloadBlob(blobs[i].blob, blobs[i].name);
      }
    }

    options.onProgress?.(100);
  } finally {
    restoreResolution(ctx.fabricCanvas, saved);
  }
}

// ─── Lottie JSON Export ──────────────────────────────────────────────────────

async function exportAsLottie(
  ctx: ExportContext,
  options: ExportOptions
): Promise<void> {
  const { animProject, projectName, nativeWidth, nativeHeight } = ctx;

  options.onProgress?.(30);

  const lottieJson = buildLottieJSON(animProject, nativeWidth, nativeHeight);

  options.onProgress?.(80);

  const jsonStr = JSON.stringify(lottieJson, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  downloadBlob(blob, `${projectName}.json`);

  options.onProgress?.(100);
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function exportAnimation(
  ctx: ExportContext,
  options: ExportOptions
): Promise<void> {
  // Save current frame to restore after export
  const currentObjects = new Map<string, Record<string, any>>();
  ctx.objectMap.forEach((obj, id) => {
    currentObjects.set(id, {
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      opacity: obj.opacity,
    });
  });

  // Optionally clear background for transparent export
  const savedBg = ctx.fabricCanvas.backgroundColor;
  if (options.transparentBg) {
    ctx.fabricCanvas.backgroundColor = "";
    ctx.fabricCanvas.requestRenderAll();
  }

  try {
    switch (options.format) {
      case "gif":
        await exportAsGif(ctx, options);
        break;
      case "webm":
        await exportAsWebM(ctx, options);
        break;
      case "png-sequence":
        await exportAsPngSequence(ctx, options);
        break;
      case "lottie":
        await exportAsLottie(ctx, options);
        break;
    }
  } finally {
    // Restore background color
    if (options.transparentBg) {
      ctx.fabricCanvas.backgroundColor = savedBg;
    }
    // Restore object states
    currentObjects.forEach((props, id) => {
      const obj = ctx.objectMap.get(id);
      if (obj) {
        obj.set(props);
        obj.setCoords();
      }
    });
    ctx.fabricCanvas.requestRenderAll();
  }
}
