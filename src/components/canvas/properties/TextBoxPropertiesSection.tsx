import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Canvas, FabricObject } from "fabric";
import { getTextBoxData, updateTextBox } from "@/lib/textBoxTool";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TextboxIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface TextBoxPropertiesSectionProps {
  selectedObject: FabricObject | null;
  canvas: Canvas | null;
}

/**
 * Section for text box specific properties
 * Controls: text content, dimensions, padding, border width
 */
export const TextBoxPropertiesSection = ({
  selectedObject,
  canvas,
}: TextBoxPropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-text-box'] ?? true);

  if (!selectedObject) return null;

  const textBoxData = getTextBoxData(selectedObject);

  return (
    <div id="section-text-box" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-text-box')}
      >
        <div className="flex items-center gap-2">
          <TextboxIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Text Box
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
          <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Text Content</Label>
          <Textarea
            value={textBoxData.text}
            onChange={(e) => {
              if (!canvas) return;
              try {
                updateTextBox(selectedObject as any, {
                  text: e.target.value,
                });
                canvas.requestRenderAll();
              } catch (error) {
                console.error("Failed to update text:", error);
              }
            }}
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">
              Width: {Math.round(textBoxData.width)}px
            </Label>
            <Slider
              value={[textBoxData.width]}
              onValueChange={([value]) => {
                if (!canvas) return;
                try {
                  updateTextBox(selectedObject as any, {
                    width: value,
                  });
                  canvas.requestRenderAll();
                } catch (error) {
                  console.error("Failed to update width:", error);
                }
              }}
              min={150}
              max={800}
              step={10}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">
              Height: {Math.round(textBoxData.height)}px
            </Label>
            <Slider
              value={[textBoxData.height]}
              onValueChange={([value]) => {
                if (!canvas) return;
                try {
                  updateTextBox(selectedObject as any, {
                    height: value,
                  });
                  canvas.requestRenderAll();
                } catch (error) {
                  console.error("Failed to update height:", error);
                }
              }}
              min={80}
              max={600}
              step={10}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Padding: {textBoxData.padding}px</Label>
          <Slider
            value={[textBoxData.padding]}
            onValueChange={([value]) => {
              if (!canvas) return;
              try {
                updateTextBox(selectedObject as any, {
                  padding: value,
                });
                canvas.requestRenderAll();
              } catch (error) {
                console.error("Failed to update padding:", error);
              }
            }}
            min={5}
            max={50}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            Border Width: {textBoxData.borderWidth}px
          </Label>
          <Slider
            value={[textBoxData.borderWidth]}
            onValueChange={([value]) => {
              if (!canvas) return;
              try {
                updateTextBox(selectedObject as any, {
                  borderWidth: value,
                });
                canvas.requestRenderAll();
              } catch (error) {
                console.error("Failed to update border width:", error);
              }
            }}
            min={0}
            max={5}
            step={0.5}
          />
        </div>
          </div>
        </div>
      )}
    </div>
  );
};
