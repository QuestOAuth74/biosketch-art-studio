import { useState } from 'react';
import { useGenerationBalance } from '@/hooks/useGenerationBalance';
import { PurchaseCreditsDialog } from './PurchaseCreditsDialog';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small pill in the top nav that shows AI generation balance.
 *
 * Per product decision: the pill is only visible once the user has used
 * at least one generation in the current window — new users don't see it
 * (avoids implying a limit before they've hit it).
 *
 * Click opens the purchase dialog.
 */
export function GenerationBalancePill() {
  const { data } = useGenerationBalance();
  const [showPurchase, setShowPurchase] = useState(false);

  // Hide until the user has hit the meter.
  if (!data) return null;
  if (data.grant_used === 0 && data.purchased === 0) return null;

  const empty = data.total_available === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPurchase(true)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
          empty
            ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
            : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15',
        )}
        title={`${data.grant_remaining} free + ${data.purchased} purchased`}
      >
        <Sparkles className="h-3 w-3" />
        <span className="tabular-nums">{data.total_available}</span>
        <span className="text-muted-foreground font-normal hidden sm:inline">generations</span>
      </button>

      <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
    </>
  );
}
