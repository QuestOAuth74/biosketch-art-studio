import { useNavigate, Link } from "react-router-dom";
import { SEOHead } from "@/components/SEO/SEOHead";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  BarChart3,
  FlaskConical,
  Wand2,
  LayoutGrid,
  Bot,
  Cloud,
  Ruler,
  FileDown,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Mini SVG chart thumbnails — each is a tiny accurate representation
const c1 = "#6b8cae", c2 = "#ae6b6b", c3 = "#6bae7a"; // muted blue, muted red, muted green

function MiniChart({ type }: { type: string }) {
  const s = 28; // viewBox size
  const common = { width: 32, height: 32, viewBox: `0 0 ${s} ${s}`, style: { display: "block" } as React.CSSProperties };
  switch (type) {
    case "scatter": return <svg {...common}><circle cx={8} cy={18} r={2} fill={c1}/><circle cx={12} cy={12} r={2} fill={c1}/><circle cx={17} cy={15} r={2} fill={c1}/><circle cx={21} cy={8} r={2} fill={c1}/><circle cx={15} cy={20} r={2} fill={c2}/><circle cx={20} cy={14} r={2} fill={c2}/></svg>;
    case "bar": return <svg {...common}><rect x={4} y={14} width={5} height={12} rx={1} fill={c1}/><rect x={11} y={8} width={5} height={18} rx={1} fill={c2}/><rect x={18} y={11} width={5} height={15} rx={1} fill={c3}/></svg>;
    case "line": return <svg {...common}><polyline points="4,20 10,14 16,16 22,8" fill="none" stroke={c1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><polyline points="4,22 10,18 16,20 22,12" fill="none" stroke={c2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "box": return <svg {...common}><line x1={10} y1={6} x2={10} y2={10} stroke={c1} strokeWidth={1.5}/><rect x={5} y={10} width={10} height={10} rx={2} fill="none" stroke={c1} strokeWidth={1.5}/><line x1={5} y1={15} x2={15} y2={15} stroke={c1} strokeWidth={2}/><line x1={10} y1={20} x2={10} y2={24} stroke={c1} strokeWidth={1.5}/><line x1={18} y1={8} x2={18} y2={11} stroke={c2} strokeWidth={1.5}/><rect x={15} y={11} width={6} height={8} rx={1.5} fill="none" stroke={c2} strokeWidth={1.5}/><line x1={15} y1={16} x2={21} y2={16} stroke={c2} strokeWidth={2}/><line x1={18} y1={19} x2={18} y2={23} stroke={c2} strokeWidth={1.5}/></svg>;
    case "violin": return <svg {...common}><path d="M10,4 Q14,10 14,14 Q14,18 10,24 Q6,18 6,14 Q6,10 10,4Z" fill={c1} opacity={0.2} stroke={c1} strokeWidth={1}/><line x1={10} y1={10} x2={10} y2={18} stroke={c1} strokeWidth={2}/><circle cx={10} cy={14} r={1.5} fill="white" stroke={c1} strokeWidth={1.5}/><path d="M20,6 Q23,12 23,14 Q23,16 20,22 Q17,16 17,14 Q17,12 20,6Z" fill={c2} opacity={0.2} stroke={c2} strokeWidth={1}/><line x1={20} y1={11} x2={20} y2={17} stroke={c2} strokeWidth={2}/><circle cx={20} cy={14} r={1.5} fill="white" stroke={c2} strokeWidth={1.5}/></svg>;
    case "histogram": return <svg {...common}><rect x={3} y={18} width={4} height={8} fill={c1} opacity={0.7}/><rect x={8} y={10} width={4} height={16} fill={c1} opacity={0.7}/><rect x={13} y={6} width={4} height={20} fill={c1} opacity={0.7}/><rect x={18} y={12} width={4} height={14} fill={c1} opacity={0.7}/><rect x={23} y={20} width={4} height={6} fill={c1} opacity={0.7}/></svg>;
    case "survival": return <svg {...common}><polyline points="3,6 10,6 10,12 16,12 16,18 20,18 20,23 26,23" fill="none" stroke={c1} strokeWidth={2} strokeLinecap="round"/><polyline points="3,6 8,6 8,10 12,10 12,16 18,16 18,22 26,22" fill="none" stroke={c2} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 2"/></svg>;
    case "dose": return <svg {...common}><path d="M3,24 C8,24 12,22 16,14 C20,6 24,5 26,5" fill="none" stroke={c1} strokeWidth={2} strokeLinecap="round"/><circle cx={8} cy={23} r={1.5} fill={c1}/><circle cx={13} cy={18} r={1.5} fill={c1}/><circle cx={18} cy={10} r={1.5} fill={c1}/><circle cx={23} cy={6} r={1.5} fill={c1}/></svg>;
    case "roc": return <svg {...common}><path d="M3,25 C3,25 6,24 10,18 C14,12 18,6 25,3" fill="none" stroke={c1} strokeWidth={2} strokeLinecap="round"/><line x1={3} y1={25} x2={25} y2={3} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 2"/><path d="M3,25 L3,25 10,18 25,3 25,25Z" fill={c1} opacity={0.06}/></svg>;
    case "volcano": return <svg {...common}><circle cx={6} cy={16} r={1.5} fill="#cbd5e1"/><circle cx={10} cy={18} r={1.5} fill="#cbd5e1"/><circle cx={14} cy={14} r={1.5} fill="#cbd5e1"/><circle cx={12} cy={20} r={1.5} fill="#cbd5e1"/><circle cx={16} cy={17} r={1.5} fill="#cbd5e1"/><circle cx={5} cy={8} r={2} fill={c1}/><circle cx={8} cy={6} r={2} fill={c1}/><circle cx={22} cy={7} r={2} fill={c2}/><circle cx={24} cy={10} r={2} fill={c2}/><line x1={14} y1={3} x2={14} y2={25} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2 2"/></svg>;
    case "forest": return <svg {...common}><line x1={14} y1={3} x2={14} y2={25} stroke="#d1d5db" strokeWidth={1} strokeDasharray="2 2"/><line x1={6} y1={8} x2={20} y2={8} stroke={c1} strokeWidth={1.5}/><circle cx={12} cy={8} r={2} fill={c1}/><line x1={8} y1={14} x2={22} y2={14} stroke={c1} strokeWidth={1.5}/><circle cx={16} cy={14} r={2.5} fill={c1}/><line x1={10} y1={20} x2={18} y2={20} stroke={c1} strokeWidth={1.5}/><circle cx={13} cy={20} r={1.5} fill={c1}/></svg>;
    case "bland": return <svg {...common}><circle cx={8} cy={14} r={1.5} fill={c1}/><circle cx={12} cy={12} r={1.5} fill={c1}/><circle cx={16} cy={16} r={1.5} fill={c1}/><circle cx={20} cy={13} r={1.5} fill={c1}/><circle cx={24} cy={15} r={1.5} fill={c1}/><line x1={3} y1={14} x2={27} y2={14} stroke={c1} strokeWidth={1}/><line x1={3} y1={8} x2={27} y2={8} stroke={c2} strokeWidth={0.7} strokeDasharray="3 2"/><line x1={3} y1={20} x2={27} y2={20} stroke={c2} strokeWidth={0.7} strokeDasharray="3 2"/></svg>;
    case "heatmap": return <svg {...common}>{[0,1,2,3].map(r => [0,1,2,3].map(ci => <rect key={`${r}${ci}`} x={3+ci*6} y={3+r*6} width={5.5} height={5.5} rx={1} fill={["#e5e7eb","#9ca3af","#6b7280","#374151","#9ca3af","#d1d5db","#4b5563","#9ca3af","#374151","#6b7280","#e5e7eb","#9ca3af","#d1d5db","#374151","#9ca3af","#6b7280"][r*4+ci]} opacity={0.8}/>))}</svg>;
    case "bubble": return <svg {...common}><circle cx={8} cy={18} r={4} fill={c1} opacity={0.4} stroke={c1} strokeWidth={1}/><circle cx={18} cy={10} r={6} fill={c2} opacity={0.4} stroke={c2} strokeWidth={1}/><circle cx={14} cy={20} r={3} fill={c3} opacity={0.4} stroke={c3} strokeWidth={1}/><circle cx={22} cy={18} r={2.5} fill={c1} opacity={0.4} stroke={c1} strokeWidth={1}/></svg>;
    case "pie": return <svg {...common}><path d="M14,14 L14,4 A10,10 0 0,1 22,10 Z" fill={c1} opacity={0.8}/><path d="M14,14 L22,10 A10,10 0 0,1 20,22 Z" fill={c2} opacity={0.8}/><path d="M14,14 L20,22 A10,10 0 0,1 6,20 Z" fill={c3} opacity={0.8}/><path d="M14,14 L6,20 A10,10 0 0,1 14,4 Z" fill="#b0b8c4" opacity={0.6}/></svg>;
    default: return <svg {...common}><rect x={4} y={4} width={20} height={20} rx={2} fill="#f1f5f9" stroke="#e2e8f0"/></svg>;
  }
}

// `path` deep-links to the standalone chart page when one exists.
// Tiles without a `path` fall back to opening Chart Studio itself.
const CHART_TYPES: { type: string; label: string; path?: string }[] = [
  { type: "scatter",   label: "Scatter Plot",   path: "/scatter-plot" },
  { type: "bar",       label: "Bar Chart",      path: "/bar-chart" },
  { type: "line",      label: "Line Chart" },
  { type: "box",       label: "Box & Whisker",  path: "/box-whisker-plot" },
  { type: "violin",    label: "Violin Plot",    path: "/violin-plot" },
  { type: "histogram", label: "Histogram" },
  { type: "survival",  label: "Kaplan-Meier",   path: "/kaplan-meier" },
  { type: "dose",      label: "Dose-Response",  path: "/dose-response" },
  { type: "roc",       label: "ROC Curve",      path: "/roc-curve" },
  { type: "volcano",   label: "Volcano Plot",   path: "/volcano-plot" },
  { type: "forest",    label: "Forest Plot",    path: "/forest-plot" },
  { type: "bland",     label: "Bland-Altman" },
  { type: "heatmap",   label: "Heatmap",        path: "/heatmap" },
  { type: "bubble",    label: "Bubble Plot" },
  { type: "pie",       label: "Pie / Donut" },
];

const STAT_TESTS = [
  "Unpaired t-test", "Paired t-test", "One-sample t-test",
  "Mann-Whitney U", "Wilcoxon Signed-Rank", "One-Way ANOVA",
  "Two-Way ANOVA", "Kruskal-Wallis", "Tukey Post-hoc",
  "Pearson Correlation", "Spearman Correlation", "Linear Regression",
  "Multiple Linear Regression", "Logistic Regression", "Poisson Regression",
  "Cox Regression", "Chi-Square", "Fisher's Exact", "Log-Rank Test",
  "Normality Test", "Descriptive Statistics",
  "PCA Analysis", "K-Means Clustering", "Hierarchical Clustering",
  "Power Analysis", "Dose-Response (4PL)",
];

const CHART_COUNT = CHART_TYPES.length;
const TEST_COUNT = STAT_TESTS.length;

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tint: string; // Tailwind text-* class for icon color
}
const FEATURES: Feature[] = [
  { icon: BarChart3,    tint: "text-sky-600",     title: `${CHART_COUNT} Chart Types`,       desc: "Scatter, bar, box, violin, heatmap, volcano, forest, Kaplan-Meier, dose-response, ROC, and more." },
  { icon: FlaskConical, tint: "text-emerald-600", title: `${TEST_COUNT} Statistical Tests`,  desc: "t-tests, ANOVA, Mann-Whitney, Kruskal-Wallis, correlation, regression (linear, logistic, Poisson, Cox), log-rank, PCA, clustering, dose-response." },
  { icon: Wand2,        tint: "text-violet-600",  title: "40+ Data Transforms",              desc: "Log/power, Box-Cox, quantile normalization, robust Z-score, ΔΔCt (qPCR), AUC, interpolation, outlier removal — grouped in cascading menus." },
  { icon: LayoutGrid,   tint: "text-indigo-600",  title: "Multi-Panel Layouts",              desc: "Compose figures with inset, 2-up, 3-up, or 4-up layouts. Independent data per panel with A/B/C labels." },
  { icon: Bot,          tint: "text-primary",     title: "AI Result Interpreter",            desc: "Built-in Claude/Gemini integration writes publication-ready result interpretations and figure legends automatically." },
  { icon: Cloud,        tint: "text-cyan-600",    title: "Cloud Save & Libraries",           desc: "Save projects, datasets, and graph presets. Sync across devices. Reuse data and chart settings across any project." },
  { icon: Ruler,        tint: "text-amber-600",   title: "Publication Presets",              desc: "Nature, Science, Cell, APA, and Minimal. Fonts, sizes, and colors matched to journal guidelines." },
  { icon: FileDown,     tint: "text-rose-600",    title: "Journal-Ready Export",             desc: "SVG, PNG up to 600 DPI, PDF, and JSON. Export exact journal dimensions or send directly to BioSketch Canvas." },
  { icon: Palette,      tint: "text-fuchsia-600", title: "6 Professional Themes",            desc: "Modern, Classic, Nature, Presentation, Dark, and Minimal. Colorblind-safe palettes included." },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Chart Studio",
  "applicationCategory": "EducationalApplication",
  "applicationSubCategory": "Scientific graphing & statistics",
  "operatingSystem": "Web",
  "url": "https://biosketch.art/chart-studio-intro",
  "description": `Free in-browser scientific graphing and statistics software. ${CHART_COUNT} chart types, ${TEST_COUNT} statistical tests, multi-panel layouts, AI result interpretation, and cloud save.`,
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "featureList": [
    `${CHART_COUNT} chart types (scatter, bar, box, violin, heatmap, volcano, forest, Kaplan-Meier, dose-response, ROC, bubble, pie, and more)`,
    `${TEST_COUNT} statistical tests (t-tests, ANOVA, Mann-Whitney, Kruskal-Wallis, regression, Cox, log-rank, PCA, clustering)`,
    "40+ data transforms (Box-Cox, quantile normalization, ΔΔCt, AUC)",
    "Multi-panel figure layouts",
    "AI-powered result interpretation",
    "Cloud save & dataset library",
    "Publication presets (Nature, Science, Cell, APA)",
    "Export to SVG, PNG (600 DPI), PDF, JSON",
  ],
  "publisher": { "@type": "Organization", "name": "BioSketch", "url": "https://biosketch.art" },
};

export default function ChartStudioLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-muted/20 to-background">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.06]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <SEOHead
        title="Chart Studio - Free Scientific Chart & Statistics Software | BioSketch"
        description={`Everything leading scientific graphing software does — in your browser, for free. ${CHART_COUNT} chart types, ${TEST_COUNT} statistical tests, multi-panel layouts, AI-powered result interpretation, and cloud save. Built for scientists.`}
        canonical="https://biosketch.art/chart-studio-intro"
        keywords="scientific graphing software, free statistical analysis tool, scientific chart maker, publication quality graphs, multi-panel figures, scientific data visualization, online statistics, PCA clustering regression, biostatistics software, GraphPad Prism alternative, free Prism alternative"
        structuredData={STRUCTURED_DATA}
      />

      {/* Breadcrumb — return path to Tools */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Tools
        </Link>
      </div>

      {/* ── Hero (scientific theme — matches Projects/Community/Icons/Tutorials/Tools) ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-4 md:pt-6">
        <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-7 md:px-10 py-8 md:py-10">
          {/* Atomic-orbit motif backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-slate-300 opacity-25"
          >
            <defs>
              <linearGradient id="cslOrbitFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g stroke="url(#cslOrbitFade)" fill="none" strokeWidth="1.4">
              <ellipse cx="100" cy="100" rx="78" ry="28" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(60 100 100)" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(-60 100 100)" />
            </g>
            <g className="text-primary">
              <circle cx="100" cy="100" r="6" fill="currentColor" opacity="0.55" />
              <circle cx="172" cy="106" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="56" cy="72" r="2.8" fill="currentColor" opacity="0.5" />
              <circle cx="68" cy="146" r="2.5" fill="currentColor" opacity="0.4" />
            </g>
          </svg>

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-muted/40 mb-3">
                <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-primary" aria-hidden>
                  <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
                  <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                  <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                  <circle cx="6" cy="6" r="1.1" fill="currentColor" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                  Chart Studio · Flagship
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-[1.05] tracking-tight">
                Publication-quality{" "}
                <span className="font-crimson italic font-bold text-primary">
                  charts
                </span>{" "}
                for scientists
              </h1>

              <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-xl leading-relaxed">
                Everything leading scientific graphing software does — plus AI result interpretation, multi-panel layouts, and cloud save. In your browser, at zero cost.
              </p>

              <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{CHART_COUNT}</span>
                  chart types
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{TEST_COUNT}</span>
                  statistical tests
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">40+</span>
                  data transforms
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  Free
                </span>
              </div>
            </div>

            <Button
              onClick={() => navigate("/chart-studio")}
              size="lg"
              className="gap-1.5 shadow-md relative z-10"
            >
              Open Chart Studio
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Chart Types Grid ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mt-20 pf-fade-3">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {CHART_COUNT} Chart Types
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Every chart a scientist needs — from scatter plots to correlation plots, volcano plots, survival curves, and ridgelines.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-w-3xl mx-auto">
          {CHART_TYPES.map(({ type, label, path }) => (
            <button
              key={type}
              type="button"
              onClick={() => navigate(path ?? "/chart-studio")}
              aria-label={path ? `Open ${label}` : `Build a ${label} in Chart Studio`}
              title={path ? `Open ${label}` : `Build a ${label} in Chart Studio`}
              className="group flex flex-col items-center gap-2.5 py-4 px-2 rounded-xl bg-card/70 border border-border shadow-sm transition-all hover:scale-105 hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <MiniChart type={type} />
              <span className="text-xs font-semibold text-muted-foreground text-center leading-tight group-hover:text-foreground transition-colors">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mt-20 pf-fade-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Everything you need. Nothing you don't.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, tint, title, desc }) => (
            <div
              key={title}
              className="p-5 rounded-2xl bg-card/70 border border-border shadow-sm transition-all hover:shadow-md"
            >
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl bg-muted/60 mb-3 ${tint}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1 tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Statistical Tests ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mt-20 pf-fade-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {TEST_COUNT} Statistical Tests & Analyses
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            From basic t-tests to advanced multivariate methods. Run analyses with one click — no coding required.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {STAT_TESTS.map((test) => (
            <div
              key={test}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/70 border border-border text-xs font-medium text-muted-foreground"
            >
              <Check className="h-3 w-3 text-emerald-600" />
              {test}
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 mt-20 pf-fade-5">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Chart Studio vs. Leading Scientific Graphing Software
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl mx-auto leading-relaxed">
            Everything the leading desktop graphing tools offer — plus web-based collaboration, AI-powered analysis, and a modern workflow. At zero cost.
          </p>
        </div>

        <div className="rounded-2xl bg-card/70 border border-border shadow-md overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Feature</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-foreground border-b border-border">Chart Studio</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Leading Desktop Software</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Price", "Free forever", "$275–545/yr"],
                ["Platform", "Web (any OS, any device)", "Windows / Mac only"],
                ["Chart types", `${CHART_COUNT} types`, "~25 types"],
                ["Statistical tests", `${TEST_COUNT} tests`, "30+ tests"],
                ["Advanced analyses", "PCA, K-means, Cox, logistic, Poisson, 4PL dose-response", "Similar"],
                ["Data transforms", "40+ (Box-Cox, quantile norm, ΔΔCt, AUC, survival censoring)", "Similar"],
                ["Multi-panel layouts", "Inset, 2-up, 3-up, 4-up grids with panel labels", "Yes"],
                ["Publication presets", "Nature, Science, Cell, APA, Minimal", "Via manual config"],
                ["Color palettes", "6 themes + colorblind-safe", "Limited"],
                ["AI result interpretation", "✓ Built-in (Claude / Gemini)", "✗ None"],
                ["AI figure legends", "✓ Auto-generate publication-ready", "✗ None"],
                ["Cloud save & sync", "✓ Across devices", "✗ Local files only"],
                ["Saved datasets library", "✓ Reusable across projects", "✗"],
                ["Saved graph presets", "✓ One-click reuse", "Limited templates"],
                ["Figure composition", "Built-in (BioSketch Canvas)", "Requires Illustrator/PowerPoint"],
                ["Collaboration", "Coming soon", "✗ None"],
                ["Export formats", "SVG, PNG (600 DPI), PDF, JSON", "TIFF, PDF, EMF"],
                ["Signup", "Free account", "Paid license"],
              ].map(([feature, us, them]) => (
                <tr key={feature} className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-medium text-foreground">{feature}</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-foreground">{us}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Comparison based on typical feature sets of commercial desktop scientific graphing software.
        </p>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 mt-24 mb-20 text-center pf-fade-5">
        <div className="rounded-3xl px-8 py-12 md:py-16 bg-slate-900 shadow-[0_20px_60px_-12px_hsl(var(--foreground)/0.3)]">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            Ready to make better charts?
          </h2>
          <p className="text-base md:text-lg text-slate-300 mt-3 max-w-md mx-auto leading-relaxed">
            Free with your BioSketch account. No credit card. No watermarks.
          </p>
          <Button
            onClick={() => navigate("/chart-studio")}
            size="lg"
            className="mt-6 h-12 px-10 text-base font-bold gap-2 bg-white text-slate-900 hover:bg-slate-100 shadow-lg"
          >
            Open Chart Studio
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
