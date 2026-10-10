import { GradientConfig, ShadowConfig } from './effects';

// Partial image filter config for presets (all properties optional)
export interface PresetImageFilterConfig {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  pixelate?: number;
  noise?: number;
  removeColor?: { distance: number; color: string };
  hueRotation?: number;
  vibrance?: number;
  grayscale?: boolean;
  invert?: boolean;
  sepia?: boolean;
}

export type PresetType =
  | 'text'           // Regular text objects
  | 'textbox'        // TextBox tool objects
  | 'shape'          // Basic shapes (rect, circle, ellipse, polygon)
  | 'line'           // Lines (path, freeform, connectors)
  | 'image'          // Images (filters, color maps, tones)
  | 'icon'           // SVG groups with icon styling
  | 'membrane'       // Membrane objects
  | 'bracket'        // Bracket annotation objects
  | 'leader-line'    // Leader line objects
  | 'callout'        // Callout objects
  | 'masked-image'   // Masked image groups
  | 'mixed';         // Multiple different types

// Core preset interface
export interface StylePreset {
  id?: string;
  user_id?: string;
  name: string;
  type: PresetType;
  properties: StylePresetProperties;
  icon?: React.ReactNode;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
}

// Line gradient configuration
export interface LineGradientConfig {
  type: 'linear' | 'radial';
  colorStops: Array<{ offset: number; color: string }>;
  coords?: { x1: number; y1: number; x2: number; y2: number };
}

// Line intersection configuration
export interface LineIntersectionConfig {
  style: 'rounded' | 'sharp' | 'gap';
  gapSize?: number;
}

// Properties that can be saved in a preset
export interface StylePresetProperties {
  // ===== UNIVERSAL PROPERTIES =====
  fill?: string | GradientConfig;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  shadow?: ShadowConfig | null;
  gradient?: GradientConfig | null;
  gradientTarget?: 'fill' | 'stroke';

  // ===== TEXT PROPERTIES =====
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  underline?: boolean;
  overline?: boolean;
  linethrough?: boolean;
  lineHeight?: number;
  charSpacing?: number;

  // ===== TEXTBOX PROPERTIES =====
  textboxWidth?: number;
  textboxHeight?: number;
  textboxPadding?: number;
  textboxBackgroundColor?: string;
  textboxBorderColor?: string;
  textboxBorderWidth?: number;

  // ===== LINE PROPERTIES =====
  strokeDashArray?: number[];
  startMarker?: string;
  endMarker?: string;
  lineStyle?: string;
  smoothingStrength?: number;  // For freeform lines
  lineGradient?: LineGradientConfig;
  lineIntersection?: LineIntersectionConfig;

  // ===== IMAGE PROPERTIES =====
  imageFilters?: PresetImageFilterConfig | null;
  colorMap?: {
    mapName: string;
    intensity: number;
  } | null;
  imageTone?: {
    color: string;
    opacity: number;
  } | null;

  // ===== ICON STYLING PROPERTIES =====
  iconTone?: {
    preset?: string;  // 'warm' | 'cool' | 'sepia' | 'vibrant' | 'night' | 'forest'
    customColor?: string;
    intensity?: number;
  } | null;

  // ===== MEMBRANE PROPERTIES =====
  membraneIconId?: string;
  membraneIconSize?: number;
  membraneSpacing?: number;
  membraneOrientation?: number;
  membraneRotateToPath?: boolean;
  membraneDoubleSided?: boolean;

  // ===== BRACKET PROPERTIES =====
  bracketSize?: number;
  bracketDepth?: number;

  // ===== LEADER LINE PROPERTIES =====
  showArrow?: boolean;

  // ===== CALLOUT PROPERTIES =====
  showLegend?: boolean;
  textFill?: string; // Text color inside callout circle
}

// Database row type
export interface UserStylePresetRow {
  id: string;
  user_id: string;
  name: string;
  type: PresetType;
  properties: StylePresetProperties;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

// For creating new presets
export interface CreateStylePresetParams {
  name: string;
  type: PresetType;
  properties: StylePresetProperties;
}

// For updating presets
export interface UpdateStylePresetParams {
  name?: string;
  properties?: StylePresetProperties;
}
