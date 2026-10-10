import { Canvas, Image as FabricImage, Rect, ActiveSelection, util, Point } from "fabric";
import { supabase } from "@/integrations/supabase/client";

// ── imageObjectExtraction ─────────────────────────────────────────────────────
// Client-side wiring for the `segment-image-objects` Edge Function.
//   - Sends the selected FabricImage to the server for per-object segmentation
//     (Gemini 2.5 Pro native masks).
//   - On success, replaces the image with one Fabric image per detected object
//     (each masked to a transparent PNG) so the user can grab/move/resize them
//     individually. A white plate is placed underneath so the area where the
//     original sat doesn't become an empty hole.
//
//   AI-illustrator outputs are on light backgrounds by the system's style rules,
//   so the white plate is visually faithful for nearly all generations. For
//   non-white-bg images we could later swap to a Gemini inpaint pass.

export interface SegmentedRegion {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mask: string; // raw base64 PNG, sized to bbox
}

export interface ExtractObjectsResult {
  regionCount: number;
}

interface HistoryHandle {
  beginTransaction: (canvas?: Canvas) => void;
  commitTransaction: (canvas?: Canvas) => void;
}

export async function extractAndReplaceImageObjects(
  canvas: Canvas,
  image: FabricImage,
  history: HistoryHandle,
): Promise<ExtractObjectsResult> {
  const transform = {
    left: image.left ?? 0,
    top: image.top ?? 0,
    scaleX: image.scaleX ?? 1,
    scaleY: image.scaleY ?? 1,
    angle: image.angle ?? 0,
    originX: image.originX ?? "left",
    originY: image.originY ?? "top",
  };
  const matrix = image.calcTransformMatrix();
  const naturalW = image.width || 0;
  const naturalH = image.height || 0;

  const imageDataUrl = (image as unknown as { toDataURL: (o: { format: string; multiplier: number }) => string })
    .toDataURL({ format: "png", multiplier: 1 });

  const { data, error } = await supabase.functions.invoke("segment-image-objects", {
    body: { imageDataUrl },
  });
  if (error) {
    let detail = error.message || "";
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context?.json?.();
      if (body?.error) detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail || "Segmentation failed");
  }
  if (!data?.success) throw new Error(data?.error || "Segmentation failed");

  const regions: SegmentedRegion[] = data.regions || [];
  if (regions.length === 0) {
    return { regionCount: 0 };
  }

  // Build a HTMLImageElement of the source so we can crop per region in-browser.
  const sourceImg = await loadImage(imageDataUrl);

  const layerImages: FabricImage[] = [];
  for (const r of regions) {
    const transparentDataUrl = await buildMaskedRegionPng(sourceImg, r);
    if (!transparentDataUrl) continue;

    const layer = await FabricImage.fromURL(transparentDataUrl, { crossOrigin: "anonymous" });

    // Region (r.x, r.y) is the top-left of the bbox in source-image pixel space.
    // Map it through the original image's transform matrix so the layer lands in
    // the same world location, scaled / rotated consistently.
    const localX = r.x - naturalW / 2;
    const localY = r.y - naturalH / 2;
    const worldTopLeft = util.transformPoint(new Point(localX, localY), matrix);

    layer.set({
      left: worldTopLeft.x,
      top: worldTopLeft.y,
      scaleX: Math.abs(transform.scaleX),
      scaleY: Math.abs(transform.scaleY),
      angle: transform.angle,
      originX: "left",
      originY: "top",
    });
    // Tag the Fabric object with the semantic label so it shows up nicely in
    // the layers panel and so we can identify these later.
    (layer as unknown as { name?: string; isExtractedObject?: boolean }).name = r.label;
    (layer as unknown as { isExtractedObject?: boolean }).isExtractedObject = true;
    layer.setCoords();
    layerImages.push(layer);
  }

  if (layerImages.length === 0) {
    return { regionCount: 0 };
  }

  history.beginTransaction(canvas);
  try {
    // White plate where the original image sat — keeps the area visually filled
    // when an object is moved off its starting position.
    const plateLocal = util.transformPoint(new Point(-naturalW / 2, -naturalH / 2), matrix);
    const plate = new Rect({
      left: plateLocal.x,
      top: plateLocal.y,
      width: naturalW * Math.abs(transform.scaleX),
      height: naturalH * Math.abs(transform.scaleY),
      fill: "#ffffff",
      stroke: undefined,
      angle: transform.angle,
      originX: "left",
      originY: "top",
      selectable: true,
      objectCaching: false,
    });
    (plate as unknown as { isExtractedObjectPlate?: boolean }).isExtractedObjectPlate = true;

    canvas.remove(image);
    canvas.add(plate);
    layerImages.forEach((l) => canvas.add(l));

    // Select all the new layers so the user immediately sees what changed.
    if (layerImages.length === 1) {
      canvas.setActiveObject(layerImages[0]);
    } else {
      canvas.setActiveObject(new ActiveSelection(layerImages, { canvas }));
    }
    canvas.requestRenderAll();
  } finally {
    history.commitTransaction(canvas);
  }

  return { regionCount: layerImages.length };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load source image"));
    img.src = src;
  });
}

async function buildMaskedRegionPng(
  source: HTMLImageElement,
  region: SegmentedRegion,
): Promise<string | null> {
  const { x, y, w, h, mask } = region;

  // Decode the mask PNG (sized to the bbox).
  const maskImg = await loadImage("data:image/png;base64," + mask).catch(() => null);
  if (!maskImg) return null;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // Step 1: draw the cropped source region into the output.
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);

  // Step 2: use the mask as an alpha channel. We rasterize the mask onto a
  // hidden canvas at the same dims, then read its red channel as the alpha.
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d");
  if (!mctx) return null;
  mctx.drawImage(maskImg, 0, 0, w, h);
  const maskData = mctx.getImageData(0, 0, w, h);
  const outData = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < outData.data.length; i += 4) {
    // Mask pixel: use the red channel as a probability — Gemini emits the mask
    // as either a binary single-channel PNG (R=G=B=255 inside) or an alpha PNG.
    // Multiplying by alpha handles both.
    const mr = maskData.data[i];
    const ma = maskData.data[i + 3];
    const inside = Math.min(255, mr) * (ma / 255);
    outData.data[i + 3] = Math.round((outData.data[i + 3] * inside) / 255);
  }
  ctx.putImageData(outData, 0, 0);

  return out.toDataURL("image/png");
}
