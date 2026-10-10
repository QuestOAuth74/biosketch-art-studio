/**
 * Vectorize a raster PNG image into true SVG vector paths using imagetracerjs.
 *
 * This converts a PNG data URL into an SVG with real <path> elements,
 * making the icon infinitely scalable without quality loss.
 */

// imagetracerjs exports a singleton ImageTracer instance via module.exports
// eslint-disable-next-line @typescript-eslint/no-var-requires
let tracerInstance: any = null;

async function loadTracer(): Promise<any> {
  if (tracerInstance) return tracerInstance;
  const mod = await import('imagetracerjs');
  // Vite may wrap CJS as { default: ... } or pass through directly
  tracerInstance = (mod as any).default || mod;
  return tracerInstance;
}

/**
 * Get ImageData from a PNG data URL by drawing it to a canvas.
 */
function getImageData(dataUrl: string, targetSize: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Scale to target size for tracing (higher = more detail, slower)
      const scale = targetSize / Math.max(w, h);
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, tw, th);
      resolve(ctx.getImageData(0, 0, tw, th));
    };
    img.onerror = () => reject(new Error('Failed to load image for vectorization'));
    img.src = dataUrl;
  });
}

export interface VectorizeOptions {
  /** Number of colors to quantize to (more = more detail, larger SVG). Default: 32 */
  numberOfColors?: number;
  /** Trace resolution size in px (image is scaled to this before tracing). Default: 1024 */
  traceResolution?: number;
  /** Minimum path size to keep (0 = keep all). Default: 0 */
  pathOmit?: number;
  /** Line threshold (lower = smoother curves). Default: 0.5 */
  lineThreshold?: number;
  /** Quadratic spline threshold (lower = smoother). Default: 0.5 */
  quadThreshold?: number;
  /** Blur radius for noise reduction before tracing. Default: 0 */
  blurRadius?: number;
}

/**
 * Vectorize a PNG data URL into an SVG string with real vector paths.
 *
 * @param pngDataUrl - The PNG image as a data URL
 * @param options - Vectorization quality options
 * @returns SVG string with true vector paths
 */
export async function vectorizeImage(
  pngDataUrl: string,
  options: VectorizeOptions = {}
): Promise<string> {
  const {
    numberOfColors = 32,
    traceResolution = 1024,
    pathOmit = 0,
    lineThreshold = 0.5,
    quadThreshold = 0.5,
    blurRadius = 0,
  } = options;

  const ImageTracer = await loadTracer();

  // Get pixel data at trace resolution
  const imgData = await getImageData(pngDataUrl, traceResolution);

  // Trace with high-quality settings
  const tracerOptions = {
    // Tracing — smooth curves
    ltres: lineThreshold,
    qtres: quadThreshold,
    pathomit: pathOmit,
    rightangleenhance: true,
    corsenabled: false,

    // Color quantization — enough colors for scientific icons
    colorsampling: 2,
    numberofcolors: numberOfColors,
    mincolorratio: 0,
    colorquantcycles: 4,

    // Layering — sequential for clean overlapping regions
    layering: 0,

    // SVG rendering — high precision
    strokewidth: 0,
    linefilter: false,
    scale: 1,
    roundcoords: 3, // 3 decimal places for smooth curves
    viewbox: true,
    desc: false,
    lcpr: 0,
    qcpr: 0,

    // Noise reduction
    blurradius: blurRadius,
    blurdelta: 20,
  };

  // imagedataToSVG expects {width, height, data} — standard ImageData shape
  let svgString: string = ImageTracer.imagedataToSVG(imgData, tracerOptions);

  // Add shape-rendering for crisp display
  if (!svgString.includes('shape-rendering')) {
    svgString = svgString.replace('<svg', '<svg shape-rendering="geometricPrecision"');
  }

  // Ensure xmlns is present
  if (!svgString.includes('xmlns=')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svgString;
}
