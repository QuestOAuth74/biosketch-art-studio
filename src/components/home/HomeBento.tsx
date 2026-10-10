import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import {
  Atom,
  Camera,
  PencilLine,
  TextAa,
  ArrowsClockwise,
  ImageSquare,
  MagicWand,
  FlowArrow,
  ListChecks,
  Calendar,
} from "@phosphor-icons/react";
import {
  ArrowRight,
  Sparkles,
  Users,
  Heart,
  Play,
  Film,
  Clock,
  MoveHorizontal,
  Wand2,
  Zap,
  BarChart3,
  LineChart,
  ScatterChart,
  PieChart,
  AreaChart,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PromptToIllustrationCarousel } from "@/components/PromptToIllustrationCarousel";

/**
 * Vertical stack of full-width "hero cards" that flow below BiosketchHero.
 * Each section is its own self-contained composition the user scrolls into.
 */

// Curated 4-icon showcase for the home page — served from the Supabase
// "badges folder" bucket (public). Click behavior sends users to /icons
// (or /auth when signed out) rather than an individual icon detail page.
const HOME_FEATURED_ICONS = [
  { filename: "cell with components 1 of 4.png", name: "Cell" },
  { filename: "microscope 2 of 4.png", name: "Microscope" },
  { filename: "lab rat 3 of 4.png", name: "Lab rat" },
  { filename: "folded protein 4 of 4.png", name: "Folded protein" },
];

const AI_FEATURES = [
  { icon: <Atom size={20} weight="duotone" />, name: "Icon Generator" },
  { icon: <TextAa size={20} weight="duotone" />, name: "Text to Figure" },
  { icon: <PencilLine size={20} weight="duotone" />, name: "Sketch to Illustration" },
  { icon: <Camera size={20} weight="duotone" />, name: "Photo to 2D" },
  { icon: <ArrowsClockwise size={20} weight="duotone" />, name: "Image to Figure" },
  { icon: <ImageSquare size={20} weight="duotone" />, name: "Reference to Figure" },
  { icon: <MagicWand size={20} weight="duotone" />, name: "Illustration Enhancer" },
  { icon: <FlowArrow size={20} weight="duotone" />, name: "Flowchart" },
  { icon: <ListChecks size={20} weight="duotone" />, name: "Protocol Diagram" },
  { icon: <Calendar size={20} weight="duotone" />, name: "Experimental Timeline" },
];

const ANIMATION_FEATURES = [
  { icon: <Play className="w-5 h-5" />, name: "Keyframe timeline" },
  { icon: <MoveHorizontal className="w-5 h-5" />, name: "Motion paths" },
  { icon: <Clock className="w-5 h-5" />, name: "Easing curves" },
  { icon: <Wand2 className="w-5 h-5" />, name: "Reveal & morph" },
  { icon: <Zap className="w-5 h-5" />, name: "Snap-to-canvas" },
  { icon: <Film className="w-5 h-5" />, name: "Export to MP4 / GIF" },
];

const GRAPH_FEATURES = [
  { icon: <BarChart3 className="w-5 h-5" />, name: "Bar & column" },
  { icon: <LineChart className="w-5 h-5" />, name: "Line & multi-axis" },
  { icon: <ScatterChart className="w-5 h-5" />, name: "Scatter & regression" },
  { icon: <AreaChart className="w-5 h-5" />, name: "Area & stacked" },
  { icon: <PieChart className="w-5 h-5" />, name: "Pie & donut" },
  { icon: <TrendingUp className="w-5 h-5" />, name: "Error bars & CI" },
];

