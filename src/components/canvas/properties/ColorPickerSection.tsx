import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { AdvancedColorPickerV2 } from "../AdvancedColorPickerV2";

interface ColorPickerSectionProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  recentColors?: string[];
  palette?: string[];
  showHex?: boolean;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

const DEFAULT_PALETTE = [
  "#3b82f6", "#0D9488", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
  "#ffffff", "#000000", "#6b7280", "#f3f4f6",
];

export const ColorPickerSection = ({
  label,
  value,
  onChange,
  recentColors = [],
  palette = DEFAULT_PALETTE,
  showHex = true,
  showOpacity = false,
  opacity = 100,
  onOpacityChange,
}: ColorPickerSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2 w-full overflow-hidden">
      <Label className="text-xs font-medium">{label}</Label>

      {/* Quick Color Grid */}
      <div className="grid grid-cols-6 gap-1.5 w-full">
        {palette.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className="w-full aspect-square rounded border-2 hover:scale-110 transition-all duration-200"
            style={{
              backgroundColor: color,
              borderColor: value === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
            }}
            title={color}
          />
        ))}
      </div>

      {/* Advanced Picker Popover */}
      <div style={{ maxWidth: '190px', width: '100%' }}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-8 justify-between text-xs"
              style={{ width: '100%' }}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className="w-5 h-5 rounded border border-border shadow-inner flex-shrink-0"
                  style={{ backgroundColor: typeof value === 'string' ? value : '#888888' }}
                />
                <span className="font-mono text-muted-foreground truncate">
                  {typeof value === 'string' ? value : 'Gradient'}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-3"
            side="left"
            align="start"
            sideOffset={8}
          >
            <AdvancedColorPickerV2
              value={value}
              onChange={(color) => {
                onChange(color);
              }}
              recentColors={recentColors}
              showOpacity={showOpacity}
              opacity={opacity}
              onOpacityChange={onOpacityChange}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Recent</Label>
          <div className="flex gap-1 flex-wrap">
            {recentColors.slice(0, 8).map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                onClick={() => onChange(color)}
                className="h-6 w-6 rounded border-2 hover:scale-110 transition-all duration-200"
                style={{ 
                  backgroundColor: color,
                  borderColor: value === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
