// Structured diagram renderer for Flowchart / Protocol / Timeline modes.
// LLM emits a strict JSON spec; this module deterministically renders it
// to clean, semantically-grouped, editable SVG.
//
// Style invariants enforced here (NOT by the LLM):
//   - All strokes: pure black #000000, 1.5px, uniform.
//   - All fills: white.
//   - All text: Inter / system sans-serif, black.
//   - Arrowheads: small solid black triangles via shared <marker>.

const PURE_BLACK = "#000000";
const WHITE = "#ffffff";
const STROKE = 1.5;
const FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ARROW_MARKER = `<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="strokeWidth">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${PURE_BLACK}" stroke="none"/>
  </marker>
</defs>`;

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Rough text width estimator (no canvas in Deno). Tuned for Inter at body sizes.
const charWidth = (size: number) => size * 0.55;
const estimateTextWidth = (text: string, fontSize: number): number =>
  text.length * charWidth(fontSize);

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ─────────────────────────── Flowchart ───────────────────────────

export type FlowNode = {
  id: string;
  label: string;
  shape: "rect" | "diamond" | "stadium";
};
export type FlowEdge = { from: string; to: string; label?: string };
export type FlowSpec = {
  direction: "TB" | "LR";
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type FlowPos = { x: number; y: number; w: number; h: number; node: FlowNode };

function layoutFlowchart(spec: FlowSpec): {
  positions: Map<string, FlowPos>;
  width: number;
  height: number;
} {
  const { direction, nodes, edges } = spec;

  // Layer assignment via longest-path (handles DAGs; cycles fall back to layer 0).
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const e of edges) {
    if (indeg.has(e.to)) indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  }
  const layer = new Map<string, number>();
  for (const n of nodes) layer.set(n.id, indeg.get(n.id) === 0 ? 0 : 0);

  let changed = true;
  let iter = 0;
  while (changed && iter < nodes.length * 4) {
    changed = false;
    for (const e of edges) {
      const fl = layer.get(e.from) ?? 0;
      const tl = layer.get(e.to) ?? 0;
      if (tl <= fl) {
        layer.set(e.to, fl + 1);
        changed = true;
      }
    }
    iter++;
  }

  const layerMap = new Map<number, string[]>();
  let maxLayer = 0;
  for (const n of nodes) {
    const l = layer.get(n.id) || 0;
    if (l > maxLayer) maxLayer = l;
    if (!layerMap.has(l)) layerMap.set(l, []);
    layerMap.get(l)!.push(n.id);
  }

  // Node sizing.
  const FONT_SIZE = 13;
  const PAD_X = 16;
  const PAD_Y = 10;
  const MIN_W = 110;
  const MAX_W = 220;
  const LINE_H = FONT_SIZE * 1.3;

  const sized = new Map<string, { w: number; h: number; node: FlowNode }>();
  for (const n of nodes) {
    const lines = wrapText(n.label, FONT_SIZE, MAX_W - 2 * PAD_X);
    const textW = Math.max(0, ...lines.map((l) => estimateTextWidth(l, FONT_SIZE)));
    let w = Math.max(MIN_W, Math.min(MAX_W, textW + 2 * PAD_X));
    let h = Math.max(40, lines.length * LINE_H + 2 * PAD_Y);
    if (n.shape === "diamond") {
      // Diamonds need extra clearance so text fits inside the rotated square.
      w = w * 1.35;
      h = Math.max(h * 1.4, w * 0.7);
    } else if (n.shape === "stadium") {
      w = w + h * 0.3; // semicircle ends consume some interior.
    }
    sized.set(n.id, { w, h, node: n });
  }

  const HSEP = 50;
  const VSEP = 60;
  const PAGE_PAD = 30;
  const positions = new Map<string, FlowPos>();

  if (direction === "TB") {
    // Each layer is a row; rows stacked top-down.
    let maxRowW = 0;
    const rowHs: number[] = [];
    for (let l = 0; l <= maxLayer; l++) {
      const ids = layerMap.get(l) || [];
      const rowW = ids.reduce((a, id) => a + sized.get(id)!.w, 0) +
        HSEP * Math.max(0, ids.length - 1);
      if (rowW > maxRowW) maxRowW = rowW;
      rowHs.push(Math.max(0, ...ids.map((id) => sized.get(id)!.h)));
    }

    let y = PAGE_PAD;
    for (let l = 0; l <= maxLayer; l++) {
      const ids = layerMap.get(l) || [];
      const rowW = ids.reduce((a, id) => a + sized.get(id)!.w, 0) +
        HSEP * Math.max(0, ids.length - 1);
      let x = PAGE_PAD + (maxRowW - rowW) / 2;
      const rowH = rowHs[l];
      for (const id of ids) {
        const s = sized.get(id)!;
        positions.set(id, {
          x: x + s.w / 2,
          y: y + rowH / 2,
          w: s.w,
          h: s.h,
          node: s.node,
        });
        x += s.w + HSEP;
      }
      y += rowH + VSEP;
    }
    return {
      positions,
      width: maxRowW + 2 * PAGE_PAD,
      height: y - VSEP + PAGE_PAD,
    };
  } else {
    // LR: each layer is a column.
    let maxColH = 0;
    const colWs: number[] = [];
    for (let l = 0; l <= maxLayer; l++) {
      const ids = layerMap.get(l) || [];
      const colH = ids.reduce((a, id) => a + sized.get(id)!.h, 0) +
        VSEP * Math.max(0, ids.length - 1);
      if (colH > maxColH) maxColH = colH;
      colWs.push(Math.max(0, ...ids.map((id) => sized.get(id)!.w)));
    }

    let x = PAGE_PAD;
    for (let l = 0; l <= maxLayer; l++) {
      const ids = layerMap.get(l) || [];
      const colH = ids.reduce((a, id) => a + sized.get(id)!.h, 0) +
        VSEP * Math.max(0, ids.length - 1);
      let y = PAGE_PAD + (maxColH - colH) / 2;
      const colW = colWs[l];
      for (const id of ids) {
        const s = sized.get(id)!;
        positions.set(id, {
          x: x + colW / 2,
          y: y + s.h / 2,
          w: s.w,
          h: s.h,
          node: s.node,
        });
        y += s.h + VSEP;
      }
      x += colW + HSEP;
    }
    return {
      positions,
      width: x - HSEP + PAGE_PAD,
      height: maxColH + 2 * PAGE_PAD,
    };
  }
}

