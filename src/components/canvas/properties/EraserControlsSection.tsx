import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EraserIcon } from "@phosphor-icons/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface EraserControlsSectionProps {
  eraserWidth: number;
  handleEraserWidthChange: (value: number[]) => void;
}

/**
 * Section for eraser tool controls
 */
export const EraserControlsSection = ({
  eraserWidth,
  handleEraserWidthChange,
}: EraserControlsSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-eraser'] ?? false);

  return (
    <div id="section-eraser" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-eraser')}
      >
        <div className="flex items-center gap-2">
          <EraserIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Eraser
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Eraser Size</Label>
          <span className="text-xs font-mono text-muted-foreground">
            {eraserWidth}px
          </span>
        </div>
        <Slider
          value={[eraserWidth]}
          onValueChange={handleEraserWidthChange}
          min={5}
          max={100}
          step={1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Adjust the size of the eraser brush
        </p>
          </div>
        </div>
      )}
    </div>
  );
};
