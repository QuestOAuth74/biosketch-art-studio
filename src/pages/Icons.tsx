import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useIconGallery, useIconCategories, useIconsTotalCount, IconSortBy } from "@/hooks/useIconGallery";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { SEOHead } from "@/components/SEO/SEOHead";
import { IconCard } from "@/components/icons/IconCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatIconName } from "@/lib/iconNameFormatter";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getVisiblePages } from "@/lib/pagination";

const SORT_OPTIONS: { value: IconSortBy; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'A-Z' },
];

const PAGE_SIZE = 20;

const Icons = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for filters/paging so back/forward + refresh
  // all preserve state. Only the search-input value is local (so typing
  // doesn't rewrite history on every keystroke).
  const searchFromUrl = searchParams.get('search') || '';
  const sortBy = (searchParams.get('sort') as IconSortBy) || 'recent';
  const selectedCategory = searchParams.get('category') || '';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [searchInput, setSearchInput] = useState(searchFromUrl);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next);
  };

  const goToPage = (page: number) => {
    updateParams({ page: page <= 1 ? null : String(page) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { data: categories = [] } = useIconCategories();
  const { data: unfilteredTotal } = useIconsTotalCount();

  // Icon search is a premium capability (3+ approved shared projects). Non-premium
  // requests are blocked at the UI layer to reduce query load on the icons table.
  const { hasAccess: canSearch, isLoading: accessLoading } = useFeatureAccess();
  const [showPremiumGate, setShowPremiumGate] = useState(false);

  // Only pass a search term when the user is allowed to use it. This also protects
  // against deep-linked `?search=...` URLs shared with non-premium visitors.
  const effectiveSearchQuery = canSearch ? searchFromUrl : '';

  const { data: result, isLoading, isFetching } = useIconGallery({
    searchQuery: effectiveSearchQuery,
    sortBy,
    category: selectedCategory,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  // If a non-premium user lands with a `?search=` param (e.g. from a shared link),
  // clear it once the access check resolves and open the upgrade prompt.
  useEffect(() => {
    if (accessLoading) return;
    if (!canSearch && searchFromUrl) {
      updateParams({ search: null, page: null });
      setSearchInput('');
      setShowPremiumGate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, canSearch, searchFromUrl]);

  const isBusy = isLoading || isFetching;

  const icons = result?.icons || [];
  const totalCount = result?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Round the unfiltered total down to a marketing-friendly "N,000+" once loaded.
  const displayTotal = !unfilteredTotal
    ? ''
    : unfilteredTotal >= 1000
      ? `${Math.floor(unfilteredTotal / 1000).toLocaleString()},000+ `
      : `${unfilteredTotal.toLocaleString()} `;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) {
      setShowPremiumGate(true);
      return;
    }
    updateParams({ search: searchInput.trim() || null, page: null });
  };

  const handleSortChange = (sort: IconSortBy) => {
    updateParams({ sort: sort === 'recent' ? null : sort, page: null });
  };

  return (
    <>
      <SEOHead
        title="BioSketch Icons | Scientific Icons for Research Figures"
        description="Browse scientific icons available in the BioSketch canvas editor. High-quality icons for biology, chemistry, medical illustrations, and more."
        keywords="scientific icons, biology icons, chemistry icons, medical icons, research figures, BioSketch icons, canvas editor"
        canonical="https://biosketch.art/icons"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: "BioSketch Icons",
              description: "Preview scientific icons available in the BioSketch canvas editor for biology, chemistry, and medical illustrations.",
              url: "https://biosketch.art/icons",
              numberOfItems: totalCount,
              publisher: {
                "@type": "Organization",
                name: "BioSketch",
                url: "https://biosketch.art",
              },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: totalCount,
                itemListElement: icons.map((icon, i) => ({
                  "@type": "ListItem",
                  position: (currentPage - 1) * PAGE_SIZE + i + 1,
                  url: `https://biosketch.art/icons/${icon.id}`,
                  name: formatIconName(icon.name),
                })),
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://biosketch.art/" },
                { "@type": "ListItem", position: 2, name: "Icons", item: "https://biosketch.art/icons" },
              ],
            },
          ],
        }}
      />

      <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background">
        {/* Soft decorative blobs */}
        <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-muted/40 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-muted/40 rounded-full blur-3xl" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-16">

          {/* ── Hero (scientific theme — matches Projects/Community) ── */}
          <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
            {/* Atomic-orbit motif backdrop */}
            <svg
              aria-hidden
              viewBox="0 0 200 200"
              className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-muted-foreground opacity-25"
            >
              <defs>
                <linearGradient id="iconsOrbitFade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <g stroke="url(#iconsOrbitFade)" fill="none" strokeWidth="1.4">
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

            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-muted/60 mb-3">
                  <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-primary" aria-hidden>
                    <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
                    <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                    <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                    <circle cx="6" cy="6" r="1.1" fill="currentColor" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Icon Library
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight">
                  {displayTotal}<span className="italic text-primary">scientific</span> icons
                </h1>

                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  Biomedical icons in the BioSketch editor — biology, chemistry, neuroscience, anatomy, and more. Free and open source.
                </p>

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">
                      {isLoading ? "—" : totalCount.toLocaleString()}
                    </span>
                    icons
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{categories.length || "—"}</span>
                    categor{categories.length === 1 ? "y" : "ies"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                    <Sparkles className="h-2.5 w-2.5" />
                    Free &amp; open source
                  </span>
                </div>
              </div>

              <Button
                onClick={() => navigate('/ai-illustrator')}
                size="sm"
                className="gap-1.5 shadow-sm relative z-10"
              >
                <Sparkles className="h-4 w-4" />
                Try AI Illustrator
              </Button>
            </div>

            {/* Search — inside the hero card */}
            <form onSubmit={handleSearch} className="relative mt-5 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  if (!val.trim()) updateParams({ search: null, page: null });
                }}
                placeholder="Search icons by name — e.g. mitochondria, neuron, DNA…"
                className="pl-9 pr-20 h-10 text-sm bg-card border-border"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8"
              >
                Search
              </Button>
            </form>
          </div>

          {/* ── Main Content (full-width) ── */}
          <div className="mt-8 pf-fade-2">
            <div className="min-w-0">
              {/* Sort (own row) */}
              <div className="flex gap-1.5 mb-3">
                {SORT_OPTIONS.map((option) => (
                  <FilterPill
                    key={option.value}
                    selected={sortBy === option.value}
                    onClick={() => handleSortChange(option.value)}
                  >
                    {option.label}
                  </FilterPill>
                ))}
              </div>

              {/* Category pills — full-width wrap so every category gets room */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5 w-full">
                  <FilterPill
                    selected={selectedCategory === ''}
                    onClick={() => updateParams({ category: null, page: null })}
                  >
                    All
                  </FilterPill>
                  {categories.map((cat) => (
                    <FilterPill
                      key={cat.id}
                      selected={selectedCategory === cat.id}
                      onClick={() => updateParams({ category: cat.id, page: null })}
                    >
                      {cat.name}
                    </FilterPill>
                  ))}
                </div>
              )}

              {/* Results info */}
              {!isLoading && totalCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span>
                    {totalCount} icon{totalCount !== 1 ? 's' : ''}
                    {searchFromUrl && (
                      <> for "<span className="font-medium text-foreground">{searchFromUrl}</span>"</>
                    )}
                    {selectedCategory && (
                      <> in <span className="font-medium text-foreground">{categories.find(c => c.id === selectedCategory)?.name}</span></>
                    )}
                  </span>
                </div>
              )}

              {/* Grid */}
              {isBusy ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
                      <Skeleton className="aspect-square bg-muted/60" />
                      <div className="px-3 py-2 space-y-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : icons.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {icons.map((icon, index) => (
                      <IconCard key={icon.id} icon={icon} index={index} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center pt-8">
                      <Pagination>
                        <PaginationContent className="gap-1 border rounded-xl p-1.5 bg-card">
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => goToPage(Math.max(1, currentPage - 1))}
                              className={`rounded-lg ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'} transition-colors`}
                            />
                          </PaginationItem>

                          {getVisiblePages(currentPage, totalPages).map((page, index) => (
                            <PaginationItem key={`${page}-${index}`}>
                              {page === 'ellipsis' ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  onClick={() => goToPage(page)}
                                  isActive={currentPage === page}
                                  className={`rounded-lg cursor-pointer ${
                                    currentPage === page
                                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                      : 'hover:bg-muted'
                                  } transition-colors`}
                                >
                                  {page}
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
              ) : (
                <div className="rounded-2xl border border-border bg-card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    {searchFromUrl ? 'No icons found' : 'No icons yet'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {searchFromUrl
                      ? `No results for "${searchFromUrl}". Try different keywords.`
                      : 'Check back soon for new icons.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 mb-4 pf-fade-3">
            <div className="rounded-2xl bg-card/80 backdrop-blur-md border border-border p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary p-2 flex-shrink-0">
                  <Info className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-1 tracking-tight">
                    Preview Only
                  </p>
                  <p>
                    This is a preview of icons available for use in the BioSketch canvas editor.
                    Icons cannot be downloaded directly from this page.{' '}
                    <Link to="/canvas" className="text-foreground underline underline-offset-2 hover:text-foreground/70 font-medium">
                      Go to the Canvas Editor
                    </Link>{' '}
                    to build figures using these icons.
                  </p>
                  <p className="mt-2 text-xs">
                    Icons are sourced from the public domain including{' '}
                    <a href="https://bioicons.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/70">BioIcons</a>,{' '}
                    <a href="https://bioart.niaid.nih.gov" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/70">NIH BioArt</a>,{' '}
                    and <a href="https://biosketch.art" className="text-foreground underline underline-offset-2 hover:text-foreground/70">BioSketch.Art</a>.{' '}
                    See our <a href="/terms" className="text-foreground underline underline-offset-2 hover:text-foreground/70 font-medium">disclaimer page</a> for full attribution and licensing details.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom spacing */}
          <div className="h-12" />
        </div>
      </div>

      <AlertDialog open={showPremiumGate} onOpenChange={setShowPremiumGate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Search is a premium feature</AlertDialogTitle>
            <AlertDialogDescription>
              Icon search opens up once you've shared 3 approved projects with the community.
              In the meantime, head to the canvas — you can browse and drop icons directly from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/canvas')}>
              Open Canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Icons;
