/**
 * useScientificLayout — Step 3: Elastic Scientific Layout
 * -------------------------------------------------------
 * Napkin.ai's defining trait is "elastic design": when text or elements
 * change, the canvas re-flows automatically instead of breaking. This hook is
 * that engine for scientific diagrams. Given a `SciDiagram` it returns fully
 * resolved canvas geometry (`SciLayout`) plus drag handlers, recomputed
 * whenever the diagram, a label, or a dragged position changes.
 *
 * Three elastic behaviours:
 *   1. CELLULAR  — layer bands auto-scale: extra proteins wrap into rows and
 *                  grow the containing membrane band (and the whole canvas).
 *   2. PHYSICS   — force-vector labels are placed beyond each arrow tip, then
 *                  iteratively de-overlapped so text never crosses a line.
 *   3. CHEMICAL  — bond lines auto-route: every bond is trimmed to the live
 *                  atom radius, so dragging an atom OR expanding its element
 *                  label re-routes the connected bonds with no manual edits.
 */
import { useCallback, useMemo, useState } from "react";
import {
  CANVAS_W, PAD, atomRadius, nodeWidth,
  type CellularDiagram, type CellularLayout, type CellularNode,
  type ChemicalDiagram, type ChemicalLayout, type ChemBondGeom,
  type LabDiagram, type LabLayout, type Box,
  type PhysicsDiagram, type PhysicsLayout, type ForceGeom,
  type SciDiagram, type SciLayout,
} from "@/lib/sciDiagram";

type AtomOverrides = Record<string, { rx: number; ry: number }>;

/* ──────────────────────── 1. cellular layout ───────────────────────────── */
/* Cellular diagrams render as a plain relationship graph — NEVER subcellular
 * compartment bands. Nodes are placed in rows by longest-path depth, giving a
 * clean directional flow for pathways, networks and mechanisms alike. */
function layoutCellular(d: CellularDiagram): CellularLayout {
  const innerW = CANVAS_W - 2 * PAD;
  const nodeH = 58;
  const rowH = 108;
  const gap = 24;

  // longest-path depth layering (cycles bounded by node count)
  const depth = new Map<string, number>();
  d.nodes.forEach((n) => depth.set(n.id, 0));
  for (let pass = 0; pass < d.nodes.length; pass++) {
    let changed = false;
    for (const e of d.edges) {
      const du = depth.get(e.from);
      const dv = depth.get(e.to);
      if (du === undefined || dv === undefined) continue;
      if (dv < du + 1) { depth.set(e.to, du + 1); changed = true; }
    }
    if (!changed) break;
  }

  const rows = new Map<number, CellularNode[]>();
  for (const n of d.nodes) {
    const k = depth.get(n.id) ?? 0;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k)!.push(n);
  }
  const keys = [...rows.keys()].sort((a, b) => a - b);

  const nodes: Record<string, Box> = {};
  keys.forEach((k, ri) => {
    const row = rows.get(k)!;
    const widths = row.map((n) => nodeWidth(n.label));
    const total = widths.reduce((s, w) => s + w, 0) + gap * (row.length - 1);
    let x = PAD + Math.max(0, (innerW - total) / 2);
    const y = 52 + ri * rowH;
    row.forEach((n, i) => {
      nodes[n.id] = { x, y, w: widths[i], h: nodeH };
      x += widths[i] + gap;
    });
  });

  return {
    kind: "cellular",
    width: CANVAS_W,
    height: 52 + Math.max(keys.length, 1) * rowH + 8,
    layers: [], // no compartment bands — ever
    nodes,
  };
}

/* ──────────────────────── 2. physics label de-overlap ──────────────────── */
function layoutPhysics(d: PhysicsDiagram): PhysicsLayout {
  const width = CANVAS_W;
  const height = 580;
  const cx = width / 2;
  const cy = height / 2;
  const maxMag = Math.max(...d.forces.map((f) => f.magnitude), 1);

  const forces: (ForceGeom & { lw: number; lh: number })[] = d.forces.map((f) => {
    const len = 74 + (f.magnitude / maxMag) * 150;
    const rad = (f.angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    return {
      id: f.id, label: f.label, type: f.type,
      magnitude: f.magnitude, angleDeg: f.angleDeg, dx, dy,
      tipX: cx + dx * len, tipY: cy + dy * len,
      labelX: cx + dx * (len + 34),
      labelY: cy + dy * (len + 34),
      lw: f.label.length * 6.8 + 26,
      lh: 32,
    };
  });

  // iterative separation: push apart any pair of label boxes that collide,
  // along whichever axis needs the smaller correction.
  for (let it = 0; it < 90; it++) {
    let moved = false;
    for (let i = 0; i < forces.length; i++) {
      for (let j = i + 1; j < forces.length; j++) {
        const a = forces[i], b = forces[j];
        const ox = (a.lw + b.lw) / 2 - Math.abs(a.labelX - b.labelX);
        const oy = (a.lh + b.lh) / 2 - Math.abs(a.labelY - b.labelY);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) {
            const s = (ox / 2 + 0.5) * (a.labelX >= b.labelX ? 1 : -1);
            a.labelX += s; b.labelX -= s;
          } else {
            const s = (oy / 2 + 0.5) * (a.labelY >= b.labelY ? 1 : -1);
            a.labelY += s; b.labelY -= s;
          }
        }
      }
    }
    if (!moved) break;
  }

  return {
    kind: "physics", width, height, center: { x: cx, y: cy },
    forces: forces.map(({ lw: _lw, lh: _lh, ...f }) => f),
  };
}

