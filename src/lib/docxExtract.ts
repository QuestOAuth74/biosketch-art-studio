/**
 * Client-side .docx extraction for the AI Illustrator's Poster-from-doc mode.
 *
 * Uses mammoth to pull raw text + embedded images out of a Word doc. We do
 * this in the browser (not the edge function) because:
 *   1. Deno .docx libs are thin and less battle-tested than mammoth.
 *   2. We can show extraction results before spending any AI credit.
 *   3. Keeps the edge function payload small — we only send text + tiny
 *      image summaries to the planner, not the raw .docx bytes.
 *
 * Section detection: any line that looks like a Word heading style (short,
 * title-cased, no trailing period) is treated as a section boundary. This is
 * heuristic but reliable enough for scientific manuscripts, which almost
 * always use Word headings for INTRODUCTION / METHODS / RESULTS / etc.
 */

import mammoth from 'mammoth';

export interface ExtractedDocImage {
  /** Data URL of the embedded image (mimeType inline). */
  dataUrl: string;
  /** Best-effort caption pulled from the paragraph after the image, if any. */
  caption?: string;
}

export interface ExtractedDoc {
  fileName: string;
  fileSizeBytes: number;
  /** Full concatenated body text. */
  text: string;
  wordCount: number;
  /** Detected top-level headings in reading order (may be [] if the doc uses no styles). */
  sections: string[];
  /** Embedded raster images in reading order. */
  images: ExtractedDocImage[];
  /** Non-fatal messages surfaced from mammoth (e.g. unsupported style dropped). */
  warnings: string[];
}

/**
 * Extract text, sections, and embedded images from a .docx File.
 * Throws if the file is not a valid .docx.
 */
export async function extractDocx(file: File): Promise<ExtractedDoc> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Only .docx files are supported.');
  }
  const arrayBuffer = await file.arrayBuffer();

  // Collect embedded images. mammoth invokes convertImage per image and
  // expects HTML attrs back — we return an empty src so the emitted HTML
  // stays clean, and separately keep the data URL in our own list.
  const images: ExtractedDocImage[] = [];
  const imageHandler = mammoth.images.imgElement(async (image) => {
    const buffer = await image.read('base64');
    images.push({ dataUrl: `data:${image.contentType};base64,${buffer}` });
    return { src: '' };
  });

  // convertToHtml surfaces heading tags — cheaper to detect sections here
  // than in raw text mode.
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { convertImage: imageHandler },
  );

  const warnings = (result.messages ?? [])
    .filter((m: any) => m.type === 'warning' || m.type === 'error')
    .map((m: any) => m.message)
    .slice(0, 6);

  // Pull headings out of the HTML — Word's Heading 1 / Heading 2 styles map
  // to <h1>/<h2> under mammoth's default conversion. We deduplicate + trim.
  const sections: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(result.value)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (text.length > 0 && text.length < 120 && !sections.includes(text)) {
      sections.push(text);
    }
  }

  // Get clean plain text separately for the word count + planner payload.
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  const text = textResult.value.replace(/\r\n/g, '\n').trim();
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).length;

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    text,
    wordCount,
    sections,
    images,
    warnings,
  };
}
