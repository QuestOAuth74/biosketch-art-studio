import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal scroll-snap carousel of prompt → illustration pairs. Each slide
 * is one AI-generated figure with the verbatim prompt beside it. Native
 * scroll-snap handles touch/trackpad swipe; arrow buttons scroll one slide,
 * dot indicators jump to a specific slide, and ← / → keys work when the
 * carousel is focused.
 *
 * Shared component — used on the marketing home page and the Free AI Credits
 * page. Data ships alongside so callers don't need to duplicate the four
 * real prompt / output pairs.
 */

// Real prompt+image pairs the team has generated in the AI Illustrator.
// Each slide shows the *actual* prompt (verbatim) next to the output — a
// proof point that mid-length editorial prompts do produce publication-
// grade figures. Images live in the public "badges folder" bucket in
// Supabase.
export const PROMPT_TO_ILLUSTRATION_SLIDES: {
  title: string;
  prompt: string;
  imageUrl: string;
  alt: string;
}[] = [
  {
    title: "Pathogen evasive mechanisms",
    prompt: `Create a clean 2 × 3 educational infographic in a flat, biomedical illustration-inspired style on a white background. Separate the six panels with thin gray lines and place a light-lilac title bar with bold black text above each panel. Depict pathogens as simple blue circles, phagocytes as irregular yellow amoeboid cells containing a pale-purple multilobed nucleus and small purple lysosomes, toxins and proteins as red dots, antibodies as red Y-shapes, and processes with white outlined arrows or thin red arrows.

Across the top row, show toxin release, opsonization prevented, and contact with phagocyte prevented. Across the bottom row, show phagolysosome fusion inhibited, escape into the cytoplasm, and resistance to killing. Add a short explanatory caption beneath each panel and include representative organisms: staphylococci, streptococci, Streptococcus pneumoniae, Bacillus anthracis, Mycobacterium tuberculosis, Toxoplasma, Chlamydia, Leishmania, Trypanosoma cruzi, and Mycobacterium leprae.`,
    imageUrl:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20PATHOGEN%20EVASION.png",
    alt: "Six-panel biomedical infographic illustrating pathogen immune evasion mechanisms",
  },
  {
    title: "Peanut illustration",
    prompt: `Create a simple editorial botanical infographic of peanut plant, Arachis hypogaea centered isolated plant specimen, selective labels, peanut internal structure detail of a peanut, minimal botanical infographic style.`,
    imageUrl:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20PEANUT.png",
    alt: "Botanical infographic of a peanut plant (Arachis hypogaea) with labeled internal seed structure",
  },
  {
    title: "Osteoporosis architecture",
    prompt: `Create a high-resolution, publication-ready biomedical comparison illustration showing the internal microarchitecture of normal trabecular bone versus osteoporotic trabecular bone. Use a clean 16:9 horizontal composition on a pure white background, with two large cutaway bone cubes positioned side by side at equal scale and viewed from a slightly elevated three-quarter angle.

Depict Normal bone as a light blush-pink cube with a dense, interconnected trabecular network — many fine rounded marrow spaces surrounded by thick continuous struts. Depict Osteoporosis as a deeper rose-brown cube with clear structural loss — thinner fragile trabeculae, broken bridges, enlarged marrow cavities. Cubes must remain identical in overall size so the reduced bone density is immediately obvious. Muted clinical palette, subtle ambient occlusion, soft pale-gray shadows, no labels inside the cubes, no watermarks.`,
    imageUrl:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20OSTEOPOROSIS.png",
    alt: "Side-by-side 3D comparison of normal trabecular bone versus osteoporotic bone",
  },
  {
    title: "Wnt signaling pathway",
    prompt: `Create a publication-ready, landscape biomedical pathway infographic titled "Wnt Signaling Pathways Regulate Cell-Cycle Progression." Cell Press–style aesthetic with a white background, crisp dark-gray linework, muted pastel colors, smooth semi-flat vector rendering.

Compose the figure as an integrated left-to-right signaling map that connects Wnt receptor activation at the plasma membrane to two distinct outcomes: canonical β-catenin–dependent G1/S progression and Wnt/STOP–dependent G2/M progression and mitotic control. Show a Wnt ligand binding Frizzled + LRP5/6, DVL adaptor, an inhibited β-catenin destruction complex (APC · Axin · GSK3 · CK1), stabilized β-catenin entering the nucleus to activate c-MYC and Cyclin D. On the Wnt/STOP branch, show stabilization of Protein X/Y/Z leading to cell-size, spindle assembly, and mitotic control panels. Include a circular G1 · S · G2 · M cell-cycle diagram in the lower right.`,
    imageUrl:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20WNT%20SIGNALING.png",
    alt: "Wnt signaling pathway infographic showing canonical β-catenin and Wnt/STOP branches",
  },
];

