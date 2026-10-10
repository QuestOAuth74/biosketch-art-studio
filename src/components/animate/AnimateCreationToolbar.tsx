import { useState, useRef, useCallback, useEffect, memo } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  Triangle,
  Star,
  Minus,
  Type,
  Pencil,
  ImagePlus,
  Hexagon,
  Diamond,
  RectangleHorizontal,
  ArrowRight,
  Pentagon,
  Heart,
} from "lucide-react";
import * as fabric from "fabric";
import { useAnimation } from "@/contexts/AnimationContext";
import { toast } from "sonner";

// ─── Tool definitions ───────────────────────────────────────────────────────

type ToolId =
  | "select"
  | "rectangle"
  | "rounded-rect"
  | "circle"
  | "ellipse"
  | "triangle"
  | "star"
  | "hexagon"
  | "pentagon"
  | "diamond"
  | "heart"
  | "line"
  | "arrow"
  | "text"
  | "freehand"
  | "image";

interface ToolDef {
  id: ToolId;
  label: string;
  icon: typeof Square;
}

const SHAPE_TOOLS: ToolDef[] = [
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "rounded-rect", label: "Rounded Rect", icon: RectangleHorizontal },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "star", label: "Star", icon: Star },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
  { id: "pentagon", label: "Pentagon", icon: Pentagon },
  { id: "diamond", label: "Diamond", icon: Diamond },
  { id: "heart", label: "Heart", icon: Heart },
];

const LINE_TOOLS: ToolDef[] = [
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
];

const DEFAULT_FILL = "rgba(139, 92, 246, 0.3)";
const DEFAULT_STROKE = "#8b5cf6";

// ─── Inner toolbar (memoized to avoid re-renders from context) ──────────────

