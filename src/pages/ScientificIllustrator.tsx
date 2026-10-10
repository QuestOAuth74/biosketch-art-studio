/**
 * Scientific Illustrator — Napkin.ai-style text-to-visual workspace for
 * scientific & medical diagrams.
 *
 * PIPELINE  prose ─▶ [parser] ─▶ SciDiagram ─▶ [useScientificLayout] ─▶ SVG
 *   Step 1  split-screen shell + SVG rendering engine
 *   Step 2  generate-scientific-diagram edge function (Gemini structured
 *           output); `mockParse` is the offline fallback
 *   Step 3  useScientificLayout — elastic geometry; draggable chemical atoms
 *   Step 4  customization & export — per-node style variants, global palettes,
 *           SVG / PNG export of the canvas or a single sub-component
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Dna, FlaskConical, Magnet, Microscope, Wand2, Loader2,
  ZoomIn, ZoomOut, Maximize2, MousePointer2, RotateCcw,
  Palette, Download, X, ChevronDown, Check, SquarePen,
  Library, Save, Trash2, Sparkles, ArrowUp, Plus, Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiInvokeGuard } from "@/hooks/useAiInvokeGuard";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  CANVAS_W, PAD, centerOf, boundaryPoint,
  type DiagramKind, type SciDiagram, type SciLayout, type ChemAtom,
  type CellularDiagram, type ChemicalDiagram, type PhysicsDiagram, type LabDiagram,
  type CellularLayout, type ChemicalLayout, type PhysicsLayout, type LabLayout,
  type CellLayer, type CellNodeType, type ForceType, type BondOrder,
} from "@/lib/sciDiagram";
import {
  PALETTES, PALETTE_LIST, variantStyle, VARIANT_LABELS,
  type PaletteId, type NodeVariant, type SciTheme,
} from "@/lib/sciPalettes";
import { exportDiagram, diagramSvgString, type ExportFormat } from "@/lib/sciExport";
import { useScientificLayout } from "@/hooks/useScientificLayout";
import { useDiagramIcons } from "@/hooks/useDiagramIcons";
import { useSavedDiagrams, type SavedDiagram } from "@/hooks/useSavedDiagrams";

/* ════════════════════════════ CATEGORIES ═══════════════════════════════ */

interface Category {
  id: DiagramKind;
  name: string;
  icon: React.ReactNode;
  accent: string;
  sample: string;
}

const CATEGORIES: Category[] = [
  {
    id: "cellular", name: "Biology / Cellular", icon: <Dna size={16} />, accent: "#db2777",
    sample:
      "# JAK-STAT Signaling\n\nAn extracellular **cytokine** binds the cytokine " +
      "receptor on the plasma membrane. The receptor activates **JAK2** in the " +
      "cytoplasm, which phosphorylates **STAT3**. Phosphorylated STAT3 forms a " +
      "STAT3 dimer that translocates to the nucleus and drives transcription of " +
      "the target gene. SOCS3 inhibits JAK2 as negative feedback.",
  },
  {
    id: "chemical", name: "Chemistry", icon: <FlaskConical size={16} />, accent: "#0891b2",
    sample:
      "# Benzene Ring\n\nBenzene (C6H6) is an aromatic hydrocarbon: six carbon " +
      "atoms in a planar hexagonal ring with alternating single and double " +
      "covalent bonds. Each carbon bonds to one hydrogen atom.",
  },
  {
    id: "physics", name: "Physics / Forces", icon: <Magnet size={16} />, accent: "#7c3aed",
    sample:
      "# Crate on a Floor\n\nA 5 kg crate rests on a horizontal floor while being " +
      "pushed. Gravity pulls down at 49 N. The normal force pushes up at 49 N. " +
      "An applied force of 30 N acts to the right, opposed by 18 N of friction.",
  },
  {
    id: "lab", name: "Lab Equipment", icon: <Microscope size={16} />, accent: "#ea580c",
    sample:
      "# Simple Distillation\n\nA heat source warms the distillation flask. The " +
      "resulting vapour rises into the condenser, where it cools and condenses. " +
      "The purified liquid is gathered in the collection flask.",
  },
];

/* ════════════════════════ MOCK PARSER (fallback) ═══════════════════════ */

const SAMPLE_DIAGRAMS: Record<DiagramKind, SciDiagram> = {
  cellular: {
    kind: "cellular", title: "JAK-STAT Signaling Pathway",
    layout: "compartments",
    nodes: [
      { id: "cyt", label: "Cytokine", layer: "extracellular", type: "ligand" },
      { id: "rec", label: "Cytokine Receptor", layer: "membrane", type: "receptor" },
      { id: "jak", label: "JAK2", layer: "cytoplasm", type: "protein" },
      { id: "socs", label: "SOCS3", layer: "cytoplasm", type: "protein" },
      { id: "stat", label: "STAT3", layer: "cytoplasm", type: "protein" },
      { id: "dimer", label: "STAT3 Dimer", layer: "cytoplasm", type: "complex" },
      { id: "gene", label: "Target Gene", layer: "nucleus", type: "gene" },
    ],
    edges: [
      { from: "cyt", to: "rec", effect: "activate", label: "binds" },
      { from: "rec", to: "jak", effect: "activate" },
      { from: "jak", to: "stat", effect: "activate", label: "phosphorylates" },
      { from: "stat", to: "dimer", effect: "activate", label: "dimerizes" },
      { from: "dimer", to: "gene", effect: "activate", label: "transcription" },
      { from: "socs", to: "jak", effect: "inhibit", label: "feedback" },
    ],
  },
  chemical: (() => {
    const atoms: ChemAtom[] = [];
    const bonds: ChemicalDiagram["bonds"] = [];
    const cR = 0.27, hR = 0.45;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      atoms.push({ id: `C${i}`, element: "C", rx: 0.5 + cR * Math.cos(a), ry: 0.5 + cR * Math.sin(a) });
      atoms.push({ id: `H${i}`, element: "H", rx: 0.5 + hR * Math.cos(a), ry: 0.5 + hR * Math.sin(a) });
      bonds.push({ from: `C${i}`, to: `H${i}`, order: "single" });
      bonds.push({ from: `C${i}`, to: `C${(i + 1) % 6}`, order: i % 2 === 0 ? "double" : "single" });
    }
    return { kind: "chemical", title: "Benzene (C₆H₆)", atoms, bonds };
  })(),
  physics: {
    kind: "physics", title: "Free-Body Diagram — Crate",
    massLabel: "Crate", massValue: "5 kg",
    forces: [
      { id: "g", label: "Gravity", type: "gravity", magnitude: 49, angleDeg: 270 },
      { id: "n", label: "Normal", type: "normal", magnitude: 49, angleDeg: 90 },
      { id: "a", label: "Applied", type: "applied", magnitude: 30, angleDeg: 0 },
      { id: "f", label: "Friction", type: "friction", magnitude: 18, angleDeg: 180 },
    ],
  },
  lab: {
    kind: "lab", title: "Simple Distillation Setup",
    steps: [
      { id: "heat", label: "Heat Source", apparatus: "Bunsen burner" },
      { id: "flask", label: "Distillation Flask", apparatus: "round-bottom flask" },
      { id: "cond", label: "Condenser", apparatus: "Liebig condenser" },
      { id: "coll", label: "Collection Flask", apparatus: "conical flask" },
    ],
    edges: [
      { from: "heat", to: "flask", label: "heats" },
      { from: "flask", to: "cond", label: "vapour" },
      { from: "cond", to: "coll", label: "condensate" },
    ],
  },
};

const mockParse = (kind: DiagramKind): SciDiagram => SAMPLE_DIAGRAMS[kind];

