import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Film, Image, Video, FileJson } from "lucide-react";
import { toast } from "sonner";
import { useAnimation } from "@/contexts/AnimationContext";
import {
  exportAnimation,
  type ExportFormat,
  type ExportQuality,
} from "@/lib/animationExport";

interface AnimateExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: typeof Film;
}[] = [
  {
    value: "gif",
    label: "GIF",
    description: "Animated GIF, works everywhere",
    icon: Image,
  },
  {
    value: "webm",
    label: "WebM Video",
    description: "High quality video (Chrome/Firefox)",
    icon: Video,
  },
  {
    value: "png-sequence",
    label: "PNG Sequence",
    description: "Individual frames as PNG files",
    icon: Film,
  },
  {
    value: "lottie",
    label: "Lottie JSON",
    description: "Motion data for web/After Effects",
    icon: FileJson,
  },
];

const QUALITY_OPTIONS: {
  value: ExportQuality;
  label: string;
  description: string;
}[] = [
  { value: "low", label: "Low", description: "0.5x — fast, small file" },
  { value: "medium", label: "Medium", description: "1x — balanced" },
  { value: "high", label: "High", description: "2x — best quality" },
];

export function AnimateExportDialog({
  open,
  onOpenChange,
}: AnimateExportDialogProps) {
  const { animProject, fabricCanvasRef, objectMapRef, sourceProject } =
    useAnimation();

  const [format, setFormat] = useState<ExportFormat>("gif");
  const [quality, setQuality] = useState<ExportQuality>("medium");
  const [transparentBg, setTransparentBg] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    if (!animProject || !fabricCanvasRef.current || !sourceProject) return;

    setExporting(true);
    setProgress(0);

    try {
      await exportAnimation(
        {
          fabricCanvas: fabricCanvasRef.current,
          animProject,
          objectMap: objectMapRef.current,
          projectName: sourceProject.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
          nativeWidth: sourceProject.canvas_width,
          nativeHeight: sourceProject.canvas_height,
        },
        {
          format,
          quality,
          transparentBg,
          onProgress: setProgress,
        }
      );

      toast.success(`Exported as ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  // Estimate file info
  const estimateInfo = () => {
    if (!animProject || !sourceProject) return null;
    const scales = { low: 0.5, medium: 1, high: 2 };
    const scale = scales[quality];
    const w = Math.round(sourceProject.canvas_width * scale);
    const h = Math.round(sourceProject.canvas_height * scale);
    return {
      resolution: `${w} x ${h}`,
      frames: animProject.totalFrames,
      duration: `${animProject.duration}s`,
    };
  };

  const info = estimateInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Export Animation
              </DialogTitle>
              <DialogDescription className="text-sm">
                Render your animation as a downloadable file
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Format */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <div className="grid grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                      format === opt.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-border/80 hover:bg-muted/30 text-muted-foreground"
                    }`}
                    onClick={() => setFormat(opt.value)}
                    disabled={exporting}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {FORMAT_OPTIONS.find((o) => o.value === format)?.description}
            </p>
          </div>

          {/* Quality */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quality</label>
            <Select
              value={quality}
              onValueChange={(v) => setQuality(v as ExportQuality)}
              disabled={exporting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {opt.label}
                      <span className="text-muted-foreground text-xs">
                        {opt.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transparent Background */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Transparent Background</label>
              <p className="text-[13px] text-muted-foreground">Remove background color during export</p>
            </div>
            <button
              onClick={() => setTransparentBg(!transparentBg)}
              disabled={exporting}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                transparentBg ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  transparentBg ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Info */}
          {info && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <span>{info.resolution}</span>
              <span>{info.frames} frames</span>
              <span>{info.duration}</span>
            </div>
          )}

          {/* Progress */}
          {exporting && (
            <div className="space-y-1.5">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[13px] text-muted-foreground text-center">
                Rendering... {progress}%
              </p>
            </div>
          )}

          {/* Export button */}
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={exporting || !animProject}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
