/**
 * Landscape A0 scientific poster → editable PowerPoint (.pptx).
 *
 * Same source data as posterSvg (plan + resolved figures + preset + layout),
 * rendered as a NATIVE PowerPoint slide so every text element stays editable
 * in PowerPoint / Keynote / Google Slides. Users double-click a title,
 * section header, bullet, or caption and retype — the layout, colors, and
 * figures stay intact.
 *
 * Layout dispatch mirrors posterSvg.ts:
 *   - classic         Bold conference poster with numbered ellipse chips.
 *   - journal-modern  Warm off-white background, serif title, no colored bars.
 *   - feature-center  Two flanking columns of narrow section panels around
 *                     a large hero center panel with the first figure.
 *   - timeline        Left-to-right numbered stops connected by arrows on a
 *                     horizontal accent spine.
 *
 * Implementation notes:
 *   - Text is emitted via slide.addText, which produces a real <p:txBody>
 *     with editable runs. NEVER rasterize text.
 *   - Colored bars are slide.addShape('rect'), which are editable shapes
 *     (users can resize / recolor them).
 *   - Figures are slide.addImage with data URLs from mammoth (embedded)
 *     or ai-illustrator (generated).
 *   - Slide size = 46.8 × 33.1 inches (A0 landscape), well within
 *     PowerPoint's max slide size.
 */
import type { AIIllustratorPreset } from './aiIllustratorPresets';
import type { PosterLayout } from './posterSvg';

interface Resolved {
  caption: string;
  source: 'embedded' | 'generate';
  imageDataUrl: string;
  failed?: boolean;
}

interface PosterPptxInput {
  plan: {
    title: string;
    authors: string;
    affiliation: string;
    keyTakeaway: string;
    sections: { name: string; bullets: string[]; figureIdx?: number }[];
    figures: {
      caption: string;
      source: 'embedded' | 'generate';
      embeddedIndex?: number;
      generatePrompt?: string;
    }[];
  };
  resolved: Resolved[];
  preset?: AIIllustratorPreset;
  layout?: PosterLayout;
}

// ─── Slide dimensions in inches (A0 landscape) ───────────────────────────────
const W = 46.8;
const H = 33.1;
// PAD bumped 1.2 → 1.6 to give the outer edge more breathing room, matching
// the SVG side of the formatting polish pass.
const PAD = 1.6;
const HEADER_H = 5.8;
const FOOTER_H = 2.7;
const TAKEAWAY_H = 3.0;
// GAP bumped 0.55 → 0.9 so panels read as distinct modules, not one dense block.
const GAP = 0.9;

interface Palette {
  primary: string;
  accent: string;
  body: string;
  muted: string;
  bg: string;
  band: string;
  panelBg: string;
  panelBgAlt: string;
  panelBorder: string;
}

function hex(c: string): string {
  const cleaned = (c || '').replace('#', '').substring(0, 6).padEnd(6, '0');
  return cleaned.toUpperCase();
}

function derivePalette(preset?: AIIllustratorPreset): Palette {
  const fallback: Palette = {
    primary: '0F172A',
    accent: '7C3AED',
    body: '1F2937',
    muted: '64748B',
    bg: 'F8FAFC',
    band: 'F1F5F9',
    panelBg: 'FFFFFF',
    panelBgAlt: 'F8FAFC',
    panelBorder: 'E2E8F0',
  };
  if (!preset || !preset.palette || preset.palette.length < 4) return fallback;
  const [c0, c1, , c3] = preset.palette;
  return {
    primary: hex(c0),
    accent: hex(c1),
    body: fallback.body,
    muted: fallback.muted,
    bg: fallback.bg,
    band: c3 ? hex(c3) : fallback.band,
    panelBg: fallback.panelBg,
    panelBgAlt: fallback.panelBgAlt,
    panelBorder: fallback.panelBorder,
  };
}

interface PanelDef {
  kind: 'section' | 'figure';
  section?: { name: string; bullets: string[] };
  figure?: Resolved;
}

function buildPanels(plan: PosterPptxInput['plan'], resolved: Resolved[]): PanelDef[] {
  const panels: PanelDef[] = [];
  const used = new Set<number>();
  for (const s of plan.sections) {
    const fig =
      typeof s.figureIdx === 'number' &&
      s.figureIdx >= 0 &&
      s.figureIdx < resolved.length &&
      !resolved[s.figureIdx].failed &&
      resolved[s.figureIdx].imageDataUrl
        ? resolved[s.figureIdx]
        : undefined;
    if (fig && typeof s.figureIdx === 'number') used.add(s.figureIdx);
    panels.push({ kind: 'section', section: { name: s.name, bullets: s.bullets }, figure: fig });
  }
  resolved.forEach((r, i) => {
    if (used.has(i) || r.failed || !r.imageDataUrl) return;
    panels.push({ kind: 'figure', figure: r });
  });
  return panels.slice(0, 9);
}

function num2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

