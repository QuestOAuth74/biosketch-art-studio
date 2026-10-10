import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DonationPickerModal } from './DonationPickerModal';

interface DonateButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  className?: string;
}

/**
 * Opens the donation picker modal, which shows the three tiers as cards.
 * Each tier links to its own Stripe Payment Link in a new tab.
 */
export function DonateButton({
  variant = 'default',
  size = 'default',
  label = 'Donate',
  className,
}: DonateButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn('gap-1.5', className)}
      >
        <Heart className="h-4 w-4" />
        {label}
      </Button>
      <DonationPickerModal open={open} onOpenChange={setOpen} />
    </>
  );
}
