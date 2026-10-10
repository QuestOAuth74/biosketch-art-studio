/**
 * Landscape A0 scientific poster composer with 4 layout variants.
 *
 * Every layout takes the same input shape (Stage 2 plan + Stage 3 resolved
 * figures + the active journal preset) and emits an SVG string. Panels are
 * always semantic building blocks — one <rect> + one header text + one body
 * text (+ optional <image>) — so Fabric parses each element as an editable
 * object when the user opens it in the Canvas editor.
 *
 * Layouts:
 *   - classic         Bold conference poster. Colored section headers with
 *                     circular section numbers, accent side stripes, quote-
 *                     mark takeaway strip. Standard 3-column grid.
 *   - journal-modern  Subdued Nature/Cell aesthetic. No colored headers,
 *                     just underlines + weight. Off-white panel bg, serif
 *                     title, generous whitespace, thin-rule takeaway.
 *   - feature-center  Two flanking columns of narrow text sections around
 *                     a large center hero (first figure + takeaway).
 *   - timeline        Left-to-right story. Numbered timeline spine with
 *                     circular stops, arrows between panels, one row of
 *                     figure-first panels.
 */
import type { AIIllustratorPreset } from './aiIllustratorPresets';

export type PosterLayout =
  | 'classic'
  | 'journal-modern'
  | 'feature-center'
  | 'timeline'
  | 'infographic-vibrant'
  | 'editorial-magazine'
  | 'data-dashboard';

interface Resolved {
  caption: string;
  source: 'embedded' | 'generate';
  imageDataUrl: string;
  failed?: boolean;
}

interface PosterInput {
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

// ─── Shared constants ────────────────────────────────────────────────────────
const W = 1600;
const H = 1131;
// Bumped from 40 → 56 to give the poster more breathing room at the outer edge.
const PAD = 56;
const HEADER_H = 200;
const FOOTER_H = 90;
const TAKEAWAY_H = 100;
// GAP bumped from 20 → 32 — panels were too tight against each other at
// preview scale, felt like a single dense block instead of a modular grid.
const GAP = 32;

// ─── Shared helpers ──────────────────────────────────────────────────────────
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapLines(text: string, maxWidth: number, fontSize: number, maxLines = 20): string[] {
  const perChar = fontSize * 0.55;
  const charsPerLine = Math.max(6, Math.floor(maxWidth / perChar));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w;
    if (candidate.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1,3}$/, '…');
  }
  return lines;
}

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

function derivePalette(preset?: AIIllustratorPreset): Palette {
  const fallback: Palette = {
    primary: '#0F172A',
    accent: '#7C3AED',
    body: '#1F2937',
    muted: '#64748B',
    bg: '#F8FAFC',
    band: '#F1F5F9',
    panelBg: '#FFFFFF',
    panelBgAlt: '#F8FAFC',
    panelBorder: '#E2E8F0',
  };
  if (!preset || !preset.palette || preset.palette.length < 4) return fallback;
  const [c0, c1, , c3] = preset.palette;
  return {
    primary: c0,
    accent: c1,
    body: fallback.body,
    muted: fallback.muted,
    bg: fallback.bg,
    band: c3 || fallback.band,
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

function buildPanels(plan: PosterInput['plan'], resolved: Resolved[]): PanelDef[] {
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

/**
 * Format a section number as a zero-padded 2-digit string. "01", "02", …
 * Used as a design element in classic + timeline layouts.
 */
function num2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

// ─── Layout A: Classic Bold ──────────────────────────────────────────────────
function renderClassic(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${palette.bg}"/>`);

  // Title bar with accent underline stripe.
  parts.push(`<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${palette.primary}"/>`);
  parts.push(`<rect x="0" y="${HEADER_H - 6}" width="${W}" height="6" fill="${palette.accent}"/>`);

  // Title — bumped from 42 to 56 so it reads at preview scale, still fits at print.
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 56, 2);
  let ty = 82;
  for (const line of titleLines) {
    parts.push(
      `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="56" font-weight="800" fill="#FFFFFF">${esc(line)}</text>`,
    );
    ty += 64;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${W / 2}" y="${HEADER_H - 62}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#FFFFFF" opacity="0.94">${esc(wrapLines(plan.authors, W - 2 * PAD, 24, 1)[0] ?? '')}</text>`,
    );
  }
  if (plan.affiliation) {
    parts.push(
      `<text x="${W / 2}" y="${HEADER_H - 30}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-style="italic" fill="#FFFFFF" opacity="0.82">${esc(wrapLines(plan.affiliation, W - 2 * PAD, 18, 1)[0] ?? '')}</text>`,
    );
  }

  // Panel grid.
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
    // Alternate row bg for visual rhythm.
    const bg = r % 2 === 0 ? palette.panelBg : palette.panelBgAlt;
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="10" ry="10" fill="${bg}" stroke="${palette.panelBorder}" stroke-width="1"/>`,
    );
    // Accent side stripe (4 px, colored).
    parts.push(
      `<rect x="${x}" y="${y}" width="6" height="${rowH}" rx="6" ry="6" fill="${palette.accent}"/>`,
    );
    // Header band with a bigger circular section number chip. Chip radius
    // 14 → 20 so it doesn't get lost next to the enlarged header text.
    // Previously we tinted the header band with accent @ 0.08 opacity —
    // that read muddy against the alternating panel bg. Now: just a thin
    // hairline under the header text for clean separation.
    const headerH = 60;
    parts.push(
      `<line x1="${x + 20}" y1="${y + headerH}" x2="${x + colW - 20}" y2="${y + headerH}" stroke="${palette.panelBorder}" stroke-width="1"/>`,
    );
    parts.push(
      `<circle cx="${x + 40}" cy="${y + 30}" r="20" fill="${palette.accent}"/>`,
      `<text x="${x + 40}" y="${y + 37}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">${num2(i)}</text>`,
    );
    const headerLabel = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    const label = wrapLines(headerLabel, colW - 80, 22, 1)[0] ?? '';
    parts.push(
      `<text x="${x + 72}" y="${y + 37}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="${palette.primary}">${esc(label)}</text>`,
    );

    // Panel interior padding bumped 12/16 → 24 so text isn't glued to the
    // colored border. Content start moved down accordingly.
    const PANEL_PAD_X = 24;
    const contentY = y + headerH + 20;
    const contentH = rowH - headerH - 32;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        // Figure takes 62 % of interior (was 55 %) — bigger visual weight at
        // preview scale where a small figure got lost among bullets.
        const imgH = Math.round(contentH * 0.62);
        parts.push(
          `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
        );
        let by = contentY + imgH + 32;
        // Cap at 3 bullets so we don't spill; type up 12 → 15 for readability.
        for (const b of p.section.bullets.slice(0, 3)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 20, 15, 2);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '●  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 21;
          }
          by += 6;
        }
      } else {
        // Text-only panel — body up 14 → 18 for easy reading at preview scale.
        let by = contentY + 14;
        for (const b of p.section.bullets.slice(0, 5)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 20, 18, 3);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '●  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 25;
          }
          by += 8;
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      // Standalone figure panels get a bigger image (0.72 → 0.78) since
      // caption is usually 1-2 lines and the figure is the point.
      const imgH = Math.round(contentH * 0.78);
      parts.push(
        `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      let cy = contentY + imgH + 30;
      for (const line of wrapLines(p.figure.caption, colW - 2 * PANEL_PAD_X - 20, 14, 3)) {
        parts.push(
          `<text x="${x + PANEL_PAD_X}" y="${cy}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="${palette.muted}" font-style="italic">${esc(line)}</text>`,
        );
        cy += 20;
      }
    }
  });

  // Key takeaway with a big quote-mark accent — text bumped from 20 → 26 so
  // the poster's headline reads clearly at any zoom.
  const takeawayY = contentBottom + GAP;
  if (plan.keyTakeaway) {
    parts.push(
      `<rect x="0" y="${takeawayY}" width="${W}" height="${TAKEAWAY_H}" fill="${palette.band}"/>`,
      `<text x="${PAD}" y="${takeawayY + 78}" font-family="Georgia, serif" font-size="88" font-weight="700" fill="${palette.accent}" opacity="0.5">“</text>`,
      `<text x="${PAD + 68}" y="${takeawayY + 32}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="${palette.primary}" letter-spacing="3">KEY TAKEAWAY</text>`,
    );
    const takeLines = wrapLines(plan.keyTakeaway, W - PAD * 2 - 68, 26, 2);
    let ky = takeawayY + 62;
    for (const line of takeLines) {
      parts.push(
        `<text x="${PAD + 68}" y="${ky}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="${palette.body}">${esc(line)}</text>`,
      );
      ky += 32;
    }
  }

  // Footer.
  const footerY = H - FOOTER_H;
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${palette.primary}"/>`,
    `<text x="${W / 2}" y="${footerY + FOOTER_H / 2 + 6}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" opacity="0.85">Generated with BioSketch AI</text>`,
  );

  return parts.join('\n');
}