// ─── Layout A: Classic Bold ──────────────────────────────────────────────────
function renderClassic(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: palette.bg };

  // Header bar + accent underline stripe.
  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: HEADER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: HEADER_H - 0.18, w: W, h: 0.18,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });

  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.5, w: W - 2 * PAD, h: 2.6,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 56, bold: true, fontFace: 'Calibri',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: 3.2, w: W - 2 * PAD, h: 1.0,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', fontSize: 26, fontFace: 'Calibri',
    });
  }
  if (input.plan.affiliation) {
    slide.addText(input.plan.affiliation, {
      x: PAD, y: 4.3, w: W - 2 * PAD, h: 0.8,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', italic: true, fontSize: 20, fontFace: 'Calibri',
    });
  }

  const panels = buildPanels(input.plan, input.resolved);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - TAKEAWAY_H - GAP - PAD;
  const colW = (W - 2 * PAD - GAP * (cols - 1)) / cols;
  const rowH = (contentBottom - contentTop - GAP * Math.max(0, rows - 1)) / rows;

  panels.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (colW + GAP);
    const y = contentTop + r * (rowH + GAP);
    const bg = r % 2 === 0 ? palette.panelBg : palette.panelBgAlt;

    slide.addShape('roundRect', {
      x, y, w: colW, h: rowH,
      fill: { color: bg },
      line: { color: palette.panelBorder, width: 1 },
      rectRadius: 0.2,
    });
    slide.addShape('rect', {
      x, y, w: 0.2, h: rowH,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    // Section-number chip: bumped 0.85 → 1.1 in diameter to match the SVG polish.
    slide.addShape('ellipse', {
      x: x + 0.55, y: y + 0.5, w: 1.1, h: 1.1,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    slide.addText(num2(i), {
      x: x + 0.55, y: y + 0.5, w: 1.1, h: 1.1,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', fontSize: 18, bold: true, fontFace: 'Calibri',
    });

    const headerLabel = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    slide.addText(headerLabel, {
      x: x + 1.85, y: y + 0.5, w: colW - 2.1, h: 1.1,
      valign: 'middle',
      color: palette.primary, fontSize: 26, bold: true, fontFace: 'Calibri',
    });

    // Interior padding 0.35/0.45 → 0.6, and content start moved down to
    // clear the taller header chip. Matches the SVG PANEL_PAD_X=24 change.
    const PANEL_PAD = 0.5;
    const contentY = y + 1.95;
    const contentH = rowH - 2.15;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        // Figure: 55 % → 62 % of interior. Bigger visual weight.
        const imgH = contentH * 0.62;
        slide.addImage({
          data: p.figure.imageDataUrl,
          x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
          sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
        });
        const bullets = p.section.bullets.slice(0, 3).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY + imgH + 0.35, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.5,
            color: palette.body, fontSize: 17, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 8, lineSpacingMultiple: 1.15,
          });
        }
      } else {
        // Text-only: 16 → 20 pt, better line spacing.
        const bullets = p.section.bullets.slice(0, 5).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: contentH,
            color: palette.body, fontSize: 20, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 12, lineSpacingMultiple: 1.2,
          });
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      // Standalone figure: 72 % → 78 % so the figure is the point of the panel.
      const imgH = contentH * 0.78;
      slide.addImage({
        data: p.figure.imageDataUrl,
        x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
        sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
      });
      slide.addText(p.figure.caption, {
        x: x + PANEL_PAD, y: contentY + imgH + 0.35, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.5,
        color: palette.muted, fontSize: 15, italic: true, fontFace: 'Calibri',
        valign: 'top', lineSpacingMultiple: 1.2,
      });
    }
  });

  const takeawayY = contentBottom + GAP;
  if (input.plan.keyTakeaway) {
    slide.addShape('rect', {
      x: 0, y: takeawayY, w: W, h: TAKEAWAY_H,
      fill: { color: palette.band },
      line: { color: palette.band, width: 0 },
    });
    slide.addText('“', {
      x: PAD, y: takeawayY, w: 2.2, h: TAKEAWAY_H,
      color: palette.accent, fontSize: 128, bold: true, fontFace: 'Georgia',
      valign: 'middle', transparency: 55,
    });
    slide.addText('KEY TAKEAWAY', {
      x: PAD + 2.0, y: takeawayY + 0.25, w: 6, h: 0.7,
      color: palette.primary, fontSize: 16, bold: true, charSpacing: 3, fontFace: 'Calibri',
    });
    slide.addText(input.plan.keyTakeaway, {
      x: PAD + 2.0, y: takeawayY + 0.95, w: W - PAD * 2 - 2.0, h: TAKEAWAY_H - 1.1,
      color: palette.body, fontSize: 30, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.1,
    });
  }

  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: 0, y: footerY, w: W, h: FOOTER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: FOOTER_H,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 14, fontFace: 'Calibri', transparency: 15,
  });
}

