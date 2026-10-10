import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowRight, Search, X, Sparkles, BarChart3 } from "lucide-react";
import { useToolVisitCounts } from "@/hooks/useToolVisits";
import { getVisiblePages } from "@/lib/pagination";

const TOOLS_PER_PAGE = 8;
const SECTION_PREVIEW = 4; // tools shown per category section on the default landing view

type ToolBadge = 'flagship' | 'new' | 'beta' | 'premium';
interface Tool {
  id: string;
  name: string;
  desc: string;
  tags: string[];
  path: string;
  badge?: ToolBadge;
}

// One curated colour per category — replaces 33 per-tool hex literals.
// Tool dots pull their colour from `tool.tags[0]` via `getToolColor()`.
const CATEGORY_COLORS: Record<string, string> = {
  'Biology':    '#059669', // emerald
  'Chemistry':  '#d97706', // amber
  'Clinical':   '#e11d48', // rose
  'Data Viz':   '#0284c7', // sky
  'Evolution':  '#059669', // emerald (branch of Biology)
  'Genetics':   '#7c3aed', // violet
  'Genomics':   '#c026d3', // fuchsia
  'Lab':        '#4f46e5', // indigo
  'Math':       '#475569', // slate
  'Planning':   '#ca8a04', // yellow
  'Statistics': '#dc2626', // red
  'General':    '#64748b', // gray
};
const getToolColor = (t: Pick<Tool, 'tags'>) => CATEGORY_COLORS[t.tags[0]] ?? '#64748b';

