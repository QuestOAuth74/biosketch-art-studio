import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Palette, Sparkles, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Preset palettes exposed by the Recolor picker. Six scientific-friendly
 * choices covering the common publication styles + a colorblind-safe option.
 * Each palette is 5 hex colors — enough for the AI to work with without
 * dictating so many that the constraint becomes noise.
 */
export interface Palette {
  id: string;
  name: string;
  description: string;
  colors: string[]; // 5 hex strings
}

export const RECOLOR_PALETTES: Palette[] = [
  {
    id: 'mono',
    name: 'Mono',
    description: 'Grayscale — journal-safe, print-ready',
    colors: ['#0F172A', '#475569', '#94A3B8', '#CBD5E1', '#F1F5F9'],
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'Nature / Cell / Science neutral palette',
    colors: ['#0B1D3A', '#1E3860', '#B8C4D6', '#F5C842', '#FFFFFF'],
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Amber and terracotta',
    colors: ['#7C2D12', '#C2410C', '#F97316', '#FDBA74', '#FFEDD5'],
  },
  {
    id: 'cool',
    name: 'Cool',
    description: 'Deep blues to sky',
    colors: ['#1E3A8A', '#2563EB', '#60A5FA', '#93C5FD', '#DBEAFE'],
  },
  {
    id: 'colorblind',
    name: 'Colorblind-safe',
    description: 'Wong palette — distinguishable for CVD',
    colors: ['#000000', '#E69F00', '#56B4E9', '#009E73', '#CC79A7'],
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'High-contrast for slides + posters',
    colors: ['#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9'],
  },
];

interface RecolorPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen palette (5 hex strings). Modal closes after. */
  onSubmit: (palette: string[]) => Promise<void> | void;
  /** External busy flag — disables submit while the parent runs the edge fn. */
  submitting?: boolean;
}

/**
 * Small modal that lets the user pick a palette to recolor a generated figure.
 * Six curated presets + a "Custom" tab with 5 hex-input chips.
 */
export function RecolorPickerModal({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: RecolorPickerModalProps) {
  const [selectedId, setSelectedId] = useState<string>(RECOLOR_PALETTES[0].id);
  const [customColors, setCustomColors] = useState<string[]>([
    '#0F172A', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  ]);

  const isCustom = selectedId === 'custom';
  const activePalette = isCustom
    ? customColors
    : (RECOLOR_PALETTES.find((p) => p.id === selectedId)?.colors ?? []);

  const handleSubmit = async () => {
    // Only valid hex strings survive — the edge function also filters, but do
    // the check here so we don't spend a credit on an obviously bad payload.
    const cleaned = activePalette.filter((c) => /^#[0-9A-Fa-f]{3,8}$/.test(c));
    if (cleaned.length === 0) return;
    await onSubmit(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <Palette className="h-6 w-6 text-primary" />
          </div>
          <DialogHeader>
            <h2 className="text-center text-xl font-bold text-slate-900 tracking-tight">
              Recolor figure
            </h2>
            <p className="text-center text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
              Pick a palette. The AI keeps the structure, labels, and lines — only colors change.
              <span className="block mt-1 text-xs font-medium text-primary">1 AI credit</span>
            </p>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {RECOLOR_PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                'w-full text-left rounded-xl border transition-all p-3 hover:border-primary/40',
                selectedId === p.id
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                  {selectedId === p.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="flex gap-1">
                  {p.colors.map((c) => (
                    <div
                      key={c}
                      className="h-5 w-5 rounded-full border border-slate-200 shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">{p.description}</p>
            </button>
          ))}

          {/* Custom palette row */}
          <button
            type="button"
            onClick={() => setSelectedId('custom')}
            className={cn(
              'w-full text-left rounded-xl border transition-all p-3 hover:border-primary/40',
              isCustom
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                : 'border-slate-200 bg-white'
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-900">Custom</span>
                {isCustom && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </div>
            <div className="flex gap-1.5">
              {customColors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="h-6 w-6 rounded-full border border-slate-200 shadow-sm"
                    style={{ backgroundColor: c }}
                  />
                  {/* Text input keyed to allow live edits when Custom is active */}
                  <Input
                    type="text"
                    value={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId('custom');
                    }}
                    onChange={(e) => {
                      e.stopPropagation();
                      const next = [...customColors];
                      next[i] = e.target.value;
                      setCustomColors(next);
                      setSelectedId('custom');
                    }}
                    className="w-16 h-6 text-[10px] tabular-nums px-1 text-center"
                    disabled={!isCustom}
                  />
                </div>
              ))}
            </div>
          </button>
        </div>

        <DialogFooter className="px-6 pb-5 pt-4 border-t border-slate-100 bg-white flex-shrink-0 sm:justify-between items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Recoloring…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Recolor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
