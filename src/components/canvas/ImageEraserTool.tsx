import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { FabricImage } from "fabric";
import { Check, Eraser, Undo, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ImageEraserToolProps {
  image: FabricImage;
  onComplete: (newImageDataUrl: string) => void;
  onCancel: () => void;
}

export const ImageEraserTool = ({
  image,
  onComplete,
  onCancel,
}: ImageEraserToolProps) => {
  const [brushSize, setBrushSize] = useState(20);
  const [isErasing, setIsErasing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;

    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const overlayCtx = overlay.getContext("2d");

    if (!ctx || !overlayCtx) return;
    ctxRef.current = ctx;

    const imageElement = image.getElement() as HTMLImageElement;

    // Set canvas size to match image
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    overlay.width = imageElement.naturalWidth;
    overlay.height = imageElement.naturalHeight;

    // Draw image
    ctx.drawImage(imageElement, 0, 0);

    // Save initial state
    setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }, [image]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsErasing(true);
    erase(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;

    const overlay = overlayRef.current;
    const overlayCtx = overlay.getContext("2d");
    if (!overlayCtx) return;

    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Clear and draw cursor
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    overlayCtx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();

    if (isErasing) {
      erase(e);
    }
  };

  const handleMouseUp = () => {
    if (isErasing && canvasRef.current && ctxRef.current) {
      // Save state for undo
      const canvas = canvasRef.current;
      const imageData = ctxRef.current.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );
      setHistory((prev) => [...prev, imageData]);
      setIsErasing(false);
    }
  };

  const erase = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Get current image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Erase in a circle
    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > brushSize) continue;

        const px = Math.floor(x + dx);
        const py = Math.floor(y + dy);

        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height)
          continue;

        const index = (py * canvas.width + px) * 4;

        // Feather edges for smoother erasing
        const alpha = 1 - distance / brushSize;
        data[index + 3] = Math.max(0, data[index + 3] * (1 - alpha));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const handleUndo = () => {
    if (history.length <= 1 || !canvasRef.current || !ctxRef.current) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];

    ctxRef.current.putImageData(previousState, 0, 0);
    setHistory(newHistory);
    toast.success("Undo successful");
  };

  const handleComplete = () => {
    if (!canvasRef.current) return;

    const dataUrl = canvasRef.current.toDataURL("image/png");
    onComplete(dataUrl);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eraser className="w-5 h-5" />
          <h3 className="font-semibold">Manual Eraser</h3>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={history.length <= 1}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Brush Size: {brushSize}px</label>
        <Slider
          value={[brushSize]}
          onValueChange={(value) => setBrushSize(value[0])}
          min={5}
          max={100}
          step={5}
        />
      </div>

      <div
        className="relative border rounded-lg overflow-auto bg-checkered flex justify-center items-center"
        style={{ minHeight: "500px", maxHeight: "70vh" }}
      >
        <div className="relative inline-block max-w-full">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 max-w-full h-auto pointer-events-none"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Click and drag to erase parts of the image. The background will become
        transparent.
      </p>

      <style>{`
        .bg-checkered {
          background-image: 
            linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
            linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </Card>
  );
};
