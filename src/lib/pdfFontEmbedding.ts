/**
 * PDF Font Embedding Module
 * Handles Google Font detection and embedding for PDF exports
 *
 * Note: svg2pdf.js automatically converts text to paths by default,
 * which is the most reliable approach. This module provides font
 * detection for logging and potential future font embedding enhancements.
 */

import { jsPDF } from "jspdf";

/**
 * Google Fonts API base URL
 */
const GOOGLE_FONTS_API_BASE = 'https://fonts.googleapis.com/css2';

/**
 * Fetches font file URL from Google Fonts CSS
 * Returns the URL to the font file (TTF or WOFF2)
 */
export async function fetchGoogleFontUrl(fontFamily: string, weight: number = 400): Promise<string | null> {
  try {
    const fontQuery = fontFamily.replace(/ /g, '+');
    const cssUrl = `${GOOGLE_FONTS_API_BASE}?family=${fontQuery}:wght@${weight}`;

    const response = await fetch(cssUrl);
    const cssText = await response.text();

    // Extract font URL from CSS
    // Google Fonts CSS contains url() declarations with font file URLs
    const urlMatch = cssText.match(/url\((https:\/\/[^)]+\.(?:ttf|woff2))\)/);
    return urlMatch ? urlMatch[1] : null;
  } catch (err) {
    console.error(`Failed to fetch font URL for ${fontFamily}:`, err);
    return null;
  }
}

/**
 * Helper to convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Attempts to download and embed a Google Font into jsPDF
 * Returns true if successful, false otherwise
 *
 * Note: This is experimental and has limitations:
 * - Requires TTF fonts (not all Google Fonts provide TTF)
 * - Font subsetting not automatic
 * - Complex font features may not work
 */
export async function embedGoogleFont(
  pdf: jsPDF,
  fontFamily: string,
  weight: number = 400
): Promise<boolean> {
  try {
    const fontUrl = await fetchGoogleFontUrl(fontFamily, weight);
    if (!fontUrl) return false;

    // Download font file
    const fontResponse = await fetch(fontUrl);
    const fontBlob = await fontResponse.blob();
    const fontBase64 = await blobToBase64(fontBlob);

    // Add font to PDF
    // Note: jsPDF requires specific font format handling
    // This is a simplified version and may need enhancement
    const fontFileName = `${fontFamily.replace(/\s+/g, '')}-${weight}.ttf`;
    pdf.addFileToVFS(fontFileName, fontBase64);
    pdf.addFont(fontFileName, fontFamily, weight === 700 ? 'bold' : 'normal');

    return true;
  } catch (err) {
    console.error(`Failed to embed font ${fontFamily}:`, err);
    return false;
  }
}

/**
 * Embeds all required fonts for PDF export
 * Returns a Map of font names to embedding success status
 */
export async function embedFontsForPDF(
  pdf: jsPDF,
  fontNames: Set<string>
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Embed each font with common weights (regular and bold)
  for (const fontName of fontNames) {
    try {
      // Try to embed regular weight
      const regularSuccess = await embedGoogleFont(pdf, fontName, 400);
      // Try to embed bold weight
      const boldSuccess = await embedGoogleFont(pdf, fontName, 700);

      // Consider successful if at least regular weight worked
      results.set(fontName, regularSuccess);
    } catch (err) {
      console.error(`Error embedding font ${fontName}:`, err);
      results.set(fontName, false);
    }
  }

  return results;
}

/**
 * Information message about font handling in PDFs
 */
export function getFontEmbeddingInfo(usedFonts: Set<string>): string {
  if (usedFonts.size === 0) {
    return 'No text detected in canvas';
  }

  return `Detected ${usedFonts.size} font(s): ${Array.from(usedFonts).join(', ')}. Text will be converted to vector paths for maximum compatibility.`;
}

/**
 * Validates if a font name is likely a Google Font
 * This is a heuristic check based on common system fonts
 */
export function isLikelyGoogleFont(fontFamily: string): boolean {
  const systemFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
    'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Console', 'Tahoma',
    'Lucida Sans Unicode', 'MS Sans Serif', 'MS Serif'
  ];

  const baseFontName = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  return !systemFonts.includes(baseFontName);
}
