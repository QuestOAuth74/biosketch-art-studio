import * as React from 'react';
import { cn } from '@/lib/utils';

interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ selected = false, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-full transition-all duration-200',
          selected
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

FilterPill.displayName = 'FilterPill';
