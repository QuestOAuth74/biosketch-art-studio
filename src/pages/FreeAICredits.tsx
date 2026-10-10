import { useState } from "react";
import { motion } from "framer-motion";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useGenerationBalance } from "@/hooks/useGenerationBalance";
import { PurchaseCreditsDialog } from "@/components/credits/PurchaseCreditsDialog";
import { ScholarsSection } from "@/components/scholars/ScholarsSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronRight, Share2, GraduationCap, UserCircle2, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

/**
 * Free AI Credits — redesign adapted from a hero-financial template.
 *
 * Design DNA carried from the reference:
 *   - Soft-blue gradient ground with layered blurred SVG shapes top-left
 *   - Glass "New" badge (rounded-full pill with a mini gradient tag inside)
 *   - Large display headline with a two-line break
 *   - Gradient CTA pair (blue primary, neutral secondary)
 *   - Framed "product mockup" panel below the hero (we drop in the Wnt
 *     signaling AI figure since it's already used on the home page)
 *
 * Substituted from the reference:
 *   - TimelineAnimation → framer-motion viewport fades with sequential
 *     delays (staggered reveal is preserved without needing to build the
 *     scroll-timeline utility)
 *   - Mobile MotionDrawer → removed; page renders inside MainLayout which
 *     provides its own responsive nav
 *   - Header / logo mark → removed; MainLayout owns the top nav
 *
 * Content: three-path credit-earning flow, embedded ScholarsSection for the
 * application UX, short FAQ.
 */

const WNT_IMAGE_URL =
  "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20WNT%20SIGNALING%20GLOSSY%203D.png";

// Credit formula: 20 base at 3 approved projects, +10 per additional.
const computeMonthlyCredits = (n: number): number => {
  if (n < 3) return 0;
  return 20 + (n - 3) * 10;
};

const FAQ_ITEMS = [
  {
    q: "What counts as an 'approved project'?",
    a: "Any illustration you build in the BioSketch Canvas, submit to the community gallery, and that our reviewers accept. AI-generated illustrations don't count — that keeps the credit loop honest.",
  },
  {
    q: "How long does approval take?",
    a: "Community project submissions: usually 1–3 days. Scholars applications: up to 5 business days for citations, faster for social/blog posts. All reviews are done by a human at BioSketch.",
  },
  {
    q: "When do free credits reset?",
    a: "On a rolling 30-day window per credit — each generation you use returns exactly 30 days later. Purchased credits never expire.",
  },
  {
    q: "Can I combine multiple earning paths?",
    a: "Yes. Share your work AND apply to Scholars AND complete your profile — the rewards stack.",
  },
];