function edgePoint(node: FlowPos, towardX: number, towardY: number) {
  const dx = towardX - node.x;
  const dy = towardY - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const hw = node.w / 2;
  const hh = node.h / 2;
  if (node.node.shape === "diamond") {
    const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    return { x: node.x + dx * t, y: node.y + dy * t };
  }
  const t = Math.min(hw / Math.max(Math.abs(dx), 1e-9), hh / Math.max(Math.abs(dy), 1e-9));
  return { x: node.x + dx * t, y: node.y + dy * t };
}

export function renderFlowchart(spec: FlowSpec): string {
  const { positions, width, height } = layoutFlowchart(spec);
  const FONT_SIZE = 13;
  const LINE_H = FONT_SIZE * 1.3;

  let nodesSvg = "";
  for (const [id, pos] of positions) {
    const { x, y, w, h, node } = pos;
    const left = x - w / 2;
    const top = y - h / 2;

    let shape = "";
    if (node.shape === "rect") {
      shape = `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" ry="6" fill="${WHITE}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;
    } else if (node.shape === "stadium") {
      const r = h / 2;
      shape = `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r.toFixed(1)}" ry="${r.toFixed(1)}" fill="${WHITE}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;
    } else {
      const pts = `${x.toFixed(1)},${top.toFixed(1)} ${(left + w).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(top + h).toFixed(1)} ${left.toFixed(1)},${y.toFixed(1)}`;
      shape = `<polygon points="${pts}" fill="${WHITE}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;
    }

    const innerW = node.shape === "diamond" ? w * 0.6 : w - 16;
    const lines = wrapText(node.label, FONT_SIZE, innerW);
    const totalH = lines.length * LINE_H;
    const baselineStart = y - totalH / 2 + FONT_SIZE * 0.85;
    let textEls = "";
    lines.forEach((ln, i) => {
      textEls += `<text x="${x.toFixed(1)}" y="${(baselineStart + i * LINE_H).toFixed(1)}" font-family="${FONT}" font-size="${FONT_SIZE}" fill="${PURE_BLACK}" text-anchor="middle">${escapeXml(ln)}</text>`;
    });

    nodesSvg += `<g class="flowchart-node" data-node-id="${escapeXml(id)}" data-shape="${node.shape}">${shape}${textEls}</g>`;
  }

  let edgesSvg = "";
  for (const e of spec.edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;
    const exit = edgePoint(a, b.x, b.y);
    const enter = edgePoint(b, a.x, a.y);
    const path = `M ${exit.x.toFixed(1)} ${exit.y.toFixed(1)} L ${enter.x.toFixed(1)} ${enter.y.toFixed(1)}`;
    edgesSvg += `<g class="flowchart-edge" data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}">`;
    edgesSvg += `<path d="${path}" stroke="${PURE_BLACK}" stroke-width="${STROKE}" fill="none" marker-end="url(#arrow)"/>`;
    if (e.label) {
      const mx = (exit.x + enter.x) / 2;
      const my = (exit.y + enter.y) / 2;
      const lw = estimateTextWidth(e.label, 11) + 10;
      edgesSvg += `<rect x="${(mx - lw / 2).toFixed(1)}" y="${(my - 9).toFixed(1)}" width="${lw.toFixed(1)}" height="18" fill="${WHITE}" stroke="none"/>`;
      edgesSvg += `<text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" font-family="${FONT}" font-size="11" fill="${PURE_BLACK}" text-anchor="middle">${escapeXml(e.label)}</text>`;
    }
    edgesSvg += `</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" font-family="${FONT}">
${ARROW_MARKER}
<g class="flowchart-edges">${edgesSvg}</g>
<g class="flowchart-nodes">${nodesSvg}</g>
</svg>`;
}

