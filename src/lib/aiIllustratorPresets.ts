/**
 * Journal-style presets for AI Illustrator.
 *
 * Each preset ships one small string block (`promptAppendix`) that gets
 * concatenated onto the user's prompt inside the ai-illustrator edge
 * function. Client-side we also carry a `palette` for the mini-preview
 * chip so users see which look they're choosing before generating.
 *
 * `id` is the wire value sent to the edge function. Keep this list in sync
 * with the edge function's whitelist — unknown IDs are silently ignored.
 */

export interface AIIllustratorPreset {
  id: string;
  name: string;
  /** One-line explainer under the chip. */
  description: string;
  /** 4 hex colors for the mini-swatch on the chip. */
  palette: [string, string, string, string];
  /**
   * Prompt block appended to the Gemini call. Written as directives the
   * model can honor even when the user's request is short.
   * Empty string = no injection (used by the "Default" preset).
   */
  promptAppendix: string;
}

export const AI_ILLUSTRATOR_PRESETS: AIIllustratorPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'BioSketch house style',
    palette: ['#0B1D3A', '#3B82F6', '#22C55E', '#F59E0B'],
    promptAppendix: '',
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Neutral, editorial, minimal',
    palette: ['#0B1D3A', '#4B4B4B', '#C89B25', '#FFFFFF'],
    promptAppendix: [
      'Style guidance — Nature journal figure:',
      '- Palette: deep navy #0B1D3A, mid grey #4B4B4B, mustard #C89B25, white #FFFFFF. Use these as the dominant hues.',
      '- Clean sans-serif labels only (Helvetica / Arial family). Minimal decorative elements.',
      '- Thin, consistent outlines (1–1.5 px equivalent). No gradients, no shadows, no 3D effects.',
      '- White or very light background. Publication-density detail.',
    ].join('\n'),
  },
  {
    id: 'cell',
    name: 'Cell',
    description: 'Bright accents, high-contrast',
    palette: ['#2B2E33', '#E74C3C', '#3498DB', '#F4F4F4'],
    promptAppendix: [
      'Style guidance — Cell journal figure:',
      '- Palette: charcoal #2B2E33, coral #E74C3C, sky #3498DB, off-white #F4F4F4. Use vivid accents on a light background.',
      '- Bold sans-serif labels for structures. Clear callouts.',
      '- Consistent line weights, flat solid colors. No gradients or shading.',
      '- Off-white background, publication-ready proportions.',
    ].join('\n'),
  },
  {
    id: 'science',
    name: 'Science',
    description: 'High contrast, structured',
    palette: ['#1A3A5C', '#E63946', '#A8DADC', '#F1FAEE'],
    promptAppendix: [
      'Style guidance — Science journal figure:',
      '- Palette: navy #1A3A5C, crimson #E63946, powder #A8DADC, cream #F1FAEE. High contrast between structure and accent.',
      '- Clear, structured layout — one central subject with clean labels.',
      '- Sans-serif labels. Thin outlines. No gradients, no shadows.',
      '- Cream background. Precise anatomical proportions.',
    ].join('\n'),
  },
  {
    id: 'elife',
    name: 'eLife',
    description: 'Warm accents, accessible',
    palette: ['#00A98F', '#333333', '#FFC000', '#F9F9F9'],
    promptAppendix: [
      'Style guidance — eLife journal figure:',
      '- Palette: teal #00A98F, charcoal #333333, warm yellow #FFC000, off-white #F9F9F9.',
      '- Modern, accessible design. Prioritize colorblind-safe combinations.',
      '- Sans-serif labels. Clean solid fills, flat shapes.',
      '- Warm off-white background. Open, uncluttered layout.',
    ].join('\n'),
  },
  {
    id: 'plos',
    name: 'PLOS',
    description: 'Bright blue, readability-first',
    palette: ['#0066CC', '#666666', '#FF6600', '#FFFFFF'],
    promptAppendix: [
      'Style guidance — PLOS journal figure:',
      '- Palette: bright blue #0066CC, mid grey #666666, warm orange #FF6600, white #FFFFFF.',
      '- Maximum readability — large clear labels, high contrast.',
      '- Sans-serif labels only. Solid fills, no gradients or effects.',
      '- White background. Suitable for online + print at any zoom.',
    ].join('\n'),
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Bold, projector-friendly',
    palette: ['#7C3AED', '#EC4899', '#F59E0B', '#FFFFFF'],
    promptAppendix: [
      'Style guidance — Presentation-slide figure:',
      '- Palette: violet #7C3AED, magenta #EC4899, amber #F59E0B, white #FFFFFF. Vivid, projector-safe.',
      '- Bold, large sans-serif labels that read from the back of a room.',
      '- Chunky outlines (2–3 px equivalent). Solid fills, high contrast.',
      '- White background. Simplified detail — no publication-density fine strokes.',
    ].join('\n'),
  },
];

export const DEFAULT_AI_ILLUSTRATOR_PRESET_ID = 'default';

export function getPresetById(id: string): AIIllustratorPreset | undefined {
  return AI_ILLUSTRATOR_PRESETS.find((p) => p.id === id);
}
