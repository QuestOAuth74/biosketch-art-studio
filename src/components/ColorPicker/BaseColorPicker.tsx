import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { debounce } from '@/lib/performanceUtils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export interface BaseColorPickerProps {
  /** Hex color value (e.g., "#3b82f6") */
  value: string;
  /** Callback when color changes (debounced for slider interactions) */
  onChange: (color: string) => void;
  /** Show opacity slider */
  showOpacity?: boolean;
  /** Opacity value (0-1) */
  opacity?: number;
  /** Callback when opacity changes (debounced) */
  onOpacityChange?: (opacity: number) => void;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * BaseColorPicker - Low-level wrapper around react-colorful with debouncing
 *
 * Features:
 * - Uses HexColorPicker from react-colorful for color selection
 * - Implements 300ms debounce (configurable) for smooth performance
 * - Local state provides immediate visual feedback
 * - Optional opacity slider with debouncing
 * - Syncs with external value changes
 *
 * Usage:
 * - Dragging pickers → debounced onChange (300ms default)
 * - Direct clicks → debounced onChange (300ms default)
 * - External value changes → synced to local state immediately
 */
export const BaseColorPicker: React.FC<BaseColorPickerProps> = ({
  value,
  onChange,
  showOpacity = false,
  opacity = 1,
  onOpacityChange,
  debounceMs = 300,
  className = '',
}) => {
  // Local state for immediate visual feedback
  const [localColor, setLocalColor] = useState(value);
  const [localOpacity, setLocalOpacity] = useState(opacity);

  // Sync external value changes to local state
  useEffect(() => {
    setLocalColor(value);
  }, [value]);

  useEffect(() => {
    setLocalOpacity(opacity);
  }, [opacity]);

  // Create stable reference for onChange
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create stable reference for onOpacityChange
  const onOpacityChangeRef = useRef(onOpacityChange);
  useEffect(() => {
    onOpacityChangeRef.current = onOpacityChange;
  }, [onOpacityChange]);

  // Create debounced onChange handler that uses ref
  const debouncedOnChange = useMemo(
    () => debounce((color: string) => onChangeRef.current(color), debounceMs),
    [debounceMs]
  );

  // Create debounced opacity change handler that uses ref
  const debouncedOnOpacityChange = useMemo(
    () => debounce((opacity: number) => onOpacityChangeRef.current?.(opacity), debounceMs),
    [debounceMs]
  );

  // Handle color change with immediate local update and debounced callback
  const handleColorChange = useCallback((newColor: string) => {
    setLocalColor(newColor); // Immediate visual feedback
    debouncedOnChange(newColor); // Debounced callback
  }, [debouncedOnChange]);

  // Handle opacity change with immediate local update and debounced callback
  const handleOpacityChange = useCallback((values: number[]) => {
    const newOpacity = values[0];
    setLocalOpacity(newOpacity); // Immediate visual feedback
    if (debouncedOnOpacityChange) {
      debouncedOnOpacityChange(newOpacity); // Debounced callback
    }
  }, [debouncedOnOpacityChange]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* react-colorful HexColorPicker */}
      <HexColorPicker
        color={localColor}
        onChange={handleColorChange}
        style={{ width: '100%', height: '200px' }}
      />

      {/* Opacity Slider (optional) */}
      {showOpacity && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Opacity</Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(localOpacity * 100)}%
            </span>
          </div>
          <Slider
            value={[localOpacity]}
            onValueChange={handleOpacityChange}
            min={0}
            max={1}
            step={0.01}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default BaseColorPicker;