// Inlined Eyebrow used inside slides — was a small local helper in HomeBento;
// duplicated here so the carousel is self-contained and doesn't require
// downstream callers to also import a marketing helper.
const SlideEyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/60">
    <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-primary" aria-hidden>
      <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
      <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
      <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="6" cy="6" r="1.1" fill="currentColor" />
    </svg>
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</span>
  </div>
);

export const PromptToIllustrationCarousel = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync activeIndex with the slide currently centered in the scroller so
  // arrow buttons and dot indicators always reflect what the user is seeing.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible entry — IntersectionObserver may fire multiple
        // entries during a scroll, so choose the one with the highest ratio.
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) {
          const idx = slideRefs.current.findIndex((el) => el === best.target);
          if (idx !== -1) setActiveIndex(idx);
        }
      },
      { root: scroller, threshold: [0.5, 0.75, 1] },
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToIndex = useCallback((i: number) => {
    const el = slideRefs.current[i];
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollToIndex(Math.min(activeIndex + 1, PROMPT_TO_ILLUSTRATION_SLIDES.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollToIndex(Math.max(activeIndex - 1, 0));
    }
  };

  return (
    <div className="relative" tabIndex={0} onKeyDown={onKeyDown} aria-label="Prompt to illustration carousel" role="region">
      <div
        ref={scrollerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden -mx-3 md:-mx-5 px-3 md:px-5"
        style={{ scrollbarWidth: "none" as const, msOverflowStyle: "none" as const }}
      >
        {PROMPT_TO_ILLUSTRATION_SLIDES.map((slide, i) => (
          <div
            key={slide.title}
            ref={(el) => (slideRefs.current[i] = el)}
            className="snap-start shrink-0 w-full pr-3 md:pr-5 last:pr-0"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${PROMPT_TO_ILLUSTRATION_SLIDES.length}: ${slide.title}`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
              {/* Prompt */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="mb-3"><SlideEyebrow>Prompt {i + 1} of {PROMPT_TO_ILLUSTRATION_SLIDES.length}</SlideEyebrow></div>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight tracking-tight mb-4">
                  {slide.title}
                </h3>
                <div className="flex-1 rounded-xl border border-border/70 bg-slate-50/70 p-4 max-h-[340px] overflow-y-auto shadow-inner">
                  <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-line font-mono">
                    {slide.prompt}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Generated with BioSketch AI Illustrator
                </p>
              </div>

              {/* Image */}
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
                          biosketch.art / {slide.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-white p-3">
                      <img
                        src={slide.imageUrl}
                        alt={slide.alt}
                        loading="lazy"
                        className="max-w-full max-h-[440px] w-auto h-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
        disabled={activeIndex === 0}
        aria-label="Previous prompt"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-11 w-11 items-center justify-center rounded-full bg-white border border-border shadow-md text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(Math.min(activeIndex + 1, PROMPT_TO_ILLUSTRATION_SLIDES.length - 1))}
        disabled={activeIndex === PROMPT_TO_ILLUSTRATION_SLIDES.length - 1}
        aria-label="Next prompt"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-11 w-11 items-center justify-center rounded-full bg-white border border-border shadow-md text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {PROMPT_TO_ILLUSTRATION_SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to prompt ${i + 1}: ${slide.title}`}
            aria-current={i === activeIndex}
            className={`h-2 rounded-full transition-all ${
              i === activeIndex ? "w-8 bg-primary" : "w-2 bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default PromptToIllustrationCarousel;
