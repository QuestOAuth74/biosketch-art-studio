import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BaseColorPicker } from './BaseColorPicker';
import { cn } from '@/lib/utils';

// Default preset colors (based on common scientific canvas colors)
const DEFAULT_PRESETS = [
  '#000000', '#ffffff', '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
  '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
];

export interface ColorPickerInputProps {
  /** Hex color value */
  value: string;
  /** Callback when color changes */
  onChange: (color: string) => void;
  /** Label text */
  label?: string;
  /** Show preset color grid */
  showPresets?: boolean;
  /** Custom preset colors (defaults to common scientific colors) */
  presets?: string[];
  /** Show hex text input */
  showHexInput?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show opacity slider in picker */
  showOpacity?: boolean;
  /** Opacity value (0-1) */
  opacity?: number;
  /** Callback when opacity changes */
  onOpacityChange?: (opacity: number) => void;
  /** Compact mode for toolbars (smaller swatch, inline layout) */
  compact?: boolean;
}

/**
 * ColorPickerInput - Simple inline color picker for basic use cases
 *
 * Features:
 * - Color preview swatch (clickable to open popover)
 * - Optional hex text input
 * - Optional preset color grid
 * - Popover with BaseColorPicker (react-colorful with debouncing)
 * - Compact design for inline use
 *
 * Use cases:
 * - Simple gradient color stop inputs
 * - Background color pickers
 * - Tool-specific colors
 * - Admin panel colors
 */
export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  value,
  onChange,
  label,
  showPresets = false,
  presets = DEFAULT_PRESETS,
  showHexInput = true,
  disabled = false,
  className = '',
  showOpacity = false,
  opacity = 1,
  onOpacityChange,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);

  // Handle hex input change
  const handleHexInputChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  // Handle preset color click
  const handlePresetClick = (color: string) => {
    onChange(color);
    setHexInput(color);
  };

  // Sync external value changes
  React.useEffect(() => {
    setHexInput(value);
  }, [value]);

  return (
    <div className={cn(
      compact ? 'flex items-center gap-2' : 'flex flex-col gap-2',
      className
    )}>
      {/* Label */}
      {label && <Label className={compact ? "text-xs" : "text-sm font-medium"}>{label}</Label>}

      {/* Color Swatch + Hex Input */}
      <div className="flex items-center gap-2">
        {/* Color Swatch with Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                compact ? 'w-7 h-7' : 'w-10 h-10',
                'rounded-md border-2 border-border shadow-sm transition-all',
                'hover:scale-105 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
                disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
              style={{ backgroundColor: value }}
              aria-label="Open color picker"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto" align="start">
            <div className="space-y-3">
              {/* BaseColorPicker */}
              <BaseColorPicker
                value={value}
                onChange={onChange}
                showOpacity={showOpacity}
                opacity={opacity}
                onOpacityChange={onOpacityChange}
              />

              {/* Preset Colors Grid */}
              {showPresets && presets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Presets</Label>
                  <div className="grid grid-cols-9 gap-1">
                    {presets.map((color, idx) => (
                      <button
                        key={`${color}-${idx}`}
                        type="button"
                        onClick={() => handlePresetClick(color)}
                        className={cn(
                          'w-6 h-6 rounded-sm border border-border/50',
                          'hover:scale-110 transition-transform shadow-sm',
                          'focus:outline-none focus:ring-2 focus:ring-primary'
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Hex Text Input (optional) */}
        {showHexInput && (
          <Input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexInputChange(e.target.value)}
            disabled={disabled}
            placeholder="#000000"
            className={cn(
              compact ? 'h-7 w-24 text-xs' : 'h-10 w-28 text-sm',
              'font-mono'
            )}
            maxLength={7}
          />
        )}
      </div>
    </div>
  );
};

export default ColorPickerInput;