// ─── Layout B: Journal Modern ────────────────────────────────────────────────
function renderJournalModern(slide: any, input: PosterPptxInput, palette: Palette): void {
  // Warm off-white canvas, no colored bars.
  slide.background = { color: 'FCFCFB' };

  // Title area — serif Georgia, left-aligned. Thin rule beneath the block.
  const titleTop = 1.4;
  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: titleTop, w: W - 2 * PAD, h: 2.4,
    color: palette.primary, fontSize: 44, bold: true, fontFace: 'Georgia',
    valign: 'top',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: titleTop + 2.5, w: W - 2 * PAD, h: 0.7,
      color: palette.body, fontSize: 18, fontFace: 'Calibri', valign: 'top',
    });
  }
  if (input.plan.affiliation) {
    slide.addText(input.plan.affiliation, {
      x: PAD, y: titleTop + 3.2, w: W - 2 * PAD, h: 0.6,
      color: palette.muted, fontSize: 14, italic: true, fontFace: 'Calibri', valign: 'top',
    });
  }
  const ruleY = titleTop + 4.0;
  slide.addShape('rect', {
    x: PAD, y: ruleY, w: W - 2 * PAD, h: 0.03,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });

  // Panel grid — no colored panel headers; wider gaps.
  const panels = buildPanels(input.plan, input.resolved);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const gap = GAP + 0.35; // more breathing room than classic
  const contentTop = ruleY + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const colW = (W - 2 * PAD - gap * (cols - 1)) / cols;
  const rowH = (contentBottom - contentTop - gap * Math.max(0, rows - 1)) / rows;

  panels.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (colW + gap);
    const y = contentTop + r * (rowH + gap);

    // Subtle off-white panel bg, no border.
    slide.addShape('rect', {
      x, y, w: colW, h: rowH,
      fill: { color: palette.panelBg },
      line: { color: palette.panelBg, width: 0 },
    });

    // Small-caps section label + short accent underline.
    const headerLabel = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    slide.addText(headerLabel.toUpperCase(), {
      x: x + 0.3, y: y + 0.4, w: colW - 0.6, h: 0.5,
      color: palette.primary, fontSize: 14, bold: true, charSpacing: 2, fontFace: 'Calibri',
      valign: 'top',
    });
    slide.addShape('rect', {
      x: x + 0.3, y: y + 0.9, w: 1.6, h: 0.07,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });

    const contentY = y + 1.3;
    const contentH = rowH - 1.5;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = contentH * 0.6;
        slide.addImage({
          data: p.figure.imageDataUrl,
          x: x + 0.3, y: contentY, w: colW - 0.6, h: imgH,
          sizing: { type: 'contain', w: colW - 0.6, h: imgH },
        });
        const bullets = p.section.bullets.slice(0, 3).map((b) => ({ text: b, options: {} }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + 0.3, y: contentY + imgH + 0.25, w: colW - 0.6, h: contentH - imgH - 0.35,
            color: palette.body, fontSize: 13, fontFace: 'Georgia',
            valign: 'top', paraSpaceAfter: 6,
          });
        }
      } else {
        const bullets = p.section.bullets.slice(0, 6).map((b) => ({ text: b, options: {} }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + 0.3, y: contentY, w: colW - 0.6, h: contentH,
            color: palette.body, fontSize: 15, fontFace: 'Georgia',
            valign: 'top', paraSpaceAfter: 8,
          });
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = contentH * 0.75;
      slide.addImage({
        data: p.figure.imageDataUrl,
        x: x + 0.3, y: contentY, w: colW - 0.6, h: imgH,
        sizing: { type: 'contain', w: colW - 0.6, h: imgH },
      });
      slide.addText(p.figure.caption, {
        x: x + 0.3, y: contentY + imgH + 0.25, w: colW - 0.6, h: contentH - imgH - 0.35,
        color: palette.muted, fontSize: 12, italic: true, fontFace: 'Georgia',
        valign: 'top',
      });
    }
  });

  // Footer — thin rule + inline takeaway.
  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: 0.03,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  if (input.plan.keyTakeaway) {
    slide.addText('KEY TAKEAWAY', {
      x: PAD, y: footerY + 0.4, w: 3.5, h: 0.5,
      color: palette.primary, fontSize: 12, bold: true, charSpacing: 2, fontFace: 'Calibri',
      valign: 'top',
    });
    slide.addText(input.plan.keyTakeaway, {
      x: PAD + 3.7, y: footerY + 0.4, w: W - PAD * 2 - 3.7, h: FOOTER_H - 1,
      color: palette.body, fontSize: 15, fontFace: 'Georgia', valign: 'top',
    });
  }
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: H - 0.7, w: W - 2 * PAD, h: 0.5,
    align: 'right', valign: 'bottom',
    color: palette.muted, fontSize: 11, fontFace: 'Calibri',
  });
}

