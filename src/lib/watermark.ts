// Embedded BioSketch logo (48x48 PNG) as base64 — avoids CORS/network issues
const BIOSKETCH_LOGO_B64 = 'data:image/png;base64,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';

/**
 * Preloads an image and returns it, or null on failure.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Applies a watermark at the bottom of an exported image.
 * Shows the BioSketch logo + "Created and Downloaded from www.biosketch.art" text.
 * Used for community project downloads by non-premium, non-admin users.
 */
export async function applyWatermark(
  dataURL: string,
  outputWidth: number,
  outputHeight: number,
): Promise<string> {
  // Load both the exported image and the embedded logo in parallel
  const [exportedImg, logoImg] = await Promise.all([
    loadImage(dataURL),
    loadImage(BIOSKETCH_LOGO_B64),
  ]);

  if (!exportedImg) return dataURL;

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw the exported image
  ctx.drawImage(exportedImg, 0, 0, outputWidth, outputHeight);

  // Calculate watermark dimensions
  const baseFontSize = Math.max(14, Math.min(outputWidth, outputHeight) * 0.028);
  const logoSize = Math.max(24, Math.min(outputWidth, outputHeight) * 0.05);
  const padding = baseFontSize * 0.8;
  const bottomY = outputHeight - padding;

  ctx.save();
  ctx.globalAlpha = 0.25;

  // Draw logo to the left of the text at the bottom
  const text = 'Created and Downloaded from www.biosketch.art';
  ctx.font = `600 ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;

  const totalWidth = (logoImg ? logoSize + baseFontSize * 0.5 : 0) + textWidth;
  const startX = (outputWidth - totalWidth) / 2;

  if (logoImg) {
    const logoX = startX;
    const logoY = bottomY - logoSize;
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
  }

  // Draw text
  const textX = startX + (logoImg ? logoSize + baseFontSize * 0.5 : 0);
  const textY = bottomY - logoSize / 2;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textX, textY);

  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Injects a watermark into an SVG string at the bottom.
 */
export function applyWatermarkToSVG(svgString: string, width: number, height: number): string {
  const fontSize = Math.max(14, Math.min(width, height) * 0.028);
  const centerX = width / 2;
  const bottomY = height - fontSize * 0.8;
  const logoUrl = BIOSKETCH_LOGO_B64;
  const logoSize = Math.max(24, Math.min(width, height) * 0.05);

  const watermarkElements = `
  <g opacity="0.25">
    <image href="${logoUrl}" x="${centerX - fontSize * 5 - logoSize}" y="${bottomY - logoSize}"
           width="${logoSize}" height="${logoSize}" />
    <text x="${centerX - fontSize * 5 + logoSize * 1.3}" y="${bottomY - logoSize / 2}"
          dominant-baseline="central"
          font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
          font-size="${fontSize}" font-weight="600" fill="#000000">
      Created and Downloaded from www.biosketch.art
    </text>
  </g>`;

  // Insert before the closing </svg> tag
  return svgString.replace('</svg>', `${watermarkElements}\n</svg>`);
}
