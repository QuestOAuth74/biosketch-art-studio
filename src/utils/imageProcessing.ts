/**
 * Remove white background from an image using flood-fill from edges.
 * Returns a PNG data URL with transparent background.
 */
export function removeWhiteBackground(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      const WHITE_THRESHOLD = 235;

      const isWhitish = (idx: number) =>
        d[idx] > WHITE_THRESHOLD && d[idx + 1] > WHITE_THRESHOLD && d[idx + 2] > WHITE_THRESHOLD;

      const visited = new Uint8Array(w * h);
      const queue: number[] = [];

      for (let x = 0; x < w; x++) {
        if (isWhitish(x * 4)) queue.push(x);
        if (isWhitish(((h - 1) * w + x) * 4)) queue.push((h - 1) * w + x);
      }
      for (let y = 1; y < h - 1; y++) {
        if (isWhitish((y * w) * 4)) queue.push(y * w);
        if (isWhitish((y * w + w - 1) * 4)) queue.push(y * w + w - 1);
      }

      while (queue.length > 0) {
        const pos = queue.pop()!;
        if (visited[pos]) continue;
        visited[pos] = 1;
        const idx = pos * 4;
        if (!isWhitish(idx)) continue;
        d[idx + 3] = 0;
        const x = pos % w;
        const y = (pos - x) / w;
        if (x > 0) queue.push(pos - 1);
        if (x < w - 1) queue.push(pos + 1);
        if (y > 0) queue.push(pos - w);
        if (y < h - 1) queue.push(pos + w);
      }

      // Anti-alias edges
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pos = y * w + x;
          const idx = pos * 4;
          if (d[idx + 3] === 0) continue;
          let removedNeighbors = 0;
          const neighbors = [pos - 1, pos + 1, pos - w, pos + w, pos - w - 1, pos - w + 1, pos + w - 1, pos + w + 1];
          for (const n of neighbors) {
            if (n >= 0 && n < w * h && visited[n]) removedNeighbors++;
          }
          if (removedNeighbors > 0) {
            const brightness = (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
            if (brightness > 200) {
              const alpha = Math.round(255 * (1 - (brightness - 200) / 55));
              d[idx + 3] = Math.max(0, Math.min(d[idx + 3], alpha));
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
}

/**
 * Upscale image by 2x with unsharp mask sharpening and saturation boost.
 * Returns a PNG data URL.
 */
export function upscaleImage(dataUrl: string, scale: number = 2): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const dstW = srcW * scale;
      const dstH = srcH * scale;

      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, dstW, dstH);

      const imageData = ctx.getImageData(0, 0, dstW, dstH);
      const src = imageData.data;

      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = dstW;
      blurCanvas.height = dstH;
      const blurCtx = blurCanvas.getContext("2d")!;
      blurCtx.filter = "blur(1px)";
      blurCtx.drawImage(canvas, 0, 0);
      const blurData = blurCtx.getImageData(0, 0, dstW, dstH).data;

      const strength = 0.6;
      for (let i = 0; i < src.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const diff = src[i + c] - blurData[i + c];
          src[i + c] = Math.max(0, Math.min(255, Math.round(src[i + c] + strength * diff)));
        }
        const r = src[i], g = src[i + 1], b = src[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const satBoost = 1.15;
        src[i]     = Math.max(0, Math.min(255, Math.round(gray + satBoost * (r - gray))));
        src[i + 1] = Math.max(0, Math.min(255, Math.round(gray + satBoost * (g - gray))));
        src[i + 2] = Math.max(0, Math.min(255, Math.round(gray + satBoost * (b - gray))));
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}