/* labels for the multi-agent pipeline stages, cycled while generating */
const GEN_STAGES = ["Planning…", "Designing…", "Reviewing…"];

/** Error thrown by invokeDiagram — surfaces the parsed body so callers can
 *  react to specific codes (WAITING_PERIOD, INSUFFICIENT_CREDITS). */
class InvokeDiagramError extends Error {
  body: any;
  constructor(message: string, body: any) {
    super(message);
    this.body = body;
  }
}

/** Call the edge function (generate OR refine) and return the diagram, with
 *  the real server error recovered from FunctionsHttpError's Response. */
async function invokeDiagram(body: Record<string, unknown>): Promise<SciDiagram> {
  const { data, error } = await supabase.functions.invoke(
    "generate-scientific-diagram", { body },
  );
  if (error) {
    let detail = error.message;
    let parsed: any = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        parsed = await ctx.json();
        if (parsed?.error) detail = parsed.error;
      } catch { /* non-JSON body */ }
    }
    throw new InvokeDiagramError(detail, parsed);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.diagram) throw new Error("No diagram returned");
  return data.diagram as SciDiagram;
}

/* ═══════════════════════════ SVG RENDERERS ═════════════════════════════ */

interface RenderProps {
  theme: SciTheme;
  selectedId: string | null;
  variantOf: (id: string) => NodeVariant;
  /** node-id → SVG data-URI, resolved from the app's icon library */
  icons: Record<string, string>;
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
}

/** strokeWidth/colour bump for the selected shape, on top of its variant. */
function selStroke(theme: SciTheme, base: { stroke: string; strokeWidth: number }, sel: boolean) {
  return sel
    ? { stroke: theme.title, strokeWidth: Math.max(base.strokeWidth, 3) }
    : base;
}

/** Arrowhead drawn as a real <polygon> (not an SVG <marker>) so it survives
 *  parsing into the Fabric.js canvas editor. (ux,uy) is the unit direction. */
function ArrowHead(
  { tipX, tipY, ux, uy, color, size = 10 }:
  { tipX: number; tipY: number; ux: number; uy: number; color: string; size?: number },
) {
  const w = size * 0.6;
  const bx = tipX - ux * size, by = tipY - uy * size;
  const px = -uy, py = ux;
  return (
    <polygon
      points={`${tipX},${tipY} ${bx + px * w},${by + py * w} ${bx - px * w},${by - py * w}`}
      fill={color}
    />
  );
}

