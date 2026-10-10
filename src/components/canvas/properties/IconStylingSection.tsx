import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ColorPickerSection } from "./ColorPickerSection";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

const TONE_PRESETS = [
  { name: "Warm", color: "#f59e0b", emoji: "🌅" },
  { name: "Cool", color: "#06b6d4", emoji: "❄️" },
  { name: "Sepia", color: "#92400e", emoji: "☕" },
  { name: "Vibrant", color: "#ec4899", emoji: "🎨" },
  { name: "Night", color: "#1e3a8a", emoji: "🌙" },
  { name: "Forest", color: "#15803d", emoji: "🌲" },
];

interface IconStylingSectionProps {
  iconToneColor: string;
  iconToneIntensity: number;
  handleIconToneChange: (color: string, intensity?: number) => void;
  handleIconToneIntensityChange: (intensity: number) => void;
  handleRemoveIconTone: () => void;
}

/**
 * Section for icon tone/tinting controls
 * Only shown for SVG group objects that are not membranes
 */
export const IconStylingSection = ({
  iconToneColor,
  iconToneIntensity,
  handleIconToneChange,
  handleIconToneIntensityChange,
  handleRemoveIconTone,
}: IconStylingSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-icon-styling'] ?? true);

  return (
    <div id="section-icon-styling" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-icon-styling')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Icon Styling
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
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tone Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {TONE_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleIconToneChange(preset.color, 0.25)}
                  className="h-9 text-xs gap-1"
                >
                  <span>{preset.emoji}</span>
                  <span>{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>

          <ColorPickerSection
            label="Custom Tone Color"
            value={iconToneColor}
            onChange={handleIconToneChange}
            recentColors={[]}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tone Intensity</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(iconToneIntensity * 100)}%
              </span>
            </div>
            <Slider
              value={[iconToneIntensity * 100]}
              onValueChange={([value]) =>
                handleIconToneIntensityChange(value / 100)
              }
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveIconTone}
            className="w-full text-xs h-9"
          >
            Remove Tone
          </Button>
        </div>
      )}
    </div>
  );
};