const tools: Tool[] = [
  { id: 'chart-studio', name: 'Chart Studio', desc: 'Full multi-chart editor for building publication-quality figures. 20+ chart types, layered composition, and one-click PNG/SVG export — the BioSketch flagship.', tags: ['Data Viz', 'General', 'Statistics'], path: '/chart-studio-intro', badge: 'flagship' },
  { id: 'pedigree', name: 'Pedigree Chart Maker', desc: 'Create publication-quality genetics pedigree charts with standard HGNC symbols, automatic offspring routing, and multiple export formats.', tags: ['Genetics', 'Biology'], path: '/pedigree' },
  { id: 'codons', name: 'Codon Wheel', desc: 'Interactive genetic code wheel for translating mRNA codons to amino acids. Color-coded by property with all 64 codons mapped.', tags: ['Genetics', 'Biology'], path: '/genetic-code-wheel' },
  { id: 'gantt', name: 'Gantt Chart Maker', desc: 'Plan research projects with task hierarchies, dependencies, milestones, and resource assignment. Auto-saves to your browser.', tags: ['Planning', 'General'], path: '/gantt' },
  { id: 'smiles', name: 'Molecular Structure Renderer', desc: 'Visualize chemical structures from SMILES strings. Search compounds by name via PubChem with export to SVG and PNG.', tags: ['Chemistry'], path: '/smiles' },
  { id: 'molecular-weight', name: 'Molecular Weight Calculator', desc: 'Enter any chemical formula to calculate molecular weight, elemental composition, and percent composition instantly.', tags: ['Chemistry'], path: '/molecular-weight' },
  { id: 'buffer-calculator', name: 'Buffer Calculator', desc: 'Henderson-Hasselbalch equation solver. Select from 10 buffer systems, enter target pH, get exact preparation recipe.', tags: ['Chemistry', 'Lab'], path: '/buffer-calculator' },
  { id: 'latex', name: 'LaTeX Equation Renderer', desc: 'Type LaTeX math equations and preview them instantly. Export as high-resolution PNG or SVG for publications and presentations.', tags: ['Math', 'General'], path: '/latex' },
  { id: 'dilution-calculator', name: 'Dilution & Molarity Calculator', desc: 'C₁V₁=C₂V₂ dilution solver, molarity from mass/volume/MW, and serial dilution series generator with exact volumes.', tags: ['Chemistry', 'Lab'], path: '/dilution-calculator' },
  { id: 'punnett-square', name: 'Punnett Square Calculator', desc: 'Generate Punnett squares for mono/di/trihybrid crosses. Genotype & phenotype ratios with Hardy-Weinberg equilibrium calculator.', tags: ['Genetics', 'Biology'], path: '/punnett-square' },
  { id: 'phylo-tree', name: 'Phylogenetic Tree Viewer', desc: 'Visualize phylogenetic trees from Newick format. Rectangular and radial layouts with branch length scaling, zoom, and export.', tags: ['Biology', 'Evolution'], path: '/phylo-tree' },
  { id: 'gel-electrophoresis', name: 'Gel Electrophoresis Simulator', desc: 'Simulate agarose gel electrophoresis with custom DNA fragments, DNA ladders, and adjustable gel percentage. Visualize band migration.', tags: ['Biology', 'Lab'], path: '/gel-electrophoresis' },
  { id: 'unit-converter', name: 'Scientific Unit Converter', desc: 'Convert between 40+ scientific units across 7 categories. Includes OD600→cell count, ng/µL→nM, µg/mL→molarity, and Beer-Lambert calculator.', tags: ['General', 'Lab'], path: '/unit-converter' },
  { id: 'dna-tools', name: 'DNA Sequence Tools', desc: 'Reverse complement, 6-frame translation, ORF finder, GC content, melting temperature, nucleotide composition, and FASTA formatting.', tags: ['Biology', 'Genetics'], path: '/dna-tools' },
  { id: 'plasmid-viewer', name: 'Plasmid Map Viewer', desc: 'Visualize plasmid maps from GenBank files with circular and linear views. Annotated features, sequence browser, and file upload.', tags: ['Biology', 'Genetics'], path: '/plasmid-viewer' },
  { id: 'volcano-plot', name: 'Volcano Plot Maker', desc: 'Visualize differential expression data. Paste log2FC and p-values, set thresholds, label top genes, and export publication-quality plots.', tags: ['Data Viz', 'Genomics'], path: '/volcano-plot' },
  { id: 'dose-response', name: 'Dose-Response Curve Fitter', desc: 'Fit 4-parameter logistic curves to calculate IC₅₀/EC₅₀, Hill slope, and R². Free alternative to GraphPad Prism for pharmacology.', tags: ['Data Viz', 'Chemistry'], path: '/dose-response' },
  { id: 'kaplan-meier', name: 'Kaplan-Meier Survival Curves', desc: 'Generate survival curves with log-rank test, median survival, censoring ticks, and number-at-risk tables. Supports multiple groups.', tags: ['Data Viz', 'Clinical'], path: '/kaplan-meier' },
  { id: 'enzyme-kinetics', name: 'Enzyme Kinetics Plotter', desc: 'Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee plots. Calculate Km, Vmax, and catalytic efficiency from substrate/velocity data.', tags: ['Chemistry', 'Biology'], path: '/enzyme-kinetics' },
  { id: 'scatter-plot', name: 'Scatter Plot with Regression', desc: 'XY scatter with 6 regression types, R², p-value, and 95% confidence intervals. Auto axis labels from data headers.', tags: ['Data Viz', 'General'], path: '/scatter-plot' },
  { id: 'chromosome-ideogram', name: 'Chromosome Ideogram Viewer', desc: 'Karyotype visualization with G-banding patterns at multiple resolutions. Annotate gene loci and GWAS hits across 100+ organisms.', tags: ['Biology', 'Genetics'], path: '/chromosome-ideogram' },
  { id: 'protein-domains', name: 'Protein Domain Viewer', desc: 'Linear protein domain architecture maps with domains, signal peptides, transmembrane regions, PTM sites, and disordered regions.', tags: ['Biology', 'Chemistry'], path: '/protein-domains' },
  { id: 'chi-square', name: 'Chi-Square Test', desc: 'Goodness of fit and test of independence. Contingency tables with expected frequencies, Yates correction, and Cramér\'s V.', tags: ['Statistics', 'Clinical'], path: '/chi-square' },
  { id: 'radar-chart', name: 'Radar Chart', desc: 'Create spider/radar plots to compare multiple datasets across categories. Multiple color themes, fill options, and data point overlays.', tags: ['Data Viz', 'General'], path: '/radar-chart' },
  { id: 'ci-proportion', name: 'CI of Proportion', desc: 'Calculate confidence intervals for proportions and counts. Wilson, Clopper-Pearson, Wald, Agresti-Coull, and Jeffreys methods.', tags: ['Statistics', 'Clinical'], path: '/ci-proportion' },
  { id: 'sankey-diagram', name: 'Sankey Diagram', desc: 'Create flow diagrams for patient flow, metabolic pathways, gene regulation networks. Automatic node layering with curved flow paths.', tags: ['Data Viz', 'Biology'], path: '/sankey-diagram' },
  { id: 'venn-diagram', name: 'Venn Diagram', desc: 'Create 2 or 3-set Venn diagrams. Paste gene lists, protein sets, or any items. Automatic overlap calculation with counts and item lists.', tags: ['Data Viz', 'Biology'], path: '/venn-diagram' },
  { id: 'roc-curve', name: 'ROC Curve', desc: 'Create ROC curves with AUC calculation. Compare multiple classifiers, find optimal cutoffs with Youden\'s index. Single or multi-model.', tags: ['Data Viz', 'Clinical'], path: '/roc-curve' },
  { id: 'forest-plot', name: 'Forest Plot', desc: 'Create forest plots for meta-analyses. Odds ratios, hazard ratios, risk ratios, mean differences with pooled estimates, confidence intervals, and study weights.', tags: ['Data Viz', 'Clinical'], path: '/forest-plot' },
  { id: 'correlation-matrix', name: 'Correlation Matrix', desc: 'Generate Pearson or Spearman correlation heatmaps. Customizable color scales, upper triangle, absolute scale. Export as SVG or PNG.', tags: ['Data Viz', 'Statistics'], path: '/correlation-matrix' },
  { id: 'violin-plot', name: 'Violin Plot', desc: 'Create violin plots with kernel density estimation, inner box plots, quartile markers, and jittered data points. Publication color themes.', tags: ['Data Viz', 'Statistics'], path: '/violin-plot' },
  { id: 'bar-chart', name: 'Bar Chart with Error Bars', desc: 'Create grouped bar charts with SEM, SD, or 95% CI error bars. Add significance brackets (*, **, ***). Multiple publication color themes.', tags: ['Data Viz', 'Statistics'], path: '/bar-chart' },
  { id: 'box-whisker-plot', name: 'Box & Whisker Plot', desc: 'Create box plots from grouped data. Calculate quartiles, IQR, whiskers, and outliers. Multiple color themes and styles with data point overlay.', tags: ['Data Viz', 'Statistics'], path: '/box-whisker-plot' },
  { id: 'heatmap', name: 'Heatmap Generator', desc: 'Generate publication-ready heatmaps from pasted data. Choose from 9 color scales, show cell values, reverse scales, and export as high-res PNG or SVG.', tags: ['Data Viz', 'Biology'], path: '/heatmap' },
];

