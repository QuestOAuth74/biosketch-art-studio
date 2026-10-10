import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { useCommunityDownloads } from "@/hooks/useCommunityDownloads";
import { useCanvas } from "@/contexts/CanvasContext";
import { DownloadQuotaBanner } from "./DownloadQuotaBanner";
import { toast } from "sonner";
import { ExportDialogTestIds } from "@/lib/test-ids";

const EXPORT_PRESETS = [
  {
    name: "Web",
    format: 'png' as const,
    dpi: 150 as const,
    description: "Websites & presentations"
  },
  {
    name: "Print",
    format: 'png' as const,
    dpi: 300 as const,
    description: "Professional printing"
  },
  {
    name: "Publication",
    format: 'png' as const,
    dpi: 600 as const,
    description: "Magazine quality"
  },
  {
    name: "Transparent",
    format: 'png-transparent' as const,
    dpi: 300 as const,
    description: "No background"
  },
  {
    name: "SVG",
    format: 'svg' as const,
    dpi: 300 as const,
    description: "Vector graphics"
  },
  {
    name: "PDF",
    format: 'pdf' as const,
    dpi: 300 as const,
    description: "Print-ready"
  },
  {
    name: "PowerPoint",
    format: 'pptx' as const,
    dpi: 300 as const,
    description: "Editable slides"
  },
];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: 'png' | 'png-transparent' | 'jpg' | 'svg' | 'pdf' | 'pptx', dpi: 150 | 300 | 600, selectionOnly?: boolean, pdfOptions?: { cmykMode?: boolean }) => void;
  canvasWidth: number;
  canvasHeight: number;
  hasSelection: boolean;
}

