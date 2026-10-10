import { useCallback, useRef, useState } from "react";

interface CubicBezierEditorProps {
  value: [number, number, number, number];
  onChange: (value: [number, number, number, number]) => void;
}

const PRESETS: { label: string; value: [number, number, number, number] }[] = [
  { label: "Ease", value: [0.25, 0.1, 0.25, 1] },
  { label: "Ease In", value: [0.42, 0, 1, 1] },
  { label: "Ease Out", value: [0, 0, 0.58, 1] },
  { label: "Ease In-Out", value: [0.42, 0, 0.58, 1] },
];

// SVG viewBox is 200x200. Curve space: x in [0,1], y in [0,1].
// In SVG coords: sx = 20 + x * 160, sy = 180 - y * 160
// So (0,0) in curve space -> (20, 180) in SVG, (1,1) -> (180, 20)
const PAD = 20;
const SIZE = 160;

function toSvgX(x: number): number {
  return PAD + x * SIZE;
}
function toSvgY(y: number): number {
  return PAD + SIZE - y * SIZE;
}
function fromSvgX(sx: number): number {
  return Math.max(0, Math.min(1, (sx - PAD) / SIZE));
}
function fromSvgY(sy: number): number {
  return Math.max(-0.5, Math.min(1.5, (PAD + SIZE - sy) / SIZE));
}

export default function CubicBezierEditor({
  value,
  onChange,
}: CubicBezierEditorProps) {
  const [x1, y1, x2, y2] = value;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);

  const getSvgPoint = useCallback(
    (e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = 200 / rect.width;
      const scaleY = 200 / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (point: 1 | 2) => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(point);

      const onMove = (ev: MouseEvent) => {
        const pt = getSvgPoint(ev);
        const cx = fromSvgX(pt.x);
        const cy = fromSvgY(pt.y);
        const next: [number, number, number, number] = [...value];
        if (point === 1) {
          next[0] = cx;
          next[1] = cy;
        } else {
          next[2] = cx;
          next[3] = cy;
        }
        onChange(next);
      };

      const onUp = () => {
        setDragging(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [getSvgPoint, value, onChange]
  );

  // Curve start (0,0) and end (1,1) in curve space
  const startX = toSvgX(0);
  const startY = toSvgY(0);
  const endX = toSvgX(1);
  const endY = toSvgY(1);

  const cp1x = toSvgX(x1);
  const cp1y = toSvgY(y1);
  const cp2x = toSvgX(x2);
  const cp2y = toSvgY(y2);

  const curvePath = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        style={{
          width: "100%",
          maxWidth: 200,
          height: "auto",
          display: "block",
          margin: "0 auto",
          cursor: dragging ? "grabbing" : "default",
          borderRadius: 8,
          background: "var(--aw-bg)",
          border: "1px solid var(--aw-border)",
        }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((v) => (
          <g key={v}>
            <line
              x1={toSvgX(v)}
              y1={toSvgY(0)}
              x2={toSvgX(v)}
              y2={toSvgY(1)}
              stroke="var(--aw-border)"
              strokeWidth="0.5"
            />
            <line
              x1={toSvgX(0)}
              y1={toSvgY(v)}
              x2={toSvgX(1)}
              y2={toSvgY(v)}
              stroke="var(--aw-border)"
              strokeWidth="0.5"
            />
          </g>
        ))}

        {/* Linear reference diagonal */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="var(--aw-text-3)"
          strokeWidth="0.5"
          strokeDasharray="3 3"
          opacity={0.4}
        />

        {/* Handle lines */}
        <line
          x1={startX}
          y1={startY}
          x2={cp1x}
          y2={cp1y}
          stroke="var(--aw-accent)"
          strokeWidth="1"
          opacity={0.5}
        />
        <line
          x1={endX}
          y1={endY}
          x2={cp2x}
          y2={cp2y}
          stroke="var(--aw-accent)"
          strokeWidth="1"
          opacity={0.5}
        />

        {/* The bezier curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--aw-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Start and end points */}
        <circle cx={startX} cy={startY} r="3" fill="var(--aw-text-3)" />
        <circle cx={endX} cy={endY} r="3" fill="var(--aw-text-3)" />

        {/* Draggable control points */}
        <circle
          cx={cp1x}
          cy={cp1y}
          r="6"
          fill="var(--aw-accent)"
          stroke="white"
          strokeWidth="1.5"
          style={{ cursor: "grab" }}
          onMouseDown={handlePointerDown(1)}
        />
        <circle
          cx={cp2x}
          cy={cp2y}
          r="6"
          fill="var(--aw-accent)"
          stroke="white"
          strokeWidth="1.5"
          style={{ cursor: "grab" }}
          onMouseDown={handlePointerDown(2)}
        />
      </svg>

      {/* Values display */}
      <div
        className="text-center mt-1.5"
        style={{ color: "var(--aw-text-3)", fontSize: "9px", fontFamily: "monospace" }}
      >
        cubic-bezier({x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)},{" "}
        {y2.toFixed(2)})
      </div>

      {/* Preset buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "3px",
          marginTop: "6px",
        }}
      >
        {PRESETS.map((preset) => {
          const isActive =
            value[0] === preset.value[0] &&
            value[1] === preset.value[1] &&
            value[2] === preset.value[2] &&
            value[3] === preset.value[3];
          return (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              className="rounded transition-colors"
              style={{
                fontSize: "8px",
                lineHeight: "11px",
                padding: "3px 2px",
                background: isActive
                  ? "rgba(139,92,246,0.10)"
                  : "var(--aw-bg)",
                border: isActive
                  ? "1.5px solid var(--aw-accent)"
                  : "1px solid var(--aw-border)",
                color: isActive ? "var(--aw-accent)" : "var(--aw-text-3)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = "rgba(139,92,246,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = "var(--aw-bg)";
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
