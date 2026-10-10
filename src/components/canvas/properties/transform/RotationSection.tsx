import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FlipHorizontal, FlipVertical, RotateCw, ChevronDown, ChevronRight } from "lucide-react";
import { FabricObject } from "fabric";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface RotationSectionProps {
  selectedObject: FabricObject | null;
  rotation: number;
  setRotation: (value: number) => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  stickyOffset?: number;
}

/**
 * Rotation and flip controls with collapsible header
 */
export const RotationSection = ({
  selectedObject,
  rotation,
  setRotation,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  stickyOffset = 0,
}: RotationSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-rotation'] ?? true);

  return (
    <div id="section-rotation" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-rotation')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Rotation
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
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onFlipHorizontal}
              disabled={!selectedObject}
            >
              <FlipHorizontal className="h-3.5 w-3.5 mr-1" />
              Flip H
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onFlipVertical}
              disabled={!selectedObject}
            >
              <FlipVertical className="h-3.5 w-3.5 mr-1" />
              Flip V
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rotation</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                disabled={!selectedObject}
                className="h-7 flex-1 text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onRotate}
                disabled={!selectedObject}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
