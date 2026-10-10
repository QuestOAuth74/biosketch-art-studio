import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

interface ProgramCard {
  image: string;
  category: string;
  title: string;
  onClick?: () => void;
}

interface BiosketchHeroProps {
  title: string;
  subtitle: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  disclaimer?: string;
  programs?: ProgramCard[];
  /**
   * Optional prompt-and-illustration pair rendered in the hero, below the
   * CTAs. Prompt sits in a mono-styled scrollable card on the left; the
   * generated illustration sits in a browser-chrome frame on the right.
   * Mirrors the PromptToIllustrationCarousel visual language.
   */
  showcase?: {
    title: string;
    prompt: string;
    imageUrl: string;
    imageAlt?: string;
  };
  className?: string;
}

/**
 * Hero section for the BioSketch home page.
 * Adapted from the PulseFit hero template — internal header removed
 * since the home page uses MainLayout's existing TopNavBar.
 */
export function BiosketchHero({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  disclaimer,
  programs = [],
  showcase,
  className,
}: BiosketchHeroProps) {
  return (
    <section
      className={cn(
        "relative w-full flex flex-col overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background",
        className
      )}
      role="banner"
      aria-label="Hero section"
    >
      {/* Main Content — dropped the min-h-[calc(100vh-4rem)] so the hero no
          longer eats a full viewport; padding tightened 16 → 10 (mobile) /
          10 → 14 (desktop); internal gap 8 → 5 for a more compact rhythm. */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="flex flex-col items-center text-center max-w-4xl gap-5"
        >
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight tracking-tight">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
            {subtitle}
          </p>

          {/* Action Buttons */}
          {(primaryAction || secondaryAction) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="flex flex-row items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 hover:-translate-y-0.5"
                >
                  {primaryAction.label}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M7 10H13M13 10L10 7M13 10L10 13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="px-8 py-4 rounded-full bg-card/60 border border-border text-foreground text-lg font-medium shadow-md hover:shadow-lg transition-all hover:scale-105 hover:-translate-y-0.5"
                >
                  {secondaryAction.label}
                </button>
              )}
            </motion.div>
          )}

          {/* Disclaimer */}
          {disclaimer && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-xs italic text-muted-foreground"
            >
              {disclaimer}
            </motion.p>
          )}
        </motion.div>

        {/* Prompt → Illustration showcase — sits in the hero below the CTAs
            when the parent passes a `showcase` prop. Left column is the
            actual prompt in a scrollable mono card; right column is the
            generated illustration in a browser-chrome frame. Same visual
            language as PromptToIllustrationCarousel. */}
        {showcase && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="w-full max-w-6xl mx-auto mt-10 md:mt-14"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
              {/* Prompt */}
              <div className="lg:col-span-5 flex flex-col text-left">
                <span
                  className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-primary"
                >
                  Prompt → Illustration
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight tracking-tight mb-4">
                  {showcase.title}
                </h3>
                <div className="flex-1 rounded-xl border border-border/70 bg-slate-50/70 p-4 max-h-[380px] overflow-y-auto shadow-inner">
                  <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-line font-mono">
                    {showcase.prompt}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Generated with BioSketch AI Illustrator (3D Glossy Style)
                </p>
              </div>

              {/* Image in browser chrome */}
              <div className="lg:col-span-7">
                <div className="relative group h-full">
                  <div className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative h-full rounded-3xl overflow-hidden border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35),0_10px_20px_-10px_rgba(15,23,42,0.15)] transition-transform duration-300 group-hover:-translate-y-1 flex flex-col">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200/60 bg-white/70 backdrop-blur shrink-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                      <div className="ml-3 flex-1 flex items-center justify-center h-6 rounded-md bg-slate-100/70 border border-slate-200/70">
                        <span className="text-[10px] font-mono text-slate-500 tracking-tight">
                          biosketch.art / {showcase.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-white p-3">
                      <img
                        src={showcase.imageUrl}
                        alt={showcase.imageAlt ?? showcase.title}
                        loading="eager"
                        className="max-w-full max-h-[520px] w-auto h-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Program Cards - Stacked Deck */}
      {programs.length > 0 && (
        <ProgramsStackedDeck programs={programs} />
      )}
    </section>
  );
}

const PROGRAMS_AUTO_ADVANCE_MS = 5000;

function ProgramsStackedDeck({ programs }: { programs: ProgramCard[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    if (isPaused || isHovered) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % programs.length);
    }, PROGRAMS_AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [isPaused, isHovered, programs.length]);

  const goNext = () => setActiveIndex((prev) => (prev + 1) % programs.length);
  const goPrev = () =>
    setActiveIndex((prev) => (prev - 1 + programs.length) % programs.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.7 }}
      className="relative z-10 w-full px-4"
      style={{ paddingTop: "32px", paddingBottom: "60px" }}
    >
      {/* Stacked card deck */}
      <div
        className="relative mx-auto"
        style={{
          width: "100%",
          maxWidth: "380px",
          height: "480px",
          perspective: "1200px",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {programs.map((program, index) => {
          const offset = (index - activeIndex + programs.length) % programs.length;
          const isVisible = offset < 4;
          const isTop = offset === 0;

          return (
            <motion.div
              key={index}
              initial={false}
              animate={{
                y: offset * 14,
                scale: 1 - offset * 0.05,
                rotateZ: offset === 0 ? 0 : (offset % 2 === 0 ? 1.5 : -1.5) * offset,
                opacity: isVisible ? 1 : 0,
                zIndex: programs.length - offset,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 26,
                mass: 0.8,
              }}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: isTop ? "auto" : "none",
              }}
              onClick={isTop ? program.onClick : undefined}
            >
              <div
                className="relative h-full w-full overflow-hidden cursor-pointer"
                style={{
                  borderRadius: "24px",
                  boxShadow: "0 16px 48px rgba(0, 0, 0, 0.18)",
                }}
              >
                <img
                  src={program.image}
                  alt={program.title}
                  className="h-full w-full object-cover"
                />

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)",
                  }}
                />

                {/* Step counter */}
                <div className="absolute top-5 right-5">
                  <span
                    className="text-xs font-mono text-white/80 tabular-nums px-2.5 py-1 rounded-full backdrop-blur-md"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  >
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(programs.length).padStart(2, "0")}
                  </span>
                </div>

                {/* Text content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.85)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                    }}
                  >
                    {program.category}
                  </span>
                  <h3
                    className="mt-2"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "26px",
                      fontWeight: 700,
                      color: "#FFFFFF",
                      lineHeight: "1.2",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {program.title}
                  </h3>

                  {/* Progress bar */}
                  <div className="mt-4 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    {isTop && !isPaused && !isHovered && (
                      <motion.div
                        key={`program-progress-${activeIndex}`}
                        className="h-full bg-white"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: PROGRAMS_AUTO_ADVANCE_MS / 1000,
                          ease: "linear",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={goPrev}
          className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
          aria-label="Previous program"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {programs.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex
                  ? "w-8 bg-slate-900"
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to program ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setIsPaused((p) => !p)}
          className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
          aria-label={isPaused ? "Resume autoplay" : "Pause autoplay"}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          onClick={goNext}
          className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
          aria-label="Next program"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
