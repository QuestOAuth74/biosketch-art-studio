/**
 * Thumbnail Generation Utility
 *
 * Generates optimized PNG thumbnails from full SVG content.
 * Target size: 5-20 KB (vs 200-300 KB for full SVGs)
 *
 * Approach:
 * - Render SVG to canvas at thumbnail size (128x128px)
 * - Transparent background (preserves SVG transparency)
 * - Convert canvas to PNG data URL
 * - PNG compression works much better than text-based SVG optimization
 * - Guarantees small size regardless of SVG complexity
 */

/**
 * Generate PNG thumbnail from SVG content or external image reference
 *
 * Handles two cases:
 * 1. SVG with external <image> tag: Extracts and loads the image URL directly
 * 2. Regular SVG: Renders SVG to canvas
 *
 * @param svgContent - Full SVG content string
 * @param maxSize - Maximum dimension (width/height) for thumbnail in pixels
 * @returns PNG data URL suitable for thumbnail storage
 */
export async function generateCompressedThumbnail(svgContent: string, maxSize: number = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Check if input is already a PNG data URL
      if (svgContent.startsWith('data:image/png')) {
        // Load the PNG and resize it
        const img = new Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = maxSize;
            canvas.height = maxSize;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            // Calculate scaled dimensions
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (maxSize - scaledWidth) / 2;
            const y = (maxSize - scaledHeight) / 2;

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            const pngDataUrl = canvas.toDataURL('image/png', 0.8);
            resolve(pngDataUrl);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load PNG data URL'));
        };

        img.src = svgContent;
        return;
      }

      // Check if SVG contains external <image> tag
      const hasExternalImage = svgContent.includes('<image') && svgContent.includes('href=');

      if (hasExternalImage) {
        // Extract image URL from SVG
        const hrefMatch = svgContent.match(/href\s*=\s*["']([^"']+)["']/);
        if (hrefMatch) {
          const imageUrl = hrefMatch[1];

          // Load the external image directly
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Handle CORS

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = maxSize;
              canvas.height = maxSize;
              const ctx = canvas.getContext('2d');

              if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
              }

              // Calculate scaled dimensions
              const scale = Math.min(maxSize / img.width, maxSize / img.height);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const x = (maxSize - scaledWidth) / 2;
              const y = (maxSize - scaledHeight) / 2;

              ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
              const pngDataUrl = canvas.toDataURL('image/png', 0.8);
              resolve(pngDataUrl);
            } catch (error) {
              reject(error);
            }
          };

          img.onerror = () => {
            reject(new Error('Failed to load external image from SVG'));
          };

          img.src = imageUrl;
          return;
        }
      }

      // Regular SVG rendering (original code)
      // Clean SVG content
      let cleanedSvg = svgContent
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .trim();

      // Create a Blob from SVG
      const svgBlob = new Blob([cleanedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Create image element
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Canvas has transparent background by default - no fill needed

          // Calculate aspect ratio to fit SVG within canvas
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (maxSize - scaledWidth) / 2;
          const y = (maxSize - scaledHeight) / 2;

          // Draw SVG onto canvas
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

          // Convert canvas to PNG data URL
          const pngDataUrl = canvas.toDataURL('image/png', 0.8); // 0.8 quality for smaller size

          URL.revokeObjectURL(url);
          resolve(pngDataUrl);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Calculate approximate size of content (SVG string or data URL) in KB
 * @param content - SVG content string or PNG data URL
 * @returns Size in kilobytes
 */
export function calculateSvgSize(content: string): number {
  // If it's a data URL, calculate the actual data size
  if (content.startsWith('data:')) {
    // Remove data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = content.split(',')[1] || content;
    // Base64 encoded size is ~1.37x actual size, decode to get real size
    const actualSize = (base64Data.length * 3) / 4;
    return actualSize / 1024;
  }

  // For SVG strings, use Blob size
  return new Blob([content]).size / 1024;
}

/**
 * Validate that thumbnail size is within acceptable range
 * @param thumbnail - Thumbnail content (SVG or PNG data URL)
 * @param maxSizeKB - Maximum allowed size in KB (default 50)
 * @returns true if size is acceptable, false otherwise
 */
export function validateThumbnailSize(thumbnail: string, maxSizeKB: number = 50): boolean {
  const size = calculateSvgSize(thumbnail);
  return size <= maxSizeKB;
}
