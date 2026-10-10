/**
 * sciExport — Step 4: vector / raster export for the Scientific Illustrator.
 *
 * Exports either the whole canvas or a single selected sub-component as a
 * standalone SVG string or a high-resolution (optionally transparent) PNG.
 *
 * The on-screen <svg> has a pan/zoom transform on its content <g>; exports
 * strip that transform so output is always the clean, fully-framed diagram.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

export type ExportScope = "full" | "selection";
export type ExportFormat = "svg" | "png";

function parseViewBox(svg: SVGSVGElement) {
  const [, , w, h] = (svg.getAttribute("viewBox") ?? "0 0 920 660")
    .split(/\s+/).map(Number);
  return { w, h };
}

/** Standalone SVG of the entire diagram (pan/zoom + grid removed). */
function buildFullSvg(svg: SVGSVGElement, background: string | null): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { w, h } = parseViewBox(svg);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  clone.querySelector('rect[fill="url(#sci-grid)"]')?.remove();
  clone.querySelector<SVGGElement>(":scope > g")?.removeAttribute("transform");

  if (background) clone.insertBefore(bgRect(0, 0, w, h, background), clone.firstChild);
  return clone;
}

/** Standalone SVG cropped to one node/atom, identified by data-pick/data-atom. */
function buildSelectionSvg(
  svg: SVGSVGElement, id: string, background: string | null,
): SVGSVGElement {
  const live = svg.querySelector<SVGGraphicsElement>(
    `[data-pick="${CSS.escape(id)}"], [data-atom="${CSS.escape(id)}"]`,
  );
  if (!live) throw new Error("Nothing selected to export");

  const bb = live.getBBox();
  const pad = 18;
  const x = bb.x - pad, y = bb.y - pad;
  const w = bb.width + pad * 2, h = bb.height + pad * 2;

  const out = document.createElementNS(SVG_NS, "svg");
  out.setAttribute("xmlns", SVG_NS);
  out.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  out.setAttribute("width", String(Math.round(w)));
  out.setAttribute("height", String(Math.round(h)));

  const defs = svg.querySelector("defs");
  if (defs) out.appendChild(defs.cloneNode(true));
  if (background) out.appendChild(bgRect(x, y, w, h, background));
  out.appendChild(live.cloneNode(true));
  return out;
}

function bgRect(x: number, y: number, w: number, h: number, fill: string) {
  const r = document.createElementNS(SVG_NS, "rect");
  r.setAttribute("x", String(x));
  r.setAttribute("y", String(y));
  r.setAttribute("width", String(w));
  r.setAttribute("height", String(h));
  r.setAttribute("fill", fill);
  return r;
}

function serialize(node: SVGSVGElement) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(node);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Rasterise an SVG string to a PNG blob at `scale`× resolution. */
async function rasterize(svgString: string, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to rasterise SVG"));
      img.src = url;
    });
    const w = (img.naturalWidth || img.width) * scale;
    const h = (img.naturalHeight || img.height) * scale;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(img, 0, 0, w, h); // background, if any, is baked into the SVG
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ExportRequest {
  svg: SVGSVGElement;
  format: ExportFormat;
  scope: ExportScope;
  selectionId?: string | null;
  /** solid colour, or null for a transparent background */
  background: string | null;
  /** PNG resolution multiplier (ignored for SVG) */
  scale?: number;
  filename?: string;
}

/** Single entry point — builds the artefact and triggers a browser download. */
export async function exportDiagram(req: ExportRequest): Promise<void> {
  const { svg, format, scope, selectionId, background, scale = 3 } = req;
  const root = scope === "selection"
    ? buildSelectionSvg(svg, selectionId ?? "", background)
    : buildFullSvg(svg, background);

  const base = req.filename ?? `scientific-diagram${scope === "selection" ? "-element" : ""}`;
  const svgString = serialize(root);

  if (format === "svg") {
    download(new Blob([svgString], { type: "image/svg+xml" }), `${base}.svg`);
  } else {
    download(await rasterize(svgString, scale), `${base}.png`);
  }
}

/**
 * Standalone full-canvas SVG string — pan/zoom + grid stripped. Used to hand
 * the diagram to the Fabric.js canvas editor (which parses it into editable
 * objects: every <text> becomes editable text, shapes become editable shapes).
 */
export function diagramSvgString(svg: SVGSVGElement, background: string | null = null): string {
  return serialize(buildFullSvg(svg, background));
}
