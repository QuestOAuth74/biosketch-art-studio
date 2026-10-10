import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Ratio, Sparkles, Loader2, Check, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Target aspect + direction options. Kept in sync with the edge function's
 * ALLOWED_ASPECTS / ALLOWED_DIRECTIONS whitelists — if these ever drift the
 * edge function rejects the request with a clear error.
 */
export type TargetAspect = '1:1' | '3:4' | '4:3' | '16:9' | '2:3' | '9:16';
export type ExtendDirection = 'all' | 'left' | 'right' | 'top' | 'bottom';

interface AspectOption {
  id: TargetAspect;
  label: string;
  /** width/height ratio for the preview tile */
  ratio: number;
  hint: string;
}

const ASPECT_OPTIONS: AspectOption[] = [
  { id: '1:1',  label: '1:1',   ratio: 1,           hint: 'Square — social & thumbnails' },
  { id: '4:3',  label: '4:3',   ratio: 4 / 3,       hint: 'Classic landscape — slides' },
  { id: '3:4',  label: '3:4',   ratio: 3 / 4,       hint: 'Portrait — journal figures' },
  { id: '16:9', label: '16:9',  ratio: 16 / 9,      hint: 'Widescreen — presentations' },
  { id: '2:3',  label: '2:3',   ratio: 2 / 3,       hint: 'Poster portrait' },
  { id: '9:16', label: '9:16',  ratio: 9 / 16,      hint: 'Mobile portrait' },
];

interface DirectionOption {
  id: ExtendDirection;
  label: string;
  description: string;
}

const DIRECTION_OPTIONS: DirectionOption[] = [
  { id: 'all',    label: 'All sides', description: 'Spread the extension evenly' },
  { id: 'top',    label: 'Top',       description: 'Add space above the figure' },
  { id: 'bottom', label: 'Bottom',    description: 'Add space below the figure' },
  { id: 'left',   label: 'Left',      description: 'Add space to the left' },
  { id: 'right',  label: 'Right',     description: 'Add space to the right' },
];

interface AspectRatioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (targetAspect: TargetAspect, direction: ExtendDirection) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Modal that picks a target aspect ratio + the side(s) to extend the figure
 * on. Small mini-preview tiles show the target shape at a glance so the user
 * doesn't have to imagine what "3:4" looks like.
 */
export function AspectRatioModal({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: AspectRatioModalProps) {
  const [selectedAspect, setSelectedAspect] = useState<TargetAspect>('4:3');
  const [selectedDirection, setSelectedDirection] = useState<ExtendDirection>('all');

  const handleSubmit = async () => {
    await onSubmit(selectedAspect, selectedDirection);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <Ratio className="h-6 w-6 text-primary" />
          </div>
          <DialogHeader>
            <h2 className="text-center text-xl font-bold text-slate-900 tracking-tight">
              Change aspect ratio
            </h2>
            <p className="text-center text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
              The AI extends your figure into the new shape — existing content stays put, new content matches the style.
              <span className="block mt-1 text-xs font-medium text-primary">1 AI credit</span>
            </p>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Aspect chooser — six mini-preview tiles */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Target aspect
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {ASPECT_OPTIONS.map((opt) => {
                const isSelected = selectedAspect === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedAspect(opt.id)}
                    title={opt.hint}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all hover:border-primary/40',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-slate-200 bg-white'
                    )}
                  >
                    {/* Mini preview — the actual aspect ratio, capped at 56×56 */}
                    <div
                      className={cn(
                        'flex items-center justify-center border-2 rounded-md',
                        isSelected ? 'border-primary' : 'border-slate-300'
                      )}
                      style={{
                        width: opt.ratio >= 1 ? 56 : 56 * opt.ratio,
                        height: opt.ratio >= 1 ? 56 / opt.ratio : 56,
                      }}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="text-xs font-semibold tabular-nums text-slate-900">
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction chooser */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Move className="h-3 w-3" />
              Extend on
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {DIRECTION_OPTIONS.map((opt) => {
                const isSelected = selectedDirection === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedDirection(opt.id)}
                    title={opt.description}
                    className={cn(
                      'rounded-lg border py-2 px-1 text-xs font-medium transition-all',
                      isSelected
                        ? 'border-primary ring-1 ring-primary/20 bg-primary/5 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {DIRECTION_OPTIONS.find((d) => d.id === selectedDirection)?.description}
            </p>
          </div>
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
                Extending…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Change aspect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