const allTags = Array.from(new Set(tools.flatMap(t => t.tags))).sort();

const BADGE_STYLES: Record<ToolBadge, { label: string; className: string }> = {
  flagship: { label: 'Flagship',  className: 'bg-primary/10 text-primary border-primary/20' },
  new:      { label: 'New',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  beta:     { label: 'Beta',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  premium:  { label: 'Premium',   className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function ToolBadgePill({ badge }: { badge: ToolBadge }) {
  const style = BADGE_STYLES[badge];
  return (
    <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-semibold border ${style.className}`}>
      {style.label}
    </span>
  );
}

interface ToolRowProps { tool: Tool; onOpen: () => void; }
function ToolRow({ tool, onOpen }: ToolRowProps) {
  return (
    <button
      onClick={onOpen}
      aria-label={`Open ${tool.name}`}
      className="group w-full flex items-center gap-4 p-4 hover:bg-muted/50 text-left transition-all duration-150"
    >
      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getToolColor(tool) }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {tool.name}
          </h2>
          {tool.badge && <ToolBadgePill badge={tool.badge} />}
          <div className="hidden sm:flex gap-1.5">
            {tool.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 rounded-full font-medium bg-muted text-muted-foreground border-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {tool.desc}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

const Tools = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for filter + page so refresh / back-forward /
  // shared links all preserve state. Search input is local and debounces
  // into the URL so typing doesn't spam history.
  const activeTag = searchParams.get('tag');
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const searchFromUrl = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const search = searchFromUrl;

  const { counts, loading: countsLoading } = useToolVisitCounts();

  const updateParams = (updates: Record<string, string | null>, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, options);
  };

  const handleTagClick = (tag: string | null) => {
    updateParams({ tag: tag ?? null, page: null });
  };
  const goToPage = (p: number) => {
    updateParams({ page: p <= 1 ? null : String(p) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Debounce searchInput → URL search param. `replace: true` keeps typing
  // out of the history stack.
  useEffect(() => {
    if (searchInput === searchFromUrl) return;
    const t = setTimeout(() => {
      updateParams({ search: searchInput.trim() || null, page: null }, { replace: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, searchFromUrl]);

  const filtered = useMemo(() => {
    let result = tools;
    if (activeTag) {
      result = result.filter(t => t.tags.includes(activeTag));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [search, activeTag]);

  const totalPages = Math.ceil(filtered.length / TOOLS_PER_PAGE);
  const paged = filtered.slice((currentPage - 1) * TOOLS_PER_PAGE, currentPage * TOOLS_PER_PAGE);

  // Landing view: no filter + no search → show tools grouped by category.
  // Filtered / searched view: flat paginated list.
  const isLanding = !activeTag && !search.trim();

  const sectionsByTag = useMemo(() => {
    if (!isLanding) return [];
    return allTags
      .map(tag => ({ tag, tools: tools.filter(t => t.tags.includes(tag)) }))
      .filter(s => s.tools.length > 0);
  }, [isLanding]);

  const topTools = useMemo(() => {
    return [...tools]
      .map(t => ({ ...t, visits: counts[t.id] || 0 }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
  }, [counts]);

  const totalVisits = useMemo(() => {
    return Object.values(counts).reduce((sum, v) => sum + v, 0);
  }, [counts]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Free Scientific Tools for Researchers | BioSketch",
    "description": "Free online scientific tools for researchers, students, and educators.",
    "url": "https://biosketch.art/tools",
    "numberOfItems": tools.length,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": tools.length,
      "itemListElement": tools.map((t, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "WebApplication",
          "name": t.name,
          "description": t.desc,
          "url": `https://biosketch.art${t.path}`,
          "applicationCategory": "EducationalApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        },
      })),
    },
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-muted/20 to-background">
      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-muted/40 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-muted/30 rounded-full blur-3xl" />
      </div>

      <SEOHead
        title="Free Scientific Tools for Researchers | BioSketch"
        description="Free online scientific tools for researchers and students: Kaplan-Meier survival curves, dose-response IC50/EC50 curve fitter, volcano plot maker, plasmid map viewer, DNA sequence tools, unit converter, pedigree chart maker, genetic code wheel, Gantt chart, SMILES molecular renderer, molecular weight calculator, buffer calculator, LaTeX equation renderer, heatmap generator, dilution calculator, Punnett square calculator, phylogenetic tree viewer, and gel electrophoresis simulator. No signup required."
        canonical="https://biosketch.art/tools"
        keywords="free scientific tools, Kaplan-Meier survival curve, log-rank test, survival analysis, IC50 calculator, dose response curve, GraphPad alternative, volcano plot maker, plasmid map viewer, DNA sequence tools, scientific unit converter, pedigree chart maker, codon wheel, molecular weight calculator, buffer calculator, SMILES renderer, LaTeX equation editor, heatmap generator, dilution calculator, Punnett square calculator, phylogenetic tree viewer, gel electrophoresis simulator"
        structuredData={structuredData}
      />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-16 pb-12">

        {/* ── Hero (scientific theme — matches Projects/Community/Icons/Tutorials) ── */}
        <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
          {/* Atomic-orbit motif backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-slate-300 opacity-25"
          >
            <defs>
              <linearGradient id="toolsOrbitFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g stroke="url(#toolsOrbitFade)" fill="none" strokeWidth="1.4">
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
                  Scientific Tools
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-[1.05] tracking-tight">
                Free tools for{" "}
                <span className="font-crimson italic font-bold text-primary">
                  science
                </span>
              </h1>

              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Browser-based scientific tools for researchers and students — no signup, no install. Open and use.
              </p>

              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{tools.length}</span>
                  tool{tools.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{allTags.length}</span>
                  categor{allTags.length === 1 ? "y" : "ies"}
                </span>
                {totalVisits > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{totalVisits.toLocaleString()}</span>
                    visit{totalVisits === 1 ? "" : "s"}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  Free &amp; no signup
                </span>
              </div>
            </div>

            <Button
              onClick={() => navigate('/chart-studio-intro')}
              size="sm"
              className="gap-1.5 shadow-sm relative z-10"
            >
              <BarChart3 className="h-4 w-4" />
              Try Chart Studio
            </Button>
          </div>

          {/* Search — inside the hero card */}
          <div className="relative mt-5 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search tools by name, description, or category…"
              className="pl-9 pr-9 h-10 text-sm bg-card border-border"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                title="Clear search"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 pf-fade-2">

          {/* ── Left: Tool List ── */}
          <div className="min-w-0">
            {/* Category filters */}
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              <FilterPill selected={!activeTag} onClick={() => handleTagClick(null)}>
                All
              </FilterPill>
              {allTags.map(tag => (
                <FilterPill
                  key={tag}
                  selected={activeTag === tag}
                  onClick={() => handleTagClick(activeTag === tag ? null : tag)}
                >
                  {tag} <span className="opacity-60 tabular-nums ml-0.5">{tools.filter(t => t.tags.includes(tag)).length}</span>
                </FilterPill>
              ))}
            </div>

            {isLanding ? (
              /* Landing view: category sections with per-tag preview + "See all" */
              <div className="space-y-6">
                {sectionsByTag.map((section) => {
                  const preview = section.tools.slice(0, SECTION_PREVIEW);
                  const hasMore = section.tools.length > SECTION_PREVIEW;
                  return (
                    <section key={section.tag}>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[section.tag] }} />
                          <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">{section.tag}</h2>
                          <span className="text-xs text-muted-foreground tabular-nums">{section.tools.length}</span>
                        </div>
                        {hasMore && (
                          <button
                            type="button"
                            onClick={() => handleTagClick(section.tag)}
                            className="text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                          >
                            See all {section.tools.length}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="rounded-2xl bg-card/70 backdrop-blur-md border border-border overflow-hidden divide-y divide-border shadow-md">
                        {preview.map((tool) => (
                          <ToolRow key={tool.id} tool={tool} onOpen={() => navigate(tool.path)} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              /* Filtered / searched view: flat paginated list */
              <>
                {/* Results info */}
                <div className="text-xs text-muted-foreground mb-4">
                  <span className="font-semibold text-foreground">{filtered.length}</span> tool{filtered.length !== 1 ? 's' : ''}
                  {activeTag && <> in <span className="font-medium text-foreground">{activeTag}</span></>}
                  {search && <> matching "<span className="font-medium text-foreground">{search}</span>"</>}
                </div>

                <div className="rounded-2xl bg-card/70 backdrop-blur-md border border-border overflow-hidden divide-y divide-border shadow-md">
                  {paged.map((tool) => (
                    <ToolRow key={tool.id} tool={tool} onOpen={() => navigate(tool.path)} />
                  ))}

                  {filtered.length === 0 && (
                    <div className="text-center py-12 px-6">
                      <div className="h-14 w-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-foreground">
                        No tools match {search ? <>"<span className="font-medium">{search}</span>"</> : 'that filter'}{activeTag ? ` in ${activeTag}` : ""}.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSearchInput('');
                            updateParams({ search: null, tag: null, page: null });
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center pt-6">
                    <Pagination>
                      <PaginationContent className="gap-1 border rounded-xl p-1.5 bg-card">
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => goToPage(Math.max(1, currentPage - 1))}
                            className={`rounded-lg ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'} transition-colors`}
                          />
                        </PaginationItem>

                        {getVisiblePages(currentPage, totalPages).map((p, i) => (
                          <PaginationItem key={`${p}-${i}`}>
                            {p === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                onClick={() => goToPage(p)}
                                isActive={currentPage === p}
                                className={`rounded-lg cursor-pointer ${
                                  currentPage === p
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'hover:bg-muted'
                                } transition-colors`}
                              >
                                {p}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                            className={`rounded-lg ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'} transition-colors`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}

            {/* Footer — cross-links back into the app */}
            <div className="text-center mt-10 text-xs text-muted-foreground">
              More tools coming soon. All tools are free and require no account.
              <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate('/canvas')}
                  className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1"
                >
                  Open the Canvas <ArrowRight className="h-3 w-3" />
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/community')}
                  className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1"
                >
                  Browse Community <ArrowRight className="h-3 w-3" />
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/ai-illustrator')}
                  className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1"
                >
                  Try AI Illustrator <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="hidden lg:block pf-fade-3">
            <div className="sticky top-20 space-y-4">
              {/* Popular Tools */}
              <div className="rounded-2xl bg-card/70 backdrop-blur-md border border-border p-5 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-orange-500 rounded-full" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Popular</h3>
                </div>

                {countsLoading ? (
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : totalVisits === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Popular tools appear here as researchers use them.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {topTools.map((tool, i) => (
                      <button
                        key={tool.id}
                        onClick={() => navigate(tool.path)}
                        aria-label={`Open ${tool.name} (${tool.visits.toLocaleString()} visits)`}
                        className="group/item w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 text-left transition-all duration-150"
                      >
                        <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">
                          {i + 1}
                        </span>
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: getToolColor(tool) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground group-hover/item:text-primary transition-colors truncate">
                            {tool.name}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {tool.visits.toLocaleString()} visits
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!countsLoading && totalVisits > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="font-semibold text-foreground tabular-nums">{totalVisits.toLocaleString()}</span> total visits
                    </p>
                  </div>
                )}
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Tools;
