import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium smooth-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        glass: "bg-white/60 dark:bg-card/50 backdrop-blur-lg border border-white/20 dark:border-white/10 text-foreground shadow-sm hover:bg-white/70 dark:hover:bg-card/60 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        sticky: "bg-[hsl(var(--highlighter-yellow))] text-[hsl(var(--graphite))] shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:shadow-[3px_3px_0_rgba(0,0,0,0.15)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-[1px_1px_0_rgba(0,0,0,0.1)] active:translate-x-[1px] active:translate-y-[1px] border border-[hsl(var(--highlighter-yellow)_/_0.3)] font-caveat font-semibold",
        ink: "bg-[hsl(var(--ink-blue))] text-white shadow-sm hover:bg-[hsl(var(--ink-blue)_/_0.9)] hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-[hsl(var(--ink-blue))]",
        pencil: "border-2 border-[hsl(var(--pencil-gray))] bg-background text-[hsl(var(--pencil-gray))] hover:bg-[hsl(var(--pencil-gray)_/_0.05)] hover:border-[hsl(var(--graphite))] hover:scale-[1.02] active:scale-[0.98] shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
