import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEO/SEOHead';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Play, BookOpen, Pencil, MousePointer, FileOutput, Scissors, Image, Video, GraduationCap, Layers } from 'lucide-react';

const tutorialStyles = `
  @keyframes tut-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .tut-fade-1 { animation: tut-fade-up 0.4s ease-out 0.1s both; }
  .tut-fade-2 { animation: tut-fade-up 0.4s ease-out 0.2s both; }
  .tut-fade-3 { animation: tut-fade-up 0.4s ease-out 0.3s both; }
`;

interface Tutorial {
  videoId: string;
  title: string;
  blogSlug: string;
  category: string;
}

const CATEGORIES = [
  { key: 'all', label: 'All Tutorials', Icon: Play },
  { key: 'getting-started', label: 'Getting Started', Icon: MousePointer },
  { key: 'drawing', label: 'Drawing Tools', Icon: Pencil },
  { key: 'text-labels', label: 'Text & Labels', Icon: BookOpen },
  { key: 'editing', label: 'Editing & Effects', Icon: Scissors },
  { key: 'export', label: 'Export & Workflow', Icon: FileOutput },
  { key: 'illustrations', label: 'Illustrations', Icon: Image },
];

const tutorials: Tutorial[] = [
  // Getting Started
  { videoId: 'Pr4Vh_zh11Y', title: 'How to Add Icons to the Canvas', blogSlug: 'how-to-add-icons-to-the-canvas-biosketchart-software', category: 'getting-started' },
  { videoId: 'uxHMomuFLRI', title: 'Customizing your Canvas and Workflow', blogSlug: 'customizing-your-canvas-and-workflow', category: 'getting-started' },
  { videoId: 'm2cU5_pqRVo', title: 'Importing Personal Assets', blogSlug: 'importing-personal-assets', category: 'getting-started' },
  { videoId: 'O7DYSFVL77E', title: 'Right Click Features', blogSlug: 'right-click-features', category: 'getting-started' },
  // Drawing Tools
  { videoId: 'EdHu_SYtucM', title: 'How to Draw Lines and Curves', blogSlug: 'how-to-draw-lines-and-curves', category: 'drawing' },
  { videoId: 'wcYQNfOCCxI', title: 'How to Draw Custom and Conventional Shapes', blogSlug: 'how-to-draw-custom-and-conventional-shapes-in-biostetchart', category: 'drawing' },
  { videoId: 'CgqhTEm95jM', title: 'Drawing with Bezier and Freeform Tools', blogSlug: 'drawing-with-bezier-and-freeform-tools-biosketch-software', category: 'drawing' },
  { videoId: 'RR1fsKKIb88', title: 'Advanced Custom Line Tools', blogSlug: 'advanced-custom-line-tools', category: 'drawing' },
  { videoId: '9u4uR2NrLqY', title: 'How to Draw Cell Membranes', blogSlug: 'how-to-draw-cell-membranes', category: 'drawing' },
  { videoId: '383n3ST8KjU', title: 'Drawing Shapes with Text', blogSlug: 'drawing-shapes-with-text-using-biosketchart', category: 'drawing' },
  // Text & Labels
  { videoId: '39iDfG-aluE', title: 'Text Features — Formatting, Text Box, Labels', blogSlug: 'text-featuresformatting-text-box-labels-in-biosketch-software', category: 'text-labels' },
  { videoId: '5grJXYxvI_U', title: 'How to Label Figures', blogSlug: 'how-to-label-figures', category: 'text-labels' },
  { videoId: 'ymaKwQ_qrVQ', title: 'Simple Call Out Tool', blogSlug: 'simple-call-out-tool', category: 'text-labels' },
  // Editing & Effects
  { videoId: 'wiR9kfVCs6s', title: 'The Eraser Tool — Editing Imported Images', blogSlug: 'the-eraser-tool-editing-imported-images-or-icons-on-the-canvas', category: 'editing' },
  { videoId: '18XqGIu8qIo', title: 'Cropping Tool Features', blogSlug: 'cropping-tool-features', category: 'editing' },
  { videoId: 'ZRugcDsiW_Q', title: 'How to Create a Mask with Custom Tools', blogSlug: 'how-to-create-a-mask-with-custom-tools', category: 'editing' },
  { videoId: 'OQZ2zcu3ZEs', title: 'How to Position and Space Objects', blogSlug: 'how-to-position-and-space-objects', category: 'editing' },
  // Export & Workflow
  { videoId: 'pIg12KSD6Hc', title: 'Exporting Projects in Various Formats', blogSlug: 'exporting-projects-in-various-formats', category: 'export' },
  { videoId: 'XjmcaX-IpiQ', title: 'Integrating Charts in your Illustration', blogSlug: 'integrating-charts-in-your-illustration', category: 'export' },
  // Scientific Illustrations
  { videoId: 'jjPThdvePqY', title: 'The Transportation and Metabolism of Lipids', blogSlug: 'the-transportation-and-metabolism-of-lipids-scientific-illustration', category: 'illustrations' },
  { videoId: 'cIMm_Xu3jeI', title: 'Glycogenesis in the Liver', blogSlug: 'glycogenesis-in-the-liver', category: 'illustrations' },
  { videoId: '2mG66SoC2FE', title: 'The Structure of Human Insulin', blogSlug: 'the-structure-of-human-insulin-scientific-illustration', category: 'illustrations' },
];