// ─── Layout C: Feature Center ────────────────────────────────────────────────
function renderFeatureCenter(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: palette.bg };

  // Header bar + accent underline stripe.
  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: HEADER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: HEADER_H - 0.12, w: W, h: 0.12,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });

  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.6, w: W - 2 * PAD, h: 2.2,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 42, bold: true, fontFace: 'Calibri',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: 3.6, w: W - 2 * PAD, h: 0.9,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', fontSize: 20, fontFace: 'Calibri',
    });
  }

  const panels = buildPanels(input.plan, input.resolved);
  const sectionPanels = panels.filter((p) => p.kind === 'section');
  const half = Math.ceil(sectionPanels.length / 2);
  const leftSections = sectionPanels.slice(0, half);
  const rightSections = sectionPanels.slice(half);
  const heroFigure = panels.find((p) => p.figure && p.figure.imageDataUrl)?.figure;

  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const heroH = contentBottom - contentTop;
  const flankW = 11.1; // ≈ 380 px scaled to A0
  const heroW = W - 2 * PAD - 2 * flankW - 2 * GAP;
  const heroX = PAD + flankW + GAP;

  const drawFlankColumn = (col: PanelDef[], colX: number) => {
    if (col.length === 0) return;
    const perH = (heroH - GAP * Math.max(0, col.length - 1)) / col.length;
    col.forEach((p, i) => {
      const y = contentTop + i * (perH + GAP);
      slide.addShape('roundRect', {
        x: colX, y, w: flankW, h: perH,
        fill: { color: palette.panelBg },
        line: { color: palette.panelBorder, width: 1 },
        rectRadius: 0.15,
      });
      slide.addShape('rect', {
        x: colX, y, w: 0.15, h: perH,
        fill: { color: palette.accent },
        line: { color: palette.accent, width: 0 },
      });
      slide.addText((p.section?.name ?? '').toUpperCase(), {
        x: colX + 0.4, y: y + 0.35, w: flankW - 0.6, h: 0.5,
        color: palette.primary, fontSize: 14, bold: true, charSpacing: 2, fontFace: 'Calibri',
        valign: 'top',
      });
      slide.addShape('rect', {
        x: colX + 0.4, y: y + 0.9, w: 1.4, h: 0.07,
        fill: { color: palette.accent },
        line: { color: palette.accent, width: 0 },
      });

      const bullets = (p.section?.bullets ?? []).slice(0, 5).map((b) => ({ text: b, options: { bullet: true } }));
      if (bullets.length > 0) {
        slide.addText(bullets, {
          x: colX + 0.4, y: y + 1.25, w: flankW - 0.8, h: perH - 1.5,
          color: palette.body, fontSize: 14, fontFace: 'Calibri',
          valign: 'top', paraSpaceAfter: 5,
        });
      }
    });
  };
  drawFlankColumn(leftSections, PAD);
  drawFlankColumn(rightSections, W - PAD - flankW);

  // Hero center — accent header band, big image, caption, rounded takeaway card.
  slide.addShape('roundRect', {
    x: heroX, y: contentTop, w: heroW, h: heroH,
    fill: { color: palette.panelBg },
    line: { color: palette.panelBorder, width: 2 },
    rectRadius: 0.2,
  });
  slide.addShape('rect', {
    x: heroX, y: contentTop, w: heroW, h: 1.35,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });
  slide.addText('HERO RESULT', {
    x: heroX + 0.55, y: contentTop, w: heroW - 1, h: 1.35,
    valign: 'middle',
    color: 'FFFFFF', fontSize: 20, bold: true, charSpacing: 3, fontFace: 'Calibri',
  });

  const heroContentY = contentTop + 1.6;
  const takeawayCardH = 3.6;
  const heroImgAreaH = heroH - 1.35 - takeawayCardH - 1.2;
  if (heroFigure) {
    slide.addImage({
      data: heroFigure.imageDataUrl,
      x: heroX + 0.4, y: heroContentY, w: heroW - 0.8, h: heroImgAreaH,
      sizing: { type: 'contain', w: heroW - 0.8, h: heroImgAreaH },
    });
    slide.addText(heroFigure.caption, {
      x: heroX + 0.4, y: heroContentY + heroImgAreaH + 0.15, w: heroW - 0.8, h: 0.7,
      align: 'center', valign: 'top',
      color: palette.muted, fontSize: 14, italic: true, fontFace: 'Calibri',
    });
  }

  if (input.plan.keyTakeaway) {
    const takeawayCardY = contentTop + heroH - takeawayCardH - 0.4;
    slide.addShape('roundRect', {
      x: heroX + 0.4, y: takeawayCardY, w: heroW - 0.8, h: takeawayCardH,
      fill: { color: palette.band },
      line: { color: palette.band, width: 0 },
      rectRadius: 0.15,
    });
    slide.addText('KEY TAKEAWAY', {
      x: heroX + 0.8, y: takeawayCardY + 0.35, w: heroW - 1.6, h: 0.5,
      color: palette.primary, fontSize: 14, bold: true, charSpacing: 3, fontFace: 'Calibri',
      valign: 'top',
    });
    slide.addText(input.plan.keyTakeaway, {
      x: heroX + 0.8, y: takeawayCardY + 1.05, w: heroW - 1.6, h: takeawayCardH - 1.2,
      color: palette.body, fontSize: 20, fontFace: 'Calibri', valign: 'top',
    });
  }

  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: 0, y: footerY, w: W, h: FOOTER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: FOOTER_H,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 14, fontFace: 'Calibri', transparency: 15,
  });
}

