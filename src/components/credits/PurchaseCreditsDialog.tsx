import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Pricing, type PricingTier } from '@/components/ui/pricing';

interface PurchaseCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreditTier {
  usd: number;
  generations: number;
  perGen: string;
  bonusPct: number | null;
  label: string;
  description: string;
  popular?: boolean;
}

const TIERS: CreditTier[] = [
  {
    usd: 5,
    generations: 50,
    perGen: '$0.10',
    bonusPct: null,
    label: 'Starter pack',
    description: 'Enough to try every AI feature and finish a small figure.',
  },
  {
    usd: 10,
    generations: 120,
    perGen: '$0.083',
    bonusPct: 20,
    label: 'Best value',
    description: 'The sweet spot for a paper or grant illustration cycle.',
    popular: true,
  },
  {
    usd: 20,
    generations: 280,
    perGen: '$0.071',
    bonusPct: 40,
    label: 'Power user',
    description: 'Weeks of AI generations for heavy iteration and refinement.',
  },
];

export function PurchaseCreditsDialog({ open, onOpenChange }: PurchaseCreditsDialogProps) {
  const [loadingTier, setLoadingTier] = useState<number | null>(null);

  const startCheckout = async (usd: number) => {
    setLoadingTier(usd);
    try {
      const { data, error } = await supabase.functions.invoke('create-credit-checkout-session', {
        body: { tier: usd, origin: window.location.origin },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse failures */ }
        console.error('Checkout error:', { error, detail });
        throw new Error(detail);
      }
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err?.message || 'Could not start checkout');
      setLoadingTier(null);
    }
  };

  const anyLoading = loadingTier !== null;

  const pricingTiers: PricingTier[] = TIERS.map((tier) => {
    const isLoading = loadingTier === tier.usd;
    const features = [
      `${tier.generations} generations${tier.bonusPct ? ` (+${tier.bonusPct}%)` : ''}`,
      `${tier.perGen} / generation`,
    ];
    return {
      label: tier.label,
      price: `$${tier.usd}`,
      features,
      description: tier.description,
      buttonText: isLoading ? 'Redirecting…' : `Buy $${tier.usd}`,
      onSelect: () => startCheckout(tier.usd),
      isPopular: tier.popular,
      isLoading,
      disabled: anyLoading,
      badgeText: 'Best value',
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background max-h-[92vh] flex flex-col">
        <div className="relative px-6 pt-8 pb-4 border-b border-border flex-shrink-0">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <DialogHeader>
            <h2 className="text-center text-2xl font-bold text-foreground tracking-tight">
              Buy AI generations
            </h2>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-8">
            <Pricing tiers={pricingTiers} />
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 sm:justify-between items-center gap-2 border-t border-border pt-4 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            Payments handled securely by Stripe.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={anyLoading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