// Count tutorials per category (excluding 'all')
const categoryCounts = CATEGORIES.filter(c => c.key !== 'all').map(c => ({
  ...c,
  count: tutorials.filter(t => t.category === c.key).length,
}));

const Tutorials = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);

  const filtered = tutorials.filter((t) => {
    const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <SEOHead
        title="BioSketch Tutorials — Learn Scientific Illustration"
        description="Watch video tutorials on how to use BioSketch. Learn drawing tools, text formatting, exporting, and more."
        keywords="BioSketch tutorial, scientific illustration tutorial, how to use BioSketch, video guide"
        canonical="https://biosketch.art/tutorials"
      />

      <style>{tutorialStyles}</style>

      <div
        className="min-h-screen relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #F5F5F5 0%, #FAFAFA 35%, #FFFFFF 100%)",
        }}
      >
        {/* Soft decorative blobs */}
        <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gray-200/25 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-gray-200/20 rounded-full blur-3xl" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-16">

          {/* ── Hero (scientific theme — matches Projects/Community/Icons) ── */}
          <div className="tut-fade-1 relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
            {/* Atomic-orbit motif backdrop */}
            <svg
              aria-hidden
              viewBox="0 0 200 200"
              className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-slate-300 opacity-25"
            >
              <defs>
                <linearGradient id="tutOrbitFade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <g stroke="url(#tutOrbitFade)" fill="none" strokeWidth="1.4">
                <ellipse cx="100" cy="100" rx="78" ry="28" />
                <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(60 100 100)" />
                <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(-60 100 100)" />
              </g>
              <circle cx="100" cy="100" r="6" fill="hsl(213, 55%, 50%)" opacity="0.55" />
              <circle cx="172" cy="106" r="3.5" fill="hsl(213, 55%, 50%)" opacity="0.7" />
              <circle cx="56" cy="72" r="2.8" fill="hsl(213, 55%, 50%)" opacity="0.5" />
              <circle cx="68" cy="146" r="2.5" fill="hsl(213, 55%, 50%)" opacity="0.4" />
            </svg>

            <div className="relative min-w-0">
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50/80 mb-3"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-[hsl(213,55%,50%)]" aria-hidden>
                  <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
                  <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                  <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                  <circle cx="6" cy="6" r="1.1" fill="currentColor" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Tutorials
                </span>
              </div>

              <h1
                className="text-3xl md:text-[40px] font-bold text-slate-900 leading-[1.05]"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.028em" }}
              >
                Learn at your own{" "}
                <span
                  className="italic font-bold"
                  style={{
                    fontFamily: "'Crimson Pro','Source Serif Pro',Georgia,serif",
                    color: "hsl(213, 55%, 36%)",
                  }}
                >
                  pace
                </span>
              </h1>

              <p className="text-[13px] text-muted-foreground mt-2 max-w-xl">
                Step-by-step video guides to master BioSketch and create publication-ready scientific illustrations.
              </p>

              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900 tabular-nums">{tutorials.length}</span>
                  tutorial{tutorials.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900 tabular-nums">{CATEGORIES.length - 1}</span>
                  categor{CATEGORIES.length - 1 === 1 ? "y" : "ies"}
                </span>
              </div>

              {/* Search — inside the hero card */}
              <div className="relative mt-5 max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search tutorials — e.g. drawing, exporting, AI illustrator…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-sm bg-white border-slate-200"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
              </div>
            </div>
          </div>

          {/* ── Main Content Grid ── */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 tut-fade-2">

            {/* ── Left Sidebar: Categories ── */}
            <div className="order-2 lg:order-1">
              <div
                className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 lg:sticky lg:top-20"
                style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
              >
                <h3
                  className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  Categories
                </h3>
                <nav className="space-y-1" style={{ fontFamily: "Inter, sans-serif" }}>
                  {CATEGORIES.map(({ key, label, Icon }) => {
                    const count = key === 'all' ? tutorials.length : tutorials.filter(t => t.category === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveCategory(key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          activeCategory === key
                            ? 'bg-primary text-white shadow-md font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-left">{label}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          activeCategory === key
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* ── Right: Tutorial Grid ── */}
            <div className="min-w-0 order-1 lg:order-2">
              {/* Mobile category chips */}
              <div className="flex flex-wrap gap-2 mb-4 lg:hidden" style={{ fontFamily: "Inter, sans-serif" }}>
                {CATEGORIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${
                      activeCategory === key
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Results header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {filtered.length} tutorial{filtered.length !== 1 ? 's' : ''}
                  {activeCategory !== 'all' && (
                    <> in <span className="text-foreground font-medium">{CATEGORIES.find(c => c.key === activeCategory)?.label}</span></>
                  )}
                  {searchQuery && (
                    <> matching "<span className="text-foreground font-medium">{searchQuery}</span>"</>
                  )}
                </p>
              </div>

              {filtered.length === 0 ? (
                <div
                  className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-12 text-center"
                  style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
                >
                  <Search className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No tutorials found matching your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((tutorial, index) => (
                    <div
                      key={tutorial.videoId}
                      className="group rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                      style={{
                        animationDelay: `${index * 30}ms`,
                        boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)",
                      }}
                      onClick={() => setActiveVideo(tutorial)}
                    >
                      {/* YouTube thumbnail */}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <img
                          src={`https://img.youtube.com/vi/${tutorial.videoId}/mqdefault.jpg`}
                          alt={tutorial.title}
                          className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors duration-300">
                          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-2.5">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-200">
                          {tutorial.title}
                        </h3>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider rounded-full px-2.5">
                            {CATEGORIES.find(c => c.key === tutorial.category)?.label || tutorial.category}
                          </Badge>
                          <Link
                            to={`/blog/${tutorial.blogSlug}`}
                            className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <BookOpen className="h-3 w-3" />
                            Read article
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom spacing */}
          <div className="h-12" />
        </div>
      </div>

      {/* Video Modal */}
      <Dialog open={!!activeVideo} onOpenChange={(open) => { if (!open) setActiveVideo(null); }}>
        <DialogContent className="max-w-4xl p-0 gap-0 bg-black border-0 overflow-hidden rounded-xl">
          {activeVideo && (
            <>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="px-5 py-3 bg-black/90 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white truncate">{activeVideo.title}</h3>
                <Link
                  to={`/blog/${activeVideo.blogSlug}`}
                  className="text-xs text-primary hover:underline shrink-0 ml-4"
                  onClick={() => setActiveVideo(null)}
                >
                  Read article
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Tutorials;
