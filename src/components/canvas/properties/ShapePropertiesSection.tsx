import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Circle, Square } from "lucide-react";
import { ColorPickerSection } from "./ColorPickerSection";

interface ShapePropertiesSectionProps {
  fillColor: string;
  strokeColor: string;
  onFillChange: (color: string) => void;
  onStrokeChange: (color: string) => void;
  recentColors: string[];
}

export const ShapePropertiesSection = ({
  fillColor,
  strokeColor,
  onFillChange,
  onStrokeChange,
  recentColors,
}: ShapePropertiesSectionProps) => {
  return (
    <Accordion type="multiple" defaultValue={["fill", "stroke"]} className="w-full">
      {/* Fill Color */}
      <AccordionItem value="fill" className="border-none">
        <AccordionTrigger className="py-3 px-3 hover:bg-accent/50 rounded-lg hover:no-underline">
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-primary" fill="currentColor" />
            <span className="text-xs font-semibold uppercase tracking-wider">Fill</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-1">
          <ColorPickerSection
            label="Fill Color"
            value={fillColor}
            onChange={onFillChange}
            recentColors={recentColors}
          />
        </AccordionContent>
      </AccordionItem>

      {/* Stroke Color */}
      <AccordionItem value="stroke" className="border-none">
        <AccordionTrigger className="py-3 px-3 hover:bg-accent/50 rounded-lg hover:no-underline">
          <div className="flex items-center gap-2">
            <Square className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider">Stroke</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-1">
          <ColorPickerSection
            label="Stroke Color"
            value={strokeColor}
            onChange={onStrokeChange}
            recentColors={recentColors}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
