import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SEOHead } from "@/components/SEO/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { buttonVariants } from "@/components/ui/button";
import {
  Heart,
  Users,
  Globe,
  Sparkles,
  Info,
  Code2,
  BookOpen,
  Copy,
  Check,
  ArrowRight,
  FlaskConical,
  Star,
} from "lucide-react";

/**
 * About page — polished shadcn/SaaS visual language (matches the pricing
 * modal): rounded-2xl cards with subtle theme-token borders, Star badge on
 * the elevated "recommended" tile, Check bullets for feature-y content,
 * framer-motion spring reveals, hover ring on interactive cards, and a
 * three-card 3D perspective grid for the "Get involved" section (middle
 * card raised + primary border, outer cards pushed back). All copy from
 * the previous version preserved verbatim.
 */

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const formatCompact = (n: number | undefined): string => {
  if (n === undefined) return "—";
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1000000) return Math.round(n / 1000) + "K";
  return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
};

const CITATIONS = [
  {
    label: "APA",
    text: "BioSketch.Art (2026). BioSketch.Art Illustrator [Web application]. https://biosketch.art",
    render: (
      <>
        BioSketch.Art (2026). <em>BioSketch.Art Illustrator</em>{" "}
        [Web application]. https://biosketch.art
      </>
    ),
  },
  {
    label: "MLA",
    text: '"BioSketch.Art Illustrator." BioSketch.Art, 2026, biosketch.art.',
    render: (
      <>
        "BioSketch.Art Illustrator." <em>BioSketch.Art</em>, 2026, biosketch.art.
      </>
    ),
  },
  {
    label: "Figure legend",
    text: "Created with BioSketch.Art Illustrator (https://biosketch.art).",
    render: <>Created with BioSketch.Art Illustrator (https://biosketch.art).</>,
  },
  {
    label: "BibTeX",
    text: `@misc{biosketch2026,
  title  = {BioSketch.Art Illustrator},
  author = {BioSketch.Art},
  year   = {2026},
  url    = {https://biosketch.art},
  note   = {Free scientific illustration tool}
}`,
    render: null,
  },
];

const VALUES = [
  {
    icon: Heart,
    title: "Free forever",
    body:
      "No subscriptions. No paywalls. Every feature is free to every researcher who wants to use it.",
  },
  {
    icon: Code2,
    title: "Open source",
    body:
      "The tool, the icon library, and the templates are open. Fork the icons, contribute back, remix.",
  },
  {
    icon: FlaskConical,
    title: "Built by scientists",
    body:
      "Every design decision is made by people who've stared at a rejected figure at 2 a.m. before a submission deadline.",
  },
  {
    icon: Globe,
    title: "Community-driven",
    body:
      "Users share back to the gallery. Reviewers approve real work. Credits earn credits. Everyone gets better.",
  },
];

const INVOLVE = [
  {
    icon: Sparkles,
    title: "Try the Canvas",
    body:
      "Build your first figure in the free BioSketch editor. No signup required to start.",
    features: [
      "Drag-and-drop illustration",
      "Icon library included",
      "Instant export as PNG/SVG",
    ],
    cta: "Open Canvas",
    path: "/canvas",
    isPopular: true,
  },
  {
    icon: Users,
    title: "Explore the community",
    body:
      "Browse approved projects from researchers around the world. Clone, remix, contribute back.",
    features: [
      "Approved projects gallery",
      "Clone any figure with one click",
      "Follow other researchers",
    ],
    cta: "Visit community",
    path: "/community",
    isPopular: false,
  },
  {
    icon: BookOpen,
    title: "Read the blog",
    body:
      "Guides, technique breakdowns, and behind-the-scenes on how we're building the platform.",
    features: [
      "Figure walkthroughs",
      "Design tips + technique",
      "Product changelog",
    ],
    cta: "Read the blog",
    path: "/blog",
    isPopular: false,
  },
];

const About = () => {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
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
        supabase.rpc("get_user_count"),
      ]);
      const data = projectsRes.data ?? [];
      const userCount =
        typeof userCountRes.data === "number" ? userCountRes.data : 0;
      return {
        users: userCount,
        projects: data.length,
        views: data.reduce((s, p) => s + (p.view_count || 0), 0),
        likes: data.reduce((s, p) => s + (p.like_count || 0), 0),
      };
    },
  });

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 1600);
    } catch {
      /* clipboard blocked — user can still select + copy */
    }
  };

  return (
    <>
      <SEOHead
        title="About | BioSketch.Art"
        description="Built by scientists, for scientists. BioSketch.Art is a free, open-source scientific illustration tool — because great science shouldn't be held back by expensive software."
        keywords="about BioSketch, open source scientific illustration, free BioRender alternative, biomedical illustration tool"
        canonical="https://biosketch.art/about"
      />

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Ambient soft-blur backdrop — same warm feel as the rest of the app */}
        <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[520px] h-[520px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-40 -right-24 w-[460px] h-[460px] bg-blue-200/25 rounded-full blur-3xl" />
          <div className="absolute bottom-32 left-1/3 w-[420px] h-[420px] bg-emerald-200/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-20">
          {/* ── 1. Hero ─────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border shadow-sm mb-6">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                About BioSketch
              </span>
            </span>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] text-foreground mb-6">
              Built by scientists,{" "}
              <span className="italic font-crimson text-primary">for scientists.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Free, open-source scientific illustration software — because great
              science shouldn't be held back by expensive software, and figures
              shouldn't take longer than experiments.
            </p>
          </motion.section>

          {/* ── 2. What we believe (4-card grid, shadcn card style) ────── */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                What we believe
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Four principles.{" "}
                <span className="italic font-crimson text-primary">Non-negotiable.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {VALUES.map(({ icon: Icon, title, body }, i) => (
                <motion.div
                  key={title}
                  initial={{ y: 24, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.08 * i,
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                  }}
                  className="rounded-2xl border border-border bg-background p-6 shadow-sm transition-all hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background"
                >
                  <div className="mx-auto inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={2.4} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground mb-2">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── 3. By the numbers ──────────────────────────────────────── */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                By the numbers
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                A community, working.
              </h2>
            </div>

            <div className="rounded-2xl border border-border bg-background shadow-sm p-6 md:p-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: "Researchers", value: stats?.users },
                  { label: "Projects shared", value: stats?.projects },
                  { label: "Total views", value: stats?.views },
                  { label: "Community likes", value: stats?.likes },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    {statsLoading ? (
                      <Skeleton className="h-10 w-16 mx-auto mb-2 rounded-md" />
                    ) : (
                      <p className="text-4xl md:text-5xl font-bold tabular-nums tracking-tight text-foreground mb-1">
                        {formatCompact(stat.value)}
                      </p>
                    )}
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ── 4. Why we built it (elevated card with primary border) ── */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Why we built it
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                We built the tool we{" "}
                <span className="italic font-crimson text-primary">wished existed.</span>
              </h2>
            </div>

            <div className="relative rounded-2xl border-2 border-primary bg-background shadow-[0_20px_45px_-25px_rgba(15,23,42,0.25)] p-6 md:p-10">
              <div className="absolute top-0 right-0 bg-primary py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-primary-foreground fill-current" />
                <span className="text-primary-foreground text-xs font-semibold uppercase tracking-wide">
                  Our why
                </span>
              </div>

              <div className="space-y-5 text-base md:text-lg text-foreground/90 leading-relaxed">
                <p>
                  BioSketch.Art is built by a small team of indie developers and
                  scientists who lived the frustration firsthand — spending more
                  time wrestling with paywalls and licensing fees than actually
                  communicating our research.
                </p>
                <p>
                  Scientific illustration tools have long been gatekept behind
                  costly subscriptions, putting polished, publication-ready
                  figures out of reach for many researchers, students, and
                  institutions who couldn't or shouldn't have to justify hundreds
                  of dollars a year just to draw a mitochondrion.
                </p>
                <p className="text-lg md:text-xl font-bold text-foreground pt-2">
                  So we built the alternative. Free, open, and shared with the
                  community that needs it.
                </p>
              </div>
            </div>
          </motion.section>

          {/* ── 5. How to cite (compact cards + copy) ──────────────────── */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Using it in a paper?
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                How to cite BioSketch.
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-lg mx-auto leading-relaxed">
                If BioSketch helped you make a figure, poster, or graphical
                abstract, a citation goes a long way. Copy any format below.
              </p>
            </div>

            <div className="space-y-3">
              {CITATIONS.map(({ label, text, render }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background shadow-sm p-5 transition-all hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(label, text)}
                      aria-label={`Copy ${label} citation`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {copiedLabel === label ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  {label === "BibTeX" ? (
                    <pre className="text-xs text-foreground leading-relaxed overflow-x-auto font-mono bg-muted/50 border border-border rounded-lg p-3">
                      {text}
                    </pre>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">
                      {render}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── 6. Get involved (pricing-style 3D 3-card grid) ─────────── */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Get involved
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Three ways in.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {INVOLVE.map((item, index) => {
                const Icon = item.icon;
                const isOuter = index === 0 || index === INVOLVE.length - 1;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={
                      isDesktop
                        ? {
                            y: item.isPopular ? -20 : 0,
                            opacity: 1,
                            x:
                              index === INVOLVE.length - 1
                                ? -30
                                : index === 0
                                  ? 30
                                  : 0,
                            scale: isOuter ? 0.94 : 1.0,
                          }
                        : { y: 0, opacity: 1 }
                    }
                    viewport={{ once: true }}
                    transition={{
                      duration: 1.2,
                      type: "spring",
                      stiffness: 100,
                      damping: 30,
                      delay: 0.2,
                      opacity: { duration: 0.4 },
                    }}
                    className={cn(
                      "relative rounded-2xl bg-background p-6 text-center flex flex-col",
                      item.isPopular
                        ? "border-2 border-primary shadow-[0_20px_45px_-25px_rgba(15,23,42,0.25)]"
                        : "border border-border shadow-sm",
                      !item.isPopular && "md:mt-5",
                      isOuter ? "z-0" : "z-10",
                      index === 0 && "md:origin-right",
                      index === INVOLVE.length - 1 && "md:origin-left",
                    )}
                  >
                    {item.isPopular && (
                      <div className="absolute top-0 right-0 bg-primary py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-primary-foreground fill-current" />
                        <span className="text-primary-foreground text-xs font-semibold uppercase tracking-wide">
                          Recommended
                        </span>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col">
                      <div className="mx-auto inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                        <Icon className="h-5 w-5 text-primary" strokeWidth={2.4} />
                      </div>

                      <h3 className="text-lg font-bold tracking-tight text-foreground mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                        {item.body}
                      </p>

                      <ul className="mt-1 gap-2 flex flex-col text-sm text-left mb-5">
                        {item.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>

                      <hr className="w-full my-4 border-border" />

                      <button
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "w-full gap-2 text-base font-semibold tracking-tight",
                          "transform-gpu transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:bg-primary hover:text-primary-foreground",
                          item.isPopular
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground",
                        )}
                      >
                        {item.cta}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

          </motion.section>

          {/* ── 7. Bottom CTA (primary card, matches shadcn hero pattern) */}
          <motion.section {...fadeIn} className="mt-20 md:mt-28">
            <div className="relative rounded-2xl bg-primary shadow-[0_25px_60px_-25px_rgba(15,23,42,0.4)] p-8 md:p-12 text-center overflow-hidden">
              <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground tracking-tight leading-tight mb-3 max-w-2xl mx-auto">
                  Good science deserves good visuals.
                </h2>
                <p className="text-sm md:text-base text-primary-foreground/85 mb-7 max-w-lg mx-auto leading-relaxed">
                  We're here to make sure cost is never the reason you settle for less.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => navigate("/canvas")}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-background text-foreground text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background shadow-md transition-all"
                  >
                    Open Canvas
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate("/free-ai-credits")}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary-foreground/10 border border-primary-foreground/25 text-primary-foreground text-sm font-bold hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60 transition-all"
                  >
                    Free AI credits
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default About;