interface ToolbarInnerProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
  addFabricObject: (obj: fabric.FabricObject, name?: string) => void;
  registerExistingObject: (obj: fabric.FabricObject, name?: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

const ToolbarInner = memo(function ToolbarInner({
  fabricCanvasRef,
  addFabricObject,
  registerExistingObject,
  canvasWidth,
  canvasHeight,
}: ToolbarInnerProps) {
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [showShapes, setShowShapes] = useState(false);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getCanvasCenter = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return { x: 200, y: 200 };
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const cx = (canvas.width! / 2 - (vpt?.[4] ?? 0)) / zoom;
    const cy = (canvas.height! / 2 - (vpt?.[5] ?? 0)) / zoom;
    return { x: cx, y: cy };
  }, [fabricCanvasRef]);

  // ─── Shape creation ─────────────────────────────────────────────────────

  const createShape = useCallback(
    (shapeId: ToolId) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      canvas.isDrawingMode = false;

      const center = getCanvasCenter();
      let obj: fabric.FabricObject | null = null;
      let name = "";

      switch (shapeId) {
        case "rectangle": {
          obj = new fabric.Rect({
            left: center.x - 60, top: center.y - 40,
            width: 120, height: 80,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Rectangle";
          break;
        }
        case "rounded-rect": {
          obj = new fabric.Rect({
            left: center.x - 60, top: center.y - 40,
            width: 120, height: 80, rx: 12, ry: 12,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Rounded Rect";
          break;
        }
        case "circle": {
          obj = new fabric.Circle({
            left: center.x - 50, top: center.y - 50, radius: 50,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Circle";
          break;
        }
        case "ellipse": {
          obj = new fabric.Ellipse({
            left: center.x - 60, top: center.y - 40, rx: 60, ry: 40,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Ellipse";
          break;
        }
        case "triangle": {
          obj = new fabric.Triangle({
            left: center.x - 50, top: center.y - 50, width: 100, height: 100,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Triangle";
          break;
        }
        case "star": {
          const points = createStarPoints(center.x, center.y, 5, 50, 25);
          obj = new fabric.Polygon(points, {
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Star";
          break;
        }
        case "hexagon": {
          const points = createRegularPolygonPoints(center.x, center.y, 6, 50);
          obj = new fabric.Polygon(points, {
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Hexagon";
          break;
        }
        case "pentagon": {
          const points = createRegularPolygonPoints(center.x, center.y, 5, 50);
          obj = new fabric.Polygon(points, {
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Pentagon";
          break;
        }
        case "diamond": {
          const points = [
            { x: center.x, y: center.y - 60 },
            { x: center.x + 45, y: center.y },
            { x: center.x, y: center.y + 60 },
            { x: center.x - 45, y: center.y },
          ];
          obj = new fabric.Polygon(points, {
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
          });
          name = "Diamond";
          break;
        }
        case "heart": {
          const heartPath =
            "M 0 -30 C -25 -60, -70 -30, -40 10 C -20 40, 0 55, 0 55 C 0 55, 20 40, 40 10 C 70 -30, 25 -60, 0 -30 Z";
          obj = new fabric.Path(heartPath, {
            left: center.x - 40, top: center.y - 40,
            fill: fillColor, stroke: strokeColor, strokeWidth: 2, scaleX: 1, scaleY: 1,
          });
          name = "Heart";
          break;
        }
      }

      if (obj) {
        addFabricObject(obj, name);
        setActiveTool("select");
        setShowShapes(false);
      }
    },
    [fabricCanvasRef, fillColor, strokeColor, getCanvasCenter, addFabricObject]
  );

  // ─── Line creation ──────────────────────────────────────────────────────

  const createLine = useCallback(
    (lineId: ToolId) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const center = getCanvasCenter();
      const x1 = center.x - 60, y1 = center.y;
      const x2 = center.x + 60, y2 = center.y;

      if (lineId === "arrow") {
        const line = new fabric.Line([x1, y1, x2, y2], { stroke: strokeColor, strokeWidth: 2 });
        const headSize = 12;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowHead = new fabric.Triangle({
          left: x2, top: y2, width: headSize, height: headSize,
          fill: strokeColor, angle: (angle * 180) / Math.PI + 90,
          originX: "center", originY: "center",
        });
        const group = new fabric.Group([line, arrowHead], {
          left: x1, top: y1 - headSize / 2,
        });
        addFabricObject(group, "Arrow");
      } else {
        const line = new fabric.Line([x1, y1, x2, y2], {
          stroke: strokeColor, strokeWidth: 2, strokeUniform: true,
        });
        addFabricObject(line, "Line");
      }
      setActiveTool("select");
    },
    [fabricCanvasRef, strokeColor, getCanvasCenter, addFabricObject]
  );

  // ─── Text creation ──────────────────────────────────────────────────────

  const createText = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;

    const center = getCanvasCenter();
    const text = new fabric.Textbox("Type here", {
      left: center.x - 80, top: center.y - 15, width: 160,
      fontSize: 24, fontFamily: "Inter, sans-serif", fill: "#ffffff",
      textAlign: "center", editable: true,
    });

    addFabricObject(text, "Text");
    setActiveTool("select");

    requestAnimationFrame(() => {
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
      requestAnimationFrame(() => {
        try {
          text.enterEditing();
          text.selectAll();
          canvas.requestRenderAll();
        } catch (_) {}
      });
    });
  }, [fabricCanvasRef, getCanvasCenter, addFabricObject]);

  // ─── Freehand drawing ─────────────────────────────────────────────────

  const toggleFreehand = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeTool === "freehand") {
      canvas.isDrawingMode = false;
      setActiveTool("select");
    } else {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = 3;
      canvas.freeDrawingBrush = brush;
      setActiveTool("freehand");
    }
  }, [activeTool, fabricCanvasRef, strokeColor]);

  // Register freehand paths
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const onPathCreated = (e: any) => {
      const path = e.path as fabric.Path;
      if (!path || (path as any).id) return;
      registerExistingObject(path, "Freehand");
    };
    canvas.on("path:created", onPathCreated);
    return () => { canvas.off("path:created", onPathCreated); };
  }, [fabricCanvasRef, registerExistingObject]);

  // Cleanup freehand on tool change
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    if (activeTool !== "freehand" && canvas.isDrawingMode) {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, fabricCanvasRef]);

  // ─── Image upload ─────────────────────────────────────────────────────

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const imgElement = new Image();
        imgElement.onload = () => {
          const canvas = fabricCanvasRef.current;
          if (!canvas) return;

          const center = getCanvasCenter();
          const fabricImg = new fabric.FabricImage(imgElement, {
            left: center.x, top: center.y,
            originX: "center", originY: "center",
          });

          const maxDim = Math.min(canvasWidth * 0.4, 400);
          if (fabricImg.width! > maxDim || fabricImg.height! > maxDim) {
            const scale = maxDim / Math.max(fabricImg.width!, fabricImg.height!);
            fabricImg.scaleToWidth(fabricImg.width! * scale);
          }

          addFabricObject(fabricImg, file.name.replace(/\.[^.]+$/, ""));
          toast.success(`Added image: ${file.name}`);
        };
        imgElement.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [fabricCanvasRef, getCanvasCenter, addFabricObject, canvasWidth]
  );

  // ─── Tool button helper ───────────────────────────────────────────────

  const ToolBtn = ({
    icon: Icon,
    label,
    active,
    onClick,
    small,
  }: {
    icon: typeof Square;
    label: string;
    active?: boolean;
    onClick: () => void;
    small?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={`${small ? "h-7 w-7" : "h-8 w-8"} rounded-lg flex items-center justify-center transition-all`}
      style={{
        background: active ? "rgba(139,92,246,0.15)" : "transparent",
        color: active ? "var(--aw-accent)" : "var(--aw-text-2)",
        border: active ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(139,92,246,0.08)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = active ? "rgba(139,92,246,0.15)" : "transparent";
      }}
    >
      <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );

  return (
    <div
      className="flex flex-col items-center gap-1 py-2 px-1 shrink-0"
      style={{
        background: "var(--aw-surface)",
        borderRight: "1px solid var(--aw-border)",
      }}
    >
      {/* Select */}
      <ToolBtn
        icon={MousePointer2}
        label="Select (V)"
        active={activeTool === "select"}
        onClick={() => { setActiveTool("select"); setShowShapes(false); }}
      />

      <div className="w-6 h-px my-0.5" style={{ background: "var(--aw-border)" }} />

      {/* Shapes toggle — expands inline grid */}
      <ToolBtn
        icon={Square}
        label="Shapes"
        active={showShapes}
        onClick={() => setShowShapes((v) => !v)}
      />

      {showShapes && (
        <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(139,92,246,0.04)" }}>
          {SHAPE_TOOLS.map((tool) => (
            <ToolBtn
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              small
              onClick={() => createShape(tool.id)}
            />
          ))}
        </div>
      )}

      {/* Lines — just two buttons, no dropdown needed */}
      {LINE_TOOLS.map((tool) => (
        <ToolBtn
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          onClick={() => createLine(tool.id)}
        />
      ))}

      <div className="w-6 h-px my-0.5" style={{ background: "var(--aw-border)" }} />

      {/* Text */}
      <ToolBtn icon={Type} label="Text (T)" onClick={createText} />

      {/* Freehand */}
      <ToolBtn
        icon={Pencil}
        label="Freehand Draw"
        active={activeTool === "freehand"}
        onClick={toggleFreehand}
      />

      {/* Image */}
      <ToolBtn
        icon={ImagePlus}
        label="Insert Image"
        onClick={() => imageInputRef.current?.click()}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="w-6 h-px my-0.5" style={{ background: "var(--aw-border)" }} />

      {/* Color pickers */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="h-5 w-5 rounded cursor-pointer"
          style={{
            backgroundColor: fillColor,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
          title="Fill color"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "color";
            input.value = fillColor.startsWith("#") ? fillColor : "#8b5cf6";
            input.onchange = () => setFillColor(input.value);
            input.click();
          }}
        />
        <div
          className="h-5 w-5 rounded cursor-pointer"
          style={{
            backgroundColor: "transparent",
            boxShadow: `inset 0 0 0 2px ${strokeColor}`,
          }}
          title="Stroke color"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "color";
            input.value = strokeColor;
            input.onchange = () => setStrokeColor(input.value);
            input.click();
          }}
        />
      </div>
    </div>
  );
});

// ─── Wrapper that extracts stable refs from context ─────────────────────────

export function AnimateCreationToolbar() {
  const { fabricCanvasRef, addFabricObject, registerExistingObject, sourceProject } =
    useAnimation();

  return (
    <ToolbarInner
      fabricCanvasRef={fabricCanvasRef}
      addFabricObject={addFabricObject}
      registerExistingObject={registerExistingObject}
      canvasWidth={sourceProject?.canvas_width ?? 800}
      canvasHeight={sourceProject?.canvas_height ?? 600}
    />
  );
}

// ─── Geometry helpers ───────────────────────────────────────────────────────

function createRegularPolygonPoints(
  cx: number, cy: number, sides: number, radius: number
): fabric.XY[] {
  const points: fabric.XY[] = [];
  const angleStep = (2 * Math.PI) / sides;
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}

function createStarPoints(
  cx: number, cy: number, numPoints: number, outerRadius: number, innerRadius: number
): fabric.XY[] {
  const points: fabric.XY[] = [];
  const angleStep = Math.PI / numPoints;
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = startAngle + i * angleStep;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}