export const ExportDialog = ({ open, onOpenChange, onExport, canvasWidth, canvasHeight, hasSelection }: ExportDialogProps) => {
  const { currentProjectId } = useCanvas();
  const { quota, checkOwnership, recordDownload } = useCommunityDownloads();
  const [format, setFormat] = useState<'png' | 'png-transparent' | 'jpg' | 'svg' | 'pdf' | 'pptx'>('png');
  const [dpi, setDpi] = useState<150 | 300 | 600>(300);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [cmykMode, setCmykMode] = useState(false);
  const [isOwnProject, setIsOwnProject] = useState<boolean | null>(null);

  // Load preferences when dialog opens
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('export_preferences');
      if (saved) {
        try {
          const prefs = JSON.parse(saved);
          if (prefs.format) setFormat(prefs.format);
          if (prefs.dpi) setDpi(prefs.dpi);
          if (prefs.cmykMode !== undefined) setCmykMode(prefs.cmykMode);
        } catch (e) {
          console.error('Failed to load export preferences:', e);
        }
      }
    }
  }, [open]);

  // Check project ownership separately
  useEffect(() => {
    if (open && currentProjectId) {
      checkOwnership(currentProjectId).then(setIsOwnProject);
    }
  }, [open, currentProjectId, checkOwnership]);

  // Calculate export dimensions based on DPI
  const calculateDimensions = (targetDpi: number) => {
    const multiplier = targetDpi / 300;
    return {
      width: Math.round(canvasWidth * multiplier),
      height: Math.round(canvasHeight * multiplier)
    };
  };

  // Estimate file size based on dimensions and format
  const estimateFileSize = (width: number, height: number, fmt: string) => {
    // Vector formats have different size characteristics
    if (fmt === 'svg' || fmt === 'pdf') {
      return "~50-500 KB";
    }

    const pixels = width * height;
    const bytesPerPixel = fmt === 'jpg' ? 0.5 : 3;
    const estimatedBytes = pixels * bytesPerPixel;

    if (estimatedBytes < 1024 * 1024) {
      return `~${Math.round(estimatedBytes / 1024)} KB`;
    }
    return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVectorFormat = format === 'svg' || format === 'pdf';
  const dimensions = calculateDimensions(dpi);
  const fileSize = estimateFileSize(dimensions.width, dimensions.height, format);

  const handleExport = async () => {
    // If it's a community project (not owned by user), check quota
    if (isOwnProject === false) {
      if (!quota.canDownload) {
        toast.error(
          quota.projectsUntilUnlimited > 0
            ? `Download limit reached. Share ${quota.projectsUntilUnlimited} more project${quota.projectsUntilUnlimited !== 1 ? 's' : ''} to unlock unlimited downloads!`
            : 'Download limit reached. Share 3 projects to unlock unlimited downloads!'
        );
        return;
      }

      // Record the download
      if (currentProjectId) {
        recordDownload({ projectId: currentProjectId, format });
      }
    }

    // Save preferences to localStorage
    localStorage.setItem('export_preferences', JSON.stringify({ format, dpi, cmykMode }));

    // Call onExport with appropriate parameters
    if (format === 'pdf') {
      onExport(format, dpi, selectionOnly, { cmykMode });
    } else {
      onExport(format, dpi, selectionOnly);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col" data-testid={ExportDialogTestIds.DIALOG}>
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Choose your export format and quality settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
          {/* Community Download Quota Banner */}
          {isOwnProject === false && (
            <DownloadQuotaBanner quota={quota} />
          )}

          {/* Export Presets - Grid Layout */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Quick Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_PRESETS.map(preset => (
                <Button
                  key={preset.name}
                  type="button"
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-start text-left hover:bg-accent"
                  onClick={() => {
                    setFormat(preset.format);
                    setDpi(preset.dpi);
                  }}
                >
                  <span className="font-medium text-sm">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Selection Only Option */}
          {hasSelection && (
            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-accent/50">
              <Checkbox
                id="selection-only"
                checked={selectionOnly}
                onCheckedChange={(checked) => setSelectionOnly(checked as boolean)}
              />
              <Label htmlFor="selection-only" className="text-sm font-medium cursor-pointer">
                Export selected objects only
              </Label>
            </div>
          )}

          {/* Format Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => {
                setFormat(value as typeof format);
              }}
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="png" id="png" data-testid={ExportDialogTestIds.FORMAT_PNG} />
                <Label htmlFor="png" className="cursor-pointer flex-1">
                  <span className="font-medium">PNG</span>
                  <p className="text-sm text-muted-foreground">Lossless quality with background</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="png-transparent" id="png-transparent" />
                <Label htmlFor="png-transparent" className="cursor-pointer flex-1">
                  <span className="font-medium">PNG (Transparent)</span>
                  <p className="text-sm text-muted-foreground">Lossless quality, no background</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="jpg" id="jpg" data-testid={ExportDialogTestIds.FORMAT_JPEG} />
                <Label htmlFor="jpg" className="cursor-pointer flex-1">
                  <span className="font-medium">JPG</span>
                  <p className="text-sm text-muted-foreground">Smaller file size, no transparency</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="svg" id="svg" data-testid={ExportDialogTestIds.FORMAT_SVG} />
                <Label htmlFor="svg" className="cursor-pointer flex-1">
                  <span className="font-medium">SVG</span>
                  <p className="text-sm text-muted-foreground">Scalable vector graphics</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="pdf" id="pdf" data-testid={ExportDialogTestIds.FORMAT_PDF} />
                <Label htmlFor="pdf" className="cursor-pointer flex-1">
                  <span className="font-medium">PDF</span>
                  <p className="text-sm text-muted-foreground">Vector PDF with optional CMYK</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <RadioGroupItem value="pptx" id="pptx" />
                <Label htmlFor="pptx" className="cursor-pointer flex-1">
                  <span className="font-medium">PowerPoint</span>
                  <p className="text-sm text-muted-foreground">Ready for presentations</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* DPI Selection - Hidden for vector formats */}
          {!isVectorFormat && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quality (DPI)</Label>
              <RadioGroup
                value={dpi.toString()}
                onValueChange={(value) => {
                  setDpi(parseInt(value) as typeof dpi);
                }}
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <RadioGroupItem value="150" id="dpi-150" data-testid={ExportDialogTestIds.DPI_150} />
                  <Label htmlFor="dpi-150" className="cursor-pointer flex-1">
                    <span className="font-medium">150 DPI - Screen & Web</span>
                    <p className="text-sm text-muted-foreground">Perfect for digital viewing, smaller files</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <RadioGroupItem value="300" id="dpi-300" data-testid={ExportDialogTestIds.DPI_300} />
                  <Label htmlFor="dpi-300" className="cursor-pointer flex-1">
                    <span className="font-medium">300 DPI - Print Quality</span>
                    <p className="text-sm text-muted-foreground">Recommended for publications and printing</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <RadioGroupItem value="600" id="dpi-600" data-testid={ExportDialogTestIds.DPI_600} />
                  <Label htmlFor="dpi-600" className="cursor-pointer flex-1">
                    <span className="font-medium">600 DPI - Professional</span>
                    <p className="text-sm text-muted-foreground">Large format printing, largest files</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* PDF-Specific Options */}
          {format === 'pdf' && (
            <div className="space-y-3 p-3 rounded-lg border bg-accent/10">
              <Label className="text-sm font-semibold">PDF Options</Label>

              {/* CMYK Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cmyk-mode"
                  checked={cmykMode}
                  onCheckedChange={(checked) => setCmykMode(checked as boolean)}
                  data-testid={ExportDialogTestIds.CMYK_MODE_TOGGLE}
                />
                <Label htmlFor="cmyk-mode" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">CMYK Color Mode</span>
                  <p className="text-sm text-muted-foreground">Simulates print colors (reduces vibrancy)</p>
                </Label>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">Export Preview</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Format:</span>
                <p className="font-medium">{format.toUpperCase()}</p>
              </div>
              {!isVectorFormat && (
                <div>
                  <span className="text-muted-foreground">Quality:</span>
                  <p className="font-medium">{dpi} DPI</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Dimensions:</span>
                <p className="font-medium">
                  {isVectorFormat
                    ? `${canvasWidth} × ${canvasHeight}`
                    : `${dimensions.width} × ${dimensions.height}`} px
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Est. file size:</span>
                <p className="font-medium">{fileSize}</p>
              </div>
              {format === 'pdf' && (
                <div>
                  <span className="text-muted-foreground">CMYK Mode:</span>
                  <p className="font-medium">{cmykMode ? 'Enabled' : 'Disabled'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid={ExportDialogTestIds.CANCEL_BUTTON}>
            Cancel
          </Button>
          <Button onClick={handleExport} data-testid={ExportDialogTestIds.EXPORT_BUTTON}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
