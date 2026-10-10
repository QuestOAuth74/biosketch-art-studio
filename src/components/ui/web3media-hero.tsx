import React from "react";
import { cn } from "@/lib/utils";

interface Web3MediaHeroProps {
  title: string;
  highlightedText?: string;
  subtitle: string;
  ctaButton?: {
    label: string;
    onClick: () => void;
  };
  floatingIcons?: any[];
  trustedByText?: string;
  brands?: any[];
  className?: string;
  children?: React.ReactNode;
  glowColor?: string;
  highlightGradient?: string;
}

export function Web3MediaHero({
  title,
  highlightedText,
  subtitle,
  ctaButton,
  className,
  children,
}: Web3MediaHeroProps) {
  return (
    <section
      className={cn(
        "relative w-full flex flex-col rounded-xl border border-border/40",
        className
      )}
      style={{ background: "hsl(var(--muted) / 0.3)" }}
      role="banner"
      aria-label="Hero section"
    >
      {/* Main Content */}
      {children ? (
        <div className="relative flex-1 flex items-center justify-center w-full">
          {children}
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-14">
          {/* Title */}
          <h1
            className="font-serif font-bold text-foreground tracking-tight text-center"
            style={{ fontSize: "clamp(26px, 4vw, 42px)", lineHeight: "1.2" }}
          >
            {title}
            {highlightedText && (
              <>
                {" "}
                <span className="text-primary">{highlightedText}</span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p
            className="text-muted-foreground max-w-lg leading-relaxed text-center mt-3"
            style={{ fontSize: "clamp(13px, 1.8vw, 15px)" }}
          >
            {subtitle}
          </p>

          {/* CTA Button */}
          {ctaButton && (
            <button
              onClick={ctaButton.onClick}
              className="mt-5 px-6 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium transition-all hover:border-primary/30 hover:shadow-sm"
            >
              {ctaButton.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
