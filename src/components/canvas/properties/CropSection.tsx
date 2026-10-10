import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Square, Circle, Pentagon, RectangleHorizontal } from "lucide-react";
import { CropIcon, ImageIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { CropMode } from "@/types/effects";
import { CropTestIds } from "@/lib/test-ids";

interface CropSectionProps {
  selectedObject: any;
  setCropMode: (mode: CropMode) => void;
  resetCrop?: () => void;
}

function hasCrop(obj: any): boolean {
  return !!(obj?.clipPath) || !!(obj?.cropConfig);
}

export const CropSection = ({ selectedObject, setCropMode, resetCrop }: CropSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const cropCollapsed = useSectionCollapseStore((state) => state.sections['section-crop'] ?? true);

  return (
    <div id="section-crop" className="relative">
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-crop')}
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Crop
          </h3>
        </div>
        {cropCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>
      {!cropCollapsed && (
        <div className="px-3 pb-3 pt-3 space-y-2">
          {selectedObject && hasCrop(selectedObject) ? (
            <>
              <Button
                data-testid={CropTestIds.EDIT_CROP_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => {
                  const cropConfig = (selectedObject as any).cropConfig;
                  const mode = cropConfig?.type || 'square';
                  setCropMode(mode as CropMode);
                }}
                className="w-full gap-2"
              >
                <CropIcon style={{ width: 16, height: 16 }} weight="regular" />
                Edit Crop
              </Button>
              <Button
                data-testid={CropTestIds.RESET_CROP_BUTTON}
                variant="outline"
                size="sm"
                onClick={resetCrop}
                className="w-full gap-2"
              >
                Reset to Original
              </Button>
            </>
          ) : (
            <>
              <Button
                data-testid={CropTestIds.CROP_RECTANGLE_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => setCropMode('rectangle')}
                className="w-full gap-2"
              >
                <RectangleHorizontal className="h-4 w-4" />
                Rectangle
              </Button>
              <Button
                data-testid={CropTestIds.CROP_SQUARE_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => setCropMode('square')}
                className="w-full gap-2"
              >
                <Square className="h-4 w-4" />
                Square (1:1)
              </Button>
              <Button
                data-testid={CropTestIds.CROP_ELLIPSE_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => setCropMode('ellipse')}
                className="w-full gap-2"
              >
                <Circle className="h-4 w-4" style={{ transform: 'scaleX(1.4)' }} />
                Ellipse
              </Button>
              <Button
                data-testid={CropTestIds.CROP_CIRCLE_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => setCropMode('circle')}
                className="w-full gap-2"
              >
                <Circle className="h-4 w-4" />
                Circle (1:1)
              </Button>
              <Button
                data-testid={CropTestIds.CROP_FREEFORM_BUTTON}
                variant="outline"
                size="sm"
                onClick={() => setCropMode('freeform')}
                className="w-full gap-2"
              >
                <Pentagon className="h-4 w-4" />
                Free-Form
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
