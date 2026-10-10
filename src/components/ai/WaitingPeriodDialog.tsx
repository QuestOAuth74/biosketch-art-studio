import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PurchaseCreditsDialog } from '@/components/credits/PurchaseCreditsDialog';
import { Clock } from 'lucide-react';

interface WaitingPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ISO timestamp when the gate lifts. Null falls back to a generic "come back tomorrow" message. */
  unlockAt: string | null;
}

/** hh h mm m format for a positive millisecond delta. */
function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return 'less than a minute';
}

/**
 * Shown when a signed-in user tries to run an AI generation inside their first
 * 24 hours. Purpose is to filter out drive-by signups who drain free credits
 * without engaging with the platform.
 */
export function WaitingPeriodDialog({ open, onOpenChange, unlockAt }: WaitingPeriodDialogProps) {
  const [showPurchase, setShowPurchase] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(
    unlockAt ? new Date(unlockAt).getTime() - Date.now() : null,
  );

  useEffect(() => {
    if (!open || !unlockAt) return;
    const target = new Date(unlockAt).getTime();
    const tick = () => setRemainingMs(target - Date.now());
    tick();
    // 30s cadence — the countdown is displayed in minutes, so sub-minute precision is wasted.
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [open, unlockAt]);

  const remainingLabel =
    remainingMs !== null && remainingMs > 0 ? formatRemaining(remainingMs) : 'soon';

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              High demand — please come back soon
            </AlertDialogTitle>
            <AlertDialogDescription>
              To keep AI running smoothly for everyone, free credits become available 24 hours
              after signup. Your free credits unlock in{' '}
              <span className="font-semibold text-foreground">{remainingLabel}</span>.
              <br />
              <br />
              Can't wait? Purchase credits and skip the wait — buying instantly unlocks AI on
              your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between gap-2">
            <AlertDialogCancel className="mt-0">I'll come back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onOpenChange(false);
                setShowPurchase(true);
              }}
            >
              Buy credits now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
    </>
  );
}
