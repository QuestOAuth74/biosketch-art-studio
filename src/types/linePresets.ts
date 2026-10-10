export const LINE_PRESET_CATEGORIES = [
  'Lines', 'Arrows', 'Inhibitor', 'Dots', 'Neurons', 'Circular', 'Brackets',
] as const;

export type LinePresetCategory = typeof LINE_PRESET_CATEGORIES[number];

export interface LinePreset {
  id: string;
  name: string;
  category: LinePresetCategory;
  fabric_json: Record<string, any>;
  thumbnail: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
}
