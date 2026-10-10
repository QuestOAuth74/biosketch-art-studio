/**
 * graphToFabric — Takes a JSON graph (nodes + edges + subgraphs) from
 * the AI, runs dagre layout, creates Fabric.js editable objects.
 *
 * No Mermaid. No SVG parsing. Just: JSON → dagre layout → Fabric shapes.
 */

import dagre from '@dagrejs/dagre';

interface GraphNode {
  id: string;
  label: string;
  shape?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

interface GraphSubgraph {
  title: string;
  nodeIds: string[];
}

interface GraphData {
  title?: string;
  direction?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs?: GraphSubgraph[];
}

// draw.io-style colors: muted, professional (draw.io default is #eeeeee/#999999)
const SHAPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  rect:     { fill: '#dbeafe', stroke: '#3b82f6' },
  rounded:  { fill: '#dcfce7', stroke: '#22c55e' },
  diamond:  { fill: '#fef3c7', stroke: '#d97706' },
  circle:   { fill: '#e0e7ff', stroke: '#4f46e5' },
  stadium:  { fill: '#ccfbf1', stroke: '#0d9488' },
  hexagon:  { fill: '#ede9fe', stroke: '#7c3aed' },
  default:  { fill: '#eeeeee', stroke: '#999999' },
};

function getColors(shape: string) {
  return SHAPE_COLORS[shape] || SHAPE_COLORS.default;
}

// Node width: match Mermaid's sizing (~10px per char at 14px font + 30px padding)
function estimateWidth(text: string): number {
  return Math.max(120, text.length * 10 + 30);
}

function arrowPath(x: number, y: number, angle: number, sc: number = 1): string {
  const s = Math.max(6, 11 * sc), a = Math.PI / 6;
  return `M ${x} ${y} L ${x - s * Math.cos(angle - a)} ${y - s * Math.sin(angle - a)} L ${x - s * Math.cos(angle + a)} ${y - s * Math.sin(angle + a)} Z`;
}

/**
 * Convert JSON graph → Fabric.js objects on canvas
 */
