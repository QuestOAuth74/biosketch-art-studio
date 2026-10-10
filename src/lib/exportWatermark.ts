import { Text as FabricText, type Canvas as FabricCanvas } from 'fabric';

const WATERMARK_ID = '__biosketch_watermark__';

/**
 * Temporarily inject a corner watermark into the canvas, run the export,
 * then remove the watermark. Only applies if `enabled` is true.
 */
export async function withExportWatermark<T>(
  canvas: FabricCanvas,
  enabled: boolean,
  run: () => Promise<T> | T,
): Promise<T> {
  if (!enabled) return await run();

  const width = canvas.getWidth();
  const height = canvas.getHeight();

  const mark = new FabricText('Made with Biosketch.Art Studio', {
    fontSize: Math.max(12, Math.min(width, height) * 0.018),
    fill: 'rgba(0, 0, 0, 0.4)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    selectable: false,
    evented: false,
    excludeFromExport: false,
  }) as any;
  mark[WATERMARK_ID] = true;

  // Position bottom-right with a small margin.
  const margin = Math.max(8, Math.min(width, height) * 0.012);
  mark.set({
    left: width - mark.width! - margin,
    top: height - mark.height! - margin,
  });

  canvas.add(mark);
  canvas.renderAll();

  try {
    return await run();
  } finally {
    const existing = canvas.getObjects().filter((o: any) => o[WATERMARK_ID]);
    existing.forEach((o) => canvas.remove(o));
    canvas.renderAll();
  }
}