// ─── Layout B: Journal Modern ────────────────────────────────────────────────
function renderJournalModern(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);
  const parts: string[] = [];

  // Warm off-white background, no colored bars anywhere.
  parts.push(`<rect width="${W}" height="${H}" fill="#FCFCFB"/>`);

  // Title area — larger serif for hero feel, wider rule beneath. Publication
  // pages open with a bigger title than we were rendering; bump 42 → 54 and
  // add a small accent stripe at the start for editorial framing.
  const titleTop = 60;
  parts.push(
    `<rect x="${PAD}" y="${titleTop}" width="6" height="60" fill="${palette.accent}"/>`,
  );
  const titleLines = wrapLines(plan.title, W - 2 * PAD - 24, 54, 2);
  let ty = titleTop + 46;
  for (const line of titleLines) {
    parts.push(
      `<text x="${PAD + 22}" y="${ty}" font-family="Georgia, 'Source Serif Pro', serif" font-size="54" font-weight="700" fill="${palette.primary}">${esc(line)}</text>`,
    );
    ty += 62;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${PAD + 22}" y="${ty + 10}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" font-weight="500" fill="${palette.body}">${esc(wrapLines(plan.authors, W - 2 * PAD - 24, 17, 1)[0] ?? '')}</text>`,
    );
  }
  if (plan.affiliation) {
    parts.push(
      `<text x="${PAD + 22}" y="${ty + 34}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-style="italic" fill="${palette.muted}">${esc(wrapLines(plan.affiliation, W - 2 * PAD - 24, 14, 1)[0] ?? '')}</text>`,
    );
  }
  const ruleY = titleTop + 150;
  parts.push(
    `<line x1="${PAD}" y1="${ruleY}" x2="${W - PAD}" y2="${ruleY}" stroke="${palette.primary}" stroke-width="1.5"/>`,
  );

  // Panel grid — wider gaps, off-white subtle panel bg only, no colored headers.
  const cols = 3;
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const contentTop = ruleY + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const gap = GAP + 12; // more breathing room
  const colW = (W - 2 * PAD - gap * (cols - 1)) / cols;
  const rowH = (contentBottom - contentTop - gap * Math.max(0, rows - 1)) / rows;

  panels.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (colW + gap);
    const y = contentTop + r * (rowH + gap);
    // Panel: subtle off-white, no border.
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" fill="#FFFFFF"/>`,
    );

    // Small-caps section label with a wider accent underline for stronger
    // hierarchy. Old 52-px underline felt lost next to the label — 100 px
    // reads as an intentional design element.
    const headerLabel = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    const label = wrapLines(headerLabel, colW - 20, 14, 1)[0]?.toUpperCase() ?? '';
    parts.push(
      `<text x="${x + 8}" y="${y + 28}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-weight="800" fill="${palette.primary}" letter-spacing="3">${esc(label)}</text>`,
      `<rect x="${x + 8}" y="${y + 40}" width="100" height="4" fill="${palette.accent}"/>`,
    );

    const contentY = y + 60;
    const contentH = rowH - 70;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = Math.round(contentH * 0.6);
        parts.push(
          `<image x="${x + 8}" y="${contentY}" width="${colW - 16}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
        );
        let by = contentY + imgH + 20;
        for (const b of p.section.bullets.slice(0, 3)) {
          const lines = wrapLines(b, colW - 24, 13, 2);
          for (let li = 0; li < lines.length; li++) {
            parts.push(
              `<text x="${x + 12}" y="${by}" font-family="Georgia, 'Source Serif Pro', serif" font-size="13" fill="${palette.body}">${esc(lines[li])}</text>`,
            );
            by += 17;
          }
          by += 4;
        }
      } else {
        let by = contentY + 4;
        for (const b of p.section.bullets.slice(0, 6)) {
          const lines = wrapLines(b, colW - 24, 15, 3);
          for (let li = 0; li < lines.length; li++) {
            parts.push(
              `<text x="${x + 12}" y="${by}" font-family="Georgia, 'Source Serif Pro', serif" font-size="15" fill="${palette.body}">${esc(lines[li])}</text>`,
            );
            by += 20;
          }
          by += 6;
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = Math.round(contentH * 0.75);
      parts.push(
        `<image x="${x + 8}" y="${contentY}" width="${colW - 16}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      let cy = contentY + imgH + 20;
      for (const line of wrapLines(p.figure.caption, colW - 24, 12, 3)) {
        parts.push(
          `<text x="${x + 12}" y="${cy}" font-family="Georgia, 'Source Serif Pro', serif" font-size="12" fill="${palette.muted}" font-style="italic">${esc(line)}</text>`,
        );
        cy += 16;
      }
    }
  });

  // Footer — thin dark rule + right-aligned takeaway inline.
  const footerY = H - FOOTER_H;
  parts.push(
    `<line x1="${PAD}" y1="${footerY}" x2="${W - PAD}" y2="${footerY}" stroke="${palette.primary}" stroke-width="1"/>`,
  );
  if (plan.keyTakeaway) {
    parts.push(
      `<text x="${PAD}" y="${footerY + 34}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="${palette.primary}" letter-spacing="2">KEY TAKEAWAY</text>`,
    );
    const takeLines = wrapLines(plan.keyTakeaway, W - 2 * PAD - 200, 15, 2);
    let ky = footerY + 32;
    for (const line of takeLines) {
      parts.push(
        `<text x="${PAD + 160}" y="${ky}" font-family="Georgia, 'Source Serif Pro', serif" font-size="15" fill="${palette.body}">${esc(line)}</text>`,
      );
      ky += 20;
    }
  }
  parts.push(
    `<text x="${W - PAD}" y="${H - 20}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11" fill="${palette.muted}">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// ─── Layout C: Feature Center ────────────────────────────────────────────────
function renderFeatureCenter(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${palette.bg}"/>`);

  // Title bar.
  parts.push(`<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${palette.primary}"/>`);
  parts.push(`<rect x="0" y="${HEADER_H - 4}" width="${W}" height="4" fill="${palette.accent}"/>`);
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 42, 2);
  let ty = 78;
  for (const line of titleLines) {
    parts.push(
      `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="40" font-weight="800" fill="#FFFFFF">${esc(line)}</text>`,
    );
    ty += 48;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${W / 2}" y="${HEADER_H - 40}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#FFFFFF" opacity="0.92">${esc(wrapLines(plan.authors, W - 2 * PAD, 18, 1)[0] ?? '')}</text>`,
    );
  }

  // Split into left/center/right columns with a wide hero in the middle.
  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const flankW = 380;
  const heroW = W - 2 * PAD - 2 * flankW - 2 * GAP;
  const heroX = PAD + flankW + GAP;
  const heroY = contentTop;
  const heroH = contentBottom - contentTop;

  // Split flanking sections into two columns of panels (left/right).
  const sectionPanels = panels.filter((p) => p.kind === 'section');
  const half = Math.ceil(sectionPanels.length / 2);
  const leftSections = sectionPanels.slice(0, half);
  const rightSections = sectionPanels.slice(half);
  const heroFigure = panels.find((p) => p.figure && p.figure.imageDataUrl)?.figure;

  const drawFlankColumn = (col: PanelDef[], colX: number) => {
    const perH = (heroH - GAP * Math.max(0, col.length - 1)) / Math.max(1, col.length);
    col.forEach((p, i) => {
      const y = contentTop + i * (perH + GAP);
      parts.push(
        `<rect x="${colX}" y="${y}" width="${flankW}" height="${perH}" rx="10" ry="10" fill="${palette.panelBg}" stroke="${palette.panelBorder}" stroke-width="1"/>`,
        `<rect x="${colX}" y="${y}" width="6" height="${perH}" rx="6" ry="6" fill="${palette.accent}"/>`,
      );
      const label = wrapLines(p.section?.name ?? '', flankW - 40, 16, 1)[0]?.toUpperCase() ?? '';
      parts.push(
        `<text x="${colX + 22}" y="${y + 32}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="${palette.primary}" letter-spacing="2">${esc(label)}</text>`,
        `<line x1="${colX + 22}" y1="${y + 40}" x2="${colX + 70}" y2="${y + 40}" stroke="${palette.accent}" stroke-width="3"/>`,
      );
      let by = y + 62;
      for (const b of (p.section?.bullets ?? []).slice(0, 5)) {
        const lines = wrapLines(b, flankW - 44, 14, 3);
        for (let li = 0; li < lines.length; li++) {
          const prefix = li === 0 ? '• ' : '   ';
          parts.push(
            `<text x="${colX + 22}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
          );
          by += 18;
        }
        by += 4;
      }
    });
  };
  drawFlankColumn(leftSections, PAD);
  drawFlankColumn(rightSections, W - PAD - flankW);

  // Hero center — big figure + key takeaway underneath. HERO RESULT ribbon
  // slimmed 46 → 38 to buy back vertical space for the image. Takeaway card
  // 110 → 150 tall so 2-3 lines of takeaway don't crowd the caption.
  parts.push(
    `<rect x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}" rx="14" ry="14" fill="${palette.panelBg}" stroke="${palette.panelBorder}" stroke-width="2"/>`,
    `<rect x="${heroX}" y="${heroY}" width="${heroW}" height="38" fill="${palette.accent}"/>`,
    `<text x="${heroX + 24}" y="${heroY + 26}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" letter-spacing="3">HERO RESULT</text>`,
  );
  const heroContentY = heroY + 38 + 24;
  const takeawayCardH = 170;
  const heroImgH = heroH - 38 - takeawayCardH - 90;
  if (heroFigure) {
    parts.push(
      `<image x="${heroX + 24}" y="${heroContentY}" width="${heroW - 48}" height="${heroImgH}" href="${heroFigure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
    );
    let capY = heroContentY + heroImgH + 28;
    for (const line of wrapLines(heroFigure.caption, heroW - 48, 15, 2)) {
      parts.push(
        `<text x="${heroX + heroW / 2}" y="${capY}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="${palette.muted}" font-style="italic">${esc(line)}</text>`,
      );
      capY += 22;
    }
  }
  if (plan.keyTakeaway) {
    const takeawayY = heroY + heroH - takeawayCardH - 20;
    parts.push(
      `<rect x="${heroX + 20}" y="${takeawayY}" width="${heroW - 40}" height="${takeawayCardH}" rx="12" ry="12" fill="${palette.band}"/>`,
      `<rect x="${heroX + 20}" y="${takeawayY}" width="6" height="${takeawayCardH}" fill="${palette.accent}"/>`,
      `<text x="${heroX + 44}" y="${takeawayY + 32}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="${palette.primary}" letter-spacing="3">KEY TAKEAWAY</text>`,
    );
    let ky = takeawayY + 68;
    for (const line of wrapLines(plan.keyTakeaway, heroW - 88, 22, 3)) {
      parts.push(
        `<text x="${heroX + 44}" y="${ky}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="500" fill="${palette.body}">${esc(line)}</text>`,
      );
      ky += 30;
    }
  }

  // Footer.
  const footerY = H - FOOTER_H;
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${palette.primary}"/>`,
    `<text x="${W / 2}" y="${footerY + FOOTER_H / 2 + 6}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" opacity="0.85">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// ─── Layout D: Timeline / Story ──────────────────────────────────────────────
function renderTimeline(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${palette.bg}"/>`);

  // Compact left-anchored title strip.
  parts.push(`<rect x="0" y="0" width="${W}" height="${HEADER_H - 40}" fill="${palette.primary}"/>`);
  parts.push(`<rect x="0" y="${HEADER_H - 44}" width="${W}" height="4" fill="${palette.accent}"/>`);
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 38, 2);
  let ty = 66;
  for (const line of titleLines) {
    parts.push(
      `<text x="${PAD}" y="${ty}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="36" font-weight="800" fill="#FFFFFF">${esc(line)}</text>`,
    );
    ty += 44;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${W - PAD}" y="${HEADER_H - 60}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="#FFFFFF" opacity="0.9">${esc(wrapLines(plan.authors, W / 2, 15, 1)[0] ?? '')}</text>`,
    );
  }

  // Horizontal timeline strip.
  const timelineY = HEADER_H + 70;
  const rowH = Math.min(580, H - HEADER_H - FOOTER_H - TAKEAWAY_H - PAD - 120);
  const stopCount = Math.min(panels.length, 5);
  const stops = panels.slice(0, stopCount);
  const stopW = (W - 2 * PAD - GAP * (stopCount - 1)) / stopCount;

  // Timeline spine — thicker line, extend beyond first/last circle for a
  // stronger "chapter" feel.
  const spineY = timelineY + 40;
  parts.push(
    `<line x1="${PAD + 20}" y1="${spineY}" x2="${W - PAD - 20}" y2="${spineY}" stroke="${palette.accent}" stroke-width="6" stroke-linecap="round"/>`,
  );

  stops.forEach((p, i) => {
    const x = PAD + i * (stopW + GAP);
    const cx = x + stopW / 2;
    // Bigger stop circle with a filled inner disc for depth. Reads as an
    // intentional marker instead of a hollow ring.
    parts.push(
      `<circle cx="${cx}" cy="${spineY}" r="28" fill="#FFFFFF" stroke="${palette.accent}" stroke-width="5"/>`,
      `<circle cx="${cx}" cy="${spineY}" r="20" fill="${palette.accent}"/>`,
      `<text x="${cx}" y="${spineY + 8}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">${num2(i)}</text>`,
    );
    // Cleaner arrow — a proper filled polygon aligned exactly with the spine.
    if (i < stops.length - 1) {
      const ax = x + stopW + GAP / 2;
      parts.push(
        `<polygon points="${ax - 10},${spineY - 10} ${ax + 12},${spineY} ${ax - 10},${spineY + 10}" fill="${palette.accent}"/>`,
      );
    }

    // Panel below the stop. No competing underline — the numbered circle
    // above IS the anchor, an extra rule would be redundant.
    const panelY = spineY + 60;
    parts.push(
      `<rect x="${x}" y="${panelY}" width="${stopW}" height="${rowH}" rx="12" ry="12" fill="${palette.panelBg}" stroke="${palette.panelBorder}" stroke-width="1"/>`,
    );
    const label = wrapLines(p.section?.name ?? (p.figure?.caption ?? ''), stopW - 24, 16, 1)[0]?.toUpperCase() ?? '';
    parts.push(
      `<text x="${cx}" y="${panelY + 38}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="16" font-weight="800" fill="${palette.primary}" letter-spacing="3">${esc(label)}</text>`,
    );

    // Figure on top, bullets below. Bumped padding to 20 and body 12 → 14.
    const fig = p.figure;
    let by = panelY + 70;
    if (fig && fig.imageDataUrl) {
      const imgH = Math.round((rowH - 70) * 0.55);
      parts.push(
        `<image x="${x + 20}" y="${by}" width="${stopW - 40}" height="${imgH}" href="${fig.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      by += imgH + 22;
    }
    for (const b of (p.section?.bullets ?? []).slice(0, 4)) {
      const lines = wrapLines(b, stopW - 40, 14, 2);
      for (let li = 0; li < lines.length; li++) {
        const prefix = li === 0 ? '●  ' : '     ';
        parts.push(
          `<text x="${x + 20}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
        );
        by += 19;
      }
      by += 5;
    }
  });

  // Key takeaway strip.
  const takeawayY = spineY + 40 + rowH + PAD;
  if (plan.keyTakeaway && takeawayY + TAKEAWAY_H < H - FOOTER_H) {
    parts.push(
      `<rect x="0" y="${takeawayY}" width="${W}" height="${TAKEAWAY_H}" fill="${palette.accent}"/>`,
      `<text x="${PAD}" y="${takeawayY + 32}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF" letter-spacing="3" opacity="0.85">END OF STORY</text>`,
    );
    let ky = takeawayY + 58;
    for (const line of wrapLines(plan.keyTakeaway, W - 2 * PAD, 20, 2)) {
      parts.push(
        `<text x="${PAD}" y="${ky}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#FFFFFF">${esc(line)}</text>`,
      );
      ky += 24;
    }
  }

  // Footer.
  const footerY = H - FOOTER_H;
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${palette.primary}"/>`,
    `<text x="${W / 2}" y="${footerY + FOOTER_H / 2 + 6}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" opacity="0.85">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// ─── Layout E: Infographic Vibrant ────────────────────────────────────────────
// Rotates through 5 accent colors so each panel gets its own personality.
// Muted editorial versions of the classic infographic palette — reads
// polished, not garish, and pairs cleanly with scientific figures.
const INFOGRAPHIC_ACCENTS = ['#DC2626', '#D97706', '#059669', '#2563EB', '#7C3AED'];
function renderInfographicVibrant(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${palette.bg}"/>`);

  // Header — solid accent stripe on top of primary. Playful.
  parts.push(
    `<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${palette.primary}"/>`,
    `<rect x="0" y="${HEADER_H - 22}" width="${W}" height="22" fill="${palette.accent}"/>`,
  );
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 56, 2);
  let ty = 82;
  for (const line of titleLines) {
    parts.push(
      `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="56" font-weight="800" fill="#FFFFFF">${esc(line)}</text>`,
    );
    ty += 64;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${W / 2}" y="${HEADER_H - 60}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="#FFFFFF" opacity="0.94">${esc(wrapLines(plan.authors, W - 2 * PAD, 22, 1)[0] ?? '')}</text>`,
    );
  }

  // 3-col grid, each panel in a rotating accent color.
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
    const accent = INFOGRAPHIC_ACCENTS[i % INFOGRAPHIC_ACCENTS.length];

    // Panel: white bg, thin coloured border. Corner radius softened for a
    // more editorial feel than the previous 14/4 combo.
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="10" ry="10" fill="#FFFFFF" stroke="${accent}" stroke-width="2"/>`,
    );
    // Coloured top ribbon (subtle wash of accent) + numbered ring on the left.
    parts.push(
      `<rect x="${x + 2}" y="${y + 2}" width="${colW - 4}" height="72" fill="${accent}" opacity="0.06"/>`,
      `<circle cx="${x + 40}" cy="${y + 40}" r="22" fill="${accent}"/>`,
      `<text x="${x + 40}" y="${y + 48}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">${num2(i)}</text>`,
    );

    const headerLabel = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    const label = wrapLines(headerLabel, colW - 90, 22, 1)[0] ?? '';
    parts.push(
      `<text x="${x + 76}" y="${y + 48}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="800" fill="${accent}">${esc(label)}</text>`,
    );

    const contentY = y + 92;
    const contentH = rowH - 108;
    const PANEL_PAD_X = 26;
    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = Math.round(contentH * 0.6);
        parts.push(
          `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
        );
        let by = contentY + imgH + 32;
        for (const b of p.section.bullets.slice(0, 3)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 20, 15, 2);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '▸  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 21;
          }
          by += 6;
        }
      } else {
        let by = contentY + 14;
        for (const b of p.section.bullets.slice(0, 5)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 20, 17, 3);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '▸  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 24;
          }
          by += 8;
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = Math.round(contentH * 0.76);
      parts.push(
        `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      let cy = contentY + imgH + 30;
      for (const line of wrapLines(p.figure.caption, colW - 2 * PANEL_PAD_X - 20, 14, 3)) {
        parts.push(
          `<text x="${x + PANEL_PAD_X}" y="${cy}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="${palette.muted}" font-style="italic">${esc(line)}</text>`,
        );
        cy += 20;
      }
    }
  });

  // Takeaway strip: single-color band pulled from the active preset. The
  // previous 5-stripe rainbow read as toy-like; a clean band with a small
  // row of accent squares as decorative touch keeps the infographic vibe
  // without going overboard.
  const takeawayY = contentBottom + GAP;
  if (plan.keyTakeaway) {
    parts.push(
      `<rect x="0" y="${takeawayY}" width="${W}" height="${TAKEAWAY_H}" fill="${palette.band}"/>`,
      `<rect x="0" y="${takeawayY}" width="${W}" height="8" fill="${palette.accent}"/>`,
    );
    // Small row of 5 accent squares as decorative punctuation on the left.
    for (let i = 0; i < 5; i++) {
      parts.push(
        `<rect x="${PAD + i * 14}" y="${takeawayY + 32}" width="10" height="10" fill="${INFOGRAPHIC_ACCENTS[i % INFOGRAPHIC_ACCENTS.length]}"/>`,
      );
    }
    parts.push(
      `<text x="${PAD + 90}" y="${takeawayY + 42}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-weight="800" fill="${palette.primary}" letter-spacing="3">KEY TAKEAWAY</text>`,
    );
    const takeLines = wrapLines(plan.keyTakeaway, W - PAD * 2, 24, 2);
    let ky = takeawayY + 76;
    for (const line of takeLines) {
      parts.push(
        `<text x="${PAD}" y="${ky}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="${palette.body}">${esc(line)}</text>`,
      );
      ky += 32;
    }
  }

  const footerY = H - FOOTER_H;
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${palette.primary}"/>`,
    `<text x="${W / 2}" y="${footerY + FOOTER_H / 2 + 6}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" opacity="0.85">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// ─── Layout F: Editorial Magazine ─────────────────────────────────────────────
// Two-column magazine spread with drop cap on the first section and a
// pull-quote box. Serif throughout, ivory background.
function renderEditorialMagazine(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#FBF9F4"/>`);

  // Wide banner header, primary color with narrow accent underline.
  parts.push(
    `<rect x="0" y="0" width="${W}" height="${HEADER_H - 30}" fill="${palette.primary}"/>`,
    `<rect x="0" y="${HEADER_H - 34}" width="${W}" height="4" fill="${palette.accent}"/>`,
  );
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 66, 2);
  let ty = 96;
  for (const line of titleLines) {
    parts.push(
      `<text x="${PAD}" y="${ty}" font-family="Georgia, 'Source Serif Pro', serif" font-size="66" font-weight="700" fill="#FFFFFF">${esc(line)}</text>`,
    );
    ty += 74;
  }
  if (plan.authors) {
    parts.push(
      `<text x="${W - PAD}" y="${HEADER_H - 68}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#FFFFFF" opacity="0.9">${esc(wrapLines(plan.authors, W / 2, 18, 1)[0] ?? '')}</text>`,
    );
  }
  if (plan.affiliation) {
    parts.push(
      `<text x="${W - PAD}" y="${HEADER_H - 42}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-style="italic" fill="#FFFFFF" opacity="0.75">${esc(wrapLines(plan.affiliation, W / 2, 14, 1)[0] ?? '')}</text>`,
    );
  }

  // Two-column body with a wider gutter for a more editorial feel.
  const cols = 2;
  const contentTop = HEADER_H + PAD;
  const contentBottom = H - FOOTER_H - PAD;
  const gap = 84;
  const colW = (W - 2 * PAD - gap) / cols;
  const colH = contentBottom - contentTop;

  // Pull quote on the right column. Bigger accent quote glyph, taller card,
  // moved off the very edge — reads intentional instead of squeezed.
  const pullQuoteH = plan.keyTakeaway ? 340 : 0;
  const pullQuoteX = PAD + colW + gap;
  const pullQuoteY = contentTop;
  if (plan.keyTakeaway) {
    parts.push(
      `<rect x="${pullQuoteX}" y="${pullQuoteY}" width="${colW}" height="${pullQuoteH}" fill="${palette.band}"/>`,
      `<rect x="${pullQuoteX}" y="${pullQuoteY}" width="6" height="${pullQuoteH}" fill="${palette.accent}"/>`,
      `<text x="${pullQuoteX + 46}" y="${pullQuoteY + 118}" font-family="Georgia, serif" font-size="120" font-weight="700" fill="${palette.accent}" opacity="0.5">“</text>`,
      `<text x="${pullQuoteX + 46}" y="${pullQuoteY + 48}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="800" fill="${palette.primary}" letter-spacing="3">KEY TAKEAWAY</text>`,
    );
    const quoteLines = wrapLines(plan.keyTakeaway, colW - 102, 28, 5);
    let qy = pullQuoteY + 154;
    for (const line of quoteLines) {
      parts.push(
        `<text x="${pullQuoteX + 46}" y="${qy}" font-family="Georgia, serif" font-size="28" font-weight="500" fill="${palette.primary}" font-style="italic">${esc(line)}</text>`,
      );
      qy += 36;
    }
  }

  // Flow the sections into the two columns. Each section becomes a block.
  // The right column starts BELOW the pull quote.
  const blocks: string[] = panels.map((p, i) => renderMagazineBlock(p, colW, i, palette));

  // Simple auto-fit: pour blocks into columns tracking Y position.
  // Height is rough since we don't know exact text metrics — use heuristics.
  const estimateBlockH = (p: PanelDef): number => {
    let h = 66; // header + underline
    if (p.figure) h += Math.min(360, Math.round(colW * 0.55));
    if (p.section) {
      const bulletCount = Math.min(6, p.section.bullets.length);
      h += bulletCount * 68;
    } else if (p.figure) {
      h += 60;
    }
    return h + 30;
  };

  let leftY = contentTop;
  let rightY = pullQuoteY + pullQuoteH + 40;
  for (let i = 0; i < panels.length; i++) {
    const blockH = estimateBlockH(panels[i]);
    // Pick the column with more room left.
    const leftRoom = contentBottom - leftY;
    const rightRoom = contentBottom - rightY;
    const placeLeft = leftRoom >= rightRoom;
    const x = placeLeft ? PAD : pullQuoteX;
    const yStart = placeLeft ? leftY : rightY;
    if (blockH > (placeLeft ? leftRoom : rightRoom)) continue;
    parts.push(`<g transform="translate(${x} ${yStart})">${blocks[i]}</g>`);
    if (placeLeft) leftY += blockH;
    else rightY += blockH;
  }

  // Footer — thin rule + credit.
  parts.push(
    `<line x1="${PAD}" y1="${H - FOOTER_H}" x2="${W - PAD}" y2="${H - FOOTER_H}" stroke="${palette.primary}" stroke-width="1"/>`,
    `<text x="${W - PAD}" y="${H - 30}" text-anchor="end" font-family="Georgia, serif" font-size="14" font-style="italic" fill="${palette.muted}">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// Helper for editorial magazine: single-panel block rendered as if in a
// magazine column. Coordinates are local (0,0 = top-left of block).
function renderMagazineBlock(p: PanelDef, colW: number, i: number, palette: Palette): string {
  const parts: string[] = [];
  const label = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
  const labelText = wrapLines(label.toUpperCase(), colW, 15, 1)[0] ?? '';
  parts.push(
    `<text x="0" y="20" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="${palette.primary}" letter-spacing="3">${esc(labelText)}</text>`,
    `<line x1="0" y1="34" x2="80" y2="34" stroke="${palette.accent}" stroke-width="4"/>`,
  );
  let y = 66;
  if (p.figure) {
    const imgH = Math.min(300, Math.round(colW * 0.55));
    parts.push(
      `<image x="0" y="${y}" width="${colW}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
    );
    y += imgH + 24;
    if (p.kind === 'figure' && p.figure.caption) {
      const capLines = wrapLines(p.figure.caption, colW, 14, 2);
      for (const line of capLines) {
        parts.push(
          `<text x="0" y="${y}" font-family="Georgia, serif" font-size="14" font-style="italic" fill="${palette.muted}">${esc(line)}</text>`,
        );
        y += 20;
      }
    }
  }
  if (p.kind === 'section' && p.section) {
    let bulletIdx = 0;
    for (const b of p.section.bullets.slice(0, 5)) {
      const lines = wrapLines(b, colW, 18, 3);
      // First bullet of the first section (i===0) gets a drop cap.
      const dropCap = i === 0 && bulletIdx === 0 && lines.length > 0;
      let li = 0;
      if (dropCap) {
        // Prominent 3-line drop cap in accent color — the definitive
        // editorial-magazine motif.
        const first = lines[0];
        const capChar = first.charAt(0);
        const rest = first.substring(1);
        parts.push(
          `<text x="0" y="${y + 68}" font-family="Georgia, serif" font-size="108" font-weight="700" fill="${palette.accent}">${esc(capChar)}</text>`,
          `<text x="82" y="${y + 30}" font-family="Georgia, serif" font-size="22" fill="${palette.body}">${esc(rest)}</text>`,
        );
        y += 42;
        for (let ri = 1; ri < lines.length; ri++) {
          parts.push(
            `<text x="82" y="${y}" font-family="Georgia, serif" font-size="22" fill="${palette.body}">${esc(lines[ri])}</text>`,
          );
          y += 30;
        }
        y += 16;
        li = lines.length;
        bulletIdx += 1;
        continue;
      }
      for (; li < lines.length; li++) {
        const prefix = li === 0 ? '·  ' : '   ';
        parts.push(
          `<text x="0" y="${y}" font-family="Georgia, serif" font-size="18" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
        );
        y += 26;
      }
      y += 10;
      bulletIdx += 1;
    }
  }
  return parts.join('\n');
}

// ─── Layout G: Data Dashboard ─────────────────────────────────────────────────
// Uniform 3-column × 2-row card grid. Each card has an accent header stripe
// with a large number, then figure or bullets underneath. Reads like a
// stats dashboard — great for methods-heavy or results-forward posters.
function renderDataDashboard(input: PosterInput, palette: Palette): string {
  const { plan, resolved } = input;
  const panels = buildPanels(plan, resolved).slice(0, 6);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${palette.bg}"/>`);

  // Compact title strip at top.
  const titleH = 150;
  parts.push(
    `<rect x="0" y="0" width="${W}" height="${titleH}" fill="${palette.primary}"/>`,
    `<rect x="0" y="${titleH - 4}" width="${W}" height="4" fill="${palette.accent}"/>`,
  );
  const titleLines = wrapLines(plan.title, W - 2 * PAD, 42, 1);
  parts.push(
    `<text x="${PAD}" y="76" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" font-weight="800" fill="#FFFFFF">${esc(titleLines[0] ?? '')}</text>`,
  );
  if (plan.authors) {
    parts.push(
      `<text x="${PAD}" y="118" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#FFFFFF" opacity="0.86">${esc(wrapLines(plan.authors, W - 2 * PAD - 220, 18, 1)[0] ?? '')}</text>`,
    );
  }
  // Top-right dashboard chip with figure count.
  parts.push(
    `<rect x="${W - PAD - 220}" y="60" width="220" height="60" rx="8" ry="8" fill="${palette.accent}"/>`,
    `<text x="${W - PAD - 110}" y="98" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#FFFFFF" letter-spacing="3">DASHBOARD</text>`,
  );

  // 3-col × 2-row card grid.
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

    // Card: white bg, thin border, shadow-emulating darker bottom stripe.
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="8" ry="8" fill="#FFFFFF" stroke="${palette.panelBorder}" stroke-width="1"/>`,
    );
    // Header stripe with a smaller number badge on the left + label. Old 38-pt
    // number swallowed the header; 26-pt inside a boxed badge reads as a chip.
    const hdrH = 78;
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${hdrH}" rx="8" ry="8" fill="${palette.primary}"/>`,
      `<rect x="${x}" y="${y + hdrH / 2}" width="${colW}" height="${hdrH / 2}" fill="${palette.primary}"/>`,
      `<rect x="${x}" y="${y + hdrH - 5}" width="${colW}" height="5" fill="${palette.accent}"/>`,
    );
    // Number badge — square background with the numeral centered.
    parts.push(
      `<rect x="${x + 18}" y="${y + 18}" width="42" height="42" rx="6" ry="6" fill="${palette.accent}"/>`,
      `<text x="${x + 39}" y="${y + 48}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">${num2(i)}</text>`,
    );
    const label = (p.kind === 'section' ? p.section?.name : p.figure?.caption) ?? '';
    parts.push(
      `<text x="${x + 76}" y="${y + 32}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF" letter-spacing="3" opacity="0.75">SECTION ${num2(i)}</text>`,
      `<text x="${x + 76}" y="${y + 58}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF" letter-spacing="1">${esc(wrapLines(label, colW - 96, 18, 1)[0] ?? '')}</text>`,
    );

    const contentY = y + hdrH + 18;
    const contentH = rowH - hdrH - 30;
    const PANEL_PAD_X = 22;

    if (p.kind === 'section' && p.section) {
      if (p.figure) {
        const imgH = Math.round(contentH * 0.6);
        parts.push(
          `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
        );
        let by = contentY + imgH + 28;
        for (const b of p.section.bullets.slice(0, 3)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 18, 15, 2);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '■  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 21;
          }
          by += 4;
        }
      } else {
        let by = contentY + 12;
        for (const b of p.section.bullets.slice(0, 4)) {
          const lines = wrapLines(b, colW - 2 * PANEL_PAD_X - 18, 18, 3);
          for (let li = 0; li < lines.length; li++) {
            const prefix = li === 0 ? '■  ' : '     ';
            parts.push(
              `<text x="${x + PANEL_PAD_X}" y="${by}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="${palette.body}">${esc(prefix + lines[li])}</text>`,
            );
            by += 24;
          }
          by += 6;
        }
      }
    } else if (p.kind === 'figure' && p.figure) {
      const imgH = Math.round(contentH * 0.78);
      parts.push(
        `<image x="${x + PANEL_PAD_X}" y="${contentY}" width="${colW - 2 * PANEL_PAD_X}" height="${imgH}" href="${p.figure.imageDataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      let cy = contentY + imgH + 26;
      for (const line of wrapLines(p.figure.caption, colW - 2 * PANEL_PAD_X - 18, 14, 2)) {
        parts.push(
          `<text x="${x + PANEL_PAD_X}" y="${cy}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="${palette.muted}" font-style="italic">${esc(line)}</text>`,
        );
        cy += 20;
      }
    }
  });

  // Bottom takeaway strip — softer than the previous solid-primary block.
  // Band bg from the preset (light neutral) with a bold left accent bar +
  // a small SUMMARY chip so the section reads as a dashboard footer widget
  // instead of a heavy dark slab.
  const takeawayY = contentBottom + GAP;
  if (plan.keyTakeaway) {
    parts.push(
      `<rect x="0" y="${takeawayY}" width="${W}" height="${TAKEAWAY_H}" fill="${palette.band}"/>`,
      `<rect x="0" y="${takeawayY}" width="10" height="${TAKEAWAY_H}" fill="${palette.accent}"/>`,
      `<rect x="${PAD}" y="${takeawayY + 26}" width="130" height="26" rx="4" ry="4" fill="${palette.accent}"/>`,
      `<text x="${PAD + 65}" y="${takeawayY + 44}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF" letter-spacing="3">SUMMARY</text>`,
    );
    const takeLines = wrapLines(plan.keyTakeaway, W - PAD * 2, 24, 2);
    let ky = takeawayY + 78;
    for (const line of takeLines) {
      parts.push(
        `<text x="${PAD}" y="${ky}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="${palette.primary}">${esc(line)}</text>`,
      );
      ky += 30;
    }
  }

  const footerY = H - FOOTER_H;
  parts.push(
    `<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${palette.bg}"/>`,
    `<line x1="${PAD}" y1="${footerY}" x2="${W - PAD}" y2="${footerY}" stroke="${palette.panelBorder}" stroke-width="1"/>`,
    `<text x="${W / 2}" y="${footerY + FOOTER_H / 2 + 6}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13" fill="${palette.muted}">Generated with BioSketch AI</text>`,
  );
  return parts.join('\n');
}

