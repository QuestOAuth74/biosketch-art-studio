// Vector-mode icon generator: LLM emits a strict JSON spec of SVG primitives,
// and we deterministically render to clean editable SVG (one <g> per element).
// Quality caveat: works best for simple subjects (lab equipment, geometric icons,
// clear anatomy outlines). Complex organic textures should use raster mode.

const escapeXml = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

type IconElement = {
  type: "circle" | "ellipse" | "rect" | "path" | "polygon" | "polyline" | "line";
  name?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cx?: number; cy?: number; r?: number; rx?: number; ry?: number;
  x?: number; y?: number; width?: number; height?: number;
  d?: string; points?: string;
  x1?: number; y1?: number; x2?: number; y2?: number;
};

export type IconSpec = {
  viewBox?: string;
  width?: number;
  height?: number;
  elements: IconElement[];
};

const DEFAULT_VIEWBOX = "0 0 100 100";

export const ICON_SVG_SCHEMA = {
  type: "object",
  properties: {
    viewBox: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["circle", "ellipse", "rect", "path", "polygon", "polyline", "line"] },
          name: { type: "string" },
          fill: { type: "string" },
          stroke: { type: "string" },
          strokeWidth: { type: "number" },
          cx: { type: "number" }, cy: { type: "number" },
          r: { type: "number" }, rx: { type: "number" }, ry: { type: "number" },
          x: { type: "number" }, y: { type: "number" },
          width: { type: "number" }, height: { type: "number" },
          d: { type: "string" }, points: { type: "string" },
          x1: { type: "number" }, y1: { type: "number" },
          x2: { type: "number" }, y2: { type: "number" },
        },
        required: ["type"],
      },
    },
  },
  required: ["elements"],
};

