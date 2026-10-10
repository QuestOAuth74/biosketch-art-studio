import { Button } from "@/components/ui/button";
import { Canvas, FabricObject } from "fabric";
import { createMaskedImage } from "@/lib/imageMaskTool";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ImageIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface ShapeMaskingSectionProps {
  selectedObject: FabricObject | null;
  canvas: Canvas | null;
}

/**
 * Section for adding image as mask to standalone shapes
 * Allows uploading an image to display inside a shape
 */
export const ShapeMaskingSection = ({
  selectedObject,
  canvas,
}: ShapeMaskingSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-image-masking'] ?? true);

  if (!selectedObject || !canvas) return null;

  return (
    <div id="section-image-masking" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-image-masking')}
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Image Masking
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
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            if (e.target.files?.[0] && canvas) {
              const group = await createMaskedImage(
                canvas,
                selectedObject,
                e.target.files[0]
              );
              if (group) {
                canvas.remove(selectedObject);
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.requestRenderAll();
                toast.success("Image mask created!");
              }
              // Reset file input
              e.target.value = "";
            }
          }}
          className="hidden"
          id="mask-image-upload"
        />
        <Button asChild variant="outline" className="w-full" size="sm">
          <label htmlFor="mask-image-upload" className="cursor-pointer">
            Add Image as Mask
          </label>
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Upload an image to display inside this shape
        </p>
        </div>
      )}
    </div>
  );
};
