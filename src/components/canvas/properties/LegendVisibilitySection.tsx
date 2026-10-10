import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Canvas } from "fabric";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NumberCircleOneIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface LegendVisibilitySectionProps {
  canvas: Canvas | null;
  showLegend: boolean;
  setShowLegend: (show: boolean) => void;
}

/**
 * Section for controlling callout legend visibility
 */
export const LegendVisibilitySection = ({
  canvas,
  showLegend,
  setShowLegend,
}: LegendVisibilitySectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-legend'] ?? false);

  return (
    <div id="section-legend" className="relative">
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-legend')}
      >
        <div className="flex items-center gap-2">
          <NumberCircleOneIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Legend
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2 w-full">
            <Label className="text-sm flex-shrink-0">Show Legend</Label>
            <Switch
              checked={showLegend}
              onCheckedChange={(checked) => {
                setShowLegend(checked);
                const legend = canvas
                  ?.getObjects()
                  .find((obj) => (obj as any).customType === "callout-legend");
                if (canvas) {
                  // Store the preference on the canvas itself
                  (canvas as any).legendHidden = !checked;

                  if (legend) {
                    // Set visibility and hidden flag on the legend object
                    legend.set({ visible: checked });
                    (legend as any).legendHidden = !checked;
                    // Use renderAll() instead of requestRenderAll() to avoid triggering events
                    canvas.requestRenderAll();
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