// ─── Layout D: Timeline / Story ──────────────────────────────────────────────
function renderTimeline(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: palette.bg };

  // Compact title strip (shorter than classic).
  const titleH = HEADER_H - 1.3;
  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: titleH,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: titleH - 0.12, w: W, h: 0.12,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });
  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.5, w: W - 2 * PAD - 12, h: titleH - 0.8,
    valign: 'middle',
    color: 'FFFFFF', fontSize: 36, bold: true, fontFace: 'Calibri',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: W - PAD - 12, y: 0.5, w: 12, h: titleH - 0.8,
      align: 'right', valign: 'middle',
      color: 'FFFFFF', fontSize: 15, fontFace: 'Calibri',
    });
  }

  // Horizontal timeline spine.
  const panels = buildPanels(input.plan, input.resolved);
  const stopCount = Math.min(panels.length, 5);
  const stops = panels.slice(0, stopCount);
  const spineY = titleH + 2.0;
  slide.addShape('rect', {
    x: PAD + 1.2, y: spineY - 0.06, w: W - 2 * PAD - 2.4, h: 0.12,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });

  const stopW = (W - 2 * PAD - GAP * Math.max(0, stopCount - 1)) / Math.max(1, stopCount);

  stops.forEach((p, i) => {
    const x = PAD + i * (stopW + GAP);
    const cx = x + stopW / 2;

    // Stop circle on the spine with the section number.
    slide.addShape('ellipse', {
      x: cx - 0.65, y: spineY - 0.65, w: 1.3, h: 1.3,
      fill: { color: 'FFFFFF' },
      line: { color: palette.accent, width: 3 },
    });
    slide.addText(num2(i), {
      x: cx - 0.65, y: spineY - 0.65, w: 1.3, h: 1.3,
      align: 'center', valign: 'middle',
      color: palette.accent, fontSize: 16, bold: true, fontFace: 'Calibri',
    });

    // Arrow triangle between stops.
    if (i < stops.length - 1) {
      const ax = x + stopW + GAP / 2;
      slide.addShape('rightTriangle', {
        x: ax - 0.15, y: spineY - 0.2, w: 0.4, h: 0.4,
        fill: { color: palette.accent },
        line: { color: palette.accent, width: 0 },
        rotate: 30,
      });
    }

    // Panel below the stop.
    const panelY = spineY + 1.2;
    const panelH = H - FOOTER_H - TAKEAWAY_H - GAP - PAD - panelY;
    slide.addShape('roundRect', {
      x, y: panelY, w: stopW, h: panelH,
      fill: { color: palette.panelBg },
      line: { color: palette.panelBorder, width: 1 },
      rectRadius: 0.15,
    });

    const headerLabel = (p.section?.name ?? p.figure?.caption ?? '').toUpperCase();
    slide.addText(headerLabel, {
      x: x + 0.25, y: panelY + 0.35, w: stopW - 0.5, h: 0.55,
      align: 'center', valign: 'top',
      color: palette.primary, fontSize: 15, bold: true, charSpacing: 2, fontFace: 'Calibri',
    });
    slide.addShape('rect', {
      x: cx - 0.6, y: panelY + 1.0, w: 1.2, h: 0.06,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });

    let contentY = panelY + 1.3;
    const fig = p.figure;
    if (fig && fig.imageDataUrl) {
      const imgH = (panelH - 1.3) * 0.55;
      slide.addImage({
        data: fig.imageDataUrl,
        x: x + 0.35, y: contentY, w: stopW - 0.7, h: imgH,
        sizing: { type: 'contain', w: stopW - 0.7, h: imgH },
      });
      contentY += imgH + 0.25;
    }
    const bullets = (p.section?.bullets ?? []).slice(0, 4).map((b) => ({ text: b, options: { bullet: true } }));
    if (bullets.length > 0) {
      slide.addText(bullets, {
        x: x + 0.35, y: contentY, w: stopW - 0.7, h: panelY + panelH - contentY - 0.25,
        color: palette.body, fontSize: 13, fontFace: 'Calibri',
        valign: 'top', paraSpaceAfter: 4,
      });
    }
  });

  // END OF STORY accent-band takeaway strip.
  const takeawayY = H - FOOTER_H - TAKEAWAY_H - GAP;
  if (input.plan.keyTakeaway) {
    slide.addShape('rect', {
      x: 0, y: takeawayY, w: W, h: TAKEAWAY_H,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    slide.addText('END OF STORY', {
      x: PAD, y: takeawayY + 0.35, w: 8, h: 0.6,
      color: 'FFFFFF', fontSize: 13, bold: true, charSpacing: 3, fontFace: 'Calibri',
      valign: 'top', transparency: 15,
    });
    slide.addText(input.plan.keyTakeaway, {
      x: PAD, y: takeawayY + 1.0, w: W - 2 * PAD, h: TAKEAWAY_H - 1.2,
      color: 'FFFFFF', fontSize: 20, bold: false, fontFace: 'Calibri', valign: 'top',
    });
  }

  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: 0, y: footerY, w: W, h: FOOTER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: FOOTER_H,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 14, fontFace: 'Calibri', transparency: 15,
  });
}

