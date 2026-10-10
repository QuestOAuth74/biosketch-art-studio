import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Unit,
  toPixels,
  fromPixels,
  convertUnit,
  validateDimension,
  getStepSize,
  formatDimension
} from "@/lib/unitConversion";
import { cn } from "@/lib/utils";
import { CanvasSizeTestIds } from "@/lib/test-ids";

interface CustomDimensionInputsProps {
  customDimensions: { width: number; height: number; unit: Unit };
  onDimensionsChange: (dims: { width: number; height: number; unit: Unit }) => void;
}

export const CustomDimensionInputs = ({ 
  customDimensions, 
  onDimensionsChange 
}: CustomDimensionInputsProps) => {
  const [width, setWidth] = useState(customDimensions.width.toString());
  const [height, setHeight] = useState(customDimensions.height.toString());
  const [unit, setUnit] = useState<Unit>(customDimensions.unit);
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => {
    setWidth(formatDimension(customDimensions.width, customDimensions.unit));
    setHeight(formatDimension(customDimensions.height, customDimensions.unit));
    setUnit(customDimensions.unit);
  }, [customDimensions]);

  // Handle unit change - convert existing values to new unit
  const handleUnitChange = (newUnit: string) => {
    if (!newUnit) return;
    const targetUnit = newUnit as Unit;
    
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    
    if (!isNaN(widthNum) && !isNaN(heightNum)) {
      const newWidth = convertUnit(widthNum, unit, targetUnit);
      const newHeight = convertUnit(heightNum, unit, targetUnit);
      
      setWidth(formatDimension(newWidth, targetUnit));
      setHeight(formatDimension(newHeight, targetUnit));
      setUnit(targetUnit);
      
      // Save unit preference to localStorage
      localStorage.setItem('canvas_preferred_unit', targetUnit);
    } else {
      setUnit(targetUnit);
    }
  };

  // Validate and update width
  const handleWidthChange = (value: string) => {
    setWidth(value);
    const num = parseFloat(value);
    
    if (value && !isNaN(num)) {
      const validation = validateDimension(num, unit);
      setWidthError(validation.valid ? null : validation.error || null);
    } else {
      setWidthError(value ? 'Invalid number' : null);
    }
  };

  // Validate and update height
  const handleHeightChange = (value: string) => {
    setHeight(value);
    const num = parseFloat(value);
    
    if (value && !isNaN(num)) {
      const validation = validateDimension(num, unit);
      setHeightError(validation.valid ? null : validation.error || null);
    } else {
      setHeightError(value ? 'Invalid number' : null);
    }
  };

  // Apply dimensions
  const handleApply = () => {
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    
    const widthValidation = validateDimension(widthNum, unit);
    const heightValidation = validateDimension(heightNum, unit);
    
    if (!widthValidation.valid) {
      setWidthError(widthValidation.error || null);
      return;
    }
    
    if (!heightValidation.valid) {
      setHeightError(heightValidation.error || null);
      return;
    }
    
    // Call parent callback with validated dimensions
    onDimensionsChange({
      width: widthNum,
      height: heightNum,
      unit: unit
    });
  };

  const isValid = !widthError && !heightError && width && height;

  return (
    <div className="space-y-3" data-testid={CanvasSizeTestIds.SIZE_DIALOG}>
      <Label className="text-xs font-bold">Custom Dimensions</Label>

      {/* Unit Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Unit</Label>
        <ToggleGroup
          type="single"
          value={unit}
          onValueChange={handleUnitChange}
          className="justify-start"
          data-testid={CanvasSizeTestIds.UNIT_SELECT}
        >
          <ToggleGroupItem value="px" className="text-xs" data-testid={CanvasSizeTestIds.UNIT_PX}>px</ToggleGroupItem>
          <ToggleGroupItem value="in" className="text-xs" data-testid={CanvasSizeTestIds.UNIT_INCHES}>in</ToggleGroupItem>
          <ToggleGroupItem value="cm" className="text-xs" data-testid={CanvasSizeTestIds.UNIT_CM}>cm</ToggleGroupItem>
          <ToggleGroupItem value="mm" className="text-xs">mm</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Width Input */}
      <div className="space-y-1">
        <Label htmlFor="custom-width" className="text-xs">Width ({unit})</Label>
        <Input
          id="custom-width"
          type="number"
          value={width}
          onChange={(e) => handleWidthChange(e.target.value)}
          step={getStepSize(unit)}
          className={cn(
            "h-8 text-sm",
            widthError && "border-red-500 focus-visible:ring-red-500"
          )}
          data-testid={CanvasSizeTestIds.WIDTH_INPUT}
        />
        {widthError && (
          <p className="text-xs text-red-500">{widthError}</p>
        )}
      </div>

      {/* Height Input */}
      <div className="space-y-1">
        <Label htmlFor="custom-height" className="text-xs">Height ({unit})</Label>
        <Input
          id="custom-height"
          type="number"
          value={height}
          onChange={(e) => handleHeightChange(e.target.value)}
          step={getStepSize(unit)}
          className={cn(
            "h-8 text-sm",
            heightError && "border-red-500 focus-visible:ring-red-500"
          )}
          data-testid={CanvasSizeTestIds.HEIGHT_INPUT}
        />
        {heightError && (
          <p className="text-xs text-red-500">{heightError}</p>
        )}
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={!isValid}
        className="w-full h-8 text-xs"
        size="sm"
        data-testid={CanvasSizeTestIds.APPLY_BUTTON}
      >
        Apply Dimensions
      </Button>
    </div>
  );
};
