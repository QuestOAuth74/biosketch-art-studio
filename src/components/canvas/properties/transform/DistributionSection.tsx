import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  StretchHorizontal,
  StretchVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Canvas } from "fabric";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface DistributionSectionProps {
  canvas: Canvas | null;
  distributionSpacing: number | "";
  setDistributionSpacing: (value: number | "") => void;
  onDistributeHorizontally: () => void;
  onDistributeVertically: () => void;
  onMatchWidth: () => void;
  onMatchHeight: () => void;
  stickyOffset?: number;
}

/**
 * Distribution and match controls with collapsible header
 */
export const DistributionSection = ({
  canvas,
  distributionSpacing,
  setDistributionSpacing,
  onDistributeHorizontally,
  onDistributeVertically,
  onMatchWidth,
  onMatchHeight,
  stickyOffset = 0,
}: DistributionSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-distribution'] ?? true);
  const activeObjects = canvas?.getActiveObjects() || [];
  const canDistribute = activeObjects.length >= 3;
  const canMatch = activeObjects.length >= 2;

  return (
    <div id="section-distribution" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-distribution')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Distribution
        </h3>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3 space-y-3">
          {/* Distribute buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onDistributeHorizontally}
                  disabled={!canDistribute}
                >
                  <AlignHorizontalSpaceBetween className="h-3.5 w-3.5 mr-1" />
                  Dist H
                </Button>
              </TooltipTrigger>
              <TooltipContent>Distribute horizontally (⌘⇧H)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onDistributeVertically}
                  disabled={!canDistribute}
                >
                  <AlignVerticalSpaceBetween className="h-3.5 w-3.5 mr-1" />
                  Dist V
                </Button>
              </TooltipTrigger>
              <TooltipContent>Distribute vertically (⌘⌥V)</TooltipContent>
            </Tooltip>
          </div>

          {/* Match buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onMatchWidth}
                  disabled={!canMatch}
                >
                  <StretchHorizontal className="h-3.5 w-3.5 mr-1" />
                  Match W
                </Button>
              </TooltipTrigger>
              <TooltipContent>Match width (⌘⇧W)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onMatchHeight}
                  disabled={!canMatch}
                >
                  <StretchVertical className="h-3.5 w-3.5 mr-1" />
                  Match H
                </Button>
              </TooltipTrigger>
              <TooltipContent>Match height (⌘⇧E)</TooltipContent>
            </Tooltip>
          </div>

          {/* Spacing input */}
          <div className="space-y-1">
            <Label className="text-xs">Spacing</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={distributionSpacing}
                onChange={(e) =>
                  setDistributionSpacing(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="20"
                min="0"
                disabled={!canMatch}
                className="h-8 text-xs flex-1"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Set exact spacing for distribution
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
