import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from 'dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes SVG content to prevent XSS attacks
 * @param svg - The SVG content to sanitize
 * @returns Sanitized SVG content safe for rendering
 */
export function sanitizeSVG(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
  });
}

/**
 * Converts a data URL to a Blob for more reliable downloads
 * @param dataUrl - The data URL to convert
 * @returns Promise resolving to a Blob
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  try {
    // Try fetch first (cleaner for well-formed data URLs)
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (fetchError) {
    // Fallback: manual conversion (more reliable for large data URLs)
    console.warn('Fetch failed, using manual conversion:', fetchError);
    
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid data URL format');
    }
    
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Could not determine MIME type from data URL');
    }
    
    const mime = mimeMatch[1];
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    
    return new Blob([u8arr], { type: mime });
  }
}

/**
 * Downloads a Blob as a file using Object URLs (more reliable than data URLs)
 * @param blob - The Blob to download
 * @param filename - The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Safely downloads a data URL by converting to Blob first
 * @param dataUrl - The data URL to download
 * @param filename - The filename for the download
 */
export async function safeDownloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const blob = await dataUrlToBlob(dataUrl);
  downloadBlob(blob, filename);
}

/**
 * Reloads all images in canvas with CORS to prevent tainting
 * Call this after loadFromJSON to fix export issues
 */
export function reloadCanvasImagesWithCORS(canvas: any): void {
  canvas.getObjects().forEach((obj: any) => {
    if (obj.type === 'image') {
      const src = obj.getSrc?.() || obj.src;
      
      if (!src || src.startsWith('data:')) {
        return; // Skip data URLs
      }

      // Create new image element with CORS enabled
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Preserve position/transform before setElement (it can reset dimensions)
        const props = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          flipX: obj.flipX,
          flipY: obj.flipY,
          opacity: obj.opacity,
          clipPath: obj.clipPath,
        };
        obj.setElement(img);
        obj.set(props);
        obj.setCoords();
        obj.dirty = true;
        if (obj.clipPath) obj.clipPath.dirty = true;
        // Invalidate parent group cache if this image is inside a group
        if (obj.group) (obj.group as any).dirty = true;
        canvas.requestRenderAll();
      };
      
      img.onerror = () => {
        console.warn('Failed to reload image with CORS:', src);
      };
      
      img.src = src;
    }
  });
}

/**
 * Loads an image with proper CORS handling for canvas export compatibility
 * @param src - Image source (data URL or external URL)
 * @returns Promise resolving to loaded Image element
 */
export function loadImageWithCORS(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Set crossOrigin for non-data URLs to enable canvas export
    // Data URLs don't need CORS since they're already embedded
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      // If CORS fails, try again without crossOrigin (but canvas will be tainted)
      if (img.crossOrigin) {
        console.warn('CORS failed, retrying without crossOrigin (export will be disabled)');
        const imgRetry = new Image();
        imgRetry.onload = () => {
          console.warn('Image loaded without CORS - export functionality will not work');
          resolve(imgRetry);
        };
        imgRetry.onerror = reject;
        imgRetry.src = src;
      } else {
        reject(err);
      }
    };
    
    img.src = src;
  });
}