export function renderIconSvg(spec: IconSpec, opts: { aspect?: "square" | "portrait" | "landscape" } = {}): string {
  const elements = Array.isArray(spec.elements) ? spec.elements : [];

  // Resolve viewBox. Prefer the spec's, otherwise derive from aspect.
  const aspectVB: Record<string, string> = {
    square: "0 0 100 100",
    portrait: "0 0 75 100",
    landscape: "0 0 100 75",
  };
  const viewBox = spec.viewBox || aspectVB[opts.aspect || "square"] || DEFAULT_VIEWBOX;

  const parts = elements
    .map((el, i) => {
      const fill = el.fill || "none";
      const stroke = el.stroke || "none";
      const sw = num(el.strokeWidth, stroke === "none" ? 0 : 1);
      const common = `class="icon-part" data-name="${escapeXml(el.name || el.type)}" data-idx="${i}"`;
      const styleAttrs = `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${sw}"`;

      switch (el.type) {
        case "circle":
          return `<circle ${common} ${styleAttrs} cx="${num(el.cx)}" cy="${num(el.cy)}" r="${num(el.r)}" />`;
        case "ellipse":
          return `<ellipse ${common} ${styleAttrs} cx="${num(el.cx)}" cy="${num(el.cy)}" rx="${num(el.rx)}" ry="${num(el.ry)}" />`;
        case "rect":
          return `<rect ${common} ${styleAttrs} x="${num(el.x)}" y="${num(el.y)}" width="${num(el.width)}" height="${num(el.height)}"${el.rx != null ? ` rx="${num(el.rx)}"` : ""} />`;
        case "path":
          if (!el.d) return "";
          return `<path ${common} ${styleAttrs} d="${escapeXml(el.d)}" />`;
        case "polygon":
          if (!el.points) return "";
          return `<polygon ${common} ${styleAttrs} points="${escapeXml(el.points)}" />`;
        case "polyline":
          if (!el.points) return "";
          return `<polyline ${common} ${styleAttrs} points="${escapeXml(el.points)}" />`;
        case "line":
          return `<line ${common} stroke="${escapeXml(stroke)}" stroke-width="${sw}" x1="${num(el.x1)}" y1="${num(el.y1)}" x2="${num(el.x2)}" y2="${num(el.y2)}" />`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeXml(viewBox)}" stroke-linejoin="round" stroke-linecap="round">
  ${parts}
</svg>`;
}

export function validateIconSpec(j: unknown): IconSpec {
  const x = j as IconSpec;
  if (!x || typeof x !== "object") throw new Error("Invalid icon spec");
  if (!Array.isArray(x.elements) || !x.elements.length) {
    throw new Error("Icon has no elements");
  }
  for (const el of x.elements) {
    if (!el.type) throw new Error("Element missing type");
    // Loose validation — renderer is defensive about missing fields.
  }
  return x;
}

function stripMarkdownFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export async function callGeminiForIconJson(args: {
  apiKey: string;
  prompt: string;
  style: string;
  palette?: string[];
  aspect?: "square" | "portrait" | "landscape";
}): Promise<IconSpec> {
  const { apiKey, prompt, style, palette, aspect } = args;

  const aspectInstruction = aspect === "portrait"
    ? `Use a portrait viewBox like "0 0 75 100".`
    : aspect === "landscape"
    ? `Use a landscape viewBox like "0 0 100 75".`
    : `Use a square viewBox like "0 0 100 100".`;

  const styleHint = style === "pencil"
    ? `Style: hand-drawn pencil — use stroke-only shapes (fill="none"), all strokes black or near-black, light strokeWidth (~0.5–1.2), prefer thin paths and outlines over filled shapes. Use cross-hatching (multiple short lines) for shading.`
    : `Style: clean flat 2D vector — solid color fills (NO gradients), thin uniform outlines (~1) in a slightly darker shade of the fill, crisp geometric forms.`;

  const paletteHint = palette && palette.length
    ? `Use ONLY this color palette for fills: ${palette.join(", ")}. Stroke colors should be a dark shade derived from each fill (~25% darker).`
    : `Choose anatomically/scientifically accurate colors.`;

  const instruction = `You design clean editable SVG icons by emitting a strict JSON spec of SVG primitive shapes.

${styleHint}
${paletteHint}
${aspectInstruction}

JSON SPEC RULES:
- "viewBox" is a "minX minY width height" string.
- "elements" is an ordered array of primitive shapes. Later elements render ON TOP of earlier ones.
- Allowed types: "circle" (cx,cy,r), "ellipse" (cx,cy,rx,ry), "rect" (x,y,width,height,rx?), "path" (d), "polygon" (points), "polyline" (points), "line" (x1,y1,x2,y2).
- Colors are hex strings ("#3B82F6"). Use "none" for absent fill or stroke.
- "strokeWidth" is a number (recommend 0.5–2 for 100-unit viewBox).
- Each element gets a short "name" that semantically labels the part (e.g. "outer_membrane", "axon", "leaf_blade") so it can be selected on canvas.
- Use as many elements as needed for fidelity (typically 6–25). NO text/letters/numbers.
- Output ONLY the JSON spec; no commentary.

Subject to draw: ${prompt}`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 30000);

  const baseBody = (withSchema: boolean) => ({
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: instruction }] },
    generationConfig: {
      responseMimeType: "application/json",
      ...(withSchema ? { responseSchema: ICON_SVG_SCHEMA } : {}),
      maxOutputTokens: 8192,
      temperature: 0.6,
    },
  });

  const attempt = async (withSchema: boolean): Promise<IconSpec> => {
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
      throw new Error(`Gemini ${resp.status}${withSchema ? " (with schema)" : " (no schema)"}: ${err.slice(0, 400)}`);
    }
    const data = await resp.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (!text) throw new Error(`Gemini returned no JSON text (finishReason=${finishReason || "unknown"})`);
    const cleaned = stripMarkdownFences(text);
    try {
      return JSON.parse(cleaned) as IconSpec;
    } catch (e: any) {
      if (finishReason === "MAX_TOKENS") {
        throw new Error("Icon too complex to fit in one response. Try a simpler subject.");
      }
      throw new Error(`Failed to parse icon JSON: ${e?.message}; preview=${cleaned.slice(0, 200)}`);
    }
  };

  try {
    try {
      return await attempt(true);
    } catch (firstErr: any) {
      if (/Gemini 4\d\d/.test(firstErr?.message || "")) {
        console.warn("[iconSvgRenderer] retrying without responseSchema:", firstErr.message);
        return await attempt(false);
      }
      throw firstErr;
    }
  } finally {
    clearTimeout(to);
  }
}
