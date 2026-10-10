/**
 * Scientific color maps for microscopy and data visualization
 * Includes perceptually uniform, diverging, and categorical color maps
 */

export type ColorMapCategory = 'sequential' | 'diverging' | 'categorical';

export interface ColorMapDefinition {
  name: string;
  description: string;
  colors: string[]; // Gradient stops (hex colors)
  category: ColorMapCategory;
  useCase: string;
}

/**
 * Scientific color maps optimized for data visualization
 * Based on matplotlib/viridis and scientific visualization best practices
 */
export const SCIENTIFIC_COLOR_MAPS: Record<string, ColorMapDefinition> = {
  // Sequential color maps - for continuous data
  viridis: {
    name: 'Viridis',
    description: 'Perceptually uniform, colorblind-safe',
    colors: [
      '#440154', '#482878', '#3e4989', '#31688e', '#26828e',
      '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'
    ],
    category: 'sequential',
    useCase: 'General scientific visualization, default choice'
  },
  plasma: {
    name: 'Plasma',
    description: 'High contrast, perceptually uniform',
    colors: [
      '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
      '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'
    ],
    category: 'sequential',
    useCase: 'Heat maps, intensity data, high dynamic range'
  },
  inferno: {
    name: 'Inferno',
    description: 'Dark background, bright highlights',
    colors: [
      '#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60',
      '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'
    ],
    category: 'sequential',
    useCase: 'Fluorescence microscopy, astronomical data'
  },
  magma: {
    name: 'Magma',
    description: 'Purple to yellow, perceptually uniform',
    colors: [
      '#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f',
      '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'
    ],
    category: 'sequential',
    useCase: 'Thermal imaging, geological data'
  },
  turbo: {
    name: 'Turbo',
    description: 'Rainbow-like with good perceptual uniformity',
    colors: [
      '#30123b', '#4454c4', '#4393e5', '#38b9c7', '#1bd2a4',
      '#5bd75d', '#a0d131', '#e3c838', '#feab3f', '#fb6a4a',
      '#df1f59', '#a01315'
    ],
    category: 'sequential',
    useCase: 'High dynamic range data, velocity fields'
  },
  cividis: {
    name: 'Cividis',
    description: 'Optimized for color vision deficiency',
    colors: [
      '#00204d', '#00386b', '#2a4d6e', '#4e6271', '#6d7a70',
      '#8e9468', '#b1af5f', '#d5cb56', '#fde74c'
    ],
    category: 'sequential',
    useCase: 'Accessible visualization, presentations'
  },
  hot: {
    name: 'Hot',
    description: 'Black-red-yellow-white heat map',
    colors: [
      '#000000', '#2b0000', '#550000', '#800000', '#aa0000',
      '#d40000', '#ff0000', '#ff5500', '#ffaa00', '#ffff00',
      '#ffff55', '#ffffaa', '#ffffff'
    ],
    category: 'sequential',
    useCase: 'Classic heat maps, thermal imaging'
  },
  cool: {
    name: 'Cool',
    description: 'Cyan to magenta gradient',
    colors: [
      '#00ffff', '#1ae5ff', '#33ccff', '#4db2ff', '#6699ff',
      '#7f7fff', '#9966ff', '#b24dff', '#cc33ff', '#e51aff',
      '#ff00ff'
    ],
    category: 'sequential',
    useCase: 'Temperature data, pressure maps'
  },

  // Diverging color maps - for data with a critical midpoint
  redBlue: {
    name: 'Red-Blue',
    description: 'Diverging temperature scale',
    colors: [
      '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
      '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b',
      '#67001f'
    ],
    category: 'diverging',
    useCase: 'Temperature anomalies, correlation data'
  },
  purpleGreen: {
    name: 'Purple-Green',
    description: 'Diverging qualitative scale',
    colors: [
      '#40004b', '#762a83', '#9970ab', '#c2a5cf', '#e7d4e8',
      '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837',
      '#00441b'
    ],
    category: 'diverging',
    useCase: 'Differential expression, fold changes'
  },
  brownTeal: {
    name: 'Brown-Teal',
    description: 'Earth tones diverging',
    colors: [
      '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5',
      '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'
    ],
    category: 'diverging',
    useCase: 'Environmental data, soil analysis'
  },

  // Categorical/Qualitative - for discrete categories
  rainbow: {
    name: 'Rainbow',
    description: 'Full spectrum visualization',
    colors: [
      '#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00',
      '#00ff7f', '#00ffff', '#007fff', '#0000ff', '#7f00ff',
      '#ff00ff'
    ],
    category: 'categorical',
    useCase: 'Phase visualization, multi-channel imaging'
  },
  phase: {
    name: 'Phase',
    description: 'Circular phase angle mapping',
    colors: [
      '#ff0000', '#ff9900', '#ffff00', '#99ff00', '#00ff00',
      '#00ff99', '#00ffff', '#0099ff', '#0000ff', '#9900ff',
      '#ff00ff', '#ff0099'
    ],
    category: 'categorical',
    useCase: 'Phase contrast microscopy, wave analysis'
  },
  jet: {
    name: 'Jet',
    description: 'Classic rainbow (not recommended)',
    colors: [
      '#000080', '#0000ff', '#0080ff', '#00ffff', '#00ff80',
      '#00ff00', '#80ff00', '#ffff00', '#ff8000', '#ff0000',
      '#800000'
    ],
    category: 'categorical',
    useCase: 'Legacy compatibility (use Turbo instead)'
  }
};

/**
 * Get all color maps in a specific category
 */
export function getColorMapsByCategory(category: ColorMapCategory): ColorMapDefinition[] {
  return Object.values(SCIENTIFIC_COLOR_MAPS).filter(map => map.category === category);
}

/**
 * Get a color map by name
 */
export function getColorMap(name: string): ColorMapDefinition | undefined {
  return SCIENTIFIC_COLOR_MAPS[name];
}

/**
 * Get all color map names
 */
export function getAllColorMapNames(): string[] {
  return Object.keys(SCIENTIFIC_COLOR_MAPS);
}

/**
 * Interpolate a color from a color map based on a value (0-1)
 * @param colorMap Color map definition
 * @param value Normalized value (0-1)
 * @returns Hex color string
 */
export function interpolateColorMap(colorMap: ColorMapDefinition, value: number): string {
  const colors = colorMap.colors;
  const clamped = Math.max(0, Math.min(1, value));

  if (clamped === 0) return colors[0];
  if (clamped === 1) return colors[colors.length - 1];

  const scaledValue = clamped * (colors.length - 1);
  const lowerIndex = Math.floor(scaledValue);
  const upperIndex = Math.ceil(scaledValue);
  const t = scaledValue - lowerIndex;

  return blendColors(colors[lowerIndex], colors[upperIndex], t);
}

/**
 * Blend two hex colors
 */
function blendColors(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