// ─────────────────────────── Protocol ───────────────────────────

export type ProtocolStep = { title: string; description?: string };
export type ProtocolSpec = { steps: ProtocolStep[] };

export function renderProtocol(spec: ProtocolSpec): string {
  const TITLE_SIZE = 14;
  const DESC_SIZE = 11;
  const CARD_W = 180;
  const HSEP = 50;
  const VSEP = 60;
  const PAD = 16;
  const BADGE_R = 14;
  const PAGE_PAD = 30;

  const cards = spec.steps.map((step, i) => {
    const titleLines = wrapText(step.title, TITLE_SIZE, CARD_W - 2 * PAD);
    const descLines = step.description
      ? wrapText(step.description, DESC_SIZE, CARD_W - 2 * PAD)
      : [];
    const titleH = titleLines.length * TITLE_SIZE * 1.25;
    const descH = descLines.length * DESC_SIZE * 1.3;
    const h = PAD + 28 + titleH + (descH > 0 ? 8 + descH : 0) + PAD;
    return { ...step, titleLines, descLines, h, idx: i };
  });

  const MAX_ROW_W = 920;
  const stepsPerRow = Math.max(1, Math.floor((MAX_ROW_W + HSEP) / (CARD_W + HSEP)));
  const rows: typeof cards[] = [];
  for (let i = 0; i < cards.length; i += stepsPerRow) {
    rows.push(cards.slice(i, i + stepsPerRow));
  }
  const rowH = Math.max(60, ...cards.map((c) => c.h));

  const colCount = Math.min(stepsPerRow, cards.length);
  const svgW = 2 * PAGE_PAD + colCount * CARD_W + (colCount - 1) * HSEP;
  const svgH = 2 * PAGE_PAD + rows.length * rowH + (rows.length - 1) * VSEP;

  let body = "";
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const y = PAGE_PAD + r * (rowH + VSEP);
    for (let c = 0; c < row.length; c++) {
      const card = row[c];
      const x = PAGE_PAD + c * (CARD_W + HSEP);

      body += `<g class="protocol-step" data-step="${card.idx + 1}">`;
      body += `<rect x="${x}" y="${y}" width="${CARD_W}" height="${rowH}" rx="8" fill="${WHITE}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;

      const bx = x + 18;
      const by = y + 18;
      body += `<circle cx="${bx}" cy="${by}" r="${BADGE_R}" fill="${PURE_BLACK}" stroke="none"/>`;
      body += `<text x="${bx}" y="${by + 4}" font-family="${FONT}" font-size="13" fill="${WHITE}" text-anchor="middle" font-weight="700">${card.idx + 1}</text>`;

      const titleStart = y + PAD + 36;
      card.titleLines.forEach((ln, i) => {
        body += `<text x="${x + CARD_W / 2}" y="${(titleStart + i * TITLE_SIZE * 1.25).toFixed(1)}" font-family="${FONT}" font-size="${TITLE_SIZE}" fill="${PURE_BLACK}" text-anchor="middle" font-weight="600">${escapeXml(ln)}</text>`;
      });
      const descStart = titleStart + card.titleLines.length * TITLE_SIZE * 1.25 + 6;
      card.descLines.forEach((ln, i) => {
        body += `<text x="${x + CARD_W / 2}" y="${(descStart + i * DESC_SIZE * 1.3).toFixed(1)}" font-family="${FONT}" font-size="${DESC_SIZE}" fill="${PURE_BLACK}" text-anchor="middle">${escapeXml(ln)}</text>`;
      });
      body += `</g>`;

      if (c < row.length - 1) {
        const ax = x + CARD_W;
        const bx2 = x + CARD_W + HSEP;
        const ay = y + rowH / 2;
        body += `<path class="protocol-arrow" d="M ${ax} ${ay} L ${bx2} ${ay}" stroke="${PURE_BLACK}" stroke-width="${STROKE}" fill="none" marker-end="url(#arrow)"/>`;
      }
    }

    if (r < rows.length - 1 && row.length === stepsPerRow) {
      const startX = PAGE_PAD + (stepsPerRow - 1) * (CARD_W + HSEP) + CARD_W;
      const endX = PAGE_PAD;
      const yMid1 = y + rowH / 2;
      const yMid2 = y + rowH + VSEP / 2;
      const yMid3 = y + rowH + VSEP + rowH / 2;
      body += `<path class="protocol-wrap" d="M ${startX} ${yMid1} L ${startX + 16} ${yMid1} L ${startX + 16} ${yMid2} L ${endX - 16} ${yMid2} L ${endX - 16} ${yMid3} L ${endX} ${yMid3}" stroke="${PURE_BLACK}" stroke-width="${STROKE}" fill="none" marker-end="url(#arrow)"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(svgW)}" height="${Math.round(svgH)}" viewBox="0 0 ${Math.round(svgW)} ${Math.round(svgH)}" font-family="${FONT}">
${ARROW_MARKER}
${body}
</svg>`;
}

// ─────────────────────────── Timeline ───────────────────────────

export type TimelineEvent = {
  time: string;
  title: string;
  description?: string;
};
export type TimelineSpec = { events: TimelineEvent[] };

export function renderTimeline(spec: TimelineSpec): string {
  const TITLE_SIZE = 13;
  const DESC_SIZE = 11;
  const TIME_SIZE = 12;
  const BOX_W = 160;
  const BOX_PAD = 12;
  const PAGE_PAD = 30;
  const LEADER_LEN = 28;
  const TIME_LABEL_GAP = 18;

  const events = spec.events.map((ev, i) => {
    const titleLines = wrapText(ev.title, TITLE_SIZE, BOX_W - 2 * BOX_PAD);
    const descLines = ev.description
      ? wrapText(ev.description, DESC_SIZE, BOX_W - 2 * BOX_PAD)
      : [];
    const titleH = titleLines.length * TITLE_SIZE * 1.25;
    const descH = descLines.length * DESC_SIZE * 1.3;
    const h = BOX_PAD + titleH + (descH > 0 ? 6 + descH : 0) + BOX_PAD;
    return { ...ev, titleLines, descLines, h, idx: i };
  });
  const maxBoxH = Math.max(60, ...events.map((e) => e.h));

  const n = events.length;
  const minSpacing = BOX_W + 36;
  const axisInner = Math.max(600, n * minSpacing);
  const svgW = axisInner + 2 * PAGE_PAD;

  const eventBoxY = PAGE_PAD;
  const eventBoxBottom = eventBoxY + maxBoxH;
  const axisY = eventBoxBottom + LEADER_LEN;
  const timeLabelY = axisY + TIME_LABEL_GAP;
  const totalH = timeLabelY + 12 + PAGE_PAD;

  const xs: number[] = [];
  if (n === 1) {
    xs.push(svgW / 2);
  } else {
    const startX = PAGE_PAD + BOX_W / 2;
    const endX = svgW - PAGE_PAD - BOX_W / 2;
    const step = (endX - startX) / (n - 1);
    for (let i = 0; i < n; i++) xs.push(startX + i * step);
  }

  let body = "";
  body += `<line class="timeline-axis" x1="${PAGE_PAD}" y1="${axisY}" x2="${svgW - PAGE_PAD}" y2="${axisY}" stroke="${PURE_BLACK}" stroke-width="${STROKE}" marker-end="url(#arrow)"/>`;

  for (let i = 0; i < n; i++) {
    const ev = events[i];
    const cx = xs[i];

    body += `<line class="timeline-tick" x1="${cx}" y1="${axisY - 5}" x2="${cx}" y2="${axisY + 5}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;
    body += `<text class="timeline-time-label" x="${cx}" y="${timeLabelY}" font-family="${FONT}" font-size="${TIME_SIZE}" fill="${PURE_BLACK}" text-anchor="middle" font-weight="700">${escapeXml(ev.time)}</text>`;
    body += `<line class="timeline-leader" x1="${cx}" y1="${axisY - 5}" x2="${cx}" y2="${eventBoxBottom}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;

    const bx = cx - BOX_W / 2;
    const by = eventBoxY;
    body += `<g class="timeline-event" data-event-idx="${i}">`;
    body += `<rect x="${bx}" y="${by}" width="${BOX_W}" height="${maxBoxH}" rx="6" fill="${WHITE}" stroke="${PURE_BLACK}" stroke-width="${STROKE}"/>`;

    const titleStart = by + BOX_PAD + TITLE_SIZE * 0.85;
    ev.titleLines.forEach((ln, j) => {
      body += `<text x="${cx}" y="${(titleStart + j * TITLE_SIZE * 1.25).toFixed(1)}" font-family="${FONT}" font-size="${TITLE_SIZE}" fill="${PURE_BLACK}" text-anchor="middle" font-weight="700">${escapeXml(ln)}</text>`;
    });
    const descStart = titleStart + ev.titleLines.length * TITLE_SIZE * 1.25 + 6;
    ev.descLines.forEach((ln, j) => {
      body += `<text x="${cx}" y="${(descStart + j * DESC_SIZE * 1.3).toFixed(1)}" font-family="${FONT}" font-size="${DESC_SIZE}" fill="${PURE_BLACK}" text-anchor="middle">${escapeXml(ln)}</text>`;
    });
    body += `</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(svgW)}" height="${Math.round(totalH)}" viewBox="0 0 ${Math.round(svgW)} ${Math.round(totalH)}" font-family="${FONT}">