// ─── Layout E: Infographic Vibrant ───────────────────────────────────────────
const INFOGRAPHIC_ACCENTS_PPTX = ['EF4444', 'F59E0B', '10B981', '3B82F6', '8B5CF6'];
function renderInfographicVibrant(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: palette.bg };

  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: HEADER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: HEADER_H - 0.65, w: W, h: 0.65,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });
  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.5, w: W - 2 * PAD, h: 2.6,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 56, bold: true, fontFace: 'Calibri',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: 3.3, w: W - 2 * PAD, h: 1.0,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', fontSize: 24, fontFace: 'Calibri',
    });
  }

  const panels = buildPanels(input.plan, input.resolved);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - TAKEAWAY_H - GAP - PAD;
  const colW = (W - 2 * PAD - GAP * (cols - 1)) / cols;
  const rowH = (contentBottom - contentTop - GAP * Math.max(0, rows - 1)) / rows;

  panels.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (colW + GAP);
    const y = contentTop + r * (rowH + GAP);
    const accent = INFOGRAPHIC_ACCENTS_PPTX[i % INFOGRAPHIC_ACCENTS_PPTX.length];

    slide.addShape('roundRect', {
      x, y, w: colW, h: rowH,
      fill: { color: 'FFFFFF' },
      line: { color: accent, width: 3 },
      rectRadius: 0.3,
    });
    slide.addShape('ellipse', {
      x: x + 0.5, y: y + 0.5, w: 1.4, h: 1.4,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });
    slide.addText(num2(i), {
      x: x + 0.5, y: y + 0.5, w: 1.4, h: 1.4,
      align: 'center', valign: 'middle',
      color: 'FFFFFF', fontSize: 22, bold: true, fontFace: 'Calibri',
    });
    const label = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    slide.addText(label, {
      x: x + 2.1, y: y + 0.5, w: colW - 2.4, h: 1.4,
      valign: 'middle',
      color: accent, fontSize: 26, bold: true, fontFace: 'Calibri',
    });

    const contentY = y + 2.2;
    const contentH = rowH - 2.5;
    const PANEL_PAD = 0.55;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = contentH * 0.6;
        slide.addImage({
          data: p.figure.imageDataUrl,
          x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
          sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
        });
        const bullets = p.section.bullets.slice(0, 3).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY + imgH + 0.35, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.5,
            color: palette.body, fontSize: 17, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 8, lineSpacingMultiple: 1.15,
          });
        }
      } else {
        const bullets = p.section.bullets.slice(0, 5).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: contentH,
            color: palette.body, fontSize: 19, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 12, lineSpacingMultiple: 1.2,
          });
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = contentH * 0.78;
      slide.addImage({
        data: p.figure.imageDataUrl,
        x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
        sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
      });
      slide.addText(p.figure.caption, {
        x: x + PANEL_PAD, y: contentY + imgH + 0.35, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.5,
        color: palette.muted, fontSize: 15, italic: true, fontFace: 'Calibri',
        valign: 'top',
      });
    }
  });

  // Rainbow candy-bar takeaway strip.
  const takeawayY = contentBottom + GAP;
  if (input.plan.keyTakeaway) {
    for (let i = 0; i < 5; i++) {
      slide.addShape('rect', {
        x: 0, y: takeawayY + i * 0.12, w: W, h: 0.12,
        fill: { color: INFOGRAPHIC_ACCENTS_PPTX[i % INFOGRAPHIC_ACCENTS_PPTX.length] },
        line: { color: INFOGRAPHIC_ACCENTS_PPTX[i % INFOGRAPHIC_ACCENTS_PPTX.length], width: 0 },
      });
    }
    slide.addShape('rect', {
      x: 0, y: takeawayY + 0.6, w: W, h: TAKEAWAY_H - 0.6,
      fill: { color: palette.band },
      line: { color: palette.band, width: 0 },
    });
    slide.addText('KEY TAKEAWAY', {
      x: PAD, y: takeawayY + 0.9, w: 6, h: 0.6,
      color: palette.primary, fontSize: 15, bold: true, charSpacing: 3, fontFace: 'Calibri',
    });
    slide.addText(input.plan.keyTakeaway, {
      x: PAD, y: takeawayY + 1.55, w: W - 2 * PAD, h: TAKEAWAY_H - 1.7,
      color: palette.body, fontSize: 26, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.1,
    });
  }

  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: 0, y: footerY, w: W, h: FOOTER_H,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: FOOTER_H,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 14, fontFace: 'Calibri', transparency: 15,
  });
}

