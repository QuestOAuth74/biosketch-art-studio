import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TextTIcon } from "@phosphor-icons/react";
import { ColorPickerSection } from "./ColorPickerSection";
import { Textbox } from "fabric";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

const GOOGLE_FONTS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Raleway", label: "Raleway" },
  { value: "Ubuntu", label: "Ubuntu" },
  { value: "Oswald", label: "Oswald" },
  { value: "Merriweather", label: "Merriweather (Serif)" },
  { value: "Playfair Display", label: "Playfair Display (Serif)" },
  { value: "Crimson Text", label: "Crimson Text (Serif)" },
  { value: "Source Sans 3", label: "Source Sans 3" },
  { value: "Arial", label: "Arial (System)" },
  { value: "Helvetica", label: "Helvetica (System)" },
  { value: "Georgia", label: "Georgia (System)" },
  { value: "Times New Roman", label: "Times New Roman (System)" },
];

interface TextPropertiesSectionProps {
  textFont: string;
  textSize: number;
  textColor: string;
  onFontChange: (font: string) => void;
  onSizeChange: (size: string) => void;
  onColorChange: (color: string) => void;
  recentColors: string[];
}

export const TextPropertiesSection = ({
  textFont,
  textSize,
  textColor,
  onFontChange,
  onSizeChange,
  onColorChange,
  recentColors,
}: TextPropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const fontCollapsed = useSectionCollapseStore((state) => state.sections['section-font'] ?? true);

  return (
    <>
      {/* Font Settings */}
      <div id="section-font" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-font')}
        >
          <div className="flex items-center gap-2">
            <TextTIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Font</h3>
          </div>
          {fontCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>

        {!fontCollapsed && (
          <div className="px-3 pb-3 pt-3">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Font Family</Label>
              <Select value={textFont} onValueChange={onFontChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {GOOGLE_FONTS.map((font) => (
                    <SelectItem
                      key={font.value}
                      value={font.value}
                      className="text-xs"
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Size</Label>
                <span className="text-xs text-muted-foreground font-mono">{textSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[textSize]}
                  onValueChange={([value]) => onSizeChange(String(value))}
                  min={8}
                  max={200}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={textSize}
                  onChange={(e) => onSizeChange(e.target.value)}
                  className="h-9 w-16 text-xs"
                  min="8"
                  max="200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <ColorPickerSection
                label="Text Color"
                value={textColor}
                onChange={onColorChange}
                recentColors={recentColors}
              />
            </div>
          </div>
          </div>
        )}
      </div>
    </>
  );
};