${ARROW_MARKER}
${body}
</svg>`;
}

// ─────────────────────────── Gemini JSON call ───────────────────────────

const FLOWCHART_SCHEMA = {
  type: "object",
  properties: {
    direction: { type: "string", enum: ["TB", "LR"] },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          shape: { type: "string", enum: ["rect", "diamond", "stadium"] },
        },
        required: ["id", "label", "shape"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
  },
  required: ["direction", "nodes", "edges"],
};

const PROTOCOL_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["steps"],
};

const TIMELINE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          time: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["time", "title"],
      },
    },
  },
  required: ["events"],
};

const FLOWCHART_INSTRUCTION = `You convert a user description into a strict JSON spec for a flowchart.

Rules:
- Pick "direction": "TB" (top-to-bottom) or "LR" (left-to-right) — whichever reads more naturally for the subject. Default to "TB".
- Use "shape": "stadium" for start/end terminals; "diamond" for decision points (yes/no branches); "rect" for normal process steps.
- Keep labels short (≤ 6 words preferred). Use scientific abbreviations where helpful.
- Use stable, descriptive ids ("start", "lyse", "decision_purified", etc.).
- Every edge.from and edge.to MUST reference an existing node id.
- For decision branches, set edge.label to "Yes"/"No" or the branching condition.
- Aim for 5–12 nodes for clarity. Do not exceed 20.
- Output ONLY the JSON spec; no commentary.`;

const PROTOCOL_INSTRUCTION = `You convert a written method description into a strict JSON spec for a step-by-step protocol diagram.

