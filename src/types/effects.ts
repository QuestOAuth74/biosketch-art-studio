export interface GradientStop {
  color: string;
  offset: number; // 0-1
  opacity?: number;
}

export interface LinearGradientConfig {
  type: 'linear';
  angle: number; // degrees
  stops: GradientStop[];
}

export interface RadialGradientConfig {
  type: 'radial';
  centerX: number; // 0-1
  centerY: number; // 0-1
  radius: number;
  stops: GradientStop[];
}

export type GradientConfig = LinearGradientConfig | RadialGradientConfig;

export interface ShadowConfig {
  enabled: boolean;
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
  opacity: number;
}

export interface GlowConfig {
  enabled: boolean;
  blur: number;
  color: string;
  opacity: number;
  spread?: number;
}

export interface LineGradientConfig {
  type: 'none' | 'fade-out' | 'fade-in' | 'color-transition' | 'custom';
  direction: 'along-path' | 'reverse';
  gradientStart: number; // 0-100: position along path where transition begins
  gradientEnd: number;   // 0-100: position along path where transition ends (>= gradientStart)
  stops: GradientStop[];
  startColor: string;
  endColor: string;
  startOpacity: number; // 0-1
  endOpacity: number;   // 0-1
}

// Gradient presets
export const GRADIENT_PRESETS = [
  {
    name: 'Sunset',
    type: 'linear' as const,
    angle: 135,
    stops: [
      { color: '#ff6b6b', offset: 0 },
      { color: '#feca57', offset: 1 }
    ]
  },
  {
    name: 'Ocean',
    type: 'linear' as const,
    angle: 90,
    stops: [
      { color: '#0077be', offset: 0 },
      { color: '#48dbfb', offset: 1 }
    ]
  },
  {
    name: 'Forest',
    type: 'linear' as const,
    angle: 180,
    stops: [
      { color: '#0fb9b1', offset: 0 },
      { color: '#55efc4', offset: 1 }
    ]
  },
  {
    name: 'Fire',
    type: 'radial' as const,
    centerX: 0.5,
    centerY: 0.5,
    radius: 100,
    stops: [
      { color: '#feca57', offset: 0 },
      { color: '#ff6b6b', offset: 0.5 },
      { color: '#ee5a6f', offset: 1 }
    ]
  },
  {
    name: 'Purple Haze',
    type: 'linear' as const,
    angle: 45,
    stops: [
      { color: '#a29bfe', offset: 0 },
      { color: '#fd79a8', offset: 1 }
    ]
  },
  {
    name: 'Emerald',
    type: 'linear' as const,
    angle: 90,
    stops: [
      { color: '#00b894', offset: 0 },
      { color: '#55efc4', offset: 1 }
    ]
  }
];

// Shadow presets
export const SHADOW_PRESETS = [
  {
    name: 'Soft',
    blur: 10,
    offsetX: 0,
    offsetY: 4,
    color: '#000000',
    opacity: 0.2
  },
  {
    name: 'Hard',
    blur: 0,
    offsetX: 4,
    offsetY: 4,
    color: '#000000',
    opacity: 0.4
  },
  {
    name: 'Long',
    blur: 15,
    offsetX: 0,
    offsetY: 10,
    color: '#000000',
    opacity: 0.3
  },
  {
    name: 'Lifted',
    blur: 20,
    offsetX: 0,
    offsetY: 8,
    color: '#000000',
    opacity: 0.15
  }
];

// Line intersection behavior types
export type IntersectionBehavior = 'cross' | 'arc' | 'gap' | 'bridge';

export interface LineIntersectionConfig {
  behavior: IntersectionBehavior;
  arcRadius?: number;      // For 'arc' mode, default 8px (4-20px range)
  gapSize?: number;        // For 'gap' mode, default 10px (4-24px range)
  bridgeWidth?: number;    // For 'bridge' mode, default strokeWidth + 4 (2-20px range)
  bridgeColor?: string;    // For 'bridge' mode, default '#ffffff'
}

// Default intersection config
export const DEFAULT_INTERSECTION_CONFIG: LineIntersectionConfig = {
  behavior: 'cross',
  arcRadius: 8,
  gapSize: 10,
  bridgeWidth: 0, // Will be calculated as strokeWidth + 4
  bridgeColor: '#ffffff'
};

// Crop mode types
export type CropMode = 'none' | 'freeform' | 'rectangle' | 'square' | 'ellipse' | 'circle';

export interface ImageCropConfig {
  type: 'freeform' | 'rectangle' | 'square' | 'ellipse' | 'circle';
  clipPathData: {
    type: 'rect' | 'circle' | 'polygon';
    // Store clipPath properties for restoration
    [key: string]: any;
  };
  originalDimensions: {
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
  };
}

// Image filter configuration
export interface ImageFilterConfig {
  brightness: number;      // -100 to 100
  contrast: number;        // -100 to 100
  saturation: number;      // -100 to 100
  grayscale: boolean;
  sepia: boolean;
}

export const DEFAULT_IMAGE_FILTER_CONFIG: ImageFilterConfig = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: false,
  sepia: false,
};

// Line endpoint types
export type LineEndpointType = 'none' | 'arrow' | 'circle-hollow' | 'circle-filled' | 'dot' | 'diamond-hollow' | 'diamond-filled' | 'inhibitor-bar' | 'right-angle';

// Corner style types for orthogonal lines
export type CornerStyle = 'sharp' | 'rounded' | 'beveled';

// Connection point data structure
export interface ConnectionPoint {
  id: string;
  objectId: string;
  x: number;
  y: number;
  relX: number; // Relative position (0-1)
  relY: number; // Relative position (0-1)
  position: 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
}

// Line connection configuration
export interface LineConnectionConfig {
  smartConnectorsEnabled: boolean;
  autoPathfindingEnabled: boolean;
  snapThreshold: number; // Distance in pixels to trigger snap
  sourceConnectionPoint?: ConnectionPoint;
  targetConnectionPoint?: ConnectionPoint;
}

// Line style configuration
export interface LineStyleConfig {
  lineType: 'straight' | 'curved' | 'orthogonal' | 'bezier';
  startEndpoint: LineEndpointType;
  endEndpoint: LineEndpointType;
  strokeWidth: number;
  dashPattern: 'solid' | 'dashed' | 'dotted' | 'custom';
  customDashArray?: number[];
  cornerStyle: CornerStyle; // For orthogonal lines only
}

// Default connection configuration
export const DEFAULT_LINE_CONNECTION_CONFIG: LineConnectionConfig = {
  smartConnectorsEnabled: true,
  autoPathfindingEnabled: false,
  snapThreshold: 15,
};

// Default line style configuration
export const DEFAULT_LINE_STYLE_CONFIG: LineStyleConfig = {
  lineType: 'straight',
  startEndpoint: 'none',
  endEndpoint: 'arrow',
  strokeWidth: 2,
  dashPattern: 'solid',
  cornerStyle: 'sharp',
};

// Image filter presets
export const IMAGE_FILTER_PRESETS = [
  {
    name: 'Vivid',
    brightness: 10,
    contrast: 20,
    saturation: 30,
    grayscale: false,
    sepia: false,
  },
  {
    name: 'Faded',
    brightness: 5,
    contrast: -15,
    saturation: -20,
    grayscale: false,
    sepia: false,
  },
  {
    name: 'High Contrast',
    brightness: 0,
    contrast: 50,
    saturation: 0,
    grayscale: false,
    sepia: false,
  },
  {
    name: 'Vintage',
    brightness: -5,
    contrast: 10,
    saturation: -10,
    grayscale: false,
    sepia: true,
  },
];
