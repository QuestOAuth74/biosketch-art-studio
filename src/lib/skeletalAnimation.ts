// ─── Skeletal Animation (2D Rigging) ──────────────────────────────────────────
// Anchor-point based puppet animation for SVG icons.
// Decomposes an SVG group into parts, each with a pivot point (anchor).
// Bones define parent-child relationships. FK solver propagates transforms.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnchorPoint {
  id: string;
  /** Display name (e.g. "Left Shoulder") */
  name: string;
  /** Pivot position relative to the rig's bounding box origin */
  x: number;
  y: number;
  /** Parent anchor (null = root) */
  parentId: string | null;
  /** Which decomposed part (track objectId) this anchor controls */
  attachedPartId: string | null;
}

export interface RigData {
  id: string;
  /** The original grouped SVG object that was decomposed */
  sourceObjectId: string;
  /** World position of the rig origin (where the original object was) */
  originX: number;
  originY: number;
  /** All anchor points (joints) */
  anchors: AnchorPoint[];
  /** IDs of the decomposed part objects on canvas */
  partIds: string[];
}

export interface FKResult {
  anchorId: string;
  worldX: number;
  worldY: number;
  worldAngle: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateAnchorId(): string {
  return `anc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

export function generateRigId(): string {
  return `rig_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

// ─── FK Solver ────────────────────────────────────────────────────────────────
// Given anchor points and per-anchor local rotations (in degrees),
// compute world positions and angles for every anchor.

export function solveFK(
  anchors: AnchorPoint[],
  /** Map from anchorId → local rotation in degrees */
  localRotations: Map<string, number>,
  rigOriginX: number,
  rigOriginY: number,
): FKResult[] {
  const results = new Map<string, FKResult>();

  // Find root anchors (no parent)
  const roots = anchors.filter((a) => a.parentId === null);

  function processAnchor(anchor: AnchorPoint, parentResult: FKResult | null) {
    const localAngle = localRotations.get(anchor.id) ?? 0;

    let worldX: number;
    let worldY: number;
    let worldAngle: number;

    if (!parentResult) {
      // Root anchor — position is relative to rig origin
      worldX = rigOriginX + anchor.x;
      worldY = rigOriginY + anchor.y;
      worldAngle = localAngle;
    } else {
      // Child anchor — rotate around parent's world position
      const dx = anchor.x - (anchors.find((a) => a.id === anchor.parentId)?.x ?? 0);
      const dy = anchor.y - (anchors.find((a) => a.id === anchor.parentId)?.y ?? 0);

      const parentRad = (parentResult.worldAngle * Math.PI) / 180;
      const cos = Math.cos(parentRad);
      const sin = Math.sin(parentRad);

      worldX = parentResult.worldX + dx * cos - dy * sin;
      worldY = parentResult.worldY + dx * sin + dy * cos;
      worldAngle = parentResult.worldAngle + localAngle;
    }

    const result: FKResult = {
      anchorId: anchor.id,
      worldX,
      worldY,
      worldAngle,
    };
    results.set(anchor.id, result);

    // Process children
    const children = anchors.filter((a) => a.parentId === anchor.id);
    for (const child of children) {
      processAnchor(child, result);
    }
  }

  for (const root of roots) {
    processAnchor(root, null);
  }

  return Array.from(results.values());
}

// ─── Apply FK results to Fabric objects ───────────────────────────────────────

export function applyFKToObjects(
  rig: RigData,
  fkResults: FKResult[],
  objectMap: Map<string, any>,
) {
  for (const anchor of rig.anchors) {
    if (!anchor.attachedPartId) continue;

    const obj = objectMap.get(anchor.attachedPartId);
    if (!obj) continue;

    const fk = fkResults.find((r) => r.anchorId === anchor.id);
    if (!fk) continue;

    // Position the part so its anchor point aligns with the FK world position
    obj.set({
      left: fk.worldX,
      top: fk.worldY,
      angle: fk.worldAngle,
      originX: "center",
      originY: "center",
    });
    obj.setCoords();
  }
}

// ─── Get bone connections for rendering ───────────────────────────────────────

export function getBoneLines(
  anchors: AnchorPoint[],
  fkResults: FKResult[],
): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const resultMap = new Map(fkResults.map((r) => [r.anchorId, r]));

  for (const anchor of anchors) {
    if (!anchor.parentId) continue;
    const parentFK = resultMap.get(anchor.parentId);
    const childFK = resultMap.get(anchor.id);
    if (parentFK && childFK) {
      lines.push({
        x1: parentFK.worldX,
        y1: parentFK.worldY,
        x2: childFK.worldX,
        y2: childFK.worldY,
      });
    }
  }

  return lines;
}

// ─── Auto-generate anchors from SVG parts ─────────────────────────────────────
// Places an anchor at the center of each decomposed part.
// The first anchor (largest part by area) becomes root.

export function autoGenerateAnchors(
  parts: { id: string; left: number; top: number; width: number; height: number; name: string }[],
  rigOriginX: number,
  rigOriginY: number,
): AnchorPoint[] {
  if (parts.length === 0) return [];

  // Sort by area descending — largest part is likely the body/torso
  const sorted = [...parts].sort(
    (a, b) => b.width * b.height - a.width * a.height
  );

  const anchors: AnchorPoint[] = [];

  // Root anchor on the largest part
  const root = sorted[0];
  const rootAnchor: AnchorPoint = {
    id: generateAnchorId(),
    name: root.name || "Root",
    x: root.left + root.width / 2 - rigOriginX,
    y: root.top + root.height / 2 - rigOriginY,
    parentId: null,
    attachedPartId: root.id,
  };
  anchors.push(rootAnchor);

  // Child anchors for remaining parts — parent to closest existing anchor
  for (let i = 1; i < sorted.length; i++) {
    const part = sorted[i];
    const cx = part.left + part.width / 2 - rigOriginX;
    const cy = part.top + part.height / 2 - rigOriginY;

    // Find nearest existing anchor
    let nearestId = rootAnchor.id;
    let nearestDist = Infinity;
    for (const existing of anchors) {
      const dx = cx - existing.x;
      const dy = cy - existing.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = existing.id;
      }
    }

    anchors.push({
      id: generateAnchorId(),
      name: part.name || `Joint ${i + 1}`,
      x: cx,
      y: cy,
      parentId: nearestId,
      attachedPartId: part.id,
    });
  }

  return anchors;
}
