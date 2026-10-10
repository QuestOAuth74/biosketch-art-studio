import { Heart, Sparkles, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DONATION_TIERS } from './tiers';

interface DonationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional intro banner rendered above the tier grid (e.g. the
   * "You've built X projects" copy for the post-3-projects prompt).
   */
  intro?: React.ReactNode;
  /**
   * Called after a tier is picked and the Stripe link opened.
   * Lets callers do things like write a "donated" flag to localStorage.
   */
  onDonate?: (amount: number) => void;
}

/**
 * Donation picker modal — three tier cards in the "pricing panel" style:
 * elevated popular card in the middle with a corner-clipped Star badge,
 * emoji chip, tier label, big price, and a full-width CTA button. Shared
 * by the footer/home Donate button and the auto-fired post-3-projects
 * prompt (which passes an `intro` node above the grid).
 */
export function DonationPickerModal({
  open,
  onOpenChange,
  intro,
  onDonate,
}: DonationPickerModalProps) {
  const pickTier = (url: string, amount: number) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onDonate?.(amount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white max-h-[92vh] flex flex-col">
        {/* Header — clean white, warm framing (pinned) */}
        <div className="relative px-6 pt-8 pb-6 border-b border-slate-100 flex-shrink-0">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shadow-sm">
            <Heart className="h-7 w-7 text-rose-500 fill-rose-100" />
          </div>
          <DialogHeader>
            <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight">
              Support BioSketch
            </h2>
          </DialogHeader>
        </div>

        {/* Scrollable middle: optional intro + tier cards */}
        <div className="flex-1 overflow-y-auto">
          {intro && (
            <div className="px-6 pt-5 -mb-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>{intro}</div>
              </div>
            </div>
          )}

          {/* Tier cards — elevated popular in the middle, framer entrance */}
          <div className="px-6 py-6 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {DONATION_TIERS.map((tier, index) => (
                <motion.div
                  key={tier.amount}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: tier.popular ? -8 : 0, opacity: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.05 + index * 0.08,
                    type: 'spring',
                    stiffness: 120,
                    damping: 20,
                  }}
                  className={cn(
                    'relative rounded-2xl p-5 bg-white flex flex-col text-center',
                    tier.popular
                      ? 'border-2 border-primary shadow-[0_20px_45px_-25px_rgba(15,23,42,0.25)]'
                      : 'border border-slate-200 shadow-sm',
                  )}
                >
                  {tier.popular && (
                    <div className="absolute top-0 right-0 bg-primary py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
                      <Star className="h-3 w-3 text-primary-foreground fill-current" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                        Popular
                      </span>
                    </div>
                  )}

                  {/* Emoji chip in the tier colour — anchors the card visually */}
                  <div
                    className={cn(
                      'mx-auto inline-flex items-center justify-center w-11 h-11 rounded-xl mb-3 text-2xl shadow-sm',
                      tier.colors.chipBg,
                    )}
                    aria-hidden
                  >
                    {tier.emoji}
                  </div>

                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    {tier.label}
                  </p>

                  {/* Big price with $ prefix — tabular for consistent widths across tiers */}
                  <div className="mt-3 flex items-baseline justify-center gap-1">
                    <span className="text-lg font-semibold text-slate-400 tabular-nums">
                      $
                    </span>
                    <span className="text-4xl font-bold text-slate-900 tabular-nums leading-none">
                      {tier.amount}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-1">one-time</p>

                  <hr className="my-5 border-slate-100" />

                  <button
                    type="button"
                    onClick={() => pickTier(tier.url, tier.amount)}
                    className={cn(
                      'w-full h-10 rounded-lg text-sm font-semibold transition-all duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      tier.popular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                        : 'border border-slate-200 bg-white text-slate-800 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md',
                    )}
                  >
                    Donate ${tier.amount}
                  </button>

                  <p className="mt-3 text-[11px] text-slate-500 leading-snug">
                    {tier.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 sm:justify-between items-center gap-2 border-t border-slate-100 pt-4 bg-white flex-shrink-0">
          <p className="text-xs text-slate-500">
            Payments handled securely by Stripe.
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