/* ──────────────────────── 3. chemical bond auto-routing ─────────────────── */
function layoutChemical(d: ChemicalDiagram, overrides: AtomOverrides): ChemicalLayout {
  const box = 540;
  const ox = (CANVAS_W - box) / 2;
  const oy = 44;

  const atoms: ChemicalLayout["atoms"] = {};
  for (const a of d.atoms) {
    const ov = overrides[a.id];
    const rx = ov ? ov.rx : a.rx;
    const ry = ov ? ov.ry : a.ry;
    atoms[a.id] = {
      x: ox + rx * box,
      y: oy + ry * box,
      r: atomRadius(a.element),
      element: a.element,
    };
  }

  // every bond is trimmed to the *current* atom radii — so a drag or a longer
  // element label re-routes the bond endpoints automatically.
  const bonds: ChemBondGeom[] = [];
  for (const b of d.bonds) {
    const A = atoms[b.from], B = atoms[b.to];
    if (!A || !B) continue;
    const dx = B.x - A.x, dy = B.y - A.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    bonds.push({
      from: b.from, to: b.to, order: b.order,
      x1: A.x + ux * A.r, y1: A.y + uy * A.r,
      x2: B.x - ux * B.r, y2: B.y - uy * B.r,
    });
  }

  return { kind: "chemical", width: CANVAS_W, height: oy + box + 40, box, ox, oy, atoms, bonds };
}

/* ───────────────────────────── lab flow ────────────────────────────────── */
function layoutLab(d: LabDiagram): LabLayout {
  const innerW = CANVAS_W - 2 * PAD;
  const w = 168, h = 96, gap = 30, rowGap = 64;
  const perRow = Math.max(1, Math.floor((innerW + gap) / (w + gap)));
  const steps: Record<string, Box> = {};
  let rows = 0;

  d.steps.forEach((s, i) => {
    const row = Math.floor(i / perRow);
    rows = row + 1;
    const inRow = Math.min(perRow, d.steps.length - row * perRow);
    const rowW = inRow * w + (inRow - 1) * gap;
    const col = i % perRow;
    steps[s.id] = {
      x: PAD + (innerW - rowW) / 2 + col * (w + gap),
      y: 70 + row * (h + rowGap),
      w, h,
    };
  });

  return {
    kind: "lab", width: CANVAS_W,
    height: 70 + rows * h + (rows - 1) * rowGap + 60,
    steps,
  };
}

/* ──────────────────────────────── hook ─────────────────────────────────── */
function computeLayout(d: SciDiagram, overrides: AtomOverrides): SciLayout {
  switch (d.kind) {
    case "cellular": return layoutCellular(d);
    case "chemical": return layoutChemical(d, overrides);
    case "physics": return layoutPhysics(d);
    case "lab": return layoutLab(d);
  }
}

export function useScientificLayout(diagram: SciDiagram) {
  // Drag positions persist across in-place edits (rename / restyle); the page
  // calls resetLayout() explicitly when the diagram is wholly replaced.
  const [overrides, setOverrides] = useState<AtomOverrides>({});

  const layout = useMemo(
    () => computeLayout(diagram, overrides),
    [diagram, overrides],
  );

  /** Move a chemical atom; bonds re-route on the next layout pass. */
  const moveAtom = useCallback((id: string, rx: number, ry: number) => {
    setOverrides((o) => ({
      ...o,
      [id]: {
        rx: Math.min(1, Math.max(0, rx)),
        ry: Math.min(1, Math.max(0, ry)),
      },
    }));
  }, []);

  const resetLayout = useCallback(() => setOverrides({}), []);

  return { layout, moveAtom, resetLayout, dirty: Object.keys(overrides).length > 0 };
}