function CellularRenderer(
  { d, layout, theme, selectedId, variantOf, icons, onSelect, onInspect }:
  { d: CellularDiagram; layout: CellularLayout } & RenderProps,
) {
  return (
    <g>
      {d.edges.map((e, i) => {
        const a = layout.nodes[e.from], b = layout.nodes[e.to];
        if (!a || !b) return null;
        const ca = centerOf(a), cb = centerOf(b);
        // run edges boundary-to-boundary so the arrowhead sits on the node edge
        const start = boundaryPoint(a, cb.x, cb.y);
        const end = boundaryPoint(b, ca.x, ca.y);
        const stroke = e.effect === "inhibit" ? theme.inhibit : theme.activate;
        const dx = end.x - start.x, dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const eid = `__edge:${i}`;
        const esel = selectedId === eid;
        return (
          <g key={i} data-pick={eid} style={{ cursor: "pointer" }}
             onClick={() => onSelect(eid)} onDoubleClick={() => onInspect(eid)}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke="transparent" strokeWidth={14} />
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke={stroke} strokeWidth={esel ? 4.5 : 2.4} />
            {e.effect === "activate" && (
              <ArrowHead tipX={end.x} tipY={end.y} ux={ux} uy={uy} color={stroke} />
            )}
            {e.effect === "inhibit" && (
              <line x1={end.x - uy * 11} y1={end.y + ux * 11}
                    x2={end.x + uy * 11} y2={end.y - ux * 11}
                    stroke={theme.inhibit} strokeWidth={3.4} />
            )}
            {e.label && (
              <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 6} fontSize={10.5}
                    textAnchor="middle" fill={theme.muted} fontStyle="italic"
                    style={{ paintOrder: "stroke" }} stroke={theme.halo} strokeWidth={3}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {d.nodes.map((n) => {
        const b = layout.nodes[n.id];
        if (!b) return null;
        const sel = selectedId === n.id;
        const v = variantOf(n.id);
        const st = variantStyle(theme.nodeFill[n.type], theme, v);
        const sk = selStroke(theme, st, sel);
        const icon = icons[n.id];
        return (
          <g key={n.id} data-pick={n.id} style={{ cursor: "pointer" }}
             onClick={() => onSelect(n.id)} onDoubleClick={() => onInspect(n.id)}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={n.type === "gene" ? 6 : 23}
                  fill={st.fill} fillOpacity={st.fillOpacity}
                  stroke={sk.stroke} strokeWidth={sk.strokeWidth} strokeDasharray={st.dash} />
            {icon && (
              <image href={icon} x={b.x + b.w / 2 - 14} y={b.y + 7}
                     width={28} height={28} preserveAspectRatio="xMidYMid meet"
                     style={{ pointerEvents: "none" }} />
            )}
            <text x={b.x + b.w / 2} y={icon ? b.y + b.h - 13 : b.y + b.h / 2 + 4}
                  fontSize={12.5} fontWeight={600} textAnchor="middle"
                  fill={v === "filled" ? theme.nodeText : theme.title}>
              {n.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ChemicalRenderer(
  { layout, theme, selectedId, variantOf, onSelect, onInspect }:
  { layout: ChemicalLayout } & RenderProps,
) {
  return (
    <g>
      {layout.bonds.map((bond, i) => {
        const dx = bond.x2 - bond.x1, dy = bond.y2 - bond.y1;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len, py = dx / len;
        const offsets =
          bond.order === "double" ? [-3.4, 3.4]
          : bond.order === "triple" ? [-5.2, 0, 5.2]
          : [0];
        const bid = `__bond:${i}`;
        const bsel = selectedId === bid;
        return (
          <g key={i} data-pick={bid} style={{ cursor: "pointer" }}
             onClick={() => onSelect(bid)} onDoubleClick={() => onInspect(bid)}>
            <line x1={bond.x1} y1={bond.y1} x2={bond.x2} y2={bond.y2}
                  stroke="transparent" strokeWidth={14} />
            {offsets.map((o, j) => (
              <line key={j}
                    x1={bond.x1 + px * o} y1={bond.y1 + py * o}
                    x2={bond.x2 + px * o} y2={bond.y2 + py * o}
                    stroke={bsel ? "#0ea5e9" : theme.bond} strokeWidth={bsel ? 3.6 : 2.4}
                    strokeDasharray={bond.order === "ionic" ? "5 4" : undefined} />
            ))}
          </g>
        );
      })}
      {Object.entries(layout.atoms).map(([id, a]) => {
        const es = theme.element[a.element] ?? theme.elementDefault;
        const sel = selectedId === id;
        const v = variantOf(id);
        const st = variantStyle(es.fill, theme, v);
        const sk = selStroke(theme, { stroke: sel ? "#0ea5e9" : st.stroke, strokeWidth: st.strokeWidth }, sel);
        return (
          <g key={id} data-atom={id} style={{ cursor: "grab" }}
             onDoubleClick={() => { onSelect(id); onInspect(id); }}>
            <circle cx={a.x} cy={a.y} r={a.r} fill={st.fill} fillOpacity={st.fillOpacity}
                    stroke={sk.stroke} strokeWidth={sk.strokeWidth} strokeDasharray={st.dash} />
            <text x={a.x} y={a.y + 4.5} fontSize={13} fontWeight={700} textAnchor="middle"
                  fill={v === "filled" ? es.text : theme.title} style={{ pointerEvents: "none" }}>
              {a.element}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function PhysicsRenderer(
  { d, layout, theme, selectedId, icons, onSelect, onInspect }:
  { d: PhysicsDiagram; layout: PhysicsLayout } & RenderProps,
) {
  const massIcon = icons["__mass"];
  const { x: cx, y: cy } = layout.center;
  // draw the ground only when the object is in surface contact — never for
  // free-fall, orbital or floating scenarios
  const onSurface = d.forces.some((f) => f.type === "normal" || f.type === "friction");
  return (
    <g>
      {onSurface && (
        <g>
          <line x1={PAD} y1={cy + 70} x2={CANVAS_W - PAD} y2={cy + 70}
                stroke={theme.ground} strokeWidth={2} />
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={i} x1={PAD + i * 64} y1={cy + 70} x2={PAD + i * 64 - 12} y2={cy + 82}
                  stroke={theme.ground} strokeWidth={1.6} />
          ))}
        </g>
      )}
      {layout.forces.map((f) => {
        const color = theme.force[f.type];
        const sel = selectedId === f.id;
        return (
          <g key={f.id} data-pick={f.id} style={{ cursor: "pointer" }}
             onClick={() => onSelect(f.id)} onDoubleClick={() => onInspect(f.id)}>
            <line x1={cx} y1={cy} x2={f.tipX} y2={f.tipY} stroke={color}
                  strokeWidth={sel ? 5 : 3.4} />
            <ArrowHead tipX={f.tipX} tipY={f.tipY} ux={f.dx} uy={f.dy} color={color} size={12} />
            <line x1={f.tipX} y1={f.tipY} x2={f.labelX} y2={f.labelY}
                  stroke={color} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
            <text x={f.labelX} y={f.labelY} fontSize={12} fontWeight={700}
                  textAnchor="middle" fill={color}
                  style={{ paintOrder: "stroke" }} stroke={theme.halo} strokeWidth={3.5}>
              {f.label}
            </text>
            <text x={f.labelX} y={f.labelY + 14} fontSize={10.5} textAnchor="middle"
                  fill={theme.muted} style={{ paintOrder: "stroke" }} stroke={theme.halo} strokeWidth={3}>
              {f.magnitude} N · {f.angleDeg}°
            </text>
          </g>
        );
      })}
      <g>
        <rect x={cx - 52} y={cy - 40} width={104} height={80} rx={8}
              fill={theme.massFill} stroke={theme.stroke} strokeWidth={2} />
        {massIcon && (
          <image href={massIcon} x={cx - 17} y={cy - 34} width={34} height={34}
                 preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} />
        )}
        <text x={cx} y={massIcon ? cy + 14 : cy - 2} fontSize={14} fontWeight={700}
              textAnchor="middle" fill={theme.massText}>
          {d.massLabel}
        </text>
        {d.massValue && (
          <text x={cx} y={massIcon ? cy + 31 : cy + 18} fontSize={11}
                textAnchor="middle" fill={theme.massSub}>
            {d.massValue}
          </text>
        )}
      </g>
    </g>
  );
}

function LabRenderer(
  { d, layout, theme, selectedId, variantOf, icons, onSelect, onInspect }:
  { d: LabDiagram; layout: LabLayout } & RenderProps,
) {
  return (
    <g>
      {d.edges.map((e, i) => {
        const a = layout.steps[e.from], b = layout.steps[e.to];
        if (!a || !b) return null;
        const sameRow = Math.abs(a.y - b.y) < 4;
        const start = { x: a.x + a.w, y: a.y + a.h / 2 };
        const end = { x: b.x, y: b.y + b.h / 2 };
        const path = sameRow
          ? `M${start.x},${start.y} L${end.x},${end.y}`
          : `M${a.x + a.w / 2},${a.y + a.h} C${a.x + a.w / 2},${a.y + a.h + 30} ` +
            `${b.x + b.w / 2},${b.y - 30} ${b.x + b.w / 2},${b.y}`;
        const tip = sameRow ? end : { x: b.x + b.w / 2, y: b.y };
        const dir = sameRow ? { x: 1, y: 0 } : { x: 0, y: 1 };
        const eid = `__edge:${i}`;
        const esel = selectedId === eid;
        return (
          <g key={i} data-pick={eid} style={{ cursor: "pointer" }}
             onClick={() => onSelect(eid)} onDoubleClick={() => onInspect(eid)}>
            <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
            <path d={path} fill="none" stroke={theme.stroke} strokeWidth={esel ? 4 : 2.6} />
            <ArrowHead tipX={tip.x} tipY={tip.y} ux={dir.x} uy={dir.y} color={theme.stroke} />
            {e.label && sameRow && (
              <text x={(start.x + end.x) / 2} y={start.y - 9} fontSize={10.5}
                    textAnchor="middle" fill={theme.muted} fontStyle="italic"
                    style={{ paintOrder: "stroke" }} stroke={theme.halo} strokeWidth={3}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {d.steps.map((s) => {
        const b = layout.steps[s.id];
        if (!b) return null;
        const sel = selectedId === s.id;
        const v = variantOf(s.id);
        const st = variantStyle(theme.labFill, theme, v);
        const sk = selStroke(theme, { stroke: v === "filled" ? theme.labStroke : st.stroke, strokeWidth: st.strokeWidth }, sel);
        const icon = icons[s.id];
        return (
          <g key={s.id} data-pick={s.id} style={{ cursor: "pointer" }}
             onClick={() => onSelect(s.id)} onDoubleClick={() => onInspect(s.id)}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12}
                  fill={st.fill} fillOpacity={st.fillOpacity}
                  stroke={sk.stroke} strokeWidth={sk.strokeWidth} strokeDasharray={st.dash} />
            {icon && (
              <image href={icon} x={b.x + b.w / 2 - 22} y={b.y + 12}
                     width={44} height={44} preserveAspectRatio="xMidYMid meet"
                     style={{ pointerEvents: "none" }} />
            )}
            <text x={b.x + b.w / 2} y={icon ? b.y + 70 : b.y + 38} fontSize={13.5}
                  fontWeight={700} textAnchor="middle" fill={theme.labText}>
              {s.label}
            </text>
            <text x={b.x + b.w / 2} y={icon ? b.y + 87 : b.y + 60} fontSize={10.5}
                  textAnchor="middle" fill={theme.labSub}>
              {s.apparatus}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ═══════════════════════════════ DEFS ══════════════════════════════════ */

function SvgDefs({ theme }: { theme: SciTheme }) {
  // Arrowheads are real <polygon>s drawn by ArrowHead — no <marker> defs, so
  // the diagram round-trips cleanly through the Fabric.js canvas editor.
  return (
    <defs>
      <pattern id="sci-grid" width={26} height={26} patternUnits="userSpaceOnUse">
        <path d="M26 0H0V26" fill="none" stroke={theme.gridStroke} strokeWidth={1} />
      </pattern>
    </defs>
  );
}

/* ════════════════════════════ CANVAS SHELL ═════════════════════════════ */

interface Interaction {
  mode: "pan" | "atom";
  id?: string;
  sx: number; sy: number;
  px: number; py: number;
  moved: boolean;
}

function DiagramCanvas(
  { svgRef, diagram, layout, theme, moveAtom, selectedId, variantOf, icons, onSelect, onInspect }:
  {
    svgRef: React.RefObject<SVGSVGElement>;
    diagram: SciDiagram; layout: SciLayout; theme: SciTheme;
    moveAtom: (id: string, rx: number, ry: number) => void;
  } & Omit<RenderProps, "theme">,
) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const it = useRef<Interaction | null>(null);

  const fit = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
  const zoomBy = (f: number) =>
    setZoom((z) => Math.min(3, Math.max(0.4, +(z * f).toFixed(2))));

  const toContent = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const v = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: (v.x - pan.x) / zoom, y: (v.y - pan.y) / zoom };
  }, [pan, zoom, svgRef]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    const atom = target.closest("[data-atom]");
    if (atom && layout.kind === "chemical") {
      it.current = {
        mode: "atom", id: atom.getAttribute("data-atom")!,
        sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (target.closest("[data-pick]")) return;
    it.current = { mode: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = it.current;
    if (!cur) return;
    if (Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > 3) cur.moved = true;
    if (cur.mode === "pan") {
      setPan({ x: cur.px + (e.clientX - cur.sx), y: cur.py + (e.clientY - cur.sy) });
    } else if (cur.mode === "atom" && cur.moved && layout.kind === "chemical") {
      const c = toContent(e.clientX, e.clientY);
      moveAtom(cur.id!, (c.x - layout.ox) / layout.box, (c.y - layout.oy) / layout.box);
    }
  };

  const onPointerUp = () => {
    const cur = it.current;
    if (cur?.mode === "atom" && !cur.moved) onSelect(cur.id!);
    it.current = null;
  };

  const onWheel = (e: React.WheelEvent) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
  const rp: RenderProps = { theme, selectedId, variantOf, icons, onSelect, onInspect };

  return (
    <div className="relative h-full w-full overflow-hidden"
         style={{ background: theme.canvasBg }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-full w-full touch-none select-none"
        style={{ cursor: it.current?.mode === "pan" ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <SvgDefs theme={theme} />
        <rect width={layout.width} height={layout.height} fill="url(#sci-grid)" />
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <text x={PAD} y={22} fontSize={15} fontWeight={700} fill={theme.title}>
            {diagram.title}
          </text>
          {diagram.kind === "cellular" && layout.kind === "cellular" &&
            <CellularRenderer d={diagram} layout={layout} {...rp} />}
          {diagram.kind === "chemical" && layout.kind === "chemical" &&
            <ChemicalRenderer layout={layout} {...rp} />}
          {diagram.kind === "physics" && layout.kind === "physics" &&
            <PhysicsRenderer d={diagram} layout={layout} {...rp} />}
          {diagram.kind === "lab" && layout.kind === "lab" &&
            <LabRenderer d={diagram} layout={layout} {...rp} />}
        </g>
      </svg>

      <div className="absolute bottom-5 right-5 flex flex-col gap-0.5 rounded-2xl border
                      border-[#E9E6DF] bg-white p-1.5
                      shadow-[0_10px_30px_rgba(31,30,27,0.10)]">
        <button onClick={() => zoomBy(1.2)} title="Zoom in"
                className="rounded-xl p-2 text-[#6F6A61] transition-colors hover:bg-[#F4F2ED]">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => zoomBy(0.8)} title="Zoom out"
                className="rounded-xl p-2 text-[#6F6A61] transition-colors hover:bg-[#F4F2ED]">
          <ZoomOut size={16} />
        </button>
        <button onClick={fit} title="Reset view"
                className="rounded-xl p-2 text-[#6F6A61] transition-colors hover:bg-[#F4F2ED]">
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="absolute bottom-5 left-5 flex items-center gap-1.5 rounded-full
                      border border-[#E9E6DF] bg-white/90 px-3 py-1.5 text-xs
                      text-[#6F6A61] backdrop-blur">
        <MousePointer2 size={13} />
        {layout.kind === "chemical"
          ? "Drag atoms · double-click to edit & style"
          : "Click to select · double-click to edit & style"}
        <span className="ml-1 font-semibold text-[#1F1E1B]">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════ MENUS / PANELS ════════════════════════════ */

function Menu(
  { open, onClose, children, width = "w-60" }:
  { open: boolean; onClose: () => void; children: React.ReactNode; width?: string },
) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 top-full z-50 mt-2 ${width} overflow-hidden
                       rounded-2xl border border-[#E9E6DF] bg-white py-1.5
                       shadow-[0_16px_44px_rgba(31,30,27,0.12)]`}>
        {children}
      </div>
    </>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="block w-full px-4 py-2 text-left text-[13px] text-[#3A3833]
                       transition-colors hover:bg-[#F4F2ED]">
      {label}
    </button>
  );
}

/** Contextual sidebar — opens on double-click of a scientific node. */
const FIELD_CLASS =
  "w-full rounded-xl border border-[#E9E6DF] bg-white px-3 py-2 text-[13px] " +
  "text-[#1F1E1B] outline-none transition-colors focus:border-[#1F1E1B]";

/* ── option lists for the structural-edit selects ── */
const LAYER_OPTS: { value: CellLayer; label: string }[] = [
  { value: "extracellular", label: "Extracellular" },
  { value: "membrane", label: "Plasma membrane" },
  { value: "cytoplasm", label: "Cytoplasm" },
  { value: "nucleus", label: "Nucleus" },
];
const CELL_TYPE_OPTS: CellNodeType[] = ["ligand", "receptor", "protein", "complex", "gene"];
const FORCE_TYPE_OPTS: ForceType[] = ["gravity", "normal", "tension", "friction", "applied", "drag"];
const BOND_OPTS: BondOrder[] = ["single", "double", "triple", "ionic"];
const EFFECT_OPTS = ["activate", "inhibit"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ════════════════════════ DIAGRAM MUTATIONS ════════════════════════════ */

const freshId = (p: string) => p + Math.random().toString(36).slice(2, 8);
const edgeIdx = (id: string) => Number(id.slice(id.indexOf(":") + 1));

/* in-place field edit — handles both elements (by id) and edges (by __edge/__bond index) */
function applyEdit(d: SciDiagram, id: string, field: string, value: string | number): SciDiagram {
  if (id.startsWith("__edge:")) {
    const i = edgeIdx(id);
    if (d.kind === "cellular")
      return { ...d, edges: d.edges.map((e, k) => (k === i ? { ...e, [field]: value } as typeof e : e)) };
    if (d.kind === "lab")
      return { ...d, edges: d.edges.map((e, k) => (k === i ? { ...e, [field]: value } as typeof e : e)) };
    return d;
  }
  if (id.startsWith("__bond:")) {
    const i = edgeIdx(id);
    if (d.kind === "chemical")
      return { ...d, bonds: d.bonds.map((b, k) => (k === i ? { ...b, [field]: value } as typeof b : b)) };
    return d;
  }
  if (d.kind === "cellular")
    return { ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, [field]: value } as typeof n : n)) };
  if (d.kind === "chemical")
    return { ...d, atoms: d.atoms.map((a) => (a.id === id ? { ...a, [field]: value } as typeof a : a)) };
  if (d.kind === "lab")
    return { ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, [field]: value } as typeof s : s)) };
  return { ...d, forces: d.forces.map((f) => (f.id === id ? { ...f, [field]: value } as typeof f : f)) };
}

/* delete an element (+ incident edges) or an edge/bond */
function deleteElement(d: SciDiagram, id: string): SciDiagram {
  if (id.startsWith("__edge:")) {
    const i = edgeIdx(id);
    if (d.kind === "cellular") return { ...d, edges: d.edges.filter((_, k) => k !== i) };
    if (d.kind === "lab") return { ...d, edges: d.edges.filter((_, k) => k !== i) };
    return d;
  }
  if (id.startsWith("__bond:")) {
    const i = edgeIdx(id);
    if (d.kind === "chemical") return { ...d, bonds: d.bonds.filter((_, k) => k !== i) };
    return d;
  }
  if (d.kind === "cellular") return {
    ...d,
    nodes: d.nodes.filter((n) => n.id !== id),
    edges: d.edges.filter((e) => e.from !== id && e.to !== id),
  };
  if (d.kind === "chemical") return {
    ...d,
    atoms: d.atoms.filter((a) => a.id !== id),
    bonds: d.bonds.filter((b) => b.from !== id && b.to !== id),
  };
  if (d.kind === "lab") return {
    ...d,
    steps: d.steps.filter((s) => s.id !== id),
    edges: d.edges.filter((e) => e.from !== id && e.to !== id),
  };
  return { ...d, forces: d.forces.filter((f) => f.id !== id) };
}

/* add a default element; returns the new diagram + the new element's id */
function addElement(d: SciDiagram): { diagram: SciDiagram; id: string } {
  if (d.kind === "cellular") {
    const id = freshId("n");
    return { id, diagram: { ...d, nodes: [...d.nodes,
      { id, label: "New node", layer: "cytoplasm", type: "protein" }] } };
  }
  if (d.kind === "chemical") {
    const id = freshId("a");
    return { id, diagram: { ...d, atoms: [...d.atoms,
      { id, element: "C", rx: 0.42 + Math.random() * 0.16, ry: 0.42 + Math.random() * 0.16 }] } };
  }
  if (d.kind === "lab") {
    const id = freshId("s");
    return { id, diagram: { ...d, steps: [...d.steps,
      { id, label: "New stage", apparatus: "apparatus" }] } };
  }
  const id = freshId("f");
  return { id, diagram: { ...d, forces: [...d.forces,
    { id, label: "New force", type: "applied", magnitude: 20, angleDeg: 0 }] } };
}

/* connect two elements with an edge/bond */
function addEdge(d: SciDiagram, from: string, to: string): SciDiagram {
  if (from === to) return d;
  if (d.kind === "cellular") {
    if (d.edges.some((e) => e.from === from && e.to === to)) return d;
    return { ...d, edges: [...d.edges, { from, to, effect: "activate" }] };
  }
  if (d.kind === "chemical") {
    if (d.bonds.some((b) =>
      (b.from === from && b.to === to) || (b.from === to && b.to === from))) return d;
    return { ...d, bonds: [...d.bonds, { from, to, order: "single" }] };
  }
  if (d.kind === "lab") {
    if (d.edges.some((e) => e.from === from && e.to === to)) return d;
    return { ...d, edges: [...d.edges, { from, to }] };
  }
  return d; // physics has no connections
}

/* ════════════════════════ SELECTION MODEL ══════════════════════════════ */

interface ElementInspection {
  scope: "element";
  eyebrow: string;
  title: string;
  sub: string;
  restyle: boolean;
  nameLabel: string;
  nameField: string;
  name: string;
  layer?: CellLayer;
  nodeType?: CellNodeType;
  forceType?: ForceType;
  magnitude?: number;
  angleDeg?: number;
}
interface EdgeInspection {
  scope: "edge";
  eyebrow: string;
  title: string;
  sub: string;
  effect?: "activate" | "inhibit";
  order?: BondOrder;
  hasLabel: boolean;
  label: string;
}
type Inspection = ElementInspection | EdgeInspection;

function inspectionOf(d: SciDiagram, id: string | null): Inspection | null {
  if (!id) return null;

  if (id.startsWith("__edge:")) {
    const e = (d.kind === "cellular" || d.kind === "lab") ? d.edges[edgeIdx(id)] : null;
    if (!e) return null;
    if (d.kind === "cellular") {
      const ce = e as CellularDiagram["edges"][number];
      return { scope: "edge", eyebrow: "Connection", title: cap(ce.effect),
        sub: `${ce.from} → ${ce.to}`, effect: ce.effect, hasLabel: true, label: ce.label ?? "" };
    }
    return { scope: "edge", eyebrow: "Flow", title: `${e.from} → ${e.to}`,
      sub: "connection", hasLabel: true, label: (e as LabDiagram["edges"][number]).label ?? "" };
  }
  if (id.startsWith("__bond:")) {
    if (d.kind !== "chemical") return null;
    const b = d.bonds[edgeIdx(id)];
    if (!b) return null;
    return { scope: "edge", eyebrow: "Bond", title: `${cap(b.order)} bond`,
      sub: `${b.from} – ${b.to}`, order: b.order, hasLabel: false, label: "" };
  }

  if (d.kind === "cellular") {
    const n = d.nodes.find((x) => x.id === id);
    return n ? { scope: "element", eyebrow: n.type, title: n.label,
      sub: n.layer ? `${n.layer} layer` : "network node",
      restyle: true, nameLabel: "Label", nameField: "label", name: n.label,
      layer: n.layer, nodeType: n.type } : null;
  }
  if (d.kind === "chemical") {
    const a = d.atoms.find((x) => x.id === id);
    return a ? { scope: "element", eyebrow: "atom", title: a.element, sub: `id ${a.id}`,
      restyle: true, nameLabel: "Element", nameField: "element", name: a.element } : null;
  }
  if (d.kind === "lab") {
    const s = d.steps.find((x) => x.id === id);
    return s ? { scope: "element", eyebrow: "stage", title: s.label, sub: s.apparatus,
      restyle: true, nameLabel: "Name", nameField: "label", name: s.label } : null;
  }
  const f = d.forces.find((x) => x.id === id);
  return f ? { scope: "element", eyebrow: "force", title: f.label,
    sub: `${f.magnitude} N · ${f.angleDeg}°`, restyle: false,
    nameLabel: "Label", nameField: "label", name: f.label,
    forceType: f.type, magnitude: f.magnitude, angleDeg: f.angleDeg } : null;
}

/* ════════════════════════════ INSPECTOR ════════════════════════════════ */

function SelectField(
  { label, value, options, onChange }:
  { label: string; value: string; options: { value: string; label: string }[];
    onChange: (v: string) => void },
) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[#6F6A61]">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function InspectorPanel(
  { inspection, variant, onEdit, onVariant, onExport, onDelete, onClose }:
  {
    inspection: Inspection;
    variant: NodeVariant;
    onEdit: (field: string, value: string | number) => void;
    onVariant: (v: NodeVariant) => void;
    onExport: (fmt: ExportFormat) => void;
    onDelete: () => void;
    onClose: () => void;
  },
) {
  const isElement = inspection.scope === "element";
  return (
    <div className="absolute right-5 top-5 z-30 w-[268px] rounded-[26px] border
                    border-[#E9E6DF] bg-white shadow-[0_20px_56px_rgba(31,30,27,0.16)]">
      <div className="flex items-start justify-between px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A39E94]">
            {inspection.eyebrow}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[#1F1E1B]">
            {inspection.title}
          </p>
          <p className="truncate text-[11px] text-[#A39E94]">{inspection.sub}</p>
        </div>
        <button onClick={onClose}
                className="rounded-full p-1.5 text-[#A39E94] transition-colors hover:bg-[#F4F2ED]">
          <X size={15} />
        </button>
      </div>

      {/* ── edit fields ── */}
      <div className="flex flex-col gap-2 border-t border-[#F0EEE8] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A39E94]">
          Edit
        </p>

        {isElement && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#6F6A61]">
                {inspection.nameLabel}
              </label>
              <input value={inspection.name}
                onChange={(e) => onEdit(inspection.nameField, e.target.value)}
                className={FIELD_CLASS} />
            </div>
            {inspection.layer && (
              <SelectField label="Layer" value={inspection.layer}
                options={LAYER_OPTS}
                onChange={(v) => onEdit("layer", v)} />
            )}
            {inspection.nodeType && (
              <SelectField label="Node type" value={inspection.nodeType}
                options={CELL_TYPE_OPTS.map((t) => ({ value: t, label: cap(t) }))}
                onChange={(v) => onEdit("type", v)} />
            )}
            {inspection.forceType && (
              <SelectField label="Force type" value={inspection.forceType}
                options={FORCE_TYPE_OPTS.map((t) => ({ value: t, label: cap(t) }))}
                onChange={(v) => onEdit("type", v)} />
            )}
            {inspection.magnitude !== undefined && inspection.angleDeg !== undefined && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-[#6F6A61]">
                    Magnitude (N)
                  </label>
                  <input type="number" value={inspection.magnitude}
                    onChange={(e) => onEdit("magnitude", Number(e.target.value) || 0)}
                    className={FIELD_CLASS} />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-[#6F6A61]">
                    Angle (°)
                  </label>
                  <input type="number" value={inspection.angleDeg}
                    onChange={(e) => onEdit("angleDeg", Number(e.target.value) || 0)}
                    className={FIELD_CLASS} />
                </div>
              </div>
            )}
          </>
        )}

        {!isElement && inspection.effect && (
          <SelectField label="Effect" value={inspection.effect}
            options={EFFECT_OPTS.map((e) => ({ value: e, label: cap(e) }))}
            onChange={(v) => onEdit("effect", v)} />
        )}
        {!isElement && inspection.order && (
          <SelectField label="Bond order" value={inspection.order}
            options={BOND_OPTS.map((o) => ({ value: o, label: cap(o) }))}
            onChange={(v) => onEdit("order", v)} />
        )}
        {!isElement && inspection.hasLabel && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#6F6A61]">
              Connection label
            </label>
            <input value={inspection.label}
              onChange={(e) => onEdit("label", e.target.value)}
              placeholder="optional" className={FIELD_CLASS} />
          </div>
        )}
      </div>

      {/* ── style variants (elements only) ── */}
      {isElement && inspection.restyle && (
        <div className="border-t border-[#F0EEE8] px-5 py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A39E94]">
            Style
          </p>
          <div className="flex flex-col gap-1.5">
            {VARIANT_LABELS.map((v) => {
              const on = v.id === variant;
              return (
                <button key={v.id} onClick={() => onVariant(v.id)}
                  className={`flex items-center justify-between rounded-2xl border px-3 py-2
                              text-left text-[13px] transition ${
                    on ? "border-[#1F1E1B] bg-[#1F1E1B] text-white"
                       : "border-[#E9E6DF] text-[#6F6A61] hover:bg-[#F4F2ED]"}`}>
                  <span>
                    <span className="font-medium">{v.label}</span>
                    <span className={on ? "ml-1.5 text-white/55" : "ml-1.5 text-[#A39E94]"}>
                      {v.hint}
                    </span>
                  </span>
                  {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── export (elements only) ── */}
      {isElement && (
        <div className="border-t border-[#F0EEE8] px-5 py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A39E94]">
            Export this element
          </p>
          <div className="flex gap-2">
            <button onClick={() => onExport("svg")}
                    className="flex-1 rounded-full border border-[#E9E6DF] py-2 text-[12px]
                               font-medium text-[#6F6A61] transition hover:bg-[#F4F2ED]">
              SVG
            </button>
            <button onClick={() => onExport("png")}
                    className="flex-1 rounded-full border border-[#E9E6DF] py-2 text-[12px]
                               font-medium text-[#6F6A61] transition hover:bg-[#F4F2ED]">
              PNG
            </button>
          </div>
        </div>
      )}

      {/* ── delete ── */}
      <div className="border-t border-[#F0EEE8] px-5 py-4">
        <button onClick={onDelete}
          className="flex w-full items-center justify-center gap-2 rounded-full border
                     border-[#EFC9C4] py-2 text-[12px] font-medium text-[#B4231A]
                     transition hover:bg-[#FBEDEB]">
          <Trash2 size={13} /> Delete {isElement ? "element" : "connection"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════ PAGE SHELL ═══════════════════════════════ */

export default function ScientificIllustrator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGated, openWaitingPeriodDialog } = useAiInvokeGuard();
  const svgRef = useRef<SVGSVGElement>(null);

  const [category, setCategory] = useState<DiagramKind>("cellular");
  const [text, setText] = useState(CATEGORIES[0].sample);
  const [diagram, setDiagram] = useState<SciDiagram>(SAMPLE_DIAGRAMS.cellular);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState(0);

  const [paletteId, setPaletteId] = useState<PaletteId>("textbook");
  const [variants, setVariants] = useState<Record<string, NodeVariant>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [paletteMenu, setPaletteMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [libraryMenu, setLibraryMenu] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const theme = PALETTES[paletteId];
  const { layout, moveAtom, resetLayout, dirty } = useScientificLayout(diagram);
  const icons = useDiagramIcons(diagram);
  const { items: savedDiagrams, save: persistDiagram, remove: removeSaved } =
    useSavedDiagrams(user?.id);
  const active = CATEGORIES.find((c) => c.id === category)!;

  const variantOf = useCallback(
    (id: string) => variants[id] ?? "filled", [variants],
  );
  const inspection = useMemo(
    () => inspectionOf(diagram, selectedId), [diagram, selectedId],
  );
  const addLabel = ({ cellular: "node", chemical: "atom",
    physics: "force", lab: "stage" } as const)[category];

  const editNode = useCallback((field: string, value: string | number) => {
    if (!selectedId) return;
    setDiagram((d) => applyEdit(d, selectedId, field, value));
  }, [selectedId]);

  // click handler — in connect mode, two node clicks create an edge/bond
  const handleSelect = useCallback((id: string) => {
    if (id.startsWith("__edge:") || id.startsWith("__bond:")) {
      setSelectedId(id);
      return;
    }
    if (!connectMode) { setSelectedId(id); return; }
    if (!connectFrom) {
      setConnectFrom(id);
      setSelectedId(id);
    } else if (connectFrom === id) {
      setConnectFrom(null);
      setSelectedId(null);
    } else {
      setDiagram((d) => addEdge(d, connectFrom, id));
      setConnectFrom(null);
      setSelectedId(null);
      toast.success("Connected.");
    }
  }, [connectMode, connectFrom]);

  const handleInspect = useCallback((id: string) => {
    if (connectMode) return;
    setSelectedId(id);
    setInspectorOpen(true);
  }, [connectMode]);

  const addNode = () => {
    const { diagram: next, id } = addElement(diagram);
    setDiagram(next);
    setSelectedId(id);
    setInspectorOpen(true);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setDiagram((d) => deleteElement(d, selectedId));
    setSelectedId(null);
    setInspectorOpen(false);
  }, [selectedId]);

  const toggleConnect = () => {
    setConnectMode((on) => !on);
    setConnectFrom(null);
  };

  // cycle the pipeline stage labels while a generation is in flight
  useEffect(() => {
    if (!generating) { setGenStage(0); return; }
    let s = 0;
    const t = setInterval(() => {
      s = Math.min(s + 1, GEN_STAGES.length - 1);
      setGenStage(s);
    }, 4500);
    return () => clearInterval(t);
  }, [generating]);

  // keyboard delete for the selected element/edge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (!selectedId) return;
      e.preventDefault();
      removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeSelected]);

  // swap the diagram, dropping per-node overrides (structure may have changed)
  const swapDiagram = (next: SciDiagram) => {
    setDiagram(next);
    setVariants({});
    setSelectedId(null);
    setInspectorOpen(false);
    resetLayout();
  };
  // a wholly new diagram also breaks the link to any saved row
  const resetDiagram = (next: SciDiagram) => {
    swapDiagram(next);
    setSavedId(null);
  };

  const pickCategory = (c: Category) => {
    setCategory(c.id);
    setText(c.sample);
    resetDiagram(SAMPLE_DIAGRAMS[c.id]);
  };

  const generate = useCallback(async () => {
    if (text.trim().length < 10) {
      toast.error("Add a bit more scientific detail before generating.");
      return;
    }
    if (!user) {
      toast.error("Please sign in to generate diagrams.", {
        action: { label: "Sign in", onClick: () => navigate("/auth") },
      });
      return;
    }
    if (isGated()) return;
    setGenerating(true);
    try {
      resetDiagram(await invokeDiagram({ text, category }));
      toast.success("Diagram generated.");
    } catch (e) {
      if (e instanceof InvokeDiagramError && e.message === "WAITING_PERIOD") {
        openWaitingPeriodDialog(e.body?.unlock_at ?? null);
        return;
      }
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(`${msg} — showing a curated sample instead.`);
      resetDiagram(mockParse(category));
    } finally {
      setGenerating(false);
    }
  }, [category, text, user, navigate, isGated, openWaitingPeriodDialog]);

  const refineDiagram = async () => {
    const instruction = refineText.trim();
    if (instruction.length < 3) {
      toast.error("Describe the change you'd like.");
      return;
    }
    if (!user) {
      toast.error("Please sign in to refine diagrams.", {
        action: { label: "Sign in", onClick: () => navigate("/auth") },
      });
      return;
    }
    if (isGated()) return;
    setRefining(true);
    try {
      const next = await invokeDiagram({ category, instruction, current: diagram });
      swapDiagram(next); // keep the saved-row link — it's the same diagram, edited
      setRefineText("");
      toast.success("Diagram updated.");
    } catch (e) {
      if (e instanceof InvokeDiagramError && e.message === "WAITING_PERIOD") {
        openWaitingPeriodDialog(e.body?.unlock_at ?? null);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Couldn't refine the diagram.");
    } finally {
      setRefining(false);
    }
  };

  const openInCanvas = useCallback(() => {
    if (!svgRef.current) return;
    if (!user) {
      toast.error("Please sign in to edit in the canvas editor.", {
        action: { label: "Sign in", onClick: () => navigate("/auth") },
      });
      return;
    }
    try {
      // hand the diagram to the Fabric.js editor — parsed into editable objects
      const svgString = diagramSvgString(svgRef.current, null);
      sessionStorage.setItem("scientific_illustrator_svg_import", svgString);
      toast.success("Opening in canvas editor…");
      navigate("/canvas");
    } catch {
      toast.error("Couldn't open this diagram in the canvas editor.");
    }
  }, [user, navigate]);

  const runExport = useCallback(
    async (format: ExportFormat, scope: "full" | "selection", background: string | null) => {
      if (!svgRef.current) return;
      try {
        await exportDiagram({
          svg: svgRef.current, format, scope,
          selectionId: selectedId, background,
        });
        toast.success(`Exported ${scope === "selection" ? "element" : "canvas"} as ${format.toUpperCase()}.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      }
    }, [selectedId],
  );

  const saveDiagram = async () => {
    if (!user) {
      toast.error("Please sign in to save diagrams.", {
        action: { label: "Sign in", onClick: () => navigate("/auth") },
      });
      return;
    }
    try {
      const id = await persistDiagram(savedId, {
        title: diagram.title || "Untitled diagram",
        category,
        source_text: text,
        diagram,
      });
      setSavedId(id);
      toast.success(savedId ? "Diagram updated." : "Diagram saved to your library.");
    } catch {
      toast.error("Couldn't save the diagram.");
    }
  };

  const loadDiagram = (s: SavedDiagram) => {
    setCategory(s.category);
    setText(s.source_text ?? "");
    resetDiagram(s.diagram);
    setSavedId(s.id);
    setLibraryMenu(false);
    toast.success(`Loaded "${s.title}".`);
  };

  const deleteSaved = async (s: SavedDiagram, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeSaved(s.id);
      if (savedId === s.id) setSavedId(null);
    } catch {
      toast.error("Couldn't delete the diagram.");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#FBFAF8] text-[#1F1E1B]">
      {/* ── top bar ── */}
      <header className="flex items-center gap-4 border-b border-[#E9E6DF] bg-[#FBFAF8] px-5 py-3">
        <button onClick={() => navigate(-1)}
                className="rounded-full p-1.5 text-[#6F6A61] transition-colors hover:bg-[#F4F2ED]">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#1F1E1B]">
            <FlaskConical size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight">Scientific Illustrator</h1>
            <p className="text-[11px] text-[#A39E94]">Text to visuals, made for science</p>
          </div>
        </div>

        <div className="ml-3 flex items-center gap-1.5">
          {CATEGORIES.map((c) => {
            const on = c.id === category;
            return (
              <button key={c.id} onClick={() => pickCategory(c)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5
                            text-xs font-medium transition ${
                  on ? "" : "border-[#E9E6DF] text-[#6F6A61] hover:bg-[#F4F2ED]"}`}
                style={on ? {
                  background: `${c.accent}14`,
                  color: c.accent,
                  borderColor: `${c.accent}3D`,
                } : undefined}>
                {c.icon}
                <span className="hidden sm:inline">{c.name}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* saved library */}
          <div className="relative">
            <button onClick={() => { setLibraryMenu((v) => !v); setPaletteMenu(false); setExportMenu(false); }}
              className="flex items-center gap-1.5 rounded-full border border-[#E9E6DF]
                         bg-white px-3 py-1.5 text-xs font-medium text-[#3A3833]
                         transition hover:bg-[#F4F2ED]">
              <Library size={14} />
              <span className="hidden md:inline">Library</span>
              <ChevronDown size={13} className="text-[#A39E94]" />
            </button>
            <Menu open={libraryMenu} onClose={() => setLibraryMenu(false)} width="w-80">
              <button onClick={() => { setLibraryMenu(false); saveDiagram(); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px]
                           font-medium text-[#1F1E1B] transition-colors hover:bg-[#F4F2ED]">
                <Save size={14} />
                {savedId ? "Update saved diagram" : "Save current diagram"}
              </button>
              <div className="my-1.5 border-t border-[#F0EEE8]" />
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase
                            tracking-[0.08em] text-[#A39E94]">Your library</p>
              {savedDiagrams.length === 0 ? (
                <p className="px-4 py-2 text-[12px] text-[#A39E94]">
                  {user ? "No saved diagrams yet." : "Sign in to save diagrams."}
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {savedDiagrams.map((s) => (
                    <div key={s.id} className="group flex items-center hover:bg-[#F4F2ED]">
                      <button onClick={() => loadDiagram(s)}
                        className="min-w-0 flex-1 px-4 py-2 text-left">
                        <p className="truncate text-[13px] font-medium text-[#1F1E1B]">
                          {s.title}
                        </p>
                        <p className="text-[11px] text-[#A39E94]">
                          {CATEGORIES.find((c) => c.id === s.category)?.name ?? s.category}
                          {" · "}{new Date(s.updated_at).toLocaleDateString()}
                        </p>
                      </button>
                      <button onClick={(e) => deleteSaved(s, e)} title="Delete"
                        className="mr-2 rounded-full p-1.5 text-[#A39E94] opacity-0 transition
                                   hover:bg-[#E9E6DF] hover:text-[#1F1E1B] group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Menu>
          </div>

          {/* palette switcher */}
          <div className="relative">
            <button onClick={() => { setPaletteMenu((v) => !v); setExportMenu(false); }}
              className="flex items-center gap-1.5 rounded-full border border-[#E9E6DF]
                         bg-white px-3 py-1.5 text-xs font-medium text-[#3A3833]
                         transition hover:bg-[#F4F2ED]">
              <Palette size={14} />
              <span className="hidden md:inline">{theme.name}</span>
              <ChevronDown size={13} className="text-[#A39E94]" />
            </button>
            <Menu open={paletteMenu} onClose={() => setPaletteMenu(false)}>
              {PALETTE_LIST.map((p) => (
                <button key={p.id}
                  onClick={() => { setPaletteId(p.id); setPaletteMenu(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left
                             text-[13px] text-[#3A3833] transition-colors hover:bg-[#F4F2ED]">
                  <span className="flex gap-0.5">
                    <span className="h-3.5 w-3.5 rounded-[5px] border border-[#E9E6DF]"
                          style={{ background: p.canvasBg }} />
                    <span className="h-3.5 w-3.5 rounded-[5px]"
                          style={{ background: p.force.applied }} />
                  </span>
                  <span className="flex-1">{p.name}</span>
                  {p.id === paletteId && <Check size={14} className="text-[#6F6A61]" />}
                </button>
              ))}
            </Menu>
          </div>

          {/* open in canvas editor */}
          <button onClick={openInCanvas}
            className="flex items-center gap-1.5 rounded-full border border-[#E9E6DF]
                       bg-white px-3 py-1.5 text-xs font-medium text-[#3A3833]
                       transition hover:bg-[#F4F2ED]">
            <SquarePen size={14} />
            <span className="hidden md:inline">Edit in Canvas</span>
          </button>

          {/* export menu */}
          <div className="relative">
            <button onClick={() => { setExportMenu((v) => !v); setPaletteMenu(false); }}
              className="flex items-center gap-1.5 rounded-full bg-[#1F1E1B] px-3.5 py-1.5
                         text-xs font-medium text-white transition hover:bg-black">
              <Download size={14} />
              <span className="hidden md:inline">Export</span>
              <ChevronDown size={13} className="text-white/60" />
            </button>
            <Menu open={exportMenu} onClose={() => setExportMenu(false)}>
              <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase
                            tracking-[0.08em] text-[#A39E94]">Whole canvas</p>
              <MenuItem label="SVG (vector)"
                        onClick={() => { setExportMenu(false); runExport("svg", "full", null); }} />
              <MenuItem label="PNG — transparent"
                        onClick={() => { setExportMenu(false); runExport("png", "full", null); }} />
              <MenuItem label="PNG — with background"
                        onClick={() => { setExportMenu(false); runExport("png", "full", theme.canvasBg); }} />
              {selectedId && (
                <>
                  <div className="my-1.5 border-t border-[#F0EEE8]" />
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase
                                tracking-[0.08em] text-[#A39E94]">Selected element</p>
                  <MenuItem label="SVG (vector)"
                            onClick={() => { setExportMenu(false); runExport("svg", "selection", null); }} />
                  <MenuItem label="PNG — transparent"
                            onClick={() => { setExportMenu(false); runExport("png", "selection", null); }} />
                </>
              )}
            </Menu>
          </div>

          <div className="mx-1 h-5 w-px bg-[#E9E6DF]" />
          <UserMenu />
        </div>
      </header>

      {/* ── split workspace ── */}
      <div className="flex min-h-0 flex-1">
        <section className="flex w-[36%] min-w-[340px] flex-col border-r border-[#E9E6DF] bg-white">
          <div className="flex items-center justify-between border-b border-[#F0EEE8] px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A39E94]">
              Scientific Markdown
            </span>
            <span className="rounded-full bg-[#F4F2ED] px-2.5 py-0.5 text-[10px]
                             font-medium text-[#6F6A61]">
              {active.name}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-white p-5 font-mono text-[13px] leading-relaxed
                       text-[#3A3833] outline-none placeholder:text-[#C9C4BA]"
            placeholder="Describe a cellular pathway, chemical structure, force system…"
          />
          <div className="border-t border-[#F0EEE8] p-4">
            <button
              onClick={generate}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-full
                         bg-[#1F1E1B] py-3 text-sm font-semibold text-white
                         transition hover:bg-black disabled:opacity-55">
              {generating
                ? <><Loader2 size={15} className="animate-spin" /> {GEN_STAGES[genStage]}</>
                : <><Wand2 size={15} /> Generate Diagram</>}
            </button>
            <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-[#A39E94]">
              <span>AI structured extraction · elastic layout · double-click a node to style.</span>
              {dirty && (
                <button onClick={resetLayout}
                        className="flex shrink-0 items-center gap-1 font-medium
                                   text-[#6F6A61] transition-colors hover:text-[#1F1E1B]">
                  <RotateCcw size={11} /> Reset layout
                </button>
              )}
            </div>

            {/* conversational refine — edit the current diagram by instruction */}
            <div className="mt-3 flex items-center gap-2 rounded-full border border-[#E9E6DF]
                            bg-white py-1 pl-3.5 pr-1.5 transition-colors
                            focus-within:border-[#1F1E1B]">
              <Sparkles size={14} className="shrink-0 text-[#A39E94]" />
              <input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") refineDiagram(); }}
                disabled={refining}
                placeholder="Refine — e.g. add a negative feedback loop"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-[#3A3833]
                           outline-none placeholder:text-[#C9C4BA]"
              />
              <button onClick={refineDiagram} disabled={refining} title="Refine diagram"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full
                           bg-[#1F1E1B] text-white transition hover:bg-black
                           disabled:opacity-50">
                {refining
                  ? <Loader2 size={13} className="animate-spin" />
                  : <ArrowUp size={14} />}
              </button>
            </div>
          </div>
        </section>

        <section className="relative min-w-0 flex-1">
          {/* structural-edit toolbar */}
          <div className="absolute left-5 top-5 z-30 flex items-center gap-1 rounded-full
                          border border-[#E9E6DF] bg-white p-1
                          shadow-[0_10px_30px_rgba(31,30,27,0.10)]">
            <button onClick={addNode}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs
                         font-medium text-[#3A3833] transition hover:bg-[#F4F2ED]">
              <Plus size={14} /> Add {addLabel}
            </button>
            {category !== "physics" && (
              <button onClick={toggleConnect}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs
                            font-medium transition ${
                  connectMode ? "bg-[#1F1E1B] text-white"
                              : "text-[#3A3833] hover:bg-[#F4F2ED]"}`}>
                <Waypoints size={14} />
                {connectMode
                  ? (connectFrom ? "Pick target…" : "Pick source…")
                  : "Connect"}
              </button>
            )}
          </div>

          <DiagramCanvas
            svgRef={svgRef}
            diagram={diagram}
            layout={layout}
            theme={theme}
            moveAtom={moveAtom}
            selectedId={selectedId}
            variantOf={variantOf}
            icons={icons}
            onSelect={handleSelect}
            onInspect={handleInspect}
          />
          {inspectorOpen && inspection && selectedId && (
            <InspectorPanel
              inspection={inspection}
              variant={variantOf(selectedId)}
              onEdit={editNode}
              onVariant={(v) => setVariants((m) => ({ ...m, [selectedId]: v }))}
              onExport={(fmt) => runExport(fmt, "selection", null)}
              onDelete={removeSelected}
              onClose={() => setInspectorOpen(false)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
