import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getVisiblePages } from '@/lib/pagination';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, Users, Eye, Heart, Library, Upload, Sparkles, ArrowRight, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ProjectCard } from '@/components/community/ProjectCard';
import { ProjectPreviewModal } from '@/components/community/ProjectPreviewModal';
import { CommunityFilters } from '@/components/community/CommunityFilters';
import { FeatureUnlockBanner } from '@/components/community/FeatureUnlockBanner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { SEOHead } from '@/components/SEO/SEOHead';
import { MobileWarningDialog } from '@/components/canvas/MobileWarningDialog';
import { CommunityTestIds } from '@/lib/test-ids';
import { SidebarQuote } from '@/components/sidebar/SidebarQuote';

interface CommunityProject {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  updated_at: string;
  thumbnail_url: string | null;
  view_count: number;
  cloned_count: number;
  like_count?: number;
  canvas_width: number;
  canvas_height: number;
  paper_size: string;
  field_of_study: string | null;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface RecentUploader {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  uploaded_at: string;
}

interface RecentCreator {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  latest_project_at: string;
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
      <span className="font-semibold text-foreground tabular-nums">{value.toLocaleString()}</span>
      {label}
    </span>
  );
}

function RecentUploaderRow({ uploader, navigate }: { uploader: RecentUploader; navigate: (path: string) => void }) {
  const initials = (uploader.full_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={() => navigate(`/author/${uploader.user_id}`)}
      title={`${uploader.full_name || 'Anonymous'} — ${formatDistanceToNow(new Date(uploader.uploaded_at), { addSuffix: true })}`}
      className="flex items-center gap-3 py-2.5 w-full text-left hover:bg-muted/50 rounded-lg px-2 -mx-1 transition-colors duration-200"
    >
      <Avatar className="h-8 w-8 shrink-0 ring-2 ring-background shadow-sm">
        <AvatarImage src={uploader.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate text-foreground hover:text-primary transition-colors">{uploader.full_name || 'Anonymous'}</p>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(uploader.uploaded_at), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}

type SortBy = 'recent' | 'popular' | 'cloned' | 'liked';

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for filters/paging so back/forward + refresh
  // preserve state and links are shareable. The search input value is local
  // so typing doesn't spam history; it debounces into the URL.
  const sortBy = (searchParams.get('sort') as SortBy) || 'recent';
  const fieldFilter = searchParams.get('field') || 'all';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const searchFromUrl = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const searchQuery = searchFromUrl;

  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<CommunityProject | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ totalProjects: 0, totalViews: 0, totalLikes: 0 });
  const [recentUploaders, setRecentUploaders] = useState<RecentUploader[]>([]);
  const [uploadersLoading, setUploadersLoading] = useState(true);
  const [recentCreators, setRecentCreators] = useState<RecentCreator[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const ITEMS_PER_PAGE = 12;

  const updateParams = (updates: Record<string, string | null>, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, options);
  };

  const handleSortChange = (v: SortBy) => updateParams({ sort: v === 'recent' ? null : v, page: null });
  const handleFieldChange = (v: string) => updateParams({ field: v === 'all' ? null : v, page: null });
  const goToPage = (p: number) => {
    updateParams({ page: p <= 1 ? null : String(p) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Debounce the search input into the URL. `replace: true` so mid-typing
  // doesn't pile up history entries — only the final query lands as a
  // navigable state.
  useEffect(() => {
    if (searchInput === searchFromUrl) return;
    const t = setTimeout(() => {
      updateParams({ search: searchInput.trim() || null, page: null }, { replace: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, searchFromUrl]);

  // Projects list reloads when the filters or page change.
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, fieldFilter, currentPage]);

  // Stats + sidebar lists load once on mount; the visibility effect below
  // handles refreshing them when the user returns from another tab.
  useEffect(() => {
    loadStats();
    loadRecentUploaders();
    loadRecentCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh sidebar lists when the user returns to this tab (e.g. after
  // creating or editing a project elsewhere).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadRecentCreators();
        loadRecentUploaders();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const loadRecentCreators = async () => {
    setCreatorsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_recent_project_creators', { p_limit: 20 });
      if (!error && data) setRecentCreators(data as RecentCreator[]);
    } catch (err) {
      console.error('Recent creators fetch error:', err);
    }
    setCreatorsLoading(false);
  };

  const loadStats = async () => {
    const { data, error } = await supabase
      .from('canvas_projects')
      .select('view_count, like_count')
      .eq('is_public', true)
      .eq('approval_status', 'approved')
      .neq('is_brush', true);

    if (!error && data) {
      setStats({
        totalProjects: data.length,
        totalViews: data.reduce((sum, p) => sum + (p.view_count || 0), 0),
        totalLikes: data.reduce((sum, p) => sum + (p.like_count || 0), 0),
      });
    }
  };

  const loadRecentUploaders = async () => {
    setUploadersLoading(true);
    try {
      const { data: recentProjects } = await supabase
        .from('canvas_projects')
        .select('user_id, updated_at')
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .neq('is_brush', true)
        .order('updated_at', { ascending: false })
        .limit(40);

      if (!recentProjects || recentProjects.length === 0) {
        setRecentUploaders([]);
        setUploadersLoading(false);
        return;
      }

      const seen = new Set<string>();
      const uniqueUploads: { user_id: string; uploaded_at: string }[] = [];
      for (const p of recentProjects) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          uniqueUploads.push({ user_id: p.user_id, uploaded_at: p.updated_at });
        }
        if (uniqueUploads.length >= 10) break;
      }

      const userIds = uniqueUploads.map(u => u.user_id);
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      setRecentUploaders(uniqueUploads.map(u => ({
        user_id: u.user_id,
        full_name: profileMap.get(u.user_id)?.full_name || null,
        avatar_url: profileMap.get(u.user_id)?.avatar_url || null,
        uploaded_at: u.uploaded_at,
      })));
    } catch (err) {
      console.error('Recent uploaders fetch error:', err);
    }
    setUploadersLoading(false);
  };

  const loadProjects = async () => {
    setLoading(true);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE - 1;

    let projectsQuery = supabase
      .from('canvas_projects')
      .select(`
        id,
        name,
        title,
        description,
        keywords,
        updated_at,
        thumbnail_url,
        view_count,
        cloned_count,
        like_count,
        canvas_width,
        canvas_height,
        paper_size,
        field_of_study,
        user_id
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('approval_status', 'approved')
      .neq('is_brush', true);

    if (fieldFilter && fieldFilter !== 'all') {
      projectsQuery = projectsQuery.eq('field_of_study', fieldFilter);
    }

    switch (sortBy) {
      case 'popular':
        projectsQuery = projectsQuery.order('view_count', { ascending: false });
        break;
      case 'cloned':
        projectsQuery = projectsQuery.order('cloned_count', { ascending: false });
        break;
      case 'liked':
        projectsQuery = projectsQuery.order('like_count', { ascending: false });
        break;
      case 'recent':
      default:
        projectsQuery = projectsQuery.order('updated_at', { ascending: false });
    }

    projectsQuery = projectsQuery.range(startIndex, endIndex);

    const { data: projectsData, error: projectsError, count } = await projectsQuery;

    if (projectsError) {
      toast.error('Failed to load community projects');
      console.error(projectsError);
      setLoading(false);
      return;
    }

    setTotalCount(count || 0);

    const userIds = [...new Set(projectsData?.map(p => p.user_id) || [])];
    const { data: profilesData, error: profilesError } = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Failed to load profiles:', profilesError);
    }

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
    const projectsWithProfiles = projectsData?.map(project => ({
      ...project,
      profiles: profilesMap.get(project.user_id) || null,
    })) || [];

    setProjects(projectsWithProfiles);
    setLoading(false);
  };

  // AI-powered semantic search
  const [searchResults, setSearchResults] = useState<CommunityProject[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    let cancelled = false;

    const doSearch = async () => {
      setSearchLoading(true);

      // Expand the query into synonyms via the AI semantic search edge function.
      // Falls back to just the user query if the call fails or times out.
      let terms: string[] = [searchQuery.trim()];
      try {
        const aiPromise = supabase.functions.invoke('semantic-icon-search', {
          body: { query: searchQuery.trim() },
        });
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
        const result = await Promise.race([aiPromise, timeout]);
        if (result && 'data' in result && result.data?.terms?.length > 0) {
          terms = result.data.terms;
        }
      } catch {}

      if (cancelled) return;

      const selectFields = 'id, name, title, description, keywords, updated_at, thumbnail_url, view_count, cloned_count, like_count, canvas_width, canvas_height, paper_size, field_of_study, user_id';
      const expandedTerms = terms.slice(0, 4);

      const baseFilters = <T extends { eq: any; neq: any }>(q: T): T =>
        q.eq('is_public', true).eq('approval_status', 'approved').neq('is_brush', true);

      // Path 1: Postgres full-text search on the precomputed `search_vector` tsvector
      // column (title+name=A, description+field+keywords=B). Gives stemming, plurals,
      // stop-word handling, multi-word relevance — the same engine used by the canvas
      // icon search in IconLibrary.tsx.
      const websearchQuery = searchQuery.trim().split(/\s+/).join(' & ');
      const ftsQueryBuilder = baseFilters(supabase
        .from('canvas_projects')
        .select(selectFields))
        .textSearch('search_vector', websearchQuery, { type: 'websearch', config: 'english' })
        .limit(80);

      // Path 2: ilike + keywords.cs across all expanded terms — catches synonyms that
      // FTS doesn't know about, plus exact tag matches for each expanded term.
      const orClauses: string[] = [];
      for (const t of expandedTerms) {
        const safe = t.replace(/[,()%]/g, ' ').trim();
        if (!safe) continue;
        orClauses.push(`title.ilike.%${safe}%`);
        orClauses.push(`name.ilike.%${safe}%`);
        orClauses.push(`description.ilike.%${safe}%`);
        orClauses.push(`field_of_study.ilike.%${safe}%`);
        orClauses.push(`keywords.cs.{${safe}}`);
      }
      const ilikeQueryBuilder = baseFilters(supabase
        .from('canvas_projects')
        .select(selectFields))
        .or(orClauses.join(','))
        .limit(80);

      // Run both in parallel; FTS soft-fails (e.g. column missing in dev) and
      // ilike continues to provide results.
      const [ftsResult, ilikeResult] = await Promise.all([
        (ftsQueryBuilder as any).then((r: any) => r, (e: any) => ({ data: null, error: e })),
        ilikeQueryBuilder,
      ]);

      if (cancelled) return;

      if (ftsResult.error) {
        console.warn('Community FTS search soft-failed:', ftsResult.error.message);
      }

      const merged = [...(ftsResult.data || []), ...(ilikeResult.data || [])];
      const seen = new Set<string>();
      const unique = merged.filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      const ftsIds = new Set<string>((ftsResult.data || []).map((p: any) => p.id));
      const query = searchQuery.toLowerCase().trim();
      const expandedLower = expandedTerms.map(t => t.toLowerCase());

      const scored = unique.map((p: any) => {
        let score = 0;
        const title = (p.title || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const field = (p.field_of_study || '').toLowerCase();
        const kw = (p.keywords || []).map((k: string) => k.toLowerCase());
        const allText = `${title} ${name} ${desc} ${field} ${kw.join(' ')}`;

        if (title === query || name === query) score += 1000;
        else if (title.startsWith(query) || name.startsWith(query)) score += 800;
        else if (kw.includes(query)) score += 600;
        else if (title.includes(query) || name.includes(query)) score += 400;
        else if (field.includes(query)) score += 300;
        else if (kw.some((k: string) => k.includes(query))) score += 250;
        else if (desc.includes(query)) score += 200;

        if (ftsIds.has(p.id)) score += 200;

        let expandedHits = 0;
        for (const term of expandedLower.slice(1)) {
          if (allText.includes(term)) expandedHits++;
        }
        score += Math.min(150, expandedHits * 30);
        score += Math.min(50, (p.view_count || 0) / 10);

        return { ...p, _score: score };
      });

      scored.sort((a: any, b: any) => b._score - a._score);
      const finalResults = scored.slice(0, 60);

      if (finalResults.length > 0) {
        const userIds = [...new Set(finalResults.map((p: any) => p.user_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const withProfiles = finalResults.map((p: any) => ({
          ...p,
          profiles: profileMap.get(p.user_id) || null,
        }));
        setSearchResults(withProfiles as CommunityProject[]);
      } else {
        setSearchResults([]);
      }

      setSearchTotal(finalResults.length);
      setSearchLoading(false);
    };

    const timer = setTimeout(doSearch, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const isSearching = searchQuery.length >= 2;
  const totalPages = isSearching
    ? Math.ceil(searchTotal / ITEMS_PER_PAGE)
    : Math.ceil(totalCount / ITEMS_PER_PAGE);

  const displayProjects = isSearching ? searchResults : projects;
  const isDisplayLoading = isSearching ? searchLoading : loading;

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-muted/20 to-background"
      data-testid={CommunityTestIds.PAGE_CONTAINER}
    >
      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-muted/40 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-muted/30 rounded-full blur-3xl" />
      </div>
      <MobileWarningDialog />
      <SEOHead
        title="Community Gallery - Free Scientific Illustrations | BioSketch"
        description="Discover and download free scientific illustrations created by researchers worldwide. Browse high-quality biology, chemistry, and medical diagrams. Use as templates for your own research figures."
        keywords="scientific illustrations, biology diagrams, medical figures, research templates, free scientific diagrams, BioSketch community, biomedical illustration"
        canonical="https://biosketch.art/community"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: "BioSketch Community Gallery",
              description: "Free scientific illustrations created by researchers and educators worldwide. Browse, clone, and use as templates for your own research figures.",
              url: "https://biosketch.art/community",
              numberOfItems: stats.totalProjects,
              publisher: {
                "@type": "Organization",
                name: "BioSketch",
                url: "https://biosketch.art",
              },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: stats.totalProjects,
                itemListElement: displayProjects.map((project, i) => ({
                  "@type": "ListItem",
                  position: (currentPage - 1) * ITEMS_PER_PAGE + i + 1,
                  url: `https://biosketch.art/community`,
                  name: project.title || project.name,
                  ...(project.description && { description: project.description }),
                })),
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://biosketch.art/" },
                { "@type": "ListItem", position: 2, name: "Community Gallery", item: "https://biosketch.art/community" },
              ],
            },
          ],
        }}
      />
      <FeatureUnlockBanner />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-16">

        {/* ── Hero (scientific theme — matches Projects page) ── */}
        <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
          {/* Atomic-orbit motif backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-slate-300 opacity-25"
          >
            <defs>
              <linearGradient id="commOrbitFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g stroke="url(#commOrbitFade)" fill="none" strokeWidth="1.4">
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
                  Community Library
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-[1.05] tracking-tight">
                Discover{" "}
                <span className="font-crimson italic font-bold text-primary">
                  open
                </span>{" "}
                research
              </h1>

              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Diagrams, figures, and illustrations by scientists worldwide — clone any project as a starting template.
              </p>

              {stats.totalProjects > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <StatPill value={stats.totalProjects} label={`project${stats.totalProjects === 1 ? '' : 's'}`} />
                  <StatPill value={stats.totalViews} label={`view${stats.totalViews === 1 ? '' : 's'}`} />
                  {stats.totalLikes > 0 && (
                    <StatPill value={stats.totalLikes} label={`like${stats.totalLikes === 1 ? '' : 's'}`} />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 relative z-10">
              {user && (
                <Button
                  onClick={() => navigate('/projects')}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Share your work
                </Button>
              )}
              <Button
                onClick={() => navigate('/ai-illustrator')}
                size="sm"
                className="gap-1.5 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                Try AI Illustrator
              </Button>
            </div>
          </div>

          {/* Search bar — inside the hero card */}
          <div className="relative mt-5 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search the library by title, keyword, or field…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm bg-card border-border"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 pf-fade-2">

          {/* ── Left: Projects ── */}
          <div className="min-w-0">
            {/* Filters */}
            <div className="mb-4">
              <CommunityFilters sortBy={sortBy} onSortChange={handleSortChange} fieldFilter={fieldFilter} onFieldChange={handleFieldChange} />
            </div>

            {/* Results info */}
            {!isDisplayLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <span>
                  {isSearching ? searchTotal : totalCount} project{(isSearching ? searchTotal : totalCount) !== 1 ? 's' : ''}
                  {searchQuery && searchQuery.length >= 2 && (
                    <> matching "<span className="font-medium text-foreground">{searchQuery}</span>"</>
                  )}
                </span>
              </div>
            )}

            {/* Loading State */}
            {isDisplayLoading ? (
              <>
                {/* Status line: spinner + the query the user is searching for,
                    so refetches triggered by a new search/filter change have
                    visible feedback (not just a flicker). Matches the
                    canvas-side IconLibrary and /icons pages. */}
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>
                    {isSearching ? (
                      <>Searching <span className="font-medium text-foreground">"{searchQuery.trim()}"</span>…</>
                    ) : (
                      'Fetching figures from the community…'
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border bg-card">
                      <Skeleton className="w-full aspect-[3/2]" />
                      <div className="p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : displayProjects.length === 0 ? (
              /* Empty State — two variants: filtered/searched or truly empty */
              <div className="rounded-2xl border bg-card p-12 text-center">
                <div className="h-16 w-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
                  {isSearching || fieldFilter !== 'all' ? (
                    <Search className="h-7 w-7 text-muted-foreground/50" />
                  ) : (
                    <Users className="h-7 w-7 text-muted-foreground/50" />
                  )}
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {isSearching
                    ? `No matches for "${searchQuery.trim()}"`
                    : fieldFilter !== 'all'
                      ? 'No projects in this field yet'
                      : 'No community projects yet'}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {isSearching
                    ? 'Try different keywords, remove the field filter, or browse the full library.'
                    : fieldFilter !== 'all'
                      ? 'Nobody has shared work tagged in this field yet — be the first, or explore other categories.'
                      : 'The library is waiting for its first contribution. Share a figure to seed the community.'}
                </p>
                <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
                  {(isSearching || fieldFilter !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchInput('');
                        updateParams({ search: null, field: null, page: null });
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                  {user ? (
                    <Button size="sm" onClick={() => navigate('/projects')} className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      Share your work
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => navigate('/auth')} className="gap-1.5">
                      Sign in to share
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Project Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayProjects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onPreview={() => setSelectedProject(project)}
                      onLikeChange={loadProjects}
                      index={index}
                    />
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
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="hidden lg:block pf-fade-3">
            <div className="sticky top-20 space-y-4">
              {/* Recent Contributors */}
              <div className="rounded-2xl bg-card/70 backdrop-blur-md border border-border p-5 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent Contributors</h3>
                </div>

                {uploadersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentUploaders.length > 0 ? (
                  <div className="space-y-0.5">
                    {recentUploaders.map((u) => (
                      <RecentUploaderRow key={u.user_id} uploader={u} navigate={navigate} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No recent activity</p>
                )}
              </div>

              {/* Recently Creating — last 20 users who created any project
                  (public or private). Neutral styling to match the sidebar. */}
              <div className="rounded-2xl bg-card/70 backdrop-blur-md border border-border p-5 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Recently Creating
                  </h3>
                </div>

                {creatorsLoading ? (
                  <div className="grid grid-cols-5 gap-2">
                    {[...Array(20)].map((_, i) => (
                      <Skeleton key={i} className="h-9 w-9 rounded-full" />
                    ))}
                  </div>
                ) : recentCreators.length > 0 ? (
                  <div className="grid grid-cols-5 gap-x-2 gap-y-3">
                    {recentCreators.map((c) => {
                      const initials = (c.full_name || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const firstName = (c.full_name || 'Anonymous').split(' ')[0];
                      return (
                        <button
                          key={c.user_id}
                          onClick={() => navigate(`/author/${c.user_id}`)}
                          title={`${c.full_name || 'Anonymous'} — ${formatDistanceToNow(new Date(c.latest_project_at), { addSuffix: true })}`}
                          className="flex flex-col items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg p-0.5 transition-transform hover:-translate-y-0.5"
                        >
                          <Avatar className="h-9 w-9 ring-1 ring-border bg-muted">
                            <AvatarImage src={c.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs font-semibold text-muted-foreground bg-muted border-0">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-medium text-muted-foreground truncate max-w-full leading-none group-hover:text-primary transition-colors">
                            {firstName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
                )}
              </div>

              {/* Quote */}
              <SidebarQuote />
            </div>
          </aside>
        </div>

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>

      {/* Preview Modal */}
      {selectedProject && (
        <ProjectPreviewModal
          project={selectedProject}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}

