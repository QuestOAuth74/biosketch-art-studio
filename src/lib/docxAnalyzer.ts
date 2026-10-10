import JSZip from 'jszip';

export interface DocxPreviewData {
  estimatedSlides: number;
  imageCount: number;
  images: Array<{ filename: string; thumbnail?: string }>;
  formatting: {
    headings: number;
    bullets: number;
    numberedLists: number;
    boldText: boolean;
    italicText: boolean;
    underlineText: boolean;
  };
  contentPreview: string;
}

export async function analyzeDocx(file: File): Promise<DocxPreviewData> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Extract document.xml
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) {
    throw new Error('Invalid DOCX file - document.xml not found');
  }

  // Extract images
  const mediaFiles = zip.file(/^word\/media\//);
  const images: Array<{ filename: string; thumbnail?: string }> = [];
  
  for (const file of mediaFiles) {
    const filename = file.name.split('/').pop();
    if (!filename) continue;
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)) {
      // Generate thumbnail
      try {
        const imageData = await file.async('blob');
        const url = URL.createObjectURL(imageData);
        images.push({ filename, thumbnail: url });
      } catch {
        images.push({ filename });
      }
    }
  }

  // Parse XML for content analysis
  const paragraphs = docXml.split('</w:p>');
  
  let headings = 0;
  let bullets = 0;
  let numberedLists = 0;
  let boldText = false;
  let italicText = false;
  let underlineText = false;
  let contentPreview = '';
  let previewLines = 0;

  for (const para of paragraphs) {
    if (!para.includes('<w:t>')) continue;

    // Check for heading styles
    const isHeading = para.includes('w:val="Heading1"') || 
                     para.includes('w:val="Heading2"') ||
                     para.includes('w:val="Heading3"') ||
                     para.includes('w:val="heading 1"') ||
                     para.includes('w:val="heading 2"') ||
                     para.includes('w:val="heading 3"');
    
    if (isHeading) headings++;

    // Check for lists
    const hasNumbering = para.includes('<w:numPr>');
    const numIdMatch = para.match(/<w:numId w:val="(\d+)"\/>/);
    
    if (hasNumbering) {
      const isNumbered = numIdMatch && parseInt(numIdMatch[1]) > 0;
      if (isNumbered) {
        numberedLists++;
      } else {
        bullets++;
      }
    }

    // Check for text formatting
    if (para.includes('<w:b/>') || para.includes('<w:b ')) boldText = true;
    if (para.includes('<w:i/>') || para.includes('<w:i ')) italicText = true;
    if (para.includes('<w:u ')) underlineText = true;

    // Build content preview (first 10 lines)
    if (previewLines < 10) {
      const textMatches = para.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      const text = textMatches
        .map(m => m.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1'))
        .join('');
      
      if (text.trim()) {
        const prefix = isHeading ? '# ' : hasNumbering ? '• ' : '';
        contentPreview += `${prefix}${text.trim()}\n`;
        previewLines++;
      }
    }
  }

  // Estimate slide count
  // Title slide + 1 slide per 2-3 headings + 1 slide per 5-7 bullets + 1 slide per image
  const estimatedSlides = Math.max(
    1, // At least 1 slide
    1 + // Title slide
    Math.ceil(headings / 2.5) + 
    Math.ceil((bullets + numberedLists) / 6) +
    Math.ceil(images.length / 2)
  );

  if (contentPreview.length > 500) {
    contentPreview = contentPreview.substring(0, 500) + '...';
  }

  return {
    estimatedSlides,
    imageCount: images.length,
    images,
    formatting: {
      headings,
      bullets,
      numberedLists,
      boldText,
      italicText,
      underlineText,
    },
    contentPreview: contentPreview || 'No content detected',
  };
}
