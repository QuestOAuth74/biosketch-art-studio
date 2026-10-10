export interface PaperSize {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  description: string;
  category?: 'journal' | 'paper' | 'presentation' | 'poster' | 'custom';
}

// All sizes converted to pixels at 300 DPI for high-quality scientific publication
export const PAPER_SIZES: PaperSize[] = [
  {
    id: 'custom',
    name: 'Custom',
    width: 1200,
    height: 800,
    unit: 'px',
    description: 'Custom canvas size',
    category: 'custom'
  },
  // === JOURNAL FIGURE SIZES ===
  // Nature / Nature Communications
  {
    id: 'nature-single',
    name: 'Nature (Single Column)',
    width: 1039,
    height: 1039,
    unit: 'px',
    description: '88mm width - Nature, Nat Comms',
    category: 'journal'
  },
  {
    id: 'nature-1.5',
    name: 'Nature (1.5 Column)',
    width: 1417,
    height: 1063,
    unit: 'px',
    description: '120mm width - Medium figures',
    category: 'journal'
  },
  {
    id: 'nature-double',
    name: 'Nature (Double Column)',
    width: 2126,
    height: 1595,
    unit: 'px',
    description: '180mm width - Full width figures',
    category: 'journal'
  },
  // Science / Science Advances
  {
    id: 'science-single',
    name: 'Science (Single Column)',
    width: 1004,
    height: 1004,
    unit: 'px',
    description: '85mm width - Science, Sci Advances',
    category: 'journal'
  },
  {
    id: 'science-double',
    name: 'Science (Double Column)',
    width: 2055,
    height: 1541,
    unit: 'px',
    description: '174mm width - Full width',
    category: 'journal'
  },
  // Cell / Cell Press journals
  {
    id: 'cell-single',
    name: 'Cell (Single Column)',
    width: 1004,
    height: 1004,
    unit: 'px',
    description: '85mm width - Cell Press journals',
    category: 'journal'
  },
  {
    id: 'cell-double',
    name: 'Cell (Double Column)',
    width: 2055,
    height: 1541,
    unit: 'px',
    description: '174mm width - Full width',
    category: 'journal'
  },
  // PNAS
  {
    id: 'pnas-single',
    name: 'PNAS (Single Column)',
    width: 1028,
    height: 1028,
    unit: 'px',
    description: '87mm width',
    category: 'journal'
  },
  {
    id: 'pnas-double',
    name: 'PNAS (Double Column)',
    width: 2102,
    height: 1577,
    unit: 'px',
    description: '178mm width - Full width',
    category: 'journal'
  },
  // eLife
  {
    id: 'elife-single',
    name: 'eLife (Single Column)',
    width: 1004,
    height: 1004,
    unit: 'px',
    description: '85mm width',
    category: 'journal'
  },
  {
    id: 'elife-full',
    name: 'eLife (Full Page)',
    width: 2102,
    height: 1577,
    unit: 'px',
    description: '178mm width',
    category: 'journal'
  },
  // PLOS ONE
  {
    id: 'plos-single',
    name: 'PLOS ONE (Single Column)',
    width: 980,
    height: 980,
    unit: 'px',
    description: '83mm width',
    category: 'journal'
  },
  {
    id: 'plos-1.5',
    name: 'PLOS ONE (1.5 Column)',
    width: 1500,
    height: 1125,
    unit: 'px',
    description: '127mm width',
    category: 'journal'
  },
  {
    id: 'plos-double',
    name: 'PLOS ONE (Double Column)',
    width: 2043,
    height: 1532,
    unit: 'px',
    description: '173mm width - Full width',
    category: 'journal'
  },
  // === STANDARD PAPER SIZES ===
  {
    id: 'a4',
    name: 'A4 (Portrait)',
    width: 2480,
    height: 3508,
    unit: 'px',
    description: '210 × 297 mm - Standard scientific paper',
    category: 'paper'
  },
  {
    id: 'a4-landscape',
    name: 'A4 (Landscape)',
    width: 3508,
    height: 2480,
    unit: 'px',
    description: '297 × 210 mm',
    category: 'paper'
  },
  {
    id: 'letter',
    name: 'Letter (Portrait)',
    width: 2550,
    height: 3300,
    unit: 'px',
    description: '8.5 × 11 in - US standard',
    category: 'paper'
  },
  {
    id: 'letter-landscape',
    name: 'Letter (Landscape)',
    width: 3300,
    height: 2550,
    unit: 'px',
    description: '11 × 8.5 in',
    category: 'paper'
  },
  {
    id: 'a5',
    name: 'A5 (Portrait)',
    width: 1748,
    height: 2480,
    unit: 'px',
    description: '148 × 210 mm',
    category: 'paper'
  },
  {
    id: 'a3',
    name: 'A3 (Portrait)',
    width: 3508,
    height: 4961,
    unit: 'px',
    description: '297 × 420 mm - Large format',
    category: 'paper'
  },
  // === PRESENTATION SIZES ===
  {
    id: 'slide-169',
    name: 'Presentation Slide (16:9)',
    width: 3840,
    height: 2160,
    unit: 'px',
    description: 'Standard presentation format',
    category: 'presentation'
  },
  {
    id: 'slide-43',
    name: 'Presentation Slide (4:3)',
    width: 3000,
    height: 2250,
    unit: 'px',
    description: 'Classic presentation format',
    category: 'presentation'
  },
  // === POSTER SIZES ===
  {
    id: 'poster-a1',
    name: 'Scientific Poster (A1)',
    width: 7016,
    height: 9933,
    unit: 'px',
    description: '594 × 841 mm - Conference poster',
    category: 'poster'
  },
  {
    id: 'poster-a0',
    name: 'Scientific Poster (A0)',
    width: 9933,
    height: 14043,
    unit: 'px',
    description: '841 × 1189 mm - Large poster',
    category: 'poster'
  },
  {
    id: 'square-1024',
    name: 'Square (1024×1024)',
    width: 1024,
    height: 1024,
    unit: 'px',
    description: 'Social media / thumbnails',
    category: 'custom'
  },
  {
    id: 'wide-2560',
    name: 'Wide (2560×1440)',
    width: 2560,
    height: 1440,
    unit: 'px',
    description: 'Wide display format',
    category: 'custom'
  }
];

export const getPaperSize = (id: string): PaperSize => {
  return PAPER_SIZES.find(size => size.id === id) || PAPER_SIZES[0];
};
