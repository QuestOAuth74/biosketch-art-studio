import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveGeneration } from '@/hooks/useActiveGeneration';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const STEP_LABELS: Record<string, string> = {
  uploading: 'Uploading...',
  drafting: 'Summarizing & drafting...',
  reviewing: 'Verifying content...',
  generating_images: 'Generating images...',
  rendering: 'Rendering...',
  completed: 'Done!',
};

export const PowerPointFloatingStatus = () => {
  const { data: active, isLoading } = useActiveGeneration();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const prevActiveRef = useRef<boolean>(false);

  // Detect when generation finishes (active goes from truthy to null)
  useEffect(() => {
    if (active) {
      prevActiveRef.current = true;
    } else if (prevActiveRef.current && !active) {
      // Was processing, now gone → completed or failed
      prevActiveRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['powerpoint-generations'] });

      // Only toast if not already on the powerpoint page
      if (location.pathname !== '/powerpoint') {
        toast.success('PowerPoint is ready!', {
          description: 'Your presentation has been generated.',
          action: {
            label: 'Download',
            onClick: () => navigate('/powerpoint'),
          },
          duration: 8000,
        });
      }
      setDismissed(false);
    }
  }, [active, queryClient, navigate, location.pathname]);

  // Hide on the /powerpoint page (full progress panel shown there)
  if (location.pathname === '/powerpoint') return null;

  // Nothing to show
  if (isLoading || !active || dismissed) return null;

  const stepLabel = STEP_LABELS[active.current_step || 'uploading'] || active.current_step;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border shadow-lg px-4 py-3 cursor-pointer transition-colors',
          'bg-card hover:bg-accent/50'
        )}
        onClick={() => navigate('/powerpoint')}
      >
        <div className="shrink-0">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate max-w-[200px]">
            {active.original_filename}
          </p>
          <p className="text-xs text-muted-foreground">{stepLabel}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
