import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let generationId: string | undefined;
  
  try {
    console.log('=== PowerPoint Generation Request Received ===');
    
    // Get authorization header - JWT is already verified by Supabase since verify_jwt = true
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      throw new Error('No authorization header');
    }

    console.log('✅ Authorization header present');

    // Create admin client with service role key for admin check
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create client with user's JWT for other operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    console.log('✅ Supabase clients created');

    // Get user from JWT (pass token explicitly to avoid env/session issues)
    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    // Check generation quota using unified can_user_generate RPC
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('can_user_generate', { _user_id: user.id });

    if (quotaError) {
      console.error('Error checking generation quota:', quotaError);
      return new Response(
        JSON.stringify({ error: 'Failed to check generation quota' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quota = quotaData as any;

    // Non-premium users cannot generate
    if (!quota.hasPremium && !quota.isAdmin) {
      const remaining = quota.needsApproved || 3;
      return new Response(
        JSON.stringify({ 
          error: 'PREMIUM_REQUIRED',
          message: `Share ${remaining} more approved project${remaining !== 1 ? 's' : ''} to unlock PowerPoint Maker`,
          remaining,
          approvedCount: quota.approvedCount || 0
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Premium users have monthly limit (admins bypass this check)
    if (!quota.isAdmin && !quota.canGenerate) {
      return new Response(
        JSON.stringify({ 
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Monthly generation limit reached. Resets on the 1st of each month.',
          used: quota.used,
          limit: quota.limit,
          monthYear: quota.monthYear
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    generationId = requestBody.generationId;
    const { wordDocPath, templateId, presentationSettings } = requestBody;

    if (!generationId) {
      throw new Error('Missing generationId');
    }

    console.log('Starting PowerPoint generation:', { generationId, wordDocPath, templateId });

    // Download Word document from storage
    const { data: wordDoc, error: downloadError } = await supabaseClient.storage
      .from('ppt-word-uploads')
      .download(wordDocPath);

    if (downloadError) {
      throw new Error(`Failed to download Word document: ${downloadError.message}`);
    }

    // Parse DOCX content properly using JSZip
    const arrayBuffer = await wordDoc.arrayBuffer();
    console.log('Document downloaded, size:', arrayBuffer.byteLength);
    
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    
    if (!docXmlFile) {
      throw new Error('Invalid DOCX file - word/document.xml not found');
    }
    
    const docXml = await docXmlFile.async('string');
    
    // Extract images from DOCX
    const mediaFiles = zip.file(/^word\/media\//);
    const extractedImages: Array<{
      path: string;
      filename: string;
      base64: string;
      ext: string;
      originalSize: number;
    }> = [];
    
    console.log(`Found ${mediaFiles.length} media files in DOCX`);
    
    for (const file of mediaFiles) {
      const filename = file.name.split('/').pop();
      if (!filename) continue;
      
      // Only process image files
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)) {
        continue;
      }
      
      try {
        const imageData = await file.async('blob');
        const storagePath = `${generationId}/${filename}`;
        
        // Convert to base64 for PptxGenJS
        const arrayBuf = await imageData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        // Upload to storage
        const { error: uploadError } = await supabaseClient.storage
          .from('ppt-images')
          .upload(storagePath, imageData, {
            contentType: imageData.type || `image/${ext}`,
            upsert: false
          });
        
        if (uploadError) {
          console.error(`Failed to upload image ${filename}:`, uploadError);
          continue;
        }
        
        console.log(`Uploaded image: ${filename} (${(arrayBuf.byteLength / 1024).toFixed(1)}KB)`);
        extractedImages.push({
          path: storagePath,
          filename: filename,
          base64: base64,
          ext: ext,
          originalSize: arrayBuf.byteLength
        });
      } catch (err) {
        console.error(`Error processing image ${filename}:`, err);
      }
    }
    
    // Store image metadata in database
    if (extractedImages.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('powerpoint_images')
        .insert(
          extractedImages.map((img, index) => ({
            generation_id: generationId,
            storage_path: img.path,
            original_filename: img.filename,
            image_type: 'extracted',
            slide_index: index + 1, // Start from slide 1 (after title)
            position: 'center'
          }))
        );
      
      if (insertError) {
        console.error('Failed to store image metadata:', insertError);
      } else {
        console.log(`Stored metadata for ${extractedImages.length} images`);
      }
    }
    
    // Parse relationships file to map rId to media files
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const relsXml = relsFile ? await relsFile.async('string') : '';
    const relIdToFile = new Map<string, string>();
    const relMatches = relsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g);
    for (const match of relMatches) {
      relIdToFile.set(match[1], match[2]);
    }
    
    // Parse XML to extract structured content with formatting
    let cleanOutline = '';
    const allParagraphs = docXml.split('</w:p>');
    
    // Build image position map with context
    const imagePositionMap = new Map<string, {
      paragraphIndex: number;
      relId: string;
      beforeParagraphs: string[];
      afterParagraphs: string[];
      caption?: string;
    }>();
    
    allParagraphs.forEach((para, index) => {
      // Check for embedded image (drawing or pict)
      const drawingMatch = para.match(/<a:blip r:embed="(rId\d+)"/);
      const pictMatch = para.match(/<v:imagedata r:id="(rId\d+)"/);
      
      const relId = drawingMatch?.[1] || pictMatch?.[1];
      if (!relId) return;
      
      const filename = relIdToFile.get(relId);
      if (!filename) return;
      
      // Extract surrounding context (3 paragraphs before and after)
      const beforeParagraphs = allParagraphs.slice(Math.max(0, index - 3), index)
        .map(p => {
          const textMatches = p.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          return textMatches?.map(m => m.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1')).join(' ');
        })
        .filter(Boolean) as string[];
      
      const afterParagraphs = allParagraphs.slice(index + 1, index + 4)
        .map(p => {
          const textMatches = p.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          return textMatches?.map(m => m.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1')).join(' ');
        })
        .filter(Boolean) as string[];
      
      // Try to extract caption (often immediately after image)
      const captionCandidate = afterParagraphs[0];
      const isCaption = captionCandidate && captionCandidate.length < 150 && 
                        (captionCandidate.toLowerCase().includes('figure') || 
                         captionCandidate.toLowerCase().includes('image') ||
                         captionCandidate.toLowerCase().includes('caption'));
      
      imagePositionMap.set(filename, {
        paragraphIndex: index,
        relId,
        beforeParagraphs,
        afterParagraphs,
        caption: isCaption ? captionCandidate : undefined
      });
    });
    
    console.log(`Mapped ${imagePositionMap.size} images to document positions`);
    
    for (const para of allParagraphs) {
      if (!para.includes('<w:t>')) continue;
      
      // Check for heading styles
      const isHeading1 = para.includes('w:val="Heading1"') || para.includes('w:val="heading 1"');
      const isHeading2 = para.includes('w:val="Heading2"') || para.includes('w:val="heading 2"');
      const isHeading3 = para.includes('w:val="Heading3"') || para.includes('w:val="heading 3"');
      
      // Check for numbered/bulleted list
      const hasNumbering = para.includes('<w:numPr>');
      const numIdMatch = para.match(/<w:numId w:val="(\d+)"\/>/);
      const ilvlMatch = para.match(/<w:ilvl w:val="(\d+)"\/>/);
      
      // Determine list level (indentation)
      const listLevel = ilvlMatch ? parseInt(ilvlMatch[1]) : 0;
      const indent = '  '.repeat(listLevel);
      
      // Parse text runs with formatting
      const runs = para.match(/<w:r>.*?<\/w:r>/gs) || [];
      let formattedText = '';
      let hasBold = false;
      let hasItalic = false;
      let hasUnderline = false;
      
      for (const run of runs) {
        const textMatch = run.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
        if (!textMatch || !textMatch[1]) continue;
        
        const text = textMatch[1];
        const isBold = run.includes('<w:b/>') || run.includes('<w:b ');
        const isItalic = run.includes('<w:i/>') || run.includes('<w:i ');
        const isUnderline = run.includes('<w:u ');
        
        // Track if any formatting is present
        if (isBold) hasBold = true;
        if (isItalic) hasItalic = true;
        if (isUnderline) hasUnderline = true;
        
        // Mark formatting in text
        let marked = text;
        if (isBold) marked = `**${marked}**`;
        if (isItalic) marked = `*${marked}*`;
        if (isUnderline) marked = `__${marked}__`;
        
        formattedText += marked;
      }
      
      if (!formattedText.trim()) continue;
      
      // Format based on style
      if (isHeading1) {
        cleanOutline += `\n# ${formattedText.trim()}\n`;
      } else if (isHeading2) {
        cleanOutline += `\n## ${formattedText.trim()}\n`;
      } else if (isHeading3) {
        cleanOutline += `\n### ${formattedText.trim()}\n`;
      } else if (hasNumbering) {
        // Numbered or bulleted list
        const isNumbered = numIdMatch && parseInt(numIdMatch[1]) > 0;
        if (isNumbered) {
          cleanOutline += `${indent}1. ${formattedText.trim()}\n`;
        } else {
          cleanOutline += `${indent}- ${formattedText.trim()}\n`;
        }
      } else {
        cleanOutline += `${formattedText.trim()}\n`;
      }
    }
    
    // Fallback if extraction was poor
    if (cleanOutline.trim().length < 50) {
      const allText = docXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      cleanOutline = allText
        .map(m => m.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1'))
        .join('\n');
    }
    
    console.log('Extracted outline (first 400 chars):', cleanOutline.substring(0, 400));

    // Note: Using unicode icons instead of SVG for PptxGenJS compatibility
    const iconDataUrls: string[] = [];

    // Use only small circles for enhanced bullets
    const BULLET_CIRCLE_SHAPE = 'ellipse';

    // Helper: Convert hex color to lighter shade
    function lightenColor(hexColor: string, percent: number): string {
      const cleanHex = hexColor.replace('#', '');
      const num = parseInt(cleanHex, 16);
      const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent / 100));
      const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent / 100));
      const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent / 100));
      return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
    }

    // Helper: Create image styling options
    function createImageOptions(
      baseOptions: any,
      imageStyle: any,
      colors: any
    ) {
      const options = { ...baseOptions };
      
      // Apply rounding based on corner radius setting
      const roundingMap: Record<string, boolean> = {
        'none': false,
        'small': true,
        'medium': true,
        'large': true,
        'circle': true
      };
      options.rounding = roundingMap[imageStyle?.cornerRadius || 'none'] || false;
      
      // Apply shadow
      if (imageStyle?.shadow && imageStyle.shadow !== 'none') {
        const shadowSettings: Record<string, any> = {
          'soft': { type: 'outer', blur: 5, opacity: 0.10, offset: 2, color: '000000' },
          'medium': { type: 'outer', blur: 8, opacity: 0.20, offset: 3, color: '000000' },
          'strong': { type: 'outer', blur: 12, opacity: 0.30, offset: 4, color: '000000' }
        };
        options.shadow = shadowSettings[imageStyle.shadow];
      }
      
      // Apply border
      if (imageStyle?.border && imageStyle.border !== 'none') {
        const borderWidths: Record<string, number> = {
          'thin': 1,
          'medium': 3,
          'thick': 5
        };
        options.line = {
          color: (imageStyle.borderColor || colors.accent || colors.secondary).replace('#', ''),
          width: borderWidths[imageStyle.border],
          type: 'solid'
        };
      }
      
      return options;
    }

    // Helper: Add polaroid image with white frame and caption
    function addPolaroidImage(
      slide: any,
      imageData: any,
      x: number,
      y: number,
      w: number,
      h: number,
      caption: string,
      colors: any,
      fonts: any
    ) {
      const frameMargin = 0.15;
      const captionHeight = 0.4;
      const totalFrameH = h + frameMargin * 2 + captionHeight;
      
      // White background frame
      slide.addShape(pptx.ShapeType.rect, {
        x: x - frameMargin,
        y: y - frameMargin,
        w: w + frameMargin * 2,
        h: totalFrameH,
        fill: { color: 'FFFFFF' },
        line: { color: 'E0E0E0', width: 1 },
        shadow: { type: 'outer', blur: 8, opacity: 0.15, offset: 3, color: '000000' }
      });
      
      // Image
      slide.addImage({
        ...imageData,
        x, y, w, h,
        sizing: { type: 'contain', w, h }
      });
      
      // Caption in the bottom space
      slide.addText(caption || 'Image', {
        x: x - frameMargin,
        y: y + h + frameMargin * 0.5,
        w: w + frameMargin * 2,
        h: captionHeight - frameMargin * 0.5,
        fontSize: 11,
        fontFace: fonts.body,
        color: '666666',
        align: 'center',
        valign: 'middle',
        italic: true
      });
    }

    // Helper: Add multi-color border frame effect
    function addFramedImage(
      slide: any,
      imageData: any,
      x: number,
      y: number,
      w: number,
      h: number,
      colors: any
    ) {
      // Outer frame (primary color)
      const outerWidth = 0.08;
      slide.addShape(pptx.ShapeType.rect, {
        x: x - outerWidth,
        y: y - outerWidth,
        w: w + outerWidth * 2,
        h: h + outerWidth * 2,
        fill: { color: colors.primary.replace('#', '') }
      });
      
      // Middle frame (white)
      const middleWidth = 0.05;
      slide.addShape(pptx.ShapeType.rect, {
        x: x - middleWidth,
        y: y - middleWidth,
        w: w + middleWidth * 2,
        h: h + middleWidth * 2,
        fill: { color: 'FFFFFF' }
      });
      
      // Image with subtle shadow
      slide.addImage({
        ...imageData,
        x, y, w, h,
        sizing: { type: 'contain', w, h },
        shadow: { type: 'inner', blur: 3, opacity: 0.10, offset: 1, color: '000000' }
      });
    }

    // Helper: Add shaded background box
    function addShadedBox(
      slide: any,
      x: number,
      y: number,
      w: number,
      h: number,
      config: any,
      colors: any
    ) {
      const bgColor = config?.backgroundColor || lightenColor(colors.primary.replace('#', ''), 85);
      const opacity = config?.opacity || 22;  // Increased default from 10 to 22
      const padding = config?.padding || 0.3;  // Slightly more padding
      
      slide.addShape(pptx.ShapeType.rect, {
        x: x - padding,
        y: y - padding,
        w: w + (padding * 2),
        h: h + (padding * 2),
        fill: { color: bgColor, transparency: 100 - opacity },
        line: { type: 'none' }
      });
    }

    // Helper: Render small circle bullet
    function renderIconBullet(
      slide: any,
      text: string,
      x: number,
      y: number,
      iconIndex: number,
      colors: any,
      fonts: any,
      config: any
    ) {
      const circleSize = 0.20;  // Small circle size
      const circleColor = (config?.circleColor || colors.primary).replace('#', '');
      
      // Add small circle as bullet
      slide.addShape(BULLET_CIRCLE_SHAPE, {
        x: x,
        y: y,
        w: circleSize,
        h: circleSize,
        fill: { color: circleColor },
        line: { type: 'none' }
      });
      
      // Add text next to circle with smaller font
      slide.addText(text, {
        x: x + circleSize + 0.15,
        y: y,
        w: 8.5 - (x + circleSize + 0.15),
        h: circleSize,
        fontSize: fonts.bodySize * 0.80,  // Smaller font size
        fontFace: fonts.body,
        color: colors.text.replace('#', ''),
        valign: 'middle'
      });
    }

    // Helper: Determine if slide should use enhanced bullets (selective application)
    function shouldUseEnhancedBullets(slide: any, slideIndex: number, totalSlides: number): boolean {
      const title = slide.title?.toLowerCase() || '';
      
      // Priority 1: Key findings, results, conclusions
      if (title.includes('key') || title.includes('finding') || title.includes('result') || 
          title.includes('conclusion') || title.includes('summary') || title.includes('takeaway') ||
          title.includes('highlight')) {
        return true;
      }
      
      // Priority 2: Methods, methodology, approach
      if (title.includes('method') || title.includes('approach') || title.includes('procedure') ||
          title.includes('technique') || title.includes('protocol')) {
        return true;
      }
      
      // Priority 3: Objectives, aims, goals
      if (title.includes('objective') || title.includes('aim') || title.includes('goal') || 
          title.includes('purpose') || title.includes('target')) {
        return true;
      }
      
      // Priority 4: Important highlights detected from slide content
      if (slide.bullets && slide.bullets.length > 0 && slide.bullets.length <= 5) {
        const bulletText = slide.bullets.map((b: any) => 
          typeof b === 'string' ? b : b.text
        ).join(' ').toLowerCase();
        
        if (bulletText.includes('significant') || bulletText.includes('important') || 
            bulletText.includes('critical') || bulletText.includes('primary') ||
            bulletText.includes('essential') || bulletText.includes('key')) {
          return true;
        }
      }
      
      // Priority 5: AI-marked slides
      if (slide.enhanceBullets === true || slide.highlightBox === true) {
        return true;
      }
      
      // Don't use on every slide - maximum 40% of slides should have enhanced styling
      return false;
    }

    // Helper: Determine if two-column layout should be used for better readability
    function shouldUseTwoColumns(bullets: any[], spacing: any, useIconBullets: boolean): boolean {
      if (bullets.length === 0) return false;
      
      // Calculate estimated height needed for bullets
      const bulletHeight = useIconBullets ? 0.55 : 0.45; // Icon bullets need more space
      const estimatedHeight = bullets.length * bulletHeight;
      const availableHeight = spacing.contentH;
      
      // Use two columns if content would exceed 85% of available height
      // This prevents cramming and improves readability
      return estimatedHeight > (availableHeight * 0.85);
    }

    // Build image context for AI
    const imageContexts = extractedImages.map((img, idx) => {
      const position = imagePositionMap.get(img.filename);
      if (!position) {
        return `Image ${idx + 1}: ${img.filename} (position unknown)`;
      }
      
      const beforeText = position.beforeParagraphs.slice(-2).join(' | ').substring(0, 150);
      const afterText = position.afterParagraphs.slice(0, 2).join(' | ').substring(0, 150);
      
      return `Image ${idx + 1}: "${img.filename}"
  - Position: Paragraph ${position.paragraphIndex} of ${allParagraphs.length}
  - Before: ${beforeText}
  - After: ${afterText}${position.caption ? `\n  - Caption: ${position.caption}` : ''}`;
    }).join('\n\n');

    // Helper: update current_step for real-time progress tracking
    async function updateStep(step: string) {
      try {
        await supabaseAdmin.from('powerpoint_generations').update({ current_step: step }).eq('id', generationId);
        console.log(`📍 Step: ${step}`);
      } catch (e) {
        console.warn('Failed to update step:', e);
      }
    }

    // Helper function to call Gemini AI for slide structure generation
    async function generateSlideStructureWithGemini(
      docOutline: string,
      imageContexts: string,
      imageCount: number
    ) {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const prompt = `You are a scientific presentation expert. Convert this Word document into a comprehensive, high-fidelity PowerPoint slide deck that preserves ALL key information from the source.

STEP 1 — SUMMARIZE: Read the entire document carefully. Identify every key concept, finding, data point, statistic, comparison, methodology detail, and conclusion. Nothing important should be lost.

STEP 2 — STRUCTURE: Arrange slides in standard scientific presentation order:
1. Title slide (presentation title derived from document)
2. Introduction / Background (context, significance, problem statement)
3. Objectives / Aims (research questions or goals)
4. Methods / Approach (methodology, experimental design, tools used)
5. Results / Key Findings (multiple slides if needed — one per major finding)
6. Discussion / Analysis (interpretation of results, comparisons)
7. Conclusion / Summary (key takeaways)
8. Future Directions / Recommendations (if applicable)

DOCUMENT CONTENT:
${docOutline.substring(0, 20000)}

AVAILABLE IMAGES (${imageCount} total):
${imageContexts || 'No images available'}

RULES:
1. Create 10-20 slides — use as many as needed to cover ALL content. Do not skip sections.
2. Each bullet must contain specific, substantive information extracted from the document — never use vague phrases like "various factors" or "multiple approaches"
3. 3-5 bullets per slide maximum. If a topic needs more, split into multiple slides.
4. Include ALL specific numbers, percentages, statistics, and data points from the document.
5. Use "table" type when the document contains tabular data, comparisons across categories, or multi-variable data. Extract real values.
6. Use "chart" type when the document contains trends, growth data, percentages to compare, or numerical progressions. Use real numbers.
7. Use "quote" for impactful statements, key conclusions, or notable findings worth highlighting.
8. Use "two-column" for side-by-side comparisons or contrasting concepts.
9. Use "image-left" or "image-right" for slides that pair with extracted document images.
10. Mark 3-5 most important slides with "enhanceBullets": true.
11. Titles must be descriptive and specific (e.g., "RNA Expression Increased 3-fold in Treatment Group" not "Results").

Return ONLY a valid JSON object (no markdown, no code fences) with this structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "type": "bullets",
      "title": "Specific Descriptive Title",
      "bullets": [
        { "text": "Substantive point with specific data", "level": 0, "listType": "bullet", "bold": false, "italic": false, "underline": false }
      ],
      "enhanceBullets": false
    },
    {
      "type": "table",
      "title": "Comparison of Treatment Groups",
      "tableData": {
        "headers": ["Parameter", "Group A", "Group B", "p-value"],
        "rows": [
          ["Metric 1", "45%", "62%", "<0.01"],
          ["Metric 2", "3.2 ± 0.4", "4.8 ± 0.6", "<0.05"]
        ]
      }
    },
    {
      "type": "chart",
      "title": "Growth Over Time",
      "chartData": {
        "chartType": "bar",
        "categories": ["Week 1", "Week 2", "Week 3", "Week 4"],
        "series": [
          { "name": "Treatment", "values": [10, 25, 40, 55] },
          { "name": "Control", "values": [10, 12, 15, 18] }
        ]
      }
    },
    {
      "type": "quote",
      "title": "Key Finding",
      "quote": "An impactful statement from the document",
      "attribution": "Source or context"
    },
    {
      "type": "image-left",
      "title": "Methodology Overview",
      "bullets": [{"text": "Step 1"}, {"text": "Step 2"}],
      "imageCaption": "Process diagram",
      "preferredImageIndex": 0
    }
  ]
}

Available slide types: "bullets", "two-column", "quote", "table", "chart", "image-left", "image-right", "image-grid", "image-top", "image-full"`;

      console.log('🤖 Calling Gemini AI for slide structure generation...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API error:', response.status, errorText);
        if (response.status === 429) throw new Error('RATE_LIMITED');
        if (response.status === 401 || response.status === 403) throw new Error('INVALID_API_KEY');
        throw new Error(`Gemini API failed: ${response.status}`);
      }

      const result = await response.json();
      const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error('No content in Gemini response');
      }

      // Parse JSON response (strip any markdown fences if present)
      const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const slideData = JSON.parse(cleanJson);

      if (!slideData.title || !slideData.slides || !Array.isArray(slideData.slides)) {
        throw new Error('Invalid Gemini response structure');
      }

      console.log(`✅ Gemini AI generated ${slideData.slides.length} slides`);
      return slideData;
    }

    // Agent 2: Review content fidelity and critique layout
    async function reviewSlideLayout(draft: any, originalDoc: string) {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

      const prompt = `You are a presentation quality reviewer. Your job is to ensure this slide deck faithfully represents the source document with no important content lost.

ORIGINAL DOCUMENT EXCERPT:
${originalDoc.substring(0, 15000)}

CURRENT SLIDE DECK:
${JSON.stringify(draft, null, 2).substring(0, 15000)}

REVIEW CHECKLIST — check each item and fix any issues:
1. CONTENT FIDELITY: Are all major sections from the document represented? If any topic is missing, ADD a slide for it.
2. DATA PRESERVATION: Are all specific numbers, percentages, statistics, and findings from the document included? If any data point is missing, add it to the relevant slide.
3. LOGICAL FLOW: Do slides follow intro → methods → results → conclusion? Reorder if needed.
4. SLIDE VARIETY: Are there diverse types (bullets, table, chart, quote, two-column, image)? If all slides are "bullets", convert some to table/chart/quote where appropriate.
5. BULLET QUALITY: Does each bullet contain specific information? Rewrite any vague bullets like "various factors were considered" into specific content from the document.
6. TABLE/CHART DATA: If there are table or chart slides, verify they contain real data extracted from the document. Fix any placeholder values.
7. MISSING SLIDES: If the document has content not yet covered by any slide, add new slides for it.
8. TITLES: Ensure titles are specific and descriptive, not generic (e.g., "RNA Expression Increased 3-fold" not just "Results").

Return the IMPROVED slide deck as valid JSON with the same structure (title, slides array). Fix all issues found. No markdown fences.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.4,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini review API failed: ${response.status}`);
      }

      const result = await response.json();
      const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) throw new Error('No content in review response');

      const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const reviewed = JSON.parse(cleanJson);

      if (!reviewed.title || !reviewed.slides || !Array.isArray(reviewed.slides)) {
        throw new Error('Invalid review response structure');
      }

      return reviewed;
    }

    // Agent 3: Generate scientific illustrations for key slides
    async function generateSlideImages(slideDataInput: any, genId: string) {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

      // Pick 3-5 slides that benefit from illustrations
      const keywordSlides = slideDataInput.slides
        .map((s: any, i: number) => ({ slide: s, index: i }))
        .filter(({ slide, index }: any) => {
          if (index === 0) return true; // Title slide
          const title = (slide.title || '').toLowerCase();
          const type = slide.type || '';
          // Skip table/chart slides — they have their own visuals
          if (type === 'table' || type === 'chart') return false;
          return (
            slide.enhanceBullets ||
            title.includes('method') ||
            title.includes('result') ||
            title.includes('finding') ||
            title.includes('conclusion') ||
            title.includes('overview') ||
            title.includes('introduction') ||
            title.includes('process') ||
            title.includes('mechanism') ||
            title.includes('background') ||
            title.includes('analysis') ||
            title.includes('comparison') ||
            title.includes('structure') ||
            title.includes('system') ||
            title.includes('framework') ||
            title.includes('objective') ||
            title.includes('approach')
          );
        });

      // Ensure minimum 3 candidates — fill from remaining content slides if needed
      let candidateSlides = keywordSlides.slice(0, 5);
      if (candidateSlides.length < 3) {
        const remaining = slideDataInput.slides
          .map((s: any, i: number) => ({ slide: s, index: i }))
          .filter(({ slide, index }: any) => {
            const type = slide.type || 'bullets';
            return type !== 'table' && type !== 'chart' && type !== 'quote' &&
              !candidateSlides.some((c: any) => c.index === index);
          });
        candidateSlides = [...candidateSlides, ...remaining].slice(0, 5);
      }

      if (candidateSlides.length === 0) {
        console.log('No candidate slides for image generation');
        return;
      }

      console.log(`Generating images for ${candidateSlides.length} slides`);

      for (const { slide, index } of candidateSlides) {
        try {
          const contentSummary = (slide.bullets || [])
            .slice(0, 5)
            .map((b: any) => typeof b === 'string' ? b : b.text)
            .join('. ');

          const imagePrompt = `Create a simple, clean scientific illustration for an academic presentation slide.

Topic: "${slide.title}"
Context: ${contentSummary}

Requirements: Simple flat vector style, minimal detail, suitable as a small slide illustration. Use blues, whites, and subtle warm accents. No text, no labels, no numbers. White or transparent background. Think diagram or icon-style, not photorealistic.`;

          const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
            {
              method: 'POST',
              headers: {
                'x-goog-api-key': GEMINI_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: imagePrompt }] }],
                generationConfig: {
                  responseModalities: ['IMAGE', 'TEXT'],
                },
              }),
            }
          );

          if (!response.ok) {
            console.warn(`Image generation failed for slide ${index}: ${response.status}`);
            continue;
          }

          const result = await response.json();
          const parts = result?.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

          if (!imagePart?.inlineData?.data) {
            console.warn(`No image data returned for slide ${index}`);
            continue;
          }

          // Decode base64 and upload to storage
          const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0));
          const ext = imagePart.inlineData.mimeType.includes('png') ? 'png' : 'jpg';
          const filename = `ai_slide_${index}.${ext}`;
          const storagePath = `${genId}/${filename}`;

          const { error: uploadErr } = await supabaseAdmin.storage
            .from('ppt-generated')
            .upload(storagePath, imageBytes, {
              contentType: imagePart.inlineData.mimeType,
              upsert: true,
            });

          if (uploadErr) {
            console.warn(`Failed to upload AI image for slide ${index}:`, uploadErr);
            continue;
          }

          // Store in powerpoint_images table
          await supabaseAdmin.from('powerpoint_images').insert({
            generation_id: genId,
            storage_path: storagePath,
            original_filename: filename,
            image_type: 'ai_generated',
            slide_index: index,
            position: 'center',
          });

          // Mark slide for AI image embedding
          slide._aiImagePath = storagePath;
          slide._aiImageBase64 = imagePart.inlineData.data;
          slide._aiImageMimeType = imagePart.inlineData.mimeType;

          console.log(`✅ Generated AI image for slide ${index}: ${filename}`);
        } catch (imgErr: any) {
          console.warn(`Image generation error for slide ${index}:`, imgErr.message);
        }
      }
    }

    // ========== AGENT 1: DRAFT SLIDES ==========
    await updateStep('drafting');
    console.log('📋 Agent 1: Drafting slide structure with Gemini AI...');
    let slideData: any;

    try {
      slideData = await generateSlideStructureWithGemini(cleanOutline, imageContexts, extractedImages.length);
    } catch (aiError: any) {
      console.error('❌ Gemini AI failed:', aiError.message);
      throw new Error(`AI generation failed: ${aiError.message}`);
    }

    // Ensure at least one slide exists
    if (!slideData.slides || slideData.slides.length === 0) {
      slideData.slides = [{ type: 'bullets', title: 'No Content', bullets: ['Document appears empty'] }];
    }

    console.log(`Agent 1 done: ${slideData.slides.length} slides drafted`);

    // ========== AGENT 2: REVIEW LAYOUT ==========
    await updateStep('reviewing');
    console.log('🔍 Agent 2: Reviewing slide layout...');
    try {
      slideData = await reviewSlideLayout(slideData, cleanOutline);
      console.log(`Agent 2 done: ${slideData.slides.length} slides after review`);
    } catch (reviewError: any) {
      console.warn('⚠️ Layout review failed, using draft:', reviewError.message);
    }

    // ========== AGENT 3: GENERATE IMAGES ==========
    await updateStep('generating_images');
    console.log('🎨 Agent 3: Generating scientific illustrations...');
    try {
      await generateSlideImages(slideData, generationId!);
      console.log('Agent 3 done: images generated');
    } catch (imgError: any) {
      console.warn('⚠️ Image generation failed, continuing without AI images:', imgError.message);
    }

    // Track AI provider usage for analytics
    try {
      const supabaseAdminForTracking = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabaseAdminForTracking.from('ai_generation_usage').insert({
        user_id: user.id,
        month_year: new Date().toISOString().substring(0, 7),
        prompt: 'PowerPoint Generation',
        style: 'powerpoint_generation',
        generation_type: 'powerpoint_full',
        generated_at: new Date().toISOString()
      });
    } catch (usageError) {
      console.warn('Failed to track AI usage:', usageError);
    }

    // ========== RENDERING ==========
    await updateStep('rendering');

    // Generate PowerPoint using PptxGenJS
    const PptxGenJS = await import('https://esm.sh/pptxgenjs@3.12.0');
    const pptx = new PptxGenJS.default();

    // Get template configuration (built-in or custom)
    // Default: Deep blue scientific theme with yellow/white text
    let colors: any;
    let fonts: any = { title: 'Arial', body: 'Arial', titleSize: 44, bodySize: 18 };
    let layouts: any = { titleSlide: 'centered', contentSlide: 'bullets', spacing: 'normal' };
    let enhancedBullets: any = null;
    let shadedBoxes: any = null;

    if (templateId.startsWith('custom-')) {
      // Fetch custom template from database
      const customTemplateId = templateId.replace('custom-', '');
      const { data: customTemplate } = await supabaseClient
        .from('powerpoint_custom_templates')
        .select('*')
        .eq('id', customTemplateId)
        .single();

      if (customTemplate) {
        colors = {
          primary: customTemplate.colors.primary.replace('#', ''),
          secondary: customTemplate.colors.secondary.replace('#', ''),
          accent: customTemplate.colors.accent.replace('#', ''),
          text: customTemplate.colors.text.replace('#', ''),
          background: customTemplate.colors.background?.replace('#', '') || '0a1628',
        };
        fonts = customTemplate.fonts;
        layouts = customTemplate.layouts;
        enhancedBullets = customTemplate.enhanced_bullets;
        shadedBoxes = customTemplate.shaded_boxes;
      } else {
        colors = { primary: '0a1628', secondary: '1e3a5f', accent: 'f0c040', text: 'FFFFFF', background: '0d1f3c' };
      }
    } else {
      // Built-in scientific templates — deep blue backgrounds, yellow/white text
      const builtInConfigs: Record<string, any> = {
        'scientific-report': {
          colors: { primary: '0a1628', secondary: '1e3a5f', accent: 'f0c040', text: 'FFFFFF', background: '0d1f3c' },
          enhancedBullets: { enabled: true, iconSet: 'scientific', circleSize: 0.35, circleColor: 'f0c040', iconColor: '0a1628' },
          shadedBoxes: { enabled: true, opacity: 20, backgroundColor: '1a3050', padding: 0.3 }
        },
        'research-presentation': {
          colors: { primary: '0b1d3a', secondary: '183d6e', accent: 'fbbf24', text: 'FFFFFF', background: '0e2244' },
          enhancedBullets: { enabled: true, iconSet: 'scientific', circleSize: 0.35, circleColor: 'fbbf24', iconColor: '0b1d3a' },
          shadedBoxes: { enabled: true, opacity: 20, backgroundColor: '1a3860', padding: 0.3 }
        },
        'medical-briefing': {
          colors: { primary: '0c1a30', secondary: '1c3558', accent: 'f59e0b', text: 'FFFFFF', background: '0f2340' },
          enhancedBullets: { enabled: true, iconSet: 'medical', circleSize: 0.35, circleColor: 'f59e0b', iconColor: '0c1a30' },
          shadedBoxes: { enabled: true, opacity: 20, backgroundColor: '1a3050', padding: 0.3 }
        },
        'educational-lecture': {
          colors: { primary: '0d1b38', secondary: '1d3a60', accent: 'eab308', text: 'FFFFFF', background: '101e3e' },
          enhancedBullets: { enabled: true, iconSet: 'educational', circleSize: 0.35, circleColor: 'eab308', iconColor: '0d1b38' },
          shadedBoxes: { enabled: true, opacity: 20, backgroundColor: '1a3050', padding: 0.3 }
        },
      };
      const config = builtInConfigs[templateId] || builtInConfigs['scientific-report'];
      colors = config.colors;
      enhancedBullets = config.enhancedBullets;
      shadedBoxes = config.shadedBoxes;
    }

    // Title slide — deep blue with golden title
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: colors.primary };

    // Add subtle decorative accent line on title slide
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 1.5, y: 4.2, w: 7, h: 0.04,
      fill: { color: colors.accent },
    });

    let titleX = 0.5, titleY = 2.0;
    if (layouts.titleSlide === 'left') {
      titleX = 0.5;
      titleY = 2.0;
    } else if (layouts.titleSlide === 'right') {
      titleX = 1.5;
      titleY = 2.0;
    }

    titleSlide.addText(slideData.title, {
      x: titleX,
      y: titleY,
      w: layouts.titleSlide === 'centered' ? 9 : 8,
      h: 2.0,
      fontSize: fonts.titleSize,
      fontFace: fonts.title,
      bold: true,
      color: 'FFFFFF',
      align: layouts.titleSlide === 'centered' ? 'center' : layouts.titleSlide,
    });

    // Helper functions for rendering different slide types
    const renderQuoteSlide = (contentSlide: any, slide: any, spacing: any) => {
      const quoteText = slide.quote || 'Quote content';

      // Decorative quote accent bar
      contentSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 2.3, w: 0.06, h: 2.5,
        fill: { color: colors.accent },
      });

      contentSlide.addText(`"${quoteText}"`, {
        x: 1.2,
        y: 2.5,
        w: 7.8,
        h: 2.5,
        fontSize: fonts.bodySize * 1.4,
        fontFace: fonts.body,
        italic: true,
        color: colors.accent,
        align: 'left',
        valign: 'middle',
      });

      if (slide.attribution) {
        contentSlide.addText(`— ${slide.attribution}`, {
          x: 1.2,
          y: 5.2,
          w: 7.8,
          h: 0.5,
          fontSize: fonts.bodySize * 0.9,
          fontFace: fonts.body,
          color: 'CCCCCC',
          align: 'left',
        });
      }
    };

    // Helper to optimize and resize images based on layout
    const getOptimizedImageDimensions = (layoutType: string) => {
      const layouts: Record<string, { w: number; h: number; quality: number }> = {
        'image-left': { w: 4.0, h: 4.2, quality: 85 },
        'image-right': { w: 4.0, h: 4.2, quality: 85 },
        'full-image': { w: 9.0, h: 5.0, quality: 90 },
        'image-grid': { w: 4.5, h: 3.0, quality: 80 },
        'title-image': { w: 8.0, h: 4.5, quality: 90 },
        'image-top': { w: 9.0, h: 4.0, quality: 85 }
      };
      
      return layouts[layoutType] || layouts['image-left'];
    };

    const renderImageGridSlide = (contentSlide: any, slide: any, spacing: any, availableImages: typeof extractedImages) => {
      const dimensions = getOptimizedImageDimensions('image-grid');
      const imageCount = Math.min(slide.imageCount || 4, availableImages.length || 4);
      const cols = imageCount <= 2 ? imageCount : 2;
      const rows = Math.ceil(imageCount / cols);
      const imageW = dimensions.w;
      const imageH = dimensions.h;
      const gap = 0.5;
      
      // Get image style settings
      const imageStyle = presentationSettings?.imageStyle || {};
      
      console.log(`Rendering image-grid: ${imageCount} images at ${imageW}x${imageH} each`);
      
      for (let i = 0; i < imageCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.5 + col * (imageW + gap);
        const y = spacing.contentY + row * (imageH + gap);
        
        if (availableImages[i]) {
          // Use actual image with styling
          const img = availableImages[i];
          const imageOptions = createImageOptions(
            {
              data: `data:image/${img.ext};base64,${img.base64}`,
              x, y, w: imageW, h: imageH,
              sizing: { type: 'contain', w: imageW, h: imageH }
            },
            imageStyle,
            colors
          );
          contentSlide.addImage(imageOptions);
        } else {
          // Fallback placeholder
          contentSlide.addShape(pptx.ShapeType.rect, {
            x, y, w: imageW, h: imageH,
            fill: { color: '1a3050' },
            line: { color: colors.secondary, width: 2 },
          });
          contentSlide.addText('[Image]', {
            x, y: y + imageH / 2 - 0.2, w: imageW, h: 0.4,
            fontSize: 14,
            color: '8899aa',
            align: 'center',
          });
        }
      }
    };

    const renderImageSideSlide = (contentSlide: any, slide: any, spacing: any, side: 'left' | 'right', availableImages: typeof extractedImages, imageIndex: number, imageCaption: string | undefined, slideIndex: number, totalSlides: number) => {
      const layoutType = side === 'left' ? 'image-left' : 'image-right';
      const dimensions = getOptimizedImageDimensions(layoutType);
      
      const imageW = dimensions.w;
      const imageH = dimensions.h;
      const imageX = side === 'left' ? 0.5 : 5.5;
      const contentX = side === 'left' ? 5.0 : 0.5;
      const contentW = 4.5;
      
      // Get image style settings
      const imageStyle = presentationSettings?.imageStyle || {};
      
      // Image or placeholder
      if (availableImages[imageIndex]) {
        const img = availableImages[imageIndex];
        
        console.log(`Rendering ${layoutType}: ${img.filename} (${(img.originalSize / 1024).toFixed(1)}KB) at ${dimensions.w}x${dimensions.h}`);
        
        // Apply special effects or standard image
        if (imageStyle.effect === 'polaroid') {
          addPolaroidImage(
            contentSlide,
            { data: `data:image/${img.ext};base64,${img.base64}` },
            imageX, spacing.contentY, imageW, imageH,
            imageCaption || '',
            colors, fonts
          );
        } else if (imageStyle.effect === 'frame') {
          addFramedImage(
            contentSlide,
            { data: `data:image/${img.ext};base64,${img.base64}` },
            imageX, spacing.contentY, imageW, imageH,
            colors
          );
        } else {
          const imageOptions = createImageOptions(
            {
              data: `data:image/${img.ext};base64,${img.base64}`,
              x: imageX,
              y: spacing.contentY,
              w: imageW,
              h: imageH,
              sizing: { type: 'contain', w: imageW, h: imageH }
            },
            imageStyle,
            colors
          );
          contentSlide.addImage(imageOptions);
          
          // Add caption below image if available (only for non-special effects)
          if (imageCaption) {
            contentSlide.addText(imageCaption, {
              x: imageX,
              y: spacing.contentY + imageH + 0.1,
              w: imageW,
              h: 0.3,
              fontSize: 10,
              fontFace: fonts.body,
              color: 'aabbcc',
              align: 'center',
              italic: true
            });
          }
        }
      } else {
        contentSlide.addShape(pptx.ShapeType.rect, {
          x: imageX, y: spacing.contentY, w: imageW, h: imageH,
          fill: { color: '1a3050' },
          line: { color: colors.secondary, width: 2 },
        });
        contentSlide.addText('[Image]', {
          x: imageX, y: spacing.contentY + imageH / 2 - 0.2, w: imageW, h: 0.4,
          fontSize: 14,
          color: '808080',
          align: 'center',
        });
      }
      
      // Content bullets with formatting
      const bullets = slide.bullets || [];
      if (bullets.length > 0) {
        const shouldEnhance = shouldUseEnhancedBullets(slide, slideIndex, slideData.slides.length);
        const useIconBullets = enhancedBullets?.enabled && shouldEnhance;
        const useShadedBoxes = shadedBoxes?.enabled && shouldEnhance;
        
        // Check if we need two-column layout due to content length
        const useTwoColumns = shouldUseTwoColumns(bullets, { contentH: imageH }, useIconBullets);
        
        if (useTwoColumns) {
          // Too many bullets for single column - use full-width two-column layout
          const midpoint = Math.ceil(bullets.length / 2);
          const fullContentX = 0.5;
          const fullContentW = 9;
          
          if (useIconBullets) {
            const bulletConfig = enhancedBullets;
            const boxConfig = shadedBoxes;
            
            // Add shaded boxes for both columns
            if (useShadedBoxes) {
              addShadedBox(contentSlide, fullContentX, spacing.contentY, 4.25, imageH, boxConfig, colors);
              addShadedBox(contentSlide, fullContentX + 4.75, spacing.contentY, 4.25, imageH, boxConfig, colors);
            }
            
            // Left column
            let currentY = spacing.contentY + 0.2;
            bullets.slice(0, midpoint).forEach((b: any, index: number) => {
              const text = typeof b === 'string' ? b : b.text;
              renderIconBullet(contentSlide, text, fullContentX + 0.2, currentY, index, colors, fonts, bulletConfig);
              currentY += 0.55;
            });
            
            // Right column
            currentY = spacing.contentY + 0.2;
            bullets.slice(midpoint).forEach((b: any, index: number) => {
              const text = typeof b === 'string' ? b : b.text;
              renderIconBullet(contentSlide, text, fullContentX + 4.95, currentY, index + midpoint, colors, fonts, bulletConfig);
              currentY += 0.55;
            });
          } else {
            // Standard two-column bullet formatting
            const formatBullets = (items: any[]) => items.map((b: any) => {
              const text = typeof b === 'string' ? b : b.text;
              const level = typeof b === 'object' ? (b.level || 0) : 0;
              const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
              const bold = typeof b === 'object' ? (b.bold || false) : false;
              const italic = typeof b === 'object' ? (b.italic || false) : false;
              const underline = typeof b === 'object' ? (b.underline || false) : false;
              
              return {
                text,
                options: {
                  bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                  indentLevel: level,
                  bold,
                  italic,
                  underline
                }
              };
            });
            
            const leftBullets = formatBullets(bullets.slice(0, midpoint));
            const rightBullets = formatBullets(bullets.slice(midpoint));
            
            contentSlide.addText(leftBullets, {
              x: fullContentX,
              y: spacing.contentY,
              w: 4.25,
              h: imageH,
              fontSize: fonts.bodySize * 0.85,  // Smaller font size
              fontFace: fonts.body,
              color: colors.text,
            });
            
            contentSlide.addText(rightBullets, {
              x: fullContentX + 4.75,
              y: spacing.contentY,
              w: 4.25,
              h: imageH,
              fontSize: fonts.bodySize * 0.85,  // Smaller font size
              fontFace: fonts.body,
              color: colors.text,
            });
          }
        } else {
          // Single column fits - use original image-side layout
          if (useIconBullets) {
            const bulletConfig = enhancedBullets;
            const boxConfig = shadedBoxes;
            
            // Calculate content height based on bullets
            const bulletHeight = Math.min(bullets.length * 0.6, imageH);
            
            // Add shaded box if enabled
            if (useShadedBoxes) {
              addShadedBox(contentSlide, contentX, spacing.contentY, contentW, bulletHeight, boxConfig, colors);
            }
            
            // Render each bullet with icon
            let currentY = spacing.contentY + 0.2;
            bullets.forEach((b: any, index: number) => {
              const text = typeof b === 'string' ? b : b.text;
              renderIconBullet(contentSlide, text, contentX + 0.2, currentY, index, colors, fonts, bulletConfig);
              currentY += 0.55;
            });
          } else {
            // Original bullet rendering
            const bulletText = bullets.map((b: any) => {
              const text = typeof b === 'string' ? b : b.text;
              const level = typeof b === 'object' ? (b.level || 0) : 0;
              const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
              const bold = typeof b === 'object' ? (b.bold || false) : false;
              const italic = typeof b === 'object' ? (b.italic || false) : false;
              const underline = typeof b === 'object' ? (b.underline || false) : false;
              
              return {
                text,
                options: {
                  bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                  indentLevel: level,
                  bold,
                  italic,
                  underline
                }
              };
            });
            
            contentSlide.addText(bulletText, {
              x: contentX,
              y: spacing.contentY,
              w: contentW,
              h: imageH,
              fontSize: fonts.bodySize * 0.85,  // Smaller font size
              fontFace: fonts.body,
              color: colors.text,
              lineSpacing: 20
            });
          }
        }
      }
    };

    // Content slides with custom layout
    const spacingMap: Record<string, { titleY: number; contentY: number; contentH: number }> = { 
      compact: { titleY: 0.3, contentY: 1.0, contentH: 5.5 }, 
      normal: { titleY: 0.5, contentY: 1.5, contentH: 4.5 }, 
      spacious: { titleY: 0.7, contentY: 2.0, contentH: 4.0 } 
    };
    const spacing = spacingMap[layouts.spacing as string] || spacingMap.normal;

    // Track image usage across slides
    let imageIndex = 0;

    slideData.slides.forEach((slide: any, slideIndex: number) => {
      const contentSlide = pptx.addSlide();
      contentSlide.background = { color: colors.background };

      // Slide title in yellow/accent on dark background
      contentSlide.addText(slide.title, {
        x: 0.5,
        y: spacing.titleY,
        w: 9,
        h: 0.75,
        fontSize: fonts.titleSize * 0.73,
        fontFace: fonts.title,
        bold: true,
        color: colors.accent,
      });

      // Subtle accent underline below title
      contentSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: spacing.titleY + 0.75, w: 2.0, h: 0.03,
        fill: { color: colors.accent },
      });

      // Embed AI-generated image if available for this slide
      if (slide._aiImageBase64 && slide._aiImageMimeType) {
        try {
          const mimeShort = slide._aiImageMimeType.includes('png') ? 'png' : 'jpeg';
          contentSlide.addImage({
            data: `image/${mimeShort};base64,${slide._aiImageBase64}`,
            x: 6.8,
            y: 0.3,
            w: 2.8,
            h: 2.0,
            sizing: { type: 'contain', w: 2.8, h: 2.0 },
            rounding: true,
          });
        } catch (aiImgErr) {
          console.warn(`Failed to embed AI image on slide ${slideIndex}:`, aiImgErr);
        }
      }

      const slideType = slide.type || 'bullets';
      const bullets = slide.bullets || [];

      switch (slideType) {
        case 'quote':
          renderQuoteSlide(contentSlide, slide, spacing);
          break;
          
        case 'image-grid':
          const gridImages = extractedImages.slice(imageIndex, imageIndex + (slide.imageCount || 4));
          renderImageGridSlide(contentSlide, slide, spacing, gridImages);
          imageIndex += gridImages.length;
          break;
          
        case 'image-left':
        case 'image-right': {
          const targetIndex = slide.preferredImageIndex !== undefined ? slide.preferredImageIndex : imageIndex;
          const imageToUse = extractedImages[targetIndex];
          const position = imageToUse ? imagePositionMap.get(imageToUse.filename) : undefined;
          
          renderImageSideSlide(
            contentSlide, 
            slide, 
            spacing, 
            slideType === 'image-left' ? 'left' : 'right', 
            extractedImages, 
            targetIndex,
            slide.imageCaption || position?.caption,
            slideIndex,
            slideData.slides.length
          );
          
          if (imageToUse && slide.preferredImageIndex === undefined) {
            imageIndex++;
          }
          break;
        }
          
        case 'image-top':
          // Image or placeholder on top
          if (extractedImages[imageIndex]) {
            const img = extractedImages[imageIndex];
            const dimensions = getOptimizedImageDimensions('image-top');
            const imageStyle = presentationSettings?.imageStyle || {};
            
            console.log(`Rendering image-top: ${img.filename} at ${dimensions.w}x${dimensions.h}`);
            
            const imageOptions = createImageOptions(
              {
                data: `data:image/${img.ext};base64,${img.base64}`,
                x: 0.5, y: spacing.contentY, w: dimensions.w, h: dimensions.h,
                sizing: { type: 'contain', w: dimensions.w, h: dimensions.h }
              },
              imageStyle,
              colors
            );
            contentSlide.addImage(imageOptions);
            imageIndex++;
          } else {
            contentSlide.addShape(pptx.ShapeType.rect, {
              x: 0.5, y: spacing.contentY, w: 9, h: 2.5,
              fill: { color: '1a3050' },
              line: { color: colors.secondary, width: 2 },
            });
            contentSlide.addText('[Image]', {
              x: 0.5, y: spacing.contentY + 1.0, w: 9, h: 0.4,
              fontSize: 14,
              color: '8899aa',
              align: 'center',
            });
          }
          
          if (bullets.length > 0) {
            const shouldEnhance = shouldUseEnhancedBullets(slide, slideIndex, slideData.slides.length);
            const useIconBullets = enhancedBullets?.enabled && shouldEnhance;
            const useShadedBoxes = shadedBoxes?.enabled && shouldEnhance;
            const useTwoColumns = shouldUseTwoColumns(bullets, { contentH: 2.5 }, useIconBullets);
            
            if (useTwoColumns) {
              // Two-column layout for better readability
              const midpoint = Math.ceil(bullets.length / 2);
              
              if (useIconBullets) {
                const bulletConfig = enhancedBullets;
                const boxConfig = shadedBoxes;
                
                if (useShadedBoxes) {
                  addShadedBox(contentSlide, 0.5, spacing.contentY + 3.0, 4.25, 2.5, boxConfig, colors);
                  addShadedBox(contentSlide, 5.25, spacing.contentY + 3.0, 4.25, 2.5, boxConfig, colors);
                }
                
                let currentY = spacing.contentY + 3.2;
                bullets.slice(0, midpoint).forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 0.7, currentY, index, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
                
                currentY = spacing.contentY + 3.2;
                bullets.slice(midpoint).forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 5.45, currentY, index + midpoint, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
              } else {
                const formatBullets = (items: any[]) => items.map((b: any) => {
                  const text = typeof b === 'string' ? b : b.text;
                  const level = typeof b === 'object' ? (b.level || 0) : 0;
                  const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                  const bold = typeof b === 'object' ? (b.bold || false) : false;
                  const italic = typeof b === 'object' ? (b.italic || false) : false;
                  const underline = typeof b === 'object' ? (b.underline || false) : false;
                  
                  return {
                    text,
                    options: {
                      bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                      indentLevel: level,
                      bold,
                      italic,
                      underline
                    }
                  };
                });
                
                const leftBullets = formatBullets(bullets.slice(0, midpoint));
                const rightBullets = formatBullets(bullets.slice(midpoint));
                
                contentSlide.addText(leftBullets, {
                  x: 0.5,
                  y: spacing.contentY + 3.0,
                  w: 4.25,
                  h: 2.5,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
                
                contentSlide.addText(rightBullets, {
                  x: 5.25,
                  y: spacing.contentY + 3.0,
                  w: 4.25,
                  h: 2.5,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
              }
            } else {
              // Single column layout
              if (useIconBullets) {
                const bulletConfig = enhancedBullets;
                const boxConfig = shadedBoxes;
                
                // Calculate content height based on bullets
                const bulletHeight = Math.min(bullets.length * 0.6, 2.5);
                
                // Add shaded box if enabled
                if (useShadedBoxes) {
                  addShadedBox(contentSlide, 0.5, spacing.contentY + 3.0, 9, bulletHeight, boxConfig, colors);
                }
                
                // Render each bullet with icon
                let currentY = spacing.contentY + 3.2;
                bullets.forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 0.7, currentY, index, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
              } else {
                // Original bullet rendering
                const bulletText = bullets.map((b: any) => {
                  const text = typeof b === 'string' ? b : b.text;
                  const level = typeof b === 'object' ? (b.level || 0) : 0;
                  const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                  const bold = typeof b === 'object' ? (b.bold || false) : false;
                  const italic = typeof b === 'object' ? (b.italic || false) : false;
                  const underline = typeof b === 'object' ? (b.underline || false) : false;
                  
                  return {
                    text,
                    options: {
                      bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                      indentLevel: level,
                      bold,
                      italic,
                      underline
                    }
                  };
                });
                
                contentSlide.addText(bulletText, {
                  x: 0.5,
                  y: spacing.contentY + 3.0,
                  w: 9,
                  h: 2.5,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
              }
            }
          }
          break;
          
        case 'image-full':
          // Full-slide image with text overlay
          if (extractedImages[imageIndex]) {
            const img = extractedImages[imageIndex];
            const dimensions = getOptimizedImageDimensions('full-image');
            const imageStyle = presentationSettings?.imageStyle || {};
            
            console.log(`Rendering image-full: ${img.filename} at ${dimensions.w}x${dimensions.h}`);
            
            // For full-slide images, we use basic options (no borders/shadows to avoid cluttering)
            contentSlide.addImage({
              data: `data:image/${img.ext};base64,${img.base64}`,
              x: 0, y: 0, w: '100%', h: '100%',
              sizing: { type: 'cover', w: 10, h: 7.5 }
            });
            
            // Semi-transparent overlay for text readability
            if (slide.bullets && slide.bullets.length > 0) {
              contentSlide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 5.5, w: '100%', h: 2,
                fill: { color: '000000', transparency: 50 }
              });
              
              const overlayText = slide.bullets.map((b: any) => typeof b === 'string' ? b : b.text).join(' • ');
              contentSlide.addText(overlayText, {
                x: 0.5, y: 6.0, w: 9, h: 1,
                fontSize: fonts.bodySize * 1.1,
                fontFace: fonts.body,
                color: 'FFFFFF',
                bold: true,
                align: 'center',
                valign: 'middle'
              });
            }
            imageIndex++;
          } else {
            // Fallback to regular bullets if no image
            if (bullets.length > 0) {
              const bulletText = bullets.map((b: any) => {
                const text = typeof b === 'string' ? b : b.text;
                const level = typeof b === 'object' ? (b.level || 0) : 0;
                const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                const bold = typeof b === 'object' ? (b.bold || false) : false;
                const italic = typeof b === 'object' ? (b.italic || false) : false;
                const underline = typeof b === 'object' ? (b.underline || false) : false;
                
                return {
                  text,
                  options: {
                    bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                    indentLevel: level,
                    bold,
                    italic,
                    underline
                  }
                };
              });
              
              contentSlide.addText(bulletText, {
                x: 0.5,
                y: spacing.contentY,
                w: 9,
                h: spacing.contentH,
                fontSize: fonts.bodySize * 0.85,  // Smaller font size
                fontFace: fonts.body,
                color: colors.text,
              });
            }
          }
          break;

        case 'two-column':
          if (bullets.length > 0) {
            const shouldEnhance = shouldUseEnhancedBullets(slide, slideIndex, slideData.slides.length);
            const useIconBullets = enhancedBullets?.enabled && shouldEnhance;
            const useShadedBoxes = shadedBoxes?.enabled && shouldEnhance;
            const midpoint = Math.ceil(bullets.length / 2);
            
            if (useIconBullets) {
              const bulletConfig = enhancedBullets;
              const boxConfig = shadedBoxes;
              
              // Add shaded boxes for both columns
              if (useShadedBoxes) {
                addShadedBox(contentSlide, 0.5, spacing.contentY, 4.25, spacing.contentH, boxConfig, colors);
                addShadedBox(contentSlide, 5.25, spacing.contentY, 4.25, spacing.contentH, boxConfig, colors);
              }
              
              // Left column
              let currentY = spacing.contentY + 0.2;
              bullets.slice(0, midpoint).forEach((b: any, index: number) => {
                const text = typeof b === 'string' ? b : b.text;
                renderIconBullet(contentSlide, text, 0.7, currentY, index, colors, fonts, bulletConfig);
                currentY += 0.55;
              });
              
              // Right column
              currentY = spacing.contentY + 0.2;
              bullets.slice(midpoint).forEach((b: any, index: number) => {
                const text = typeof b === 'string' ? b : b.text;
                renderIconBullet(contentSlide, text, 5.45, currentY, index + midpoint, colors, fonts, bulletConfig);
                currentY += 0.55;
              });
            } else {
              // Original formatting
              const formatBullets = (bulletArray: any[]) => bulletArray.map((b: any) => {
                const text = typeof b === 'string' ? b : b.text;
                const level = typeof b === 'object' ? (b.level || 0) : 0;
                const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                const bold = typeof b === 'object' ? (b.bold || false) : false;
                const italic = typeof b === 'object' ? (b.italic || false) : false;
                const underline = typeof b === 'object' ? (b.underline || false) : false;
                
                return {
                  text,
                  options: {
                    bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                    indentLevel: level,
                    bold,
                    italic,
                    underline
                  }
                };
              });
              
              const leftBullets = formatBullets(bullets.slice(0, midpoint));
              const rightBullets = formatBullets(bullets.slice(midpoint));
              
              contentSlide.addText(leftBullets, {
                x: 0.5,
                y: spacing.contentY,
                w: 4.25,
                h: spacing.contentH,
                fontSize: fonts.bodySize * 0.85,  // Smaller font size
                fontFace: fonts.body,
                color: colors.text,
              });
              
              contentSlide.addText(rightBullets, {
                x: 5.25,
                y: spacing.contentY,
                w: 4.25,
                h: spacing.contentH,
                fontSize: fonts.bodySize * 0.85,  // Smaller font size
                fontFace: fonts.body,
                color: colors.text,
              });
            }
          }
          break;

        case 'table': {
          // Render a data table from slide.tableData
          const tableData = slide.tableData;
          if (tableData?.headers && tableData?.rows) {
            const tableRows: any[][] = [];

            // Header row
            tableRows.push(tableData.headers.map((h: string) => ({
              text: h,
              options: {
                bold: true,
                color: 'FFFFFF',
                fill: { color: colors.accent },
                fontSize: 13,
                fontFace: fonts.body,
                align: 'center',
                valign: 'middle',
              },
            })));

            // Data rows with alternating colors
            tableData.rows.forEach((row: string[], rowIdx: number) => {
              tableRows.push(row.map((cell: string) => ({
                text: cell || '',
                options: {
                  fontSize: 12,
                  fontFace: fonts.body,
                  color: colors.text,
                  fill: { color: rowIdx % 2 === 0 ? colors.secondary : colors.primary },
                  align: 'center',
                  valign: 'middle',
                },
              })));
            });

            const colW = Math.min(9 / tableData.headers.length, 3);

            contentSlide.addTable(tableRows, {
              x: 0.5,
              y: spacing.contentY + 0.2,
              w: 9,
              colW: colW,
              rowH: 0.45,
              border: { type: 'solid', pt: 0.5, color: colors.secondary },
              autoPage: false,
            });
          }
          break;
        }

        case 'chart': {
          // Render a chart from slide.chartData
          const chartInfo = slide.chartData;
          if (chartInfo?.categories && chartInfo?.series) {
            const chartType = (chartInfo.chartType || 'bar').toUpperCase();
            const pptxChartType = chartType === 'LINE' ? pptx.ChartType.line
              : chartType === 'PIE' ? pptx.ChartType.pie
              : pptx.ChartType.bar;

            const chartData = chartInfo.series.map((s: any, idx: number) => ({
              name: s.name || `Series ${idx + 1}`,
              labels: chartInfo.categories,
              values: s.values.map((v: any) => Number(v) || 0),
            }));

            const seriesColors = [colors.accent, colors.secondary, 'FFFFFF', lightenColor(colors.accent, 40)];

            contentSlide.addChart(pptxChartType, chartData, {
              x: 0.8,
              y: spacing.contentY + 0.2,
              w: 8.4,
              h: spacing.contentH - 0.4,
              showTitle: false,
              showValue: true,
              valueFontSize: 10,
              valueFontColor: colors.text,
              catAxisLabelColor: colors.text,
              catAxisLabelFontSize: 11,
              valAxisLabelColor: colors.text,
              valAxisLabelFontSize: 10,
              legendPos: 'b',
              legendColor: colors.text,
              legendFontSize: 10,
              chartColors: seriesColors.slice(0, chartInfo.series.length),
            });
          }
          break;
        }

        default: // 'bullets' and fallback
          if (bullets.length > 0) {
            const shouldEnhance = shouldUseEnhancedBullets(slide, slideIndex, slideData.slides.length);
            const useIconBullets = enhancedBullets?.enabled && shouldEnhance;
            const useShadedBoxes = shadedBoxes?.enabled && shouldEnhance;
            const useTwoColumns = shouldUseTwoColumns(bullets, spacing, useIconBullets);
            
            if (useTwoColumns) {
              // Automatically use two-column layout for better readability
              const midpoint = Math.ceil(bullets.length / 2);
              
              if (useIconBullets) {
                const bulletConfig = enhancedBullets;
                const boxConfig = shadedBoxes;
                
                // Add shaded boxes for both columns
                if (useShadedBoxes) {
                  addShadedBox(contentSlide, 0.5, spacing.contentY, 4.25, spacing.contentH, boxConfig, colors);
                  addShadedBox(contentSlide, 5.25, spacing.contentY, 4.25, spacing.contentH, boxConfig, colors);
                }
                
                // Left column
                let currentY = spacing.contentY + 0.2;
                bullets.slice(0, midpoint).forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 0.7, currentY, index, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
                
                // Right column
                currentY = spacing.contentY + 0.2;
                bullets.slice(midpoint).forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 5.45, currentY, index + midpoint, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
              } else {
                // Original formatting for two columns
                const formatBullets = (items: any[]) => items.map((b: any) => {
                  const text = typeof b === 'string' ? b : b.text;
                  const level = typeof b === 'object' ? (b.level || 0) : 0;
                  const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                  const bold = typeof b === 'object' ? (b.bold || false) : false;
                  const italic = typeof b === 'object' ? (b.italic || false) : false;
                  const underline = typeof b === 'object' ? (b.underline || false) : false;
                  
                  return {
                    text,
                    options: {
                      bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                      indentLevel: level,
                      bold,
                      italic,
                      underline
                    }
                  };
                });
                
                const leftBullets = formatBullets(bullets.slice(0, midpoint));
                const rightBullets = formatBullets(bullets.slice(midpoint));
                
                contentSlide.addText(leftBullets, {
                  x: 0.5,
                  y: spacing.contentY,
                  w: 4.25,
                  h: spacing.contentH,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
                
                contentSlide.addText(rightBullets, {
                  x: 5.25,
                  y: spacing.contentY,
                  w: 4.25,
                  h: spacing.contentH,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
              }
            } else {
              // Single column layout
              if (useIconBullets) {
                const bulletConfig = enhancedBullets;
                const boxConfig = shadedBoxes;
                
                // Calculate content height based on bullets
                const bulletHeight = bullets.length * 0.6;
                const contentH = Math.min(bulletHeight, spacing.contentH);
                
                // Add shaded box if enabled
                if (useShadedBoxes) {
                  addShadedBox(contentSlide, 0.5, spacing.contentY, 9, contentH, boxConfig, colors);
                }
                
                // Render each bullet with icon
                let currentY = spacing.contentY + 0.2;
                bullets.forEach((b: any, index: number) => {
                  const text = typeof b === 'string' ? b : b.text;
                  renderIconBullet(contentSlide, text, 0.7, currentY, index, colors, fonts, bulletConfig);
                  currentY += 0.55;
                });
              } else {
                // Original bullet rendering
                const bulletText = bullets.map((b: any) => {
                  const text = typeof b === 'string' ? b : b.text;
                  const level = typeof b === 'object' ? (b.level || 0) : 0;
                  const listType = typeof b === 'object' ? (b.listType || 'bullet') : 'bullet';
                  const bold = typeof b === 'object' ? (b.bold || false) : false;
                  const italic = typeof b === 'object' ? (b.italic || false) : false;
                  const underline = typeof b === 'object' ? (b.underline || false) : false;
                  
                  return {
                    text,
                    options: {
                      bullet: listType === 'bullet' ? true : { type: 'number' as 'number' },
                      indentLevel: level,
                      bold,
                      italic,
                      underline
                    }
                  };
                });
                
                contentSlide.addText(bulletText, {
                  x: 0.5,
                  y: spacing.contentY,
                  w: 9,
                  h: spacing.contentH,
                  fontSize: fonts.bodySize * 0.85,  // Smaller font size
                  fontFace: fonts.body,
                  color: colors.text,
                });
              }
            }
          }
          break;
      }
    });

    // Generate PPTX file
    const pptxData = await pptx.write({ outputType: 'arraybuffer' });
    const pptxBlob = new Uint8Array(pptxData as ArrayBuffer);

    // Upload to storage
    const generatedFileName = `${generationId}.pptx`;
    const { error: uploadError } = await supabaseClient.storage
      .from('ppt-generated')
      .upload(generatedFileName, pptxBlob, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

    if (uploadError) {
      throw new Error(`Failed to upload generated file: ${uploadError.message}`);
    }

    // Update database — try with current_step first, fall back without it
    let updateError;
    const { error: err1 } = await supabaseAdmin
      .from('powerpoint_generations')
      .update({
        status: 'completed',
        current_step: 'completed',
        storage_path: generatedFileName,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    if (err1) {
      // current_step column might not exist yet — retry without it
      console.warn('Update with current_step failed, retrying without:', err1.message);
      const { error: err2 } = await supabaseAdmin
        .from('powerpoint_generations')
        .update({
          status: 'completed',
          storage_path: generatedFileName,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);
      updateError = err2;
    }

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    console.log('✅ PowerPoint generation completed successfully');

    return new Response(
      JSON.stringify({ success: true, generationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in generate-powerpoint:', error);
    console.error('❌ Error stack:', error.stack);

    // Try to update status to failed using the captured generationId
    if (generationId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseAdmin
          .from('powerpoint_generations')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
          })
          .eq('id', generationId);
          
        console.log(`✅ Updated generation ${generationId} status to failed`);
      } catch (e) {
        console.error('❌ Failed to update error status:', e);
      }
    } else {
      console.error('❌ No generationId available to update status');
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
