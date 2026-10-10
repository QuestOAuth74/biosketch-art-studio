import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Canvas, Path } from "fabric";
import { BezierPoint } from "@/types/bezier";
import {
  simplifyBezierPath,
  rebuildPathFromBezierPoints,
  estimateSimplifiedPointCount
} from "@/lib/bezierPathSimplification";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScribbleIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface BezierSimplificationPanelProps {
  path: Path & {
    bezierPoints?: BezierPoint[];
    isPinned?: boolean;
  };
  canvas: Canvas | null;
}

export const BezierSimplificationPanel = ({
  path,
  canvas
}: BezierSimplificationPanelProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-path-simplification'] ?? true);

  const [tolerance, setTolerance] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current point count
  const bezierPoints = path?.bezierPoints || [];
  const currentPointCount = bezierPoints.length;

  // Calculate estimated point count after simplification
  const [estimatedCount, setEstimatedCount] = useState(currentPointCount);

  useEffect(() => {
    if (bezierPoints.length > 0) {
      const estimated = estimateSimplifiedPointCount(bezierPoints, tolerance);
      setEstimatedCount(estimated);
    }
  }, [tolerance, bezierPoints.length]);

  // Check if simplification is possible
  const canSimplify = currentPointCount > 3 && !path?.isPinned;

  // Handler for simplify button
  const handleSimplify = () => {
    if (!canvas || !path || !canSimplify) return;

    setIsProcessing(true);

    try {
      // Get original points
      const originalPoints = path.bezierPoints as BezierPoint[];
      if (!originalPoints || originalPoints.length <= 3) {
        toast.error("Path must have more than 3 points to simplify");
        return;
      }

      const originalCount = originalPoints.length;

      // Simplify
      const simplifiedPoints = simplifyBezierPath(originalPoints, tolerance);

      // Validate minimum points
      if (simplifiedPoints.length < 3) {
        toast.error("Cannot simplify further - minimum 3 points required");
        return;
      }

      // Check if anything changed
      if (simplifiedPoints.length === originalCount) {
        toast.info("Path already optimized - no points to remove at this tolerance");
        return;
      }

      // Fire modification event for history
      canvas.fire('object:modified', { target: path });

      // Update bezier points
      (path as any).bezierPoints = simplifiedPoints;

      // Rebuild path geometry
      rebuildPathFromBezierPoints(path, simplifiedPoints);

      canvas.requestRenderAll();

      // Show success message
      toast.success(`Path simplified: ${originalCount} → ${simplifiedPoints.length} points`);
    } catch (error) {
      toast.error("Failed to simplify path");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="section-path-simplification" className="relative">
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-path-simplification')}
      >
        <div className="flex items-center gap-2">
          <ScribbleIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Path Simplification
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="space-y-4">
            {/* Info display */}
            <div className="p-2 bg-accent/10 rounded border border-border/30">
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Current points:</span>
                  <span className="font-mono font-semibold">{currentPointCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Estimated result:</span>
                  <span className="font-mono font-semibold">~{estimatedCount}</span>
                </div>
              </div>
            </div>

            {/* Tolerance slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Simplification Strength</Label>
                <span className="text-xs font-mono text-muted-foreground">{tolerance}</span>
              </div>
              <Slider
                value={[tolerance]}
                onValueChange={([v]) => setTolerance(v)}
                min={0}
                max={100}
                step={1}
                disabled={!canSimplify || isProcessing}
                className="w-full"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Gentle</span>
                <span>Moderate</span>
                <span>Aggressive</span>
              </div>
            </div>

            {/* Action button */}
            <Button
              onClick={handleSimplify}
              disabled={!canSimplify || isProcessing}
              className="w-full h-8 text-xs"
              variant="default"
            >
              {isProcessing ? "Processing..." : "Simplify Path"}
            </Button>

            {/* Warning messages */}
            {currentPointCount <= 3 && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-700 dark:text-yellow-400">
                Path must have more than 3 points to simplify
              </div>
            )}

            {path?.isPinned && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-700 dark:text-yellow-400">
                Cannot simplify pinned paths
              </div>
            )}

            {/* Help text */}
            <div className="text-xs text-muted-foreground leading-relaxed">
              Remove anchor points while preserving the curve's shape. Corner points are always preserved.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
