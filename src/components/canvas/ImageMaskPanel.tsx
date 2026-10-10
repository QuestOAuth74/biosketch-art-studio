import { useState, useRef } from "react";
import { Group } from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useCanvas } from "@/contexts/CanvasContext";
import {
  enterImageEditMode,
  replaceMaskImage,
  removeMask,
  updateCornerRadius,
} from "@/lib/imageMaskTool";
import { MaskShape } from "@/types/imageMask";
import { Edit, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { ImageIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface ImageMaskPanelProps {
  group: Group;
}

export const ImageMaskPanel = ({ group }: ImageMaskPanelProps) => {
  const {
    canvas,
    setIsImageEditMode,
    imageEditModeRef,
    isImageEditMode,
    exitImageEditMode,
  } = useCanvas();

  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-image-mask'] ?? true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const maskShape = (group as any).maskShape as MaskShape || "rect";
  const [cornerRadius, setCornerRadius] = useState<number>(
    (group as any).cornerRadius || 20
  );

  const handleEditImage = () => {
    if (!canvas) return;
    // Set the ref before entering edit mode
    imageEditModeRef.current = group;
    enterImageEditMode(canvas, group, setIsImageEditMode);
  };

  const handleExitEditMode = () => {
    exitImageEditMode();
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvas || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    await replaceMaskImage(canvas, group, file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCornerRadiusChange = (values: number[]) => {
    if (!canvas) return;
    const newRadius = values[0];
    setCornerRadius(newRadius);
    updateCornerRadius(canvas, group, newRadius);
  };

  const handleRemoveMask = () => {
    if (!canvas) return;
    removeMask(canvas, group);
  };

  // If in edit mode, show edit controls in blue highlighted section
  if (isImageEditMode) {
    return (
      <div id="section-image-mask" className="relative">
        <div
          className="bg-blue-50 border-b border-blue-300 px-3 py-2 cursor-pointer hover:bg-blue-100 flex items-center justify-between"
          onClick={() => toggleSection('section-image-mask')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Editing Masked Image
            </h3>
          </div>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )}
        </div>

        {!isCollapsed && (
          <div className="px-3 pb-3 pt-3 bg-blue-50 border-b border-blue-300">
            <div className="flex gap-2">
              <Button
                onClick={handleExitEditMode}
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Done
              </Button>
              <Button
                onClick={handleExitEditMode}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal mode - show mask controls
  return (
    <div id="section-image-mask" className="relative">
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-image-mask')}
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Image Mask
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3 space-y-2">
          {/* Edit Image Button */}
          <Button
            onClick={handleEditImage}
            disabled={isImageEditMode}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Image
          </Button>

          {/* Replace Image */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplaceImage}
              className="hidden"
              id="replace-mask-image"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <label htmlFor="replace-mask-image" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Replace Image
              </label>
            </Button>
          </div>

          {/* Corner Radius (only for rounded rectangles) */}
          {maskShape === "roundedRect" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Corner Radius</Label>
                <span className="text-xs text-muted-foreground">{cornerRadius}px</span>
              </div>
              <Slider
                value={[cornerRadius]}
                onValueChange={handleCornerRadiusChange}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          )}

          {/* Remove Mask */}
          <Button
            onClick={handleRemoveMask}
            variant="destructive"
            size="sm"
            className="w-full justify-start"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Mask
          </Button>
        </div>
      )}
    </div>
  );
};
