import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCanvas } from "@/contexts/CanvasContext";
import { CanvasEditorTestIds } from "@/lib/test-ids";

export const ZoomControlPopover = () => {
  const { zoom, setCustomZoom } = useCanvas();
  const [customValue, setCustomValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const presets = [25, 50, 75, 100, 150, 200, 400];

  const handlePresetClick = (value: number) => {
    setCustomZoom(value);
    setIsOpen(false);
    setCustomValue("");
  };

  const handleCustomZoom = () => {
    if (!customValue.trim()) return;

    const value = parseInt(customValue);
    if (isNaN(value) || value < 10 || value > 400) {
      return;
    }
    setCustomZoom(value);
    setIsOpen(false);
    setCustomValue("");
  };

  const handleInputChange = (value: string) => {
    setCustomValue(value);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-xs font-medium px-2 py-1 bg-muted/50 rounded min-w-[3rem] text-center text-foreground cursor-pointer hover:bg-muted transition-colors"
          data-testid={CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON}
        >
          {zoom}%
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-28 p-2"
        align="center"
        data-testid={CanvasEditorTestIds.ZOOM_POPOVER}
      >
        <div className="space-y-1">
          {/* Presets - One column */}
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              data-testid={`canvas-editor-zoom-preset-${preset}`}
              className={`w-full text-center px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors ${
                zoom === preset ? "bg-accent font-medium" : ""
              }`}
            >
              {preset}%
            </button>
          ))}

          {/* Custom Zoom - Separator */}
          <div className="border-t my-2" />

          {/* Custom Zoom Input */}
          <div className="px-1">
            <Input
              type="number"
              placeholder="Custom"
              value={customValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomZoom()}
              onBlur={handleCustomZoom}
              data-testid={CanvasEditorTestIds.ZOOM_CUSTOM_INPUT}
              className="h-8 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
