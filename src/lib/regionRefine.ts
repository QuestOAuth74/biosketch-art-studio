/**
 * Client-side helpers for the region-select (inpainting) refine flow.
 *
 * Supports two selection tools:
 *   - Rectangle: `buildRectMaskPng(sourceUrl, box)`
 *   - Freeform pen: `buildFreeformMaskPng(sourceUrl, points)`
 *
 * Both return a same-size PNG (white=edit, black=preserve) sent to the edge
 * function alongside the source image.
 *
 * `compositeWithMask` uses the mask PNG directly to blend AI output back onto
 * the original, so pixels outside the selection stay pixel-exact even if
 * Gemini drifts. A small feather at the mask edge hides seams.
 */

export interface MaskBox {
  /** All values in ORIGINAL image pixel coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Pre-erase a rect region of an image with the sampled background color,
 * returning a new data URL. Used by the text-edit flow to hand Gemini a
 * cleaned canvas — the image-preview model preserves existing content by
 * default when given a mask, so leaving the OLD text visible means "replace"
 * often becomes "keep as-is". Erasing first turns the ambiguous "replace X
 * with Y" task into an unambiguous "draw Y here" task.
 *
 * The background color is sampled from a ring of `ringPx` pixels immediately
 * outside the box, averaged. Falls back to pure white when there's no
 * sampleable ring (box touches every edge, degenerate cases).
 */
export async function eraseBoxToBackground(
  sourceImageUrl: string,
  box: MaskBox,
  ringPx: number = 10,
): Promise<string> {
  const img = await loadImage(sourceImageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');
  ctx.drawImage(img, 0, 0);

  // Sample a ring outside the box; average RGB. One getImageData for the
  // whole rect-plus-ring is much cheaper than per-pixel reads.
  const bx = Math.max(0, Math.min(w, box.x));
  const by = Math.max(0, Math.min(h, box.y));
  const bw = Math.max(0, Math.min(w - bx, box.w));
  const bh = Math.max(0, Math.min(h - by, box.h));

  const sampleX = Math.max(0, bx - ringPx);
  const sampleY = Math.max(0, by - ringPx);
  const sampleW = Math.min(w - sampleX, bw + 2 * ringPx);
  const sampleH = Math.min(h - sampleY, bh + 2 * ringPx);

  let fillStyle = '#FFFFFF';
  if (sampleW > 0 && sampleH > 0) {
    const region = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
    const px = region.data;
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let py = 0; py < sampleH; py++) {
      const absY = sampleY + py;
      const rowBase = py * sampleW * 4;
      for (let cx = 0; cx < sampleW; cx++) {
        const absX = sampleX + cx;
        // Skip pixels inside the box — we want ring-only.
        if (absX >= bx && absX < bx + bw && absY >= by && absY < by + bh) continue;
        const i = rowBase + cx * 4;
        rSum += px[i];
        gSum += px[i + 1];
        bSum += px[i + 2];
        count++;
      }
    }
    if (count > 0) {
      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      fillStyle = `rgb(${r}, ${g}, ${b})`;
    }
  }

  if (bw > 0 && bh > 0) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(bx, by, bw, bh);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Rectangle mask: `box` in image pixel coords filled white on black.
 */
export async function buildRectMaskPng(sourceImageUrl: string, box: MaskBox): Promise<string> {
  const img = await loadImage(sourceImageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const bx = Math.max(0, Math.min(w, box.x));
  const by = Math.max(0, Math.min(h, box.y));
  const bw = Math.max(0, Math.min(w - bx, box.w));
  const bh = Math.max(0, Math.min(h - by, box.h));
  if (bw > 0 && bh > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx, by, bw, bh);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Freeform mask: `points` in image pixel coords, treated as a closed polygon
 * and filled white on black. The path is auto-closed so the caller doesn't
 * need to repeat the first point at the end.
 */
export async function buildFreeformMaskPng(sourceImageUrl: string, points: Point[]): Promise<string> {
  const img = await loadImage(sourceImageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  if (points.length >= 3) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Convert a normalized [x0,y0,x1,y1] region (0..1 floats, top-left origin) to
 * a MaskBox in the source image's pixel coordinates. Used by the planner-
 * driven auto-mask path: the planner returns a normalized bbox so it doesn't
 * need to know the exact image dims, and the client scales it here.
 */
export async function regionFromNormalized(
  sourceImageUrl: string,
  region: { x0: number; y0: number; x1: number; y1: number },
): Promise<MaskBox> {
  const img = await loadImage(sourceImageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const x0 = Math.max(0, Math.min(1, region.x0));
  const y0 = Math.max(0, Math.min(1, region.y0));
  const x1 = Math.max(0, Math.min(1, region.x1));
  const y1 = Math.max(0, Math.min(1, region.y1));
  const x = Math.round(x0 * w);
  const y = Math.round(y0 * h);
  const bw = Math.max(1, Math.round((x1 - x0) * w));
  const bh = Math.max(1, Math.round((y1 - y0) * h));
  return { x, y, w: bw, h: bh };
}

/**
 * Bounding box for an array of points. Used for the composite guard so we
 * only iterate over pixels that could possibly be inside the mask.
 */
export function pointsBounds(points: Point[]): MaskBox {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x, minY = points[0].y, maxX = minX, maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Composite the AI-returned image with the original using a mask PNG.
 * White mask pixels take the refined image; black mask pixels take the
 * original. A `featherPx` band inside the white area blends linearly so the
 * seam disappears.
 *
 * If the refined image has different dimensions than the original (which
 * Gemini sometimes does), we scale it to fit the original's canvas.
 */
export async function compositeWithMask(
  originalUrl: string,
  refinedUrl: string,
  maskUrl: string,
  featherPx = 3,
): Promise<string> {
  const [orig, refined, mask] = await Promise.all([
    loadImage(originalUrl),
    loadImage(refinedUrl),
    loadImage(maskUrl),
  ]);

  const w = orig.naturalWidth;
  const h = orig.naturalHeight;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Could not get output 2D context');
  outCtx.drawImage(orig, 0, 0);

  const refCanvas = document.createElement('canvas');
  refCanvas.width = w;
  refCanvas.height = h;
  const refCtx = refCanvas.getContext('2d')!;
  refCtx.drawImage(refined, 0, 0, w, h); // Scale-to-fit

  // Mask image should already be same-size; scale defensively.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.drawImage(mask, 0, 0, w, h);

  // Optional feather: shrink white area by featherPx via a 2nd copy of the
  // mask that's eroded. We approximate erosion by drawing the mask with a
  // slight blur and re-thresholding — cheap and good enough for smooth edges.
  // Instead, we do a per-pixel alpha ramp based on distance-to-nearest-black,
  // which we approximate by sampling the mask alpha at multiple offsets.

  const baseData = outCtx.getImageData(0, 0, w, h);
  const refinedData = refCtx.getImageData(0, 0, w, h);
  const maskData = maskCtx.getImageData(0, 0, w, h);
  const out = baseData.data;
  const src = refinedData.data;
  const mData = maskData.data;

  const f = Math.max(0, featherPx | 0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mi = (y * w + x) * 4;
      // Mask "whiteness" 0..1 (all channels similar; sample red).
      const m = mData[mi] / 255;
      if (m <= 0.02) continue; // Fully black → keep original (already there).

      let alpha = m;
      if (f > 0 && m > 0.98) {
        // Feather: check the nearest black pixel within `f` in a small
        // cardinal-and-diagonal sample. Cheaper than a full distance transform.
        let minDist = f + 1;
        for (let dy = -f; dy <= f; dy++) {
          for (let dx = -f; dx <= f; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nmi = (ny * w + nx) * 4;
            if (mData[nmi] / 255 <= 0.5) {
              const d = Math.max(Math.abs(dx), Math.abs(dy));
              if (d < minDist) minDist = d;
            }
          }
        }
        if (minDist <= f) {
          alpha = Math.min(1, minDist / f);
        }
      }
      const invAlpha = 1 - alpha;
      const i = (y * w + x) * 4;
      out[i    ] = src[i    ] * alpha + out[i    ] * invAlpha;
      out[i + 1] = src[i + 1] * alpha + out[i + 1] * invAlpha;
      out[i + 2] = src[i + 2] * alpha + out[i + 2] * invAlpha;
    }
  }

  outCtx.putImageData(baseData, 0, 0);
  return outCanvas.toDataURL('image/png');
}
