export interface PowerPointGeneration {
  id: string;
  user_id: string;
  original_filename: string;
  generated_filename: string;
  template_name: string;
  storage_path: string;
  word_doc_path: string | null;
  status: 'processing' | 'completed' | 'failed';
  current_step?: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PowerPointTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
  enhancedBullets?: EnhancedBullets;
  shadedBoxes?: ShadedBoxes;
  isCustom?: boolean;
}

export interface QuoteStyles {
  quoteSize: number;
  attributionSize: number;
  showQuoteMarks: boolean;
  quoteColor?: string;
  alignment: 'left' | 'center' | 'right';
}

export interface ImageLayouts {
  gridColumns: number;
  imageSize: 'small' | 'medium' | 'large';
  imageBorder: boolean;
  imageRounded: boolean;
  imageSpacing: 'tight' | 'normal' | 'wide';
  
  // Default positioning per slide type
  defaultPositions?: {
    'image-left'?: 'left' | 'center' | 'right';
    'image-right'?: 'left' | 'center' | 'right';
    'image-top'?: 'top' | 'center' | 'bottom';
    'image-grid'?: 'left' | 'center' | 'right' | 'justified';
  };
  
  // Border styling (when imageBorder is true)
  borderStyle?: {
    width?: number; // 1-10 points
    color?: string; // hex color
    style?: 'solid' | 'dashed' | 'dotted';
  };
  
  // Corner rounding (when imageRounded is true)
  cornerRadius?: number; // 0-50 (percentage or points)
  
  // Image sizing behavior
  sizingMode?: 'contain' | 'cover' | 'crop';
  
  // Caption/label formatting
  captions?: {
    enabled?: boolean;
    position?: 'above' | 'below' | 'overlay-bottom' | 'overlay-top';
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string; // for overlay captions
    alignment?: 'left' | 'center' | 'right';
  };
  
  // Shadow effects
  shadow?: {
    enabled?: boolean;
    blur?: number; // 0-20
    angle?: number; // 0-360
    distance?: number; // 0-20
    color?: string;
    opacity?: number; // 0-100
  };
}

export interface EnhancedBullets {
  enabled: boolean;
  iconSet: 'default' | 'scientific' | 'medical' | 'educational';
  circleSize: number;
  circleColor: string;
  iconColor: string;
}

export interface ShadedBoxes {
  enabled: boolean;
  opacity: number;
  backgroundColor: string;
  padding: number;
}

export interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background?: string;
  };
  fonts: {
    title: string;
    body: string;
    titleSize: number;
    bodySize: number;
  };
  layouts: {
    titleSlide: 'centered' | 'left' | 'right';
    contentSlide: 'bullets' | 'two-column' | 'image-text' | 'image-left' | 'image-right' | 'image-grid' | 'image-top' | 'full-image' | 'quote' | 'split-content';
    spacing: 'compact' | 'normal' | 'spacious';
  };
  quote_styles?: QuoteStyles | null;
  image_layouts?: ImageLayouts | null;
  enhanced_bullets?: EnhancedBullets | null;
  shaded_boxes?: ShadedBoxes | null;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const POWERPOINT_TEMPLATES: PowerPointTemplate[] = [
  {
    id: 'scientific-report',
    name: 'Scientific Report',
    description: 'Professional design with icon bullets and shaded boxes',
    preview: '📊',
    colors: {
      primary: '#1e3a8a',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      text: '#1e293b',
    },
    enhancedBullets: {
      enabled: true,
      iconSet: 'scientific',
      circleSize: 0.35,
      circleColor: '#3b82f6',
      iconColor: '#ffffff'
    },
    shadedBoxes: {
      enabled: true,
      opacity: 10,
      backgroundColor: '#e3f2fd',
      padding: 0.25
    }
  },
  {
    id: 'research-presentation',
    name: 'Research Presentation',
    description: 'Academic design with icon bullets and shaded boxes',
    preview: '🔬',
    colors: {
      primary: '#064e3b',
      secondary: '#047857',
      accent: '#10b981',
      text: '#1f2937',
    },
    enhancedBullets: {
      enabled: true,
      iconSet: 'scientific',
      circleSize: 0.35,
      circleColor: '#047857',
      iconColor: '#ffffff'
    },
    shadedBoxes: {
      enabled: true,
      opacity: 10,
      backgroundColor: '#d1fae5',
      padding: 0.25
    }
  },
  {
    id: 'medical-briefing',
    name: 'Medical Briefing',
    description: 'Clinical design with icon bullets and shaded boxes',
    preview: '⚕️',
    colors: {
      primary: '#991b1b',
      secondary: '#dc2626',
      accent: '#ef4444',
      text: '#111827',
    },
    enhancedBullets: {
      enabled: true,
      iconSet: 'medical',
      circleSize: 0.35,
      circleColor: '#dc2626',
      iconColor: '#ffffff'
    },
    shadedBoxes: {
      enabled: true,
      opacity: 10,
      backgroundColor: '#fee2e2',
      padding: 0.25
    }
  },
  {
    id: 'educational-lecture',
    name: 'Educational Lecture',
    description: 'Engaging design with icon bullets and shaded boxes',
    preview: '📚',
    colors: {
      primary: '#ea580c',
      secondary: '#2563eb',
      accent: '#fb923c',
      text: '#0f172a',
    },
    enhancedBullets: {
      enabled: true,
      iconSet: 'educational',
      circleSize: 0.35,
      circleColor: '#2563eb',
      iconColor: '#ffffff'
    },
    shadedBoxes: {
      enabled: true,
      opacity: 10,
      backgroundColor: '#ffedd5',
      padding: 0.25
    }
  },
];