// ─── Layout F: Editorial Magazine ─────────────────────────────────────────────
function renderEditorialMagazine(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: 'FBF9F4' };

  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: HEADER_H - 0.9,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: HEADER_H - 1.0, w: W, h: 0.12,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });
  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.7, w: W - 2 * PAD, h: 2.8,
    valign: 'middle',
    color: 'FFFFFF', fontSize: 58, bold: true, fontFace: 'Georgia',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: HEADER_H - 2.3, w: W - 2 * PAD, h: 0.8,
      align: 'right', valign: 'middle',
      color: 'FFFFFF', fontSize: 18, fontFace: 'Calibri',
    });
  }

  const panels = buildPanels(input.plan, input.resolved);
  const cols = 2;
  const gap = 1.8;
  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const colW = (W - 2 * PAD - gap) / cols;

  // Pull quote reserves the top of the right column.
  const pullQuoteH = input.plan.keyTakeaway ? 9 : 0;
  const pullQuoteX = PAD + colW + gap;
  const pullQuoteY = contentTop;
  if (input.plan.keyTakeaway) {
    slide.addShape('rect', {
      x: pullQuoteX, y: pullQuoteY, w: colW, h: pullQuoteH,
      fill: { color: palette.band },
      line: { color: palette.band, width: 0 },
    });
    slide.addShape('rect', {
      x: pullQuoteX, y: pullQuoteY, w: 0.2, h: pullQuoteH,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    slide.addText('“', {
      x: pullQuoteX + 0.7, y: pullQuoteY + 0.3, w: 2, h: 2,
      color: palette.accent, fontSize: 128, bold: true, fontFace: 'Georgia', valign: 'top',
      transparency: 45,
    });
    slide.addText(input.plan.keyTakeaway, {
      x: pullQuoteX + 0.9, y: pullQuoteY + 2.5, w: colW - 1.5, h: pullQuoteH - 3,
      color: palette.primary, fontSize: 30, italic: true, fontFace: 'Georgia', valign: 'top',
      lineSpacingMultiple: 1.15,
    });
  }

  // Flow blocks into two columns. Heights are estimated.
  let leftY = contentTop;
  let rightY = pullQuoteY + pullQuoteH + 0.8;

  const estimateBlockH = (p: PanelDef): number => {
    let h = 1.4;
    if (p.figure) h += 5.2;
    if (p.section) {
      h += Math.min(p.section.bullets.length, 5) * 1.9;
    } else if (p.figure) {
      h += 0.9;
    }
    return h + 0.7;
  };

  panels.forEach((p, i) => {
    const blockH = estimateBlockH(p);
    const leftRoom = contentBottom - leftY;
    const rightRoom = contentBottom - rightY;
    const placeLeft = leftRoom >= rightRoom;
    const x = placeLeft ? PAD : pullQuoteX;
    const y = placeLeft ? leftY : rightY;
    if (blockH > (placeLeft ? leftRoom : rightRoom)) return;

    const label = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    slide.addText(label.toUpperCase(), {
      x, y, w: colW, h: 0.6,
      color: palette.primary, fontSize: 16, bold: true, charSpacing: 3, fontFace: 'Calibri', valign: 'top',
    });
    slide.addShape('rect', {
      x, y: y + 0.55, w: 2.4, h: 0.09,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    let by = y + 1.05;
    if (p.figure) {
      const imgH = 4.5;
      slide.addImage({
        data: p.figure.imageDataUrl,
        x, y: by, w: colW, h: imgH,
        sizing: { type: 'contain', w: colW, h: imgH },
      });
      by += imgH + 0.35;
    }
    if (p.kind === 'section' && p.section && p.section.bullets.length > 0) {
      const bullets = p.section.bullets.slice(0, 5).map((b) => ({ text: b, options: {} }));
      slide.addText(bullets, {
        x, y: by, w: colW, h: blockH - (by - y) - 0.5,
        color: palette.body, fontSize: 20, fontFace: 'Georgia', valign: 'top',
        paraSpaceAfter: 10, lineSpacingMultiple: 1.25,
      });
    } else if (p.kind === 'figure' && p.figure && p.figure.caption) {
      slide.addText(p.figure.caption, {
        x, y: by, w: colW, h: 0.9,
        color: palette.muted, fontSize: 15, italic: true, fontFace: 'Georgia', valign: 'top',
      });
    }
    if (placeLeft) leftY += blockH;
    else rightY += blockH;
  });

  slide.addShape('rect', {
    x: PAD, y: H - FOOTER_H, w: W - 2 * PAD, h: 0.03,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: H - 0.7, w: W - 2 * PAD, h: 0.5,
    align: 'right', valign: 'bottom',
    color: palette.muted, fontSize: 13, italic: true, fontFace: 'Georgia',
  });
}

// ─── Layout G: Data Dashboard ─────────────────────────────────────────────────
function renderDataDashboard(slide: any, input: PosterPptxInput, palette: Palette): void {
  slide.background = { color: palette.bg };

  const titleH = 4.5;
  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: titleH,
    fill: { color: palette.primary },
    line: { color: palette.primary, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: titleH - 0.12, w: W, h: 0.12,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
  });
  slide.addText(input.plan.title || 'Untitled poster', {
    x: PAD, y: 0.5, w: W - 2 * PAD - 7, h: 2.4,
    color: 'FFFFFF', fontSize: 44, bold: true, fontFace: 'Calibri', valign: 'top',
  });
  if (input.plan.authors) {
    slide.addText(input.plan.authors, {
      x: PAD, y: 3.0, w: W - 2 * PAD - 7, h: 1,
      color: 'FFFFFF', fontSize: 18, fontFace: 'Calibri', valign: 'top',
    });
  }
  // Dashboard chip top-right.
  slide.addShape('roundRect', {
    x: W - PAD - 6.5, y: 1.5, w: 6.5, h: 1.8,
    fill: { color: palette.accent },
    line: { color: palette.accent, width: 0 },
    rectRadius: 0.2,
  });
  slide.addText('DASHBOARD', {
    x: W - PAD - 6.5, y: 1.5, w: 6.5, h: 1.8,
    align: 'center', valign: 'middle',
    color: 'FFFFFF', fontSize: 18, bold: true, charSpacing: 4, fontFace: 'Calibri',
  });

  const panels = buildPanels(input.plan, input.resolved).slice(0, 6);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const contentTop = titleH + PAD;
  const contentBottom = H - FOOTER_H - TAKEAWAY_H - GAP - PAD;
  const colW = (W - 2 * PAD - GAP * (cols - 1)) / cols;
  const rowH = (contentBottom - contentTop - GAP * Math.max(0, rows - 1)) / rows;

  panels.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (colW + GAP);
    const y = contentTop + r * (rowH + GAP);
    const hdrH = 2.4;

    slide.addShape('roundRect', {
      x, y, w: colW, h: rowH,
      fill: { color: 'FFFFFF' },
      line: { color: palette.panelBorder, width: 1 },
      rectRadius: 0.2,
    });
    slide.addShape('rect', {
      x, y, w: colW, h: hdrH,
      fill: { color: palette.primary },
      line: { color: palette.primary, width: 0 },
    });
    slide.addShape('rect', {
      x, y: y + hdrH - 0.2, w: colW, h: 0.2,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    slide.addText(num2(i), {
      x: x + 0.6, y: y + 0.35, w: 3, h: 1.4,
      color: 'FFFFFF', fontSize: 48, bold: true, fontFace: 'Calibri', valign: 'top',
    });
    const label = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    slide.addText(label.toUpperCase(), {
      x: x + 0.6, y: y + 1.55, w: colW - 1.2, h: 0.7,
      color: 'FFFFFF', fontSize: 18, bold: true, charSpacing: 3, fontFace: 'Calibri', valign: 'top',
    });

    const contentY = y + hdrH + 0.5;
    const contentH = rowH - hdrH - 0.85;
    const PANEL_PAD = 0.55;

    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = contentH * 0.6;
        slide.addImage({
          data: p.figure.imageDataUrl,
          x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
          sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
        });
        const bullets = p.section.bullets.slice(0, 3).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY + imgH + 0.3, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.45,
            color: palette.body, fontSize: 17, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 6, lineSpacingMultiple: 1.15,
          });
        }
      } else {
        const bullets = p.section.bullets.slice(0, 4).map((b) => ({ text: b, options: { bullet: true } }));
        if (bullets.length > 0) {
          slide.addText(bullets, {
            x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: contentH,
            color: palette.body, fontSize: 19, fontFace: 'Calibri',
            valign: 'top', paraSpaceAfter: 10, lineSpacingMultiple: 1.2,
          });
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = contentH * 0.78;
      slide.addImage({
        data: p.figure.imageDataUrl,
        x: x + PANEL_PAD, y: contentY, w: colW - 2 * PANEL_PAD, h: imgH,
        sizing: { type: 'contain', w: colW - 2 * PANEL_PAD, h: imgH },
      });
      slide.addText(p.figure.caption, {
        x: x + PANEL_PAD, y: contentY + imgH + 0.3, w: colW - 2 * PANEL_PAD, h: contentH - imgH - 0.45,
        color: palette.muted, fontSize: 15, italic: true, fontFace: 'Calibri',
        valign: 'top',
      });
    }
  });

  // Dark takeaway strip with accent side bar.
  const takeawayY = contentBottom + GAP;
  if (input.plan.keyTakeaway) {
    slide.addShape('rect', {
      x: 0, y: takeawayY, w: W, h: TAKEAWAY_H,
      fill: { color: palette.primary },
      line: { color: palette.primary, width: 0 },
    });
    slide.addShape('rect', {
      x: 0, y: takeawayY, w: 0.2, h: TAKEAWAY_H,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });
    slide.addText('SUMMARY', {
      x: PAD, y: takeawayY + 0.3, w: 4, h: 0.7,
      color: palette.accent, fontSize: 16, bold: true, charSpacing: 3, fontFace: 'Calibri',
    });
    slide.addText(input.plan.keyTakeaway, {
      x: PAD, y: takeawayY + 1.1, w: W - 2 * PAD, h: TAKEAWAY_H - 1.3,
      color: 'FFFFFF', fontSize: 26, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.15,
    });
  }

  const footerY = H - FOOTER_H;
  slide.addShape('rect', {
    x: 0, y: footerY, w: W, h: FOOTER_H,
    fill: { color: palette.bg },
    line: { color: palette.bg, width: 0 },
  });
  slide.addShape('rect', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: 0.02,
    fill: { color: palette.panelBorder },
    line: { color: palette.panelBorder, width: 0 },
  });
  slide.addText('Generated with BioSketch AI', {
    x: PAD, y: footerY, w: W - 2 * PAD, h: FOOTER_H,
    align: 'center', valign: 'middle',
    color: palette.muted, fontSize: 13, fontFace: 'Calibri',
  });
}