const FreeAICredits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: balance } = useGenerationBalance();
  const { approvedCount } = useFeatureAccess();
  const [showPurchase, setShowPurchase] = useState(false);

  // Staggered viewport fade preset. Replaces the reference's TimelineAnimation
  // by using a `delay` per element so hero pieces reveal in sequence.
  const stagger = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <>
      <SEOHead
        title="Earn Free AI Credits | BioSketch"
        description="Three ways to earn free AI generation credits on BioSketch. Share your work, apply to the Scholars program, or complete your profile."
        keywords="free AI credits, BioSketch AI, earn AI credits, open science, free scientific illustration"
        canonical="https://biosketch.art/free-ai-credits"
      />

      <section className="min-h-screen bg-[#f7f9fc] text-[#1e293b] relative overflow-hidden flex flex-col items-center">
        {/* Layered blurred-gradient SVG shapes — top-left corner accent */}
        <svg
          width="358"
          height="483"
          viewBox="0 0 358 483"
          className="absolute top-0 z-[1] left-0 pointer-events-none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <g filter="url(#filter0_f_0_1)">
            <rect
              x="-86.9961"
              y="-33.114"
              width="72"
              height="541"
              rx="36"
              transform="rotate(-30.8182 -86.9961 -33.114)"
              fill="url(#paint0_linear_0_1)"
            />
          </g>
          <g filter="url(#filter1_f_0_1)">
            <rect
              x="-17"
              y="-135.113"
              width="50.0937"
              height="541"
              rx="25.0469"
              transform="rotate(-30.8182 -17 -135.113)"
              fill="url(#paint1_linear_0_1)"
            />
          </g>
          <defs>
            <filter id="filter0_f_0_1" x="-137.641" y="-120.646" width="440.285" height="602.787" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="32" result="effect1_foregroundBlur_0_1" />
            </filter>
            <filter id="filter1_f_0_1" x="-71.707" y="-215.486" width="429.598" height="599.69" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="32" result="effect1_foregroundBlur_0_1" />
            </filter>
            <linearGradient id="paint0_linear_0_1" x1="-50.9961" y1="-33.114" x2="-50.9961" y2="507.886" gradientUnits="userSpaceOnUse">
              <stop stopColor="#91bbfb" />
              <stop offset="1" stopColor="#E6F1FF" />
            </linearGradient>
            <linearGradient id="paint1_linear_0_1" x1="8.04686" y1="-135.113" x2="8.04686" y2="405.887" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8dbafd" />
              <stop offset="1" stopColor="#c1d9f8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Soft blue gradient overlay across the hero band */}
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-50 via-blue-100 to-transparent opacity-100 pointer-events-none" />

        {/* ──────────────── HERO ──────────────── */}
        <div className="relative z-10 text-center pt-24 md:pt-32 pb-16 px-4 flex flex-col gap-6 max-w-6xl">
          {/* Glass "New" badge */}
          <motion.div
            {...stagger(0)}
            className="bg-white w-fit mx-auto text-black px-1.5 py-1 rounded-full inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 border-2 border-white"
          >
            <span className="bg-gradient-to-br from-blue-500 to-blue-200 text-white px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest">
              Free
            </span>
            <span className="text-sm font-medium">
              Earn AI credits by contributing to open science
            </span>
          </motion.div>

          {/* Display headline */}
          <motion.h1
            {...stagger(0.1)}
            className="sm:text-6xl text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-neutral-900 max-w-5xl mx-auto leading-[1.03]"
          >
            Credits earned, <br /> not sold.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...stagger(0.2)}
            className="text-lg md:text-xl lg:text-2xl text-neutral-500 font-medium max-w-3xl mx-auto leading-relaxed px-4"
          >
            Every AI generation on BioSketch runs on credits you earn by
            contributing to open science. Three simple paths, no subscription.
          </motion.p>

          {/* Gradient CTA pair */}
          <motion.div
            {...stagger(0.3)}
            className="flex gap-4 justify-center flex-wrap"
          >
            <button
              onClick={() => navigate(user ? "/projects" : "/auth")}
              className="px-6 bg-gradient-to-br from-blue-500 via-blue-400 to-blue-200 text-white text-base md:text-xl rounded-lg shadow-sm transition py-2.5 border border-blue-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
            >
              {user ? "Start earning" : "Create a free account"}
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowPurchase(true)}
              className="px-6 bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-300 text-black text-base md:text-xl rounded-lg shadow-sm transition py-2.5 border border-neutral-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-blue-500" />
              Buy credits
            </button>
          </motion.div>
        </div>

        {/* ──────────────── FRAMED WNT SIGNALING IMAGE ──────────────── */}
        <div className="w-full max-w-6xl mx-auto rounded-xl relative mt-6 px-4">
          <motion.div
            {...stagger(0.4)}
            className="rounded-2xl bg-white/50 backdrop-blur-lg p-4 shadow-xl shadow-blue-500/10 border border-white/60"
          >
            <img
              src={WNT_IMAGE_URL}
              alt="AI-generated Wnt signaling pathway figure — Cell Press–style, muted pastel palette"
              className="w-full relative z-[4] rounded-2xl"
              loading="eager"
            />
            <div className="mt-3 text-center text-xs text-neutral-500 italic">
              Generated with BioSketch AI Illustrator (Glossy 3D style)
            </div>
          </motion.div>
        </div>

        {/* ──────────────── BALANCE STRIP (signed-in only) ──────────────── */}
        {user && (
          <motion.section
            {...stagger(0.5)}
            className="relative z-10 mt-16 w-full max-w-4xl mx-auto px-4"
          >
            <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-lg shadow-md px-6 py-5">
              <div className="grid grid-cols-3 gap-4 divide-x divide-slate-200 text-center">
                <div className="px-2">
                  <div className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
                    {approvedCount ?? 0}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Approved projects
                  </div>
                </div>
                <div className="px-2">
                  <div className="text-2xl md:text-3xl font-bold text-blue-600 tabular-nums">
                    {computeMonthlyCredits(approvedCount ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Credits / month
                  </div>
                </div>
                <div className="px-2">
                  <div className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
                    {balance?.total_available ?? "—"}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Available now
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Bottom-right mirror gradient blur — anchors the lower half of the
            page in the same visual language as the top-left corner */}
        <svg
          width="358"
          height="483"
          viewBox="0 0 358 483"
          className="absolute bottom-0 right-0 z-[1] pointer-events-none opacity-70 rotate-180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <g filter="url(#filter0_bottom)">
            <rect x="-86.9961" y="-33.114" width="72" height="541" rx="36" transform="rotate(-30.8182 -86.9961 -33.114)" fill="url(#paint0_bottom)" />
          </g>
          <defs>
            <filter id="filter0_bottom" x="-137.641" y="-120.646" width="440.285" height="602.787" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="32" result="effect1_foregroundBlur_bottom" />
            </filter>
            <linearGradient id="paint0_bottom" x1="-50.9961" y1="-33.114" x2="-50.9961" y2="507.886" gradientUnits="userSpaceOnUse">
              <stop stopColor="#91bbfb" />
              <stop offset="1" stopColor="#E6F1FF" />
            </linearGradient>
          </defs>
        </svg>

        {/* ──────────────── THREE EARNING PATHS ──────────────── */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 mt-20 md:mt-28">
          <motion.div {...stagger(0)} className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
              Three earning paths
            </span>
            <h2 className="mt-3 text-3xl md:text-5xl font-medium tracking-tight text-neutral-900 leading-[1.05]">
              Pick the one that fits <br className="hidden md:block" />your work.
            </h2>
            <p className="mt-4 text-base md:text-lg text-neutral-500 leading-relaxed max-w-xl mx-auto">
              Each path is a first-class earning route. Stack them however you like.
            </p>
          </motion.div>

          {/* Path 1 — Share */}
          <motion.section {...stagger(0.05)} className="mt-6">
            <div className="group rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/15 transition-shadow">
              <div className="flex items-start gap-5">
                <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-400 to-blue-200 border border-blue-300 shadow-lg shadow-blue-500/25 flex items-center justify-center">
                  <Share2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600 tabular-nums">Path 01</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full">
                      Recurring monthly
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-medium text-slate-900 tracking-tight">
                    Share your Canvas illustrations
                  </h3>
                  <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed">
                    Build in the BioSketch Canvas, submit to the community
                    gallery, get approved. Every approved illustration adds to
                    your monthly credit grant, forever, with no ceiling.
                  </p>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <StepChip n={1} text="Create in Canvas" />
                    <StepChip n={2} text="Submit to community" />
                    <StepChip n={3} text="Reviewer approves" />
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200/70 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-slate-700">
                      <span className="font-bold text-slate-900 tabular-nums">20</span>
                      <span className="text-slate-500"> credits/month at 3 approvals · </span>
                      <span className="font-bold text-slate-900 tabular-nums">+10</span>
                      <span className="text-slate-500"> per additional</span>
                    </div>
                    <button
                      onClick={() => navigate(user ? "/projects" : "/auth")}
                      className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-gradient-to-br from-blue-500 via-blue-400 to-blue-200 text-white text-sm font-bold border border-blue-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      {user ? "Open Canvas" : "Sign in to start"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Path 2 — Scholars (elevated card, matches its "featured" role) */}
          <motion.section {...stagger(0.1)} className="mt-6">
            <div className="relative">
              {/* Soft outer glow — signals this is the featured path */}
              <div className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-br from-blue-300/30 via-blue-200/10 to-transparent blur-xl" />
              <div className="relative rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-white/80 to-blue-50/60 backdrop-blur-xl p-6 md:p-8 shadow-xl shadow-blue-500/15">
                <div className="flex items-start gap-5">
                  <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 border border-blue-500 shadow-lg shadow-blue-500/40 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600 tabular-nums">Path 02</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white bg-gradient-to-br from-blue-500 to-blue-300 px-2 py-0.5 rounded-full shadow-sm shadow-blue-500/30">
                        New · One-time grants
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-medium text-slate-900 tracking-tight">
                      Publish about BioSketch — Scholars program
                    </h3>
                    <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed">
                      Cite BioSketch in a paper, write about it on a university
                      blog, or post about it on social. Approved applications get
                      a one-time credit grant on top of your monthly earnings.
                    </p>
                  </div>
                </div>

                {/* Three-tile picker + application dialog + my-applications table */}
                <div className="mt-6">
                  <ScholarsSection />
                </div>
              </div>
            </div>
          </motion.section>

          {/* Path 3 — Profile */}
          <motion.section {...stagger(0.15)} className="mt-6">
            <div className="rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/15 transition-shadow">
              <div className="flex items-start gap-5">
                <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-400 via-slate-300 to-slate-200 border border-slate-300 shadow-lg shadow-slate-400/20 flex items-center justify-center">
                  <UserCircle2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 tabular-nums">Path 03</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full">
                      2-minute boost
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-medium text-slate-900 tracking-tight">
                    Complete your profile
                  </h3>
                  <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed">
                    Small monthly bonus for a filled-out profile — makes it
                    easier for other researchers to find and cite your work.
                    Three simple actions, one credit each.
                  </p>

                  <ul className="mt-5 divide-y divide-slate-200/70">
                    {[
                      "Upload a profile picture",
                      "Write a bio (10+ characters)",
                      "Add a quote (5+ characters)",
                    ].map((item) => (
                      <li key={item} className="flex items-center justify-between text-sm text-slate-700 py-2">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>{item}</span>
                        </div>
                        <span className="text-xs font-bold text-blue-600 tabular-nums bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          +1 /mo
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-5 border-t border-slate-200/70 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-slate-700">
                      Up to <span className="font-bold text-slate-900 tabular-nums">+3</span> credits per month
                    </div>
                    <button
                      onClick={() => navigate(user ? "/profile" : "/auth")}
                      className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-300 text-black text-sm font-bold border border-neutral-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      {user ? "Open profile" : "Sign in first"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        {/* ──────────────── SHORT FAQ ──────────────── */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 mt-20 md:mt-28">
          <motion.div {...stagger(0)} className="text-center mb-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
              Common questions
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-medium text-slate-900 tracking-tight leading-[1.1]">
              Short answers.
            </h2>
          </motion.div>
          <motion.div
            {...stagger(0.05)}
            className="rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl overflow-hidden shadow-md shadow-blue-500/10"
          >
            <Accordion type="single" collapsible className="divide-y divide-slate-200/60">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-0">
                  <AccordionTrigger className="px-6 py-4 text-left text-sm md:text-base font-semibold text-slate-900 hover:no-underline hover:bg-blue-50/40 transition-colors [&[data-state=open]>svg]:text-blue-500">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-5 pt-0 text-sm text-slate-600 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>

        {/* ──────────────── CLOSING CTA ──────────────── */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 mt-20 md:mt-28 pb-24">
          <motion.div
            {...stagger(0)}
            className="rounded-3xl border border-white/70 bg-gradient-to-br from-white/80 via-blue-50/60 to-white/80 backdrop-blur-xl p-8 md:p-12 text-center shadow-xl shadow-blue-500/15 relative overflow-hidden"
          >
            <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-blue-300/30 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/30 rounded-full blur-3xl" />
            <div className="relative">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                Ready when you are
              </span>
              <h3 className="mt-3 text-2xl md:text-4xl font-medium tracking-tight text-neutral-900 leading-[1.05] max-w-xl mx-auto">
                Start earning credits today.
              </h3>
              <p className="mt-3 text-sm md:text-base text-neutral-500 max-w-lg mx-auto leading-relaxed">
                Free forever. No credit card. No subscription. Just contribution.
              </p>
              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => navigate(user ? "/projects" : "/auth")}
                  className="px-6 bg-gradient-to-br from-blue-500 via-blue-400 to-blue-200 text-white text-base rounded-lg shadow-sm transition py-2.5 border border-blue-300 hover:shadow-md hover:-translate-y-0.5 inline-flex items-center gap-2"
                >
                  {user ? "Start earning" : "Create a free account"}
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/ai-illustrator")}
                  className="px-6 bg-white/70 backdrop-blur-sm text-slate-800 text-base rounded-lg shadow-sm transition py-2.5 border border-slate-200 hover:bg-white hover:-translate-y-0.5 inline-flex items-center gap-2"
                >
                  Try AI Illustrator
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
      </section>
    </>
  );
};

// Small numbered step chip used inside Path 1's how-it-works row.
function StepChip({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-gradient-to-br from-blue-50 via-white to-blue-50/40 border border-blue-100/80 px-3 py-2.5 shadow-sm shadow-blue-500/5">
      <span className="shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-300 border border-blue-400 text-[11px] font-bold tabular-nums text-white flex items-center justify-center shadow-sm shadow-blue-500/40">
        {n}
      </span>
      <span className="text-xs font-semibold text-slate-700">{text}</span>
    </div>
  );
}

export default FreeAICredits;
