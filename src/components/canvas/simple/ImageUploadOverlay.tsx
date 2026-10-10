import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ImageUploadState } from '@/hooks/useImageUpload';

interface Props {
  state: ImageUploadState;
}

/**
 * Small centered overlay shown while an image is being read/decoded on the
 * Simple canvas. Determinate progress during the FileReader phase, spinner
 * during decode/insert.
 */
export function ImageUploadOverlay({ state }: Props) {
  if (state.phase === 'idle') return null;
  const pct = Math.round(state.progress * 100);
  const isReading = state.phase === 'reading';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-lg p-5 pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {isReading ? 'Uploading image' : 'Adding to canvas'}
          </span>
        </div>
        {state.fileName && (
          <div className="text-xs text-muted-foreground truncate mb-3">{state.fileName}</div>
        )}
        <Progress value={isReading ? pct : 100} className="h-2" />
        <div className="mt-2 text-xs text-muted-foreground text-right tabular-nums">
          {isReading ? `${pct}%` : 'Rendering…'}
        </div>
      </div>
    </div>
  );
}