export async function mermaidToFabricObjects(
  _mermaidCode: string,  // unused now — kept for API compat
  canvas: any,
  graphData?: GraphData
): Promise<number> {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    throw new Error('No graph data provided');
  }

  const { Rect, Circle, Polygon, Ellipse, IText, Textbox, Path } = await import('fabric');

  // Build dagre graph
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: graphData.direction === 'LR' ? 'LR' : 'TB',
    nodesep: 50,
    ranksep: 50,
    edgesep: 15,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add subgraph containers
  const subgraphMap: Record<string, GraphSubgraph> = {};
  (graphData.subgraphs || []).forEach((sg, i) => {
    const sgId = `_sg_${i}`;
    subgraphMap[sgId] = sg;
    g.setNode(sgId, { label: sg.title, width: 10, height: 10 });
  });

  // Add nodes
  graphData.nodes.forEach(node => {
    const w = estimateWidth(node.label);
    const h = node.shape === 'diamond' ? 70 : 50;
    g.setNode(node.id, { label: node.label, width: w, height: h, shape: node.shape || 'rect' });

    // Parent to subgraph
    Object.entries(subgraphMap).forEach(([sgId, sg]) => {
      if (sg.nodeIds.includes(node.id)) {
        try { g.setParent(node.id, sgId); } catch {}
      }
    });
  });

  // Add edges
  graphData.edges.forEach(edge => {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to, {
        label: edge.label || '',
        width: edge.label ? edge.label.length * 8 + 30 : 0,
        height: edge.label ? 20 : 0,
        labelpos: 'c',
      });
    }
  });

  // Run layout
  dagre.layout(g);

  // Get diagram bounds from dagre layout
  let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
  g.nodes().forEach((id: string) => {
    const n = g.node(id);
    if (!n || !isFinite(n.x)) return;
    bMinX = Math.min(bMinX, n.x - n.width / 2);
    bMinY = Math.min(bMinY, n.y - n.height / 2);
    bMaxX = Math.max(bMaxX, n.x + n.width / 2);
    bMaxY = Math.max(bMaxY, n.y + n.height / 2);
  });
  if (!isFinite(bMinX)) { bMinX = 0; bMinY = 0; bMaxX = 500; bMaxY = 500; }

  const dW = bMaxX - bMinX || 1;
  const dH = bMaxY - bMinY || 1;

  // draw.io approach: render at full size (no geometry scaling), use viewport zoom to fit
  // This keeps fonts, strokes, and spacing at their intended sizes
  const offX = -bMinX + 40;
  const offY = -bMinY + 60; // 60px top margin for title

  const cx = (v: number) => v + offX;
  const cy = (v: number) => v + offY;
  const cw = (v: number) => v;
  const scale = 1; // geometry is always 1:1

  // Fixed sizes (never scaled — draw.io uses fixed 12px font, 2px stroke)
  const nodeFont = 14;
  const edgeFont = 12;
  const sgFont = 13;
  const titleFont = 18;
  const sw = 2;

  let count = 0;

  // Draw subgraph backgrounds
  Object.entries(subgraphMap).forEach(([sgId]) => {
    const n = g.node(sgId);
    if (!n || !isFinite(n.x)) return;
    canvas.add(new Rect({
      left: cx(n.x - n.width / 2) - 20, top: cy(n.y - n.height / 2) - 30,
      width: cw(n.width) + 40, height: cw(n.height) + 50,
      fill: '#f1f5f9', stroke: '#94a3b8', strokeWidth: sw,
      rx: 14, ry: 14, opacity: 0.7, selectable: true,
    }));
    count++;
    const sg = subgraphMap[sgId];
    if (sg.title) {
      canvas.add(new IText(sg.title, {
        left: cx(n.x - n.width / 2) - 10, top: cy(n.y - n.height / 2) - 27,
        fontSize: sgFont, fontFamily: 'Inter, sans-serif',
        fontWeight: '700', fill: '#64748b',
      }));
      count++;
    }
  });

  // Draw edges
  g.edges().forEach((e: any) => {
    const ed = g.edge(e);
    if (!ed?.points || ed.points.length < 2) return;

    const pts = ed.points;

    // Pull back start/end points from node centers to node borders
    // draw.io uses dagre's computed intersection points; we compute border distance from angle
    const firstPt = pts[0], secondPt = pts[1];
    const lastPt = pts[pts.length - 1], prevPt = pts[pts.length - 2];

    const startAngle = Math.atan2(secondPt.y - firstPt.y, secondPt.x - firstPt.x);
    const endAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x);

    // Compute border distance based on approach angle (correct for both TB and LR)
    function borderDist(node: any, angle: number): number {
      if (!node) return 0;
      const absC = Math.abs(Math.cos(angle));
      const absS = Math.abs(Math.sin(angle));
      const halfW = node.width / 2;
      const halfH = node.height / 2;
      if (absC < 0.001) return halfH; // vertical
      if (absS < 0.001) return halfW; // horizontal
      return Math.min(halfW / absC, halfH / absS); // diagonal
    }

    const srcNode = g.node(e.v);
    const startDist = borderDist(srcNode, startAngle) + 2;
    const sx = firstPt.x + startDist * Math.cos(startAngle);
    const sy = firstPt.y + startDist * Math.sin(startAngle);

    const tgtNode = g.node(e.w);
    const endDist = borderDist(tgtNode, endAngle) + 4;
    const ex = lastPt.x - endDist * Math.cos(endAngle);
    const ey = lastPt.y - endDist * Math.sin(endAngle);

    // Build path with adjusted start/end
    let d = `M ${cx(sx)} ${cy(sy)}`;
    if (pts.length === 2) {
      d += ` L ${cx(ex)} ${cy(ey)}`;
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const cur = pts[i], nxt = pts[i + 1] || cur;
        if (i === pts.length - 2) {
          d += ` Q ${cx(cur.x)} ${cy(cur.y)} ${cx(ex)} ${cy(ey)}`;
        } else {
          d += ` Q ${cx(cur.x)} ${cy(cur.y)} ${cx((cur.x + nxt.x) / 2)} ${cy((cur.y + nxt.y) / 2)}`;
        }
      }
    }

    canvas.add(new Path(d, {
      fill: 'transparent', stroke: '#64748b', strokeWidth: sw,
      strokeLineCap: 'round', strokeLineJoin: 'round', selectable: true,
    }));
    count++;

    // Arrowhead at the adjusted end point
    canvas.add(new Path(arrowPath(cx(ex), cy(ey), endAngle, scale), {
      fill: '#475569', stroke: '#475569', strokeWidth: 1, selectable: false,
    }));
    count++;

    // Edge label — use dagre's computed label position if available
    if (ed.label) {
      const midX = ed.x ?? (sx + ex) / 2;
      const midY = ed.y ?? (sy + ey) / 2;
      canvas.add(new IText(ed.label, {
        left: cx(midX), top: cy(midY),
        fontSize: edgeFont, fontFamily: 'Inter, sans-serif',
        fontWeight: '500', fill: '#333333',
        backgroundColor: '#ffffff',
        originX: 'center', originY: 'center', padding: 4,
      }));
      count++;
    }
  });

  // Draw nodes
  graphData.nodes.forEach(node => {
    const n = g.node(node.id);
    if (!n || !isFinite(n.x)) return;

    const x = cx(n.x - n.width / 2);
    const y = cy(n.y - n.height / 2);
    const w = cw(n.width);
    const h = cw(n.height);
    const colors = getColors(node.shape || 'rect');

    if (node.shape === 'diamond') {
      const mx = x + w / 2, my = y + h / 2;
      canvas.add(new Polygon([
        { x: mx, y: my - h / 2 }, { x: mx + w / 2, y: my },
        { x: mx, y: my + h / 2 }, { x: mx - w / 2, y: my },
      ], { fill: colors.fill, stroke: colors.stroke, strokeWidth: sw }));
    } else if (node.shape === 'circle') {
      const r = Math.min(w, h) / 2;
      canvas.add(new Circle({
        left: x + w / 2 - r, top: y + h / 2 - r, radius: r,
        fill: colors.fill, stroke: colors.stroke, strokeWidth: sw,
      }));
    } else {
      // draw.io: arcSize=14 for rounded, arcSize=50 for stadium
      const rx = node.shape === 'stadium' ? Math.min(h / 2, 25) : node.shape === 'rounded' ? 14 : 4;
      canvas.add(new Rect({
        left: x, top: y, width: w, height: h,
        fill: colors.fill, stroke: colors.stroke, strokeWidth: sw, rx, ry: rx,
      }));
    }
    count++;

    // Label — Textbox wraps text within width (draw.io: whiteSpace=wrap, 15px padding)
    canvas.add(new Textbox(node.label, {
      left: x + w / 2, top: y + h / 2,
      fontSize: nodeFont, fontFamily: 'Inter, sans-serif',
      fontWeight: '600', fill: '#1e293b',
      originX: 'center', originY: 'center', textAlign: 'center',
      width: w - 16, splitByGrapheme: false,
    }));
    count++;
  });

  // Title
  if (graphData.title) {
    const titleX = offX + dW / 2;
    canvas.add(new IText(graphData.title, {
      left: titleX, top: 15,
      fontSize: titleFont, fontFamily: 'Inter, sans-serif',
      fontWeight: '700', fill: '#333333',
      originX: 'center',
    }));
    count++;
  }

  // draw.io approach: zoom viewport to fit (don't scale geometry)
  // Find the bounding box of all objects we just added
  const diagramRight = offX + dW + 40;
  const diagramBottom = offY + dH + 40;
  const canvasW = canvas.getWidth?.() || canvas.width || 1200;
  const canvasH = canvas.getHeight?.() || canvas.height || 800;

  if (diagramRight > canvasW || diagramBottom > canvasH) {
    // Zoom out the viewport to show the full diagram (draw.io's fit() approach)
    const zoomX = canvasW / diagramRight;
    const zoomY = canvasH / diagramBottom;
    const zoom = Math.min(zoomX, zoomY, 1) * 0.95;
    canvas.setZoom(zoom);
    canvas.requestRenderAll();
  }

  canvas.requestRenderAll();
  return count;
}