Rules:
- Each step has a short, action-oriented "title" (≤ 4–5 words, e.g. "Lyse cells", "Run SDS-PAGE").
- Optionally include a one-line "description" with the most important detail (reagent, duration, temperature, etc.).
- Order steps in true execution order.
- Aim for 4–8 steps. Combine trivial sub-steps; do not split into > 10.
- Output ONLY the JSON spec; no commentary.`;

const TIMELINE_INSTRUCTION = `You convert a study/experiment description into a strict JSON spec for an experimental timeline.

Rules:
- Each event has a "time" string (e.g. "Day 1", "Day 10", "Week 4", "Month 6", "T = 0", "−24 h") and a short "title" (≤ 5 words).
- Optionally include a one-line "description".
- Order events chronologically.
- Aim for 4–8 events. Do not exceed 12.
- Use the most natural time unit for the study (days for short studies, weeks/months for long ones).
- Output ONLY the JSON spec; no commentary.`;

function stripMarkdownFences(s: string): string {
  // LLMs sometimes wrap JSON in ```json ... ``` fences despite responseMimeType.
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

async function callGeminiJson<T>(
  apiKey: string,
  instruction: string,
  userPrompt: string,
  schema: unknown,
): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 30000);

  // Two-attempt strategy:
  //   1) With responseMimeType+responseSchema (preferred — strict JSON).
  //   2) Without responseSchema (some Gemini versions/regions reject the schema
  //      shape and return a 400). The system prompt already tells the model to
  //      output JSON only, and we strip any markdown fences before parsing.
  const baseBody = (withSchema: boolean) => ({
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: instruction }] },
    generationConfig: {
      responseMimeType: "application/json",
      ...(withSchema ? { responseSchema: schema } : {}),
      // 8192 keeps headroom for ~20-node flowcharts with labels.
      // Lower limits truncate mid-string and corrupt the JSON.
      maxOutputTokens: 8192,
      temperature: 0.4,
    },
  });

  const attempt = async (withSchema: boolean): Promise<T> => {
    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(baseBody(withSchema)),
        signal: ctrl.signal,
      },
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini JSON ${resp.status}${withSchema ? " (with schema)" : " (no schema)"}: ${err.slice(0, 400)}`);
    }
    const data = await resp.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (!text) {
      console.error("[structuredRenderer] No text in Gemini response. finishReason=", finishReason, "raw=", JSON.stringify(data).slice(0, 600));
      throw new Error(`Gemini returned no JSON text (finishReason=${finishReason || "unknown"})`);
    }
    const cleaned = stripMarkdownFences(text);
    try {
      return JSON.parse(cleaned) as T;
    } catch (parseErr: any) {
      console.error("[structuredRenderer] JSON parse failed. finishReason=", finishReason, "len=", cleaned.length, "tail=", cleaned.slice(-200));
      // MAX_TOKENS truncation produces unterminated JSON — give the user a clear hint.
      if (finishReason === "MAX_TOKENS") {
        throw new Error("Diagram too large to fit in one response. Try a shorter / less detailed prompt.");
      }
      throw new Error(`Failed to parse Gemini JSON: ${parseErr?.message}; preview=${cleaned.slice(0, 200)}`);
    }
  };

  try {
    try {
      return await attempt(true);
    } catch (firstErr: any) {
      // Retry without schema only on 400-class errors that may indicate schema rejection.
      const msg = firstErr?.message || "";
      if (/Gemini JSON 4\d\d/.test(msg)) {
        console.warn("[structuredRenderer] First attempt failed with 4xx, retrying without responseSchema:", msg);
        return await attempt(false);
      }
      throw firstErr;
    }
  } finally {
    clearTimeout(to);
  }
}

