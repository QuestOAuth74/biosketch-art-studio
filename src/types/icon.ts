export interface IconItem {
  id: string;
  name: string;
  category: string;
  svgData: string;
  thumbnail?: string;
  createdAt: number;
}

export interface IconDbRow {
  id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
  created_at: string;
}

export interface IconCategory {
  id: string;
  name: string;
  description?: string;
}