const AtomicOrbits = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 200 200" className={className}>
    <defs>
      <linearGradient id="bentoOrbitFade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    <g stroke="url(#bentoOrbitFade)" fill="none" strokeWidth="1.4">
      <ellipse cx="100" cy="100" rx="78" ry="28" />
      <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(60 100 100)" />
      <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(-60 100 100)" />
    </g>
    <g className="text-primary" fill="currentColor">
      <circle cx="100" cy="100" r="6" opacity="0.55" />
      <circle cx="172" cy="106" r="3.5" opacity="0.7" />
      <circle cx="56" cy="72" r="2.8" opacity="0.5" />
      <circle cx="68" cy="146" r="2.5" opacity="0.4" />
    </g>
  </svg>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
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

const cardBase =
  "relative overflow-hidden rounded-[28px] border border-border bg-card/80 backdrop-blur-sm shadow-xl";

const RevealWrap = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 32 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const CTAButton = ({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ComponentType<{ className?: string }> }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg hover:shadow-xl hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
    <ArrowRight className="w-4 h-4" />
  </button>
);

const IconChip = ({ children }: { children: React.ReactNode }) => (
  <div className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary">
    {children}
  </div>
);

/**
 * Framed walkthrough video with a small browser-chrome header for a more
 * editorial, "product screenshot" feel than a plain rounded rectangle.
 * Video autoplays, muted, looped, no controls; ambient primary glow appears
 * on hover. Aspect ratio locked to 16:9 so the frame stays professional
 * regardless of the source video's native size.
 */
const WalkthroughVideo = ({
  src,
  ariaLabel,
  urlLabel = "biosketch.art",
}: {
  src: string;
  ariaLabel: string;
  urlLabel?: string;
}) => (
  <div className="relative group">
    {/* Ambient glow */}
    <div className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
    {/* Frame */}
    <div className="relative rounded-3xl overflow-hidden border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35),0_10px_20px_-10px_rgba(15,23,42,0.15)] transition-transform duration-300 group-hover:-translate-y-1">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200/60 bg-white/70 backdrop-blur">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 flex-1 flex items-center justify-center h-6 rounded-md bg-slate-100/70 border border-slate-200/70">
          <span className="text-[10px] font-mono text-slate-500 tracking-tight">{urlLabel}</span>
        </div>
      </div>
      {/* Inline SVG unsharp-mask filter used by the <video> below. Rendered
          zero-size and hidden from AT — it's just a definition. Kernel is a
          classic 3×3 sharpen (center 5, cardinal −1). Cheap on GPU; runs on
          every frame automatically because it's applied via CSS `filter`. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="video-sharpen">
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="0 -0.25 0  -0.25 2 -0.25  0 -0.25 0"
          />
        </filter>
      </svg>
      {/* Video */}
      <video
        src={src}
        className="w-full h-auto block pointer-events-none aspect-video object-cover bg-slate-900/5"
        style={{
          // Real-time perceived-sharpness pass on the video pixels:
          //   1. Convolution unsharp mask defined above lifts edges.
          //   2. Small contrast + saturation bump so the mid-tones don't
          //      look grey after the mask normalizes edge energy.
          //   3. GPU compositing hint so the browser uses its higher-quality
          //      scaler when upsampling the video to the container width.
          filter: 'url(#video-sharpen) contrast(1.03) saturate(1.03)',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
        autoPlay
        playsInline
        muted
        loop
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        aria-label={ariaLabel}
      />
    </div>
  </div>
);

// Prompt → illustration carousel extracted to a shared component so it's
// reusable across pages (home + Free AI Credits). See
// src/components/PromptToIllustrationCarousel.tsx for the data + component.

export const HomeBento = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["home-stack-stats"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const [projectsRes, userCountRes] = await Promise.all([
        supabase
          .from("canvas_projects")
          .select("view_count, like_count")
          .eq("is_public", true)
          .eq("approval_status", "approved")
          .neq("is_brush", true),
        // Same RPC the Auth page uses for its "joined by N users" footer —
        // gives the true auth.users count, not the (RLS-restricted) profiles count.
        supabase.rpc("get_user_count"),
      ]);
      const data = projectsRes.data ?? [];
      const userCount = typeof userCountRes.data === "number" ? userCountRes.data : 0;
      return {
        users: userCount,
        views: data.reduce((s, p) => s + (p.view_count || 0), 0),
        likes: data.reduce((s, p) => s + (p.like_count || 0), 0),
      };
    },
  });

  return (
    <div>
      {/* ── 1 · Open Source Library ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <AtomicOrbits className="pointer-events-none absolute -top-10 -right-10 w-72 h-72 md:w-96 md:h-96 text-muted-foreground opacity-25" />
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Copy */}
              <div className="lg:col-span-6">
                <div className="mb-5"><Eyebrow>Open Source Library</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  <span className="italic font-crimson text-primary">
                    Open
                  </span>{" "}
                  source icons
                  <br />
                  for biomedical researchers.
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
                  A free, growing library of editable scientific illustrations — proteins,
                  cells, organisms, anatomy, lab kit — released under permissive licenses.
                  Drop any icon onto the BioSketch canvas, recolor, regroup, remix.
                </p>
                <CTAButton onClick={() => navigate("/icons")}>Browse the library</CTAButton>
              </div>

              {/* Icon previews — curated 4-image showcase from the badges bucket */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-4">
                {HOME_FEATURED_ICONS.map((icon) => {
                  const { data: { publicUrl } } = supabase.storage
                    .from("badges folder")
                    .getPublicUrl(icon.filename);
                  return (
                    <button
                      key={icon.filename}
                      type="button"
                      onClick={() => navigate(user ? "/icons" : "/auth")}
                      className="group rounded-2xl bg-card border border-border p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                    >
                      <div className="aspect-square flex items-center justify-center mb-2">
                        <img
                          src={publicUrl}
                          alt={icon.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {icon.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 2 · AI Illustration Suite ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Features grid first on desktop for visual rhythm */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-2 gap-3 order-2 lg:order-1">
                {AI_FEATURES.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => navigate("/ai-illustrator")}
                    className="group flex items-center gap-3 rounded-xl bg-card border border-border p-3.5 text-left hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <IconChip>{f.icon}</IconChip>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy */}
              <div className="lg:col-span-5 order-1 lg:order-2">
                <div className="mb-5"><Eyebrow>AI Illustration Suite</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  Ten ways to{" "}
                  <span className="italic font-crimson text-primary">
                    generate
                  </span>
                  .
                  <br />
                  One canvas to refine.
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
                  Every AI output drops straight into the BioSketch canvas — fully editable,
                  vector-style. Pick any tool, refine in place.
                </p>
                <CTAButton onClick={() => navigate("/ai-illustrator")} icon={Sparkles}>
                  Open AI Illustrator
                </CTAButton>
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 2b · Abstract → Figure walkthrough ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Steps */}
              <div className="lg:col-span-5">
                <div className="mb-5"><Eyebrow>Abstract → Figure</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  From abstract to{" "}
                  <span className="italic font-crimson text-primary">
                    publication-ready
                  </span>{" "}
                  figure.
                </h2>
                <ol className="space-y-4 mb-8">
                  {[
                    { title: "Paste your abstract", body: "Drop a paragraph of prose — mechanism, cascade, cohort. The AI reads the whole thing, not a summary." },
                    { title: "Review the figure plan", body: "The AI drafts a plan card — components, layout, palette. Nudge it in plain English before you spend a credit drawing." },
                    { title: "Draw from the plan", body: "One click renders a publication-quality figure from the approved plan. Re-draw cheaply if the composition needs a nudge." },
                    { title: "Refine on canvas", body: "Recolor, edit labels, extend the aspect ratio, or open in Canvas for full vector editing." },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3.5">
                      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-base font-bold text-foreground leading-tight">
                          {step.title}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <CTAButton onClick={() => navigate("/ai-illustrator")} icon={Sparkles}>
                  Try Abstract → Figure
                </CTAButton>
              </div>

              {/* Video */}
              <div className="lg:col-span-7">
                <WalkthroughVideo
                  src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/ABSTRACTTOFIGVIDEO.mp4"
                  ariaLabel="Walkthrough: paste an abstract and generate a publication figure with BioSketch AI Illustrator"
                  urlLabel="biosketch.art / ai-illustrator"
                />
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 2c · Poster from Word Document walkthrough ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Steps */}
              <div className="lg:col-span-5">
                <div className="mb-5"><Eyebrow>Poster from Word Document</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  A landscape poster from your{" "}
                  <span className="italic font-crimson text-primary">
                    manuscript
                  </span>
                  .
                </h2>
                <ol className="space-y-4 mb-8">
                  {[
                    { title: "Upload your .docx", body: "Drop a Word document — sections, figures, and captions are extracted automatically. Embedded images come across intact." },
                    { title: "Pick a layout", body: "Choose from Classic Bold, Journal Modern, Feature Center, or Timeline. The layout shapes how the AI plans your panels." },
                    { title: "Review the plan", body: "The planner drafts sections, figure placements, and a cross-check for missing bullets or overflowing panels — nudge it before you generate." },
                    { title: "Generate & download", body: "The AI draws each figure, assembles a landscape SVG poster, and gives you an editable PPT export ready for print." },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3.5">
                      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-base font-bold text-foreground leading-tight">
                          {step.title}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <CTAButton onClick={() => navigate("/ai-illustrator")} icon={Sparkles}>
                  Try Poster from Doc
                </CTAButton>
              </div>

              {/* Video */}
              <div className="lg:col-span-7">
                <WalkthroughVideo
                  src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/POSTERMADE.mp4"
                  ariaLabel="Walkthrough: upload a Word document and assemble it into a scientific poster with BioSketch AI Illustrator"
                  urlLabel="biosketch.art / poster-from-doc"
                />
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 2d · AI Icon Generation walkthrough ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Steps */}
              <div className="lg:col-span-5">
                <div className="mb-5"><Eyebrow>AI Icon Generation</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  Labeled scientific icons,{" "}
                  <span className="italic font-crimson text-primary">
                    editable
                  </span>{" "}
                  in place.
                </h2>
                <ol className="space-y-4 mb-8">
                  {[
                    { title: "Describe the icon", body: "A noun and one modifier is enough — \"mitochondrion with cristae\", \"neuron with dendrites\". The AI draws it labeled, on a clean background." },
                    { title: "Rewrite any label", body: "Click a label in the figure and type the new text. The AI redraws just that word in the same font and placement — no full re-generate." },
                    { title: "Import to Canvas", body: "Drop the icon straight into the BioSketch Canvas as an editable object — move it, resize it, add arrows, layer multiple icons into a scene." },
                    { title: "Export to PowerPoint", body: "One click hands you a .pptx where every label is an editable text box, ready for lab meetings, decks, and posters." },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3.5">
                      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-base font-bold text-foreground leading-tight">
                          {step.title}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <CTAButton onClick={() => navigate("/ai-illustrator")} icon={Sparkles}>
                  Try Icon Generator
                </CTAButton>
              </div>

              {/* Video */}
              <div className="lg:col-span-7">
                <WalkthroughVideo
                  src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/LABELEDICON.mp4"
                  ariaLabel="Walkthrough: generate a labeled scientific icon with BioSketch AI Icon Generator, rewrite labels in place, and import to Canvas or PowerPoint"
                  urlLabel="biosketch.art / icon-generator"
                />
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 2e · Reference Image → Vector walkthrough ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Steps */}
              <div className="lg:col-span-5">
                <div className="mb-5"><Eyebrow>Reference Image → Vector</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  Any reference image, redrawn as{" "}
                  <span className="italic font-crimson text-primary">
                    clean vector
                  </span>
                  .
                </h2>
                <ol className="space-y-4 mb-8">
                  {[
                    { title: "Upload a reference image", body: "Drop a photo, screenshot, or figure. The AI reinterprets it as a clean 2D vector illustration — anatomically accurate, publication-ready." },
                    { title: "AI redraws as clean vector", body: "Composition preserved, style unified. Flat fills, thin outlines, editorial palette — no photorealistic noise, no 3D shading." },
                    { title: "Region edit — fix any area", body: "Select a rectangle or freeform region and describe what to redraw. The rest of the figure stays intact — 1 credit per edit." },
                    { title: "Text edit — rewrite any label", body: "Click a label in the figure and type new text. The AI redraws just that word in the same font and placement — no full re-generate." },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3.5">
                      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-base font-bold text-foreground leading-tight">
                          {step.title}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <CTAButton onClick={() => navigate("/ai-illustrator")} icon={Sparkles}>
                  Try Reference → Vector
                </CTAButton>
              </div>

              {/* Video */}
              <div className="lg:col-span-7">
                <WalkthroughVideo
                  src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/REFTOIMAGE.mp4"
                  ariaLabel="Walkthrough: turn a reference image into a clean vector figure, then use region-edit and text-edit to refine it in place"
                  urlLabel="biosketch.art / ref-to-figure"
                />
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 3 · Animation ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <AtomicOrbits className="pointer-events-none absolute -top-12 -left-12 w-72 h-72 text-muted-foreground opacity-20" />
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Copy */}
              <div className="lg:col-span-6">
                <div className="mb-5"><Eyebrow>Motion Graphics</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  Bring your figures{" "}
                  <span className="italic font-crimson text-primary">
                    to life
                  </span>
                  .
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
                  Animate any object on the canvas with keyframes, motion paths, and easing
                  curves. Perfect for lab meetings, conference talks, and grant videos. Export
                  to MP4 or looping GIF when you're done.
                </p>
                <CTAButton onClick={() => navigate("/animations")} icon={Play}>
                  Open Animations
                </CTAButton>
              </div>

              {/* Feature pills */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-3">
                {ANIMATION_FEATURES.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => navigate("/animations")}
                    className="group flex items-center gap-3 rounded-xl bg-card border border-border p-3.5 text-left hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <IconChip>{f.icon}</IconChip>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 4 · BioSketch Graph ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Feature pills left */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-3 order-2 lg:order-1">
                {GRAPH_FEATURES.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => navigate("/chart-studio-intro")}
                    className="group flex items-center gap-3 rounded-xl bg-card border border-border p-3.5 text-left hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <IconChip>{f.icon}</IconChip>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy right */}
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="mb-5"><Eyebrow>BioSketch Graph</Eyebrow></div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-5">
                  Free,{" "}
                  <span className="italic font-crimson text-primary">
                    open source
                  </span>{" "}
                  charts
                  <br />
                  that finish on your canvas.
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
                  Build publication-quality plots — bar, line, scatter, area, pie, error bars —
                  then drop them straight into the BioSketch canvas to style alongside your
                  figure. One workflow, no extra tools.
                </p>
                <CTAButton onClick={() => navigate("/chart-studio-intro")} icon={BarChart3}>
                  Open BioSketch Graph
                </CTAButton>
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 5 · Community Stats ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-12 md:py-20 bg-gradient-to-br from-primary/5 via-card to-primary/5`}>
            <AtomicOrbits className="pointer-events-none absolute -bottom-16 -left-16 w-80 h-80 text-muted-foreground opacity-20" />
            <div className="relative">
              <div className="mb-6 flex justify-center"><Eyebrow>Community</Eyebrow></div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center leading-tight tracking-tight mb-10 max-w-3xl mx-auto">
                A living{" "}
                <span className="italic font-crimson text-primary">
                  shared workspace
                </span>{" "}
                of scientific figures.
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-4 max-w-4xl mx-auto">
                <BigMetric value={stats?.users} label="registered users" />
                <BigMetric value={stats?.views} label="figure views" />
                <BigMetric value={stats?.likes} label="hearts given" icon={<Heart className="w-4 h-4" />} />
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 6 · Editorial Quote ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-5xl mx-auto px-7 md:px-14 py-14 md:py-20 text-center`}>
            <span
              className="block text-primary text-7xl md:text-8xl leading-none mb-4 font-crimson"
              aria-hidden
            >
              “
            </span>
            <p className="text-2xl md:text-4xl text-foreground leading-tight max-w-3xl mx-auto font-crimson tracking-tight">
              <span className="italic">Free art for free science.</span> Every figure you publish
              should be remixable by the next lab that needs it.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              <span className="w-1 h-3 rounded-full bg-primary" />
              The BioSketch principle
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 7 · Discover (Community CTA) ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-5xl mx-auto px-7 md:px-14 py-12 md:py-16`}>
            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7">
                <div className="mb-5"><Eyebrow>Discover</Eyebrow></div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight mb-4">
                  See what other researchers are{" "}
                  <span className="italic font-crimson text-primary">
                    publishing
                  </span>
                  .
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                  Browse public figures, clone what you need, contribute back. New work
                  appears as researchers publish.
                </p>
              </div>
              <div className="md:col-span-5 flex md:justify-end">
                <CTAButton onClick={() => navigate("/community")} icon={Users}>
                  Visit community
                </CTAButton>
              </div>
            </div>
          </div>
        </RevealWrap>
      </section>

      {/* ── 7b · Prompt → Illustration carousel ── */}
      <section className="relative w-full px-4 md:px-8 py-8 md:py-12">
        <RevealWrap>
          <div className={`${cardBase} max-w-7xl mx-auto px-8 md:px-16 py-7 md:py-10`}>
            <div className="mb-8 max-w-2xl">
              <div className="mb-5"><Eyebrow>Prompt → Illustration</Eyebrow></div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-4">
                Real prompts.{" "}
                <span className="italic font-crimson text-primary">
                  Publication-ready
                </span>{" "}
                figures.
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Each figure below was generated by the Illustrator from the verbatim prompt
                shown alongside it. Swipe through to compare.
              </p>
            </div>
            <PromptToIllustrationCarousel />
          </div>
        </RevealWrap>
      </section>

    </div>
  );
};

function BigMetric({
  value,
  label,
  icon,
}: {
  value: number | undefined;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      {value === undefined ? (
        <Skeleton className="h-14 md:h-16 w-32 mx-auto rounded-md" />
      ) : (
        <div className="text-5xl md:text-6xl font-bold text-foreground leading-none tracking-tight tabular-nums">
          {value.toLocaleString()}
        </div>
      )}
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mt-3 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </div>
    </div>
  );
}
