import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';

export interface PricingTier {
  label: string;
  /** Display price, e.g. "$5". Rendered as-is. */
  price: string;
  /** Bulleted feature strings. */
  features: string[];
  description: string;
  buttonText: string;
  onSelect: () => void;
  isPopular?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  /** Text shown in the corner-clipped Popular badge (default "Popular"). */
  badgeText?: string;
}

export interface PricingProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  tiers: PricingTier[];
}

/**
 * Pricing showcase — three-column card grid. The outer cards are pushed back
 * with a subtle 3D rotation on desktop, and the "popular" middle card is
 * elevated with a primary border and corner Star badge. Adapted from a shadcn
 * pricing block, minus the monthly/yearly toggle (our data model is one-time
 * purchases, so a period toggle doesn't apply).
 */
export function Pricing({
  title,
  description,
  tiers,
  className,
  ...props
}: PricingProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className={cn('w-full', className)} {...props}>
      {(title || description) && (
        <div className="text-center space-y-3 mb-8">
          {title && (
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-muted-foreground text-sm md:text-base whitespace-pre-line">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 pb-2">
        {tiers.map((tier, index) => {
          const isOuter = index === 0 || index === tiers.length - 1;
          return (
            <motion.div
              key={tier.label}
              initial={{ y: 50, opacity: 0 }}
              whileInView={
                isDesktop
                  ? {
                      y: tier.isPopular ? -20 : 0,
                      opacity: 1,
                      x: index === tiers.length - 1 ? -30 : index === 0 ? 30 : 0,
                      scale: isOuter ? 0.94 : 1.0,
                    }
                  : { y: 0, opacity: 1 }
              }
              viewport={{ once: true }}
              transition={{
                duration: 1.2,
                type: 'spring',
                stiffness: 100,
                damping: 30,
                delay: 0.2,
                opacity: { duration: 0.4 },
              }}
              className={cn(
                'relative rounded-2xl p-6 bg-background text-center flex flex-col',
                tier.isPopular ? 'border-2 border-primary' : 'border border-border',
                !tier.isPopular && 'md:mt-5',
                isOuter ? 'z-0' : 'z-10',
                index === 0 && 'md:origin-right',
                index === tiers.length - 1 && 'md:origin-left',
              )}
            >
              {tier.isPopular && (
                <div className="absolute top-0 right-0 bg-primary py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
                  <Star className="text-primary-foreground h-3.5 w-3.5 fill-current" />
                  <span className="text-primary-foreground text-xs font-semibold uppercase tracking-wide">
                    {tier.badgeText ?? 'Popular'}
                  </span>
                </div>
              )}

              <div className="flex-1 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {tier.label}
                </p>

                <div className="mt-5 flex items-baseline justify-center gap-x-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                    {tier.price}
                  </span>
                </div>

                <ul className="mt-6 gap-2 flex flex-col text-sm">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-left text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <hr className="w-full my-5 border-border" />

                <button
                  type="button"
                  onClick={tier.onSelect}
                  disabled={tier.disabled || tier.isLoading}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'group relative w-full gap-2 overflow-hidden text-base font-semibold tracking-tight',
                    'transform-gpu transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:bg-primary hover:text-primary-foreground',
                    'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground disabled:hover:ring-0',
                    tier.isPopular
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground',
                  )}
                >
                  {tier.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tier.buttonText}
                </button>

                <p className="mt-4 text-xs leading-snug text-muted-foreground">
                  {tier.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
