/**
 * Any-figure → PowerPoint (.pptx) export.
 *
 * Kept deliberately simple: one slide, one image, no OCR, no text overlays,
 * no whitening, no editable text boxes. The user gets a plain slide that
 * matches the aspect ratio of the source image and drops it straight into
 * their deck. Anything else (retyping labels, moving elements) happens in
 * PowerPoint itself using standard tools.
 *
 * The earlier version tried to OCR the raster + overlay editable text
 * boxes. That approach produced too many failure modes (mismatched
 * background patches, misread labels, jagged drift) for the win it gave.
 * If in-place label editing is ever needed again, the Edit Text feature
 * on the AI Illustrator canvas covers that use case directly.
 */

interface FigurePptxInput {
  imageDataUrl: string;
  /** Optional filename override; defaults to biosketch-figure.pptx. */
  filename?: string;
}

/**
 * Load an image data URL into an HTMLImageElement so we can read its
 * natural dimensions and sit the slide at the correct aspect ratio.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for PPT export'));
    img.src = dataUrl;
  });
}

/**
 * Slug a filename fragment for saving. Keeps it short + ASCII-safe.
 */
function slugFilename(hint: string): string {
  const safe = hint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  return safe || 'biosketch-figure';
}

/**
 * Build and download a single-slide .pptx containing the given image.
 * Returns the filename that was saved so callers can toast.
 */
export async function buildFigurePptx({
  imageDataUrl,
  filename,
}: FigurePptxInput): Promise<string> {
  const PptxGenModule = await import('pptxgenjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGenJS = (PptxGenModule as any).default ?? PptxGenModule;

  const img = await loadImage(imageDataUrl);
  const aspect = img.naturalWidth / img.naturalHeight;

  // Slide dimensions in inches. Match the image aspect so it fills the slide
  // without letterboxing. Cap the long side at 13.33 in (PowerPoint
  // widescreen width) — plenty for any figure, stays under PPT's 56-in limit.
  const LONG = 13.33;
  const slideW = aspect >= 1 ? LONG : LONG * aspect;
  const slideH = aspect >= 1 ? LONG / aspect : LONG;

  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'FIGURE', width: slideW, height: slideH });
  pres.layout = 'FIGURE';
  pres.title = filename ?? 'BioSketch figure';
  pres.author = 'BioSketch AI';

  const slide = pres.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addImage({
    data: imageDataUrl,
    x: 0, y: 0, w: slideW, h: slideH,
  });

  const finalName = filename ?? `${slugFilename('figure')}.pptx`;
  await pres.writeFile({ fileName: finalName });
  return finalName;
}
