import { useCanvas } from "@/contexts/CanvasContext";
import { Group, Rect, Path, Textbox } from "fabric";
import { toast } from "sonner";

export const createImagePlaceholder = (
  canvas: any,
  options?: { left?: number; top?: number; width?: number; height?: number; label?: string }
) => {
  const left = options?.left ?? 100;
  const top = options?.top ?? 100;
  const width = options?.width ?? 200;
  const height = options?.height ?? 150;
  const label = options?.label ?? "Double-click to add image";

  // Create background rectangle with dashed border
  const background = new Rect({
    left: 0,
    top: 0,
    width: width,
    height: height,
    fill: "#f5f5f5",
    stroke: "#999999",
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    rx: 8,
    ry: 8,
    originX: "left",
    originY: "top",
  });

  // Create camera icon (simplified SVG path)
  const iconSize = Math.min(width, height) * 0.3;
  const iconLeft = width / 2;
  const iconTop = height / 2 - 15;

  const cameraIcon = new Path(
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    {
      left: iconLeft,
      top: iconTop,
      fill: "#cccccc",
      stroke: "#999999",
      strokeWidth: 0.5,
      scaleX: iconSize / 24,
      scaleY: iconSize / 24,
      originX: "center",
      originY: "center",
    }
  );

  // Create label text
  const labelText = new Textbox(label, {
    left: width / 2,
    top: height / 2 + 25,
    fontSize: 14,
    fill: "#999999",
    fontFamily: "Inter, system-ui, sans-serif",
    textAlign: "center",
    originX: "center",
    originY: "center",
    width: width - 20,
    selectable: false,
  });

  // Create group with custom property
  const placeholderGroup = new Group([background, cameraIcon, labelText], {
    left: left,
    top: top,
    selectable: true,
    hasControls: true,
  });

  // Add custom property to identify as image placeholder
  (placeholderGroup as any).isImagePlaceholder = true;
  (placeholderGroup as any).placeholderLabel = label;

  return placeholderGroup;
};

export const useImagePlaceholder = () => {
  const { canvas } = useCanvas();

  const addImagePlaceholder = (options?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    label?: string;
  }) => {
    if (!canvas) {
      toast.error("Canvas not initialized");
      return;
    }

    const placeholder = createImagePlaceholder(canvas, options);
    canvas.add(placeholder);
    canvas.setActiveObject(placeholder);
    canvas.requestRenderAll();

    toast.success("Image placeholder added. Double-click to add image.");
  };

  return { addImagePlaceholder };
};