/**
 * Build and download the poster as an editable .pptx.
 * Dispatches to the renderer matching the requested layout — the SVG picker
 * and PPT export now stay in visual sync.
 * Returns the filename that was saved so callers can toast.
 */
export async function buildPosterPptx(input: PosterPptxInput): Promise<string> {
  // Dynamic import so the ~200 KB pptxgenjs bundle only loads when a user
  // actually clicks Download PPT.
  const PptxGenModule = await import('pptxgenjs');
  const PptxGenJS = (PptxGenModule as any).default ?? PptxGenModule;

  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'A0LAND', width: W, height: H });
  pres.layout = 'A0LAND';
  pres.title = input.plan.title || 'Scientific poster';
  pres.author = 'BioSketch AI';

  const palette = derivePalette(input.preset);
  const slide = pres.addSlide();

  const layout: PosterLayout = input.layout ?? 'classic';
  switch (layout) {
    case 'journal-modern':
      renderJournalModern(slide, input, palette);
      break;
    case 'feature-center':
      renderFeatureCenter(slide, input, palette);
      break;
    case 'timeline':
      renderTimeline(slide, input, palette);
      break;
    case 'infographic-vibrant':
      renderInfographicVibrant(slide, input, palette);
      break;
    case 'editorial-magazine':
      renderEditorialMagazine(slide, input, palette);
      break;
    case 'data-dashboard':
      renderDataDashboard(slide, input, palette);
      break;
    case 'classic':
    default:
      renderClassic(slide, input, palette);
      break;
  }

  const safeTitle = (input.plan.title || 'biosketch-poster')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  const layoutSuffix = layout === 'classic' ? '' : `-${layout}`;
  const fileName = `${safeTitle || 'biosketch-poster'}${layoutSuffix}.pptx`;
  await pres.writeFile({ fileName });
  return fileName;
}