function validateFlowSpec(j: unknown): FlowSpec {
  const x = j as FlowSpec;
  if (!x || typeof x !== "object") throw new Error("Invalid flowchart spec");
  if (x.direction !== "TB" && x.direction !== "LR") x.direction = "TB";
  if (!Array.isArray(x.nodes) || !x.nodes.length) throw new Error("Flowchart has no nodes");
  if (!Array.isArray(x.edges)) x.edges = [];
  const ids = new Set<string>();
  for (const n of x.nodes) {
    if (!n.id || !n.label) throw new Error("Flowchart node missing id/label");
    if (!["rect", "diamond", "stadium"].includes(n.shape)) n.shape = "rect";
    ids.add(n.id);
  }
  x.edges = x.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  return x;
}

function validateProtocolSpec(j: unknown): ProtocolSpec {
  const x = j as ProtocolSpec;
  if (!x || !Array.isArray(x.steps) || !x.steps.length) {
    throw new Error("Protocol has no steps");
  }
  for (const s of x.steps) if (!s.title) throw new Error("Step missing title");
  return x;
}

function validateTimelineSpec(j: unknown): TimelineSpec {
  const x = j as TimelineSpec;
  if (!x || !Array.isArray(x.events) || !x.events.length) {
    throw new Error("Timeline has no events");
  }
  for (const e of x.events) {
    if (!e.time || !e.title) throw new Error("Event missing time/title");
  }
  return x;
}

export type StructuredMode = "flowchart" | "protocol" | "timeline";

export async function generateStructuredDiagram(args: {
  apiKey: string;
  mode: StructuredMode;
  prompt: string;
}): Promise<{ svg: string; json: unknown }> {
  const { apiKey, mode, prompt } = args;
  if (mode === "flowchart") {
    const raw = await callGeminiJson(apiKey, FLOWCHART_INSTRUCTION, prompt, FLOWCHART_SCHEMA);
    const spec = validateFlowSpec(raw);
    return { svg: renderFlowchart(spec), json: spec };
  }
  if (mode === "protocol") {
    const raw = await callGeminiJson(apiKey, PROTOCOL_INSTRUCTION, prompt, PROTOCOL_SCHEMA);
    const spec = validateProtocolSpec(raw);
    return { svg: renderProtocol(spec), json: spec };
  }
  const raw = await callGeminiJson(apiKey, TIMELINE_INSTRUCTION, prompt, TIMELINE_SCHEMA);
  const spec = validateTimelineSpec(raw);
  return { svg: renderTimeline(spec), json: spec };
}