// ─── Public entry ────────────────────────────────────────────────────────────
export function buildPosterSvg(input: PosterInput): string {
  const palette = derivePalette(input.preset);
  const layout: PosterLayout = input.layout ?? 'classic';
  let body: string;
  switch (layout) {
    case 'journal-modern':
      body = renderJournalModern(input, palette);
      break;
    case 'feature-center':
      body = renderFeatureCenter(input, palette);
      break;
    case 'timeline':
      body = renderTimeline(input, palette);
      break;
    case 'infographic-vibrant':
      body = renderInfographicVibrant(input, palette);
      break;
    case 'editorial-magazine':
      body = renderEditorialMagazine(input, palette);
      break;
    case 'data-dashboard':
      body = renderDataDashboard(input, palette);
      break;
    case 'classic':
    default:
      body = renderClassic(input, palette);
      break;
  }
  return [
    // data-poster="1" is a marker the Canvas SVG-import path checks. When
    // present, the Canvas adds each parsed object directly to the canvas
    // instead of wrapping them in a single fabric.Group, so double-click-
    // to-edit works on titles / bullets / captions immediately (mirrors
    // the editable PPT export). Other SVGs (flowchart / protocol / timeline
    // / plots) keep the grouped behavior.
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-poster="1">`,
    body,
    `</svg>`,
  ].join('\n');
}

/**
 * Human-readable layout metadata for the picker UI. Kept alongside the
 * renderer so adding a new layout requires exactly one edit here + one
 * new render function above.
 */
export const POSTER_LAYOUTS: {
  id: PosterLayout;
  name: string;
  description: string;
}[] = [
  {
    id: 'classic',
    name: 'Classic Bold',
    description: 'Colored section headers with numbered chips. Standard conference poster.',
  },
  {
    id: 'journal-modern',
    name: 'Journal Modern',
    description: 'Serif title, no colored bars — reads like a review paper spread.',
  },
  {
    id: 'feature-center',
    name: 'Feature Center',
    description: 'Two flanking columns around a large hero panel. One dominant result.',
  },
  {
    id: 'timeline',
    name: 'Timeline / Story',
    description: 'Left-to-right numbered stops connected by arrows. Process order.',
  },
  {
    id: 'infographic-vibrant',
    name: 'Infographic Vibrant',
    description: 'Multi-accent panels with numbered ring icons. SciComm / public engagement.',
  },
  {
    id: 'editorial-magazine',
    name: 'Editorial Magazine',
    description: 'Two-column serif spread with drop cap + pull quote. Review-paper look.',
  },
  {
    id: 'data-dashboard',
    name: 'Data Dashboard',
    description: 'Uniform metric-card grid with header stripes. Methods / results forward.',
  },
];
