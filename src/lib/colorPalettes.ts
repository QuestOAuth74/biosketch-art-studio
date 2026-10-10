// Scientific Color Palettes for Canvas

export interface ColorPalette {
  name: string;
  description: string;
  colors: string[];
}

// Colorblind-safe palettes
export const colorblindSafePalettes: ColorPalette[] = [
  {
    name: "Viridis",
    description: "Perceptually uniform, colorblind-safe",
    colors: ["#440154", "#482878", "#3e4989", "#31688e", "#26838f", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"]
  },
  {
    name: "Cividis",
    description: "Optimized for color vision deficiency",
    colors: ["#00224e", "#123570", "#3b496c", "#575d6d", "#707173", "#8a8678", "#a59c74", "#c3b369", "#e1cc55", "#fdea45"]
  },
  {
    name: "Wong",
    description: "Wong's colorblind-safe palette",
    colors: ["#000000", "#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"]
  }
];

// Cell signaling pathway colors
export const cellSignalingPalettes: ColorPalette[] = [
  {
    name: "Pathway States",
    description: "Activation, inhibition, neutral states",
    colors: ["#22c55e", "#16a34a", "#15803d", "#ef4444", "#dc2626", "#b91c1c", "#6b7280", "#9ca3af"]
  },
  {
    name: "Cell Components",
    description: "Organelles and structures",
    colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#14b8a6", "#06b6d4", "#84cc16"]
  },
  {
    name: "Molecules",
    description: "DNA, RNA, proteins, lipids",
    colors: ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#65a30d", "#0891b2", "#4f46e5", "#c026d3"]
  }
];

// Publication-ready palettes
export const publicationPalettes: ColorPalette[] = [
  {
    name: "Nature",
    description: "Inspired by Nature journal figures",
    colors: ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4", "#91D1C2", "#DC0000", "#7E6148", "#B09C85"]
  },
  {
    name: "Science",
    description: "Clean scientific illustration colors",
    colors: ["#3B4992", "#EE0000", "#008B45", "#631879", "#008280", "#BB0021", "#5F559B", "#A20056", "#808180", "#1B1919"]
  },
  {
    name: "Cell",
    description: "Cell journal color scheme",
    colors: ["#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF"]
  }
];

// Sequential/gradient palettes for heatmaps
export const sequentialPalettes: ColorPalette[] = [
  {
    name: "Blue to Red",
    description: "Expression levels, temperature",
    colors: ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"]
  },
  {
    name: "Purple to Green",
    description: "Diverging data visualization",
    colors: ["#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837"]
  }
];

// All palettes combined
export const allScientificPalettes = {
  colorblindSafe: colorblindSafePalettes,
  cellSignaling: cellSignalingPalettes,
  publication: publicationPalettes,
  sequential: sequentialPalettes
};

// Color harmony utilities
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getComplementary(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

export function getTriadic(hex: string): string[] {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
  ];
}

export function getAnalogous(hex: string): string[] {
  const hsl = hexToHsl(hex);
  return [
    hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
    hex,
    hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
  ];
}

export function getSplitComplementary(hex: string): string[] {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 150) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 210) % 360, hsl.s, hsl.l)
  ];
}
