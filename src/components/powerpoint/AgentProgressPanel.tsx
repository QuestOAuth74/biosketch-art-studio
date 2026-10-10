import { CheckCircle, Loader2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentProgressPanelProps {
  currentStep: string | null | undefined;
  status: string | null;
  errorMessage: string | null;
}

const STEPS = [
  {
    key: 'drafting',
    label: 'Drafting Slides',
    description: 'AI summarizes key concepts and structures slides with tables and charts',
  },
  {
    key: 'reviewing',
    label: 'Reviewing Content',
    description: 'AI verifies content fidelity and critiques layout against source document',
  },
  {
    key: 'generating_images',
    label: 'Generating Images',
    description: 'AI creates scientific illustrations for key concepts',
  },
  {
    key: 'rendering',
    label: 'Rendering PowerPoint',
    description: 'Building final PowerPoint file',
  },
];

function getStepIndex(step: string | null | undefined): number {
  if (!step) return -1;
  if (step === 'uploading') return -1; // pre-step, before drafting starts
  if (step === 'completed') return STEPS.length; // all done
  return STEPS.findIndex((s) => s.key === step);
}

export const AgentProgressPanel = ({ currentStep, status, errorMessage }: AgentProgressPanelProps) => {
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing';

  // If processing but no currentStep info (migration not applied), show first step as active
  const activeIndex = getStepIndex(currentStep);
  const effectiveIndex = (isProcessing && activeIndex === -1) ? 0 : activeIndex;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Generation Progress
      </h3>
      <div className="space-y-1">
        {STEPS.map((step, index) => {
          let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';

          if (isCompleted) {
            state = 'done';
          } else if (isFailed) {
            if (index < effectiveIndex) state = 'done';
            else if (index === effectiveIndex) state = 'failed';
            else state = 'pending';
          } else if (isProcessing) {
            if (index < effectiveIndex) state = 'done';
            else if (index === effectiveIndex) state = 'active';
            else state = 'pending';
          }

          return (
            <div key={step.key} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute left-[11px] top-[28px] w-0.5 h-[calc(100%+4px-28px)]',
                    state === 'done' ? 'bg-green-500' : 'bg-border'
                  )}
                />
              )}

              {/* Step icon */}
              <div className="relative z-10 mt-0.5 shrink-0">
                {state === 'done' && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {state === 'active' && (
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                )}
                {state === 'failed' && (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                {state === 'pending' && (
                  <Circle className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>

              {/* Step content */}
              <div className="pb-6">
                <p
                  className={cn(
                    'text-sm font-medium',
                    state === 'active' && 'text-blue-600 dark:text-blue-400',
                    state === 'done' && 'text-green-600 dark:text-green-400',
                    state === 'failed' && 'text-red-600 dark:text-red-400',
                    state === 'pending' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {state === 'failed' && errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
