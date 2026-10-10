/**
 * normalize.ts — final deterministic pass before the diagram is returned.
 *
 * Adds the geometry the renderer needs but the LLM never produces (chemical
 * atom coordinates via a force-directed layout), drops any dangling edges that
 * survived the repair loop, wraps physics angles, and stamps the renderer kind.
 */
import { Category, RawCellular, RawChemical, RawPhysics, RawLab } from "./schema.ts";

/* Force-directed layout: the LLM emits only connectivity, so we place atoms in
 * normalised 0..1 space. ~140 iterations of repulsion + bond springs untangle
 * rings and chains deterministically (seeded on a circle). */
export function layoutChemical(raw: RawChemical) {
  const n = raw.atoms.length;
  const idx = new Map(raw.atoms.map((a, i) => [a.id, i]));
  const pos = raw.atoms.map((_, i) => ({
    x: 0.5 + 0.32 * Math.cos((2 * Math.PI * i) / n),
    y: 0.5 + 0.32 * Math.sin((2 * Math.PI * i) / n),
  }));
  const bonds = raw.bonds
    .map((b) => [idx.get(b.from), idx.get(b.to)] as const)
    .filter((p): p is readonly [number, number] => p[0] != null && p[1] != null);

  const L = 0.26; // ideal bond length
  for (let iter = 0; iter < 140; iter++) {
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy || 1e-4;
        const rep = 0.012 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        fx[i] += dx * rep; fy[i] += dy * rep;
        fx[j] -= dx * rep; fy[j] -= dy * rep;
      }
    }
    for (const [a, b] of bonds) {
      let dx = pos[b].x - pos[a].x;
      let dy = pos[b].y - pos[a].y;
      const d = Math.hypot(dx, dy) || 1e-4;
      const f = (d - L) * 0.5;
      dx /= d; dy /= d;
      fx[a] += dx * f; fy[a] += dy * f;
      fx[b] -= dx * f; fy[b] -= dy * f;
    }
    for (let i = 0; i < n; i++) {
      pos[i].x += Math.max(-0.05, Math.min(0.05, fx[i]));
      pos[i].y += Math.max(-0.05, Math.min(0.05, fy[i]));
    }
  }
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-3);
  return raw.atoms.map((a, i) => ({
    id: a.id,
    element: a.element,
    rx: 0.08 + ((pos[i].x - minX) / span) * 0.84,
    ry: 0.08 + ((pos[i].y - minY) / span) * 0.84,
  }));
}

export function normalise(category: Category, raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("empty model output");

  if (category === "cellular") {
    const r = raw as RawCellular;
    const layout = r.layout === "compartments" ? "compartments" : "network";
    const ids = new Set(r.nodes.map((n) => n.id));
    // compartments: every node needs a layer; network: strip layers entirely
    const nodes = layout === "compartments"
      ? r.nodes.map((n) => ({ ...n, layer: n.layer ?? "cytoplasm" }))
      : r.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }));
    return {
      kind: "cellular",
      title: r.title,
      layout,
      nodes,
      edges: r.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    };
  }
  if (category === "chemical") {
    const r = raw as RawChemical;
    const atoms = layoutChemical(r);
    const ids = new Set(atoms.map((a) => a.id));
    return {
      kind: "chemical",
      title: r.title,
      atoms,
      bonds: r.bonds.filter((b) => ids.has(b.from) && ids.has(b.to)),
    };
  }
  if (category === "physics") {
    const r = raw as RawPhysics;
    return {
      kind: "physics",
      title: r.title,
      massLabel: r.massLabel,
      massValue: r.massValue,
      forces: r.forces.map((f) => ({
        ...f,
        angleDeg: ((f.angleDeg % 360) + 360) % 360,
        magnitude: Math.abs(f.magnitude),
      })),
    };
  }
  const r = raw as RawLab;
  const ids = new Set(r.steps.map((s) => s.id));
  return {
    kind: "lab",
    title: r.title,
    steps: r.steps,
    edges: r.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}
