import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Loader2, Plus, Trash2, FolderOpen, Search, Globe, Lock, CheckCircle, XCircle, FileText, Copy, Users, Share2, Eye, Heart, Film, Clapperboard, BarChart3, Shapes, ArrowRight, MousePointer2, MessageSquare, Sparkles } from 'lucide-react';
import { FilterPill } from '@/components/ui/filter-pill';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ShareProjectDialog } from '@/components/projects/ShareProjectDialog';
import { CollaborateDialog } from '@/components/collaboration/CollaborateDialog';
import { TemplateBrowserModal } from '@/components/projects/TemplateBrowserModal';
import { UsersThree } from '@phosphor-icons/react';
import { useLazyThumbnails } from '@/hooks/useLazyThumbnails';
import { ThumbnailWithSpinner } from '@/components/projects/ThumbnailWithSpinner';
import { SidebarQuote } from '@/components/sidebar/SidebarQuote';
import { useAnimationFeature } from '@/hooks/useAnimationFeature';
import { useProjectLimit } from '@/hooks/useProjectLimit';
import { checkProjectLimit } from '@/lib/projectLimit';
import { DonationPromptModal } from '@/components/donate/DonationPromptModal';
import { getVisiblePages } from '@/lib/pagination';

type FilterStatus = 'all' | 'public' | 'private' | 'shared';

interface Project {
  id: string;
  name: string;
  updated_at: string;
  paper_size: string;
  canvas_width: number;
  canvas_height: number;
  is_public?: boolean;
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  citations?: string | null;
  field_of_study?: string | null;
  approval_status?: string | null;
  thumbnail_url?: string | null;
  thumbnail_updated_at?: string | null;
  user_id: string;
  view_count?: number;
  cloned_count?: number;
  like_count?: number;
}

interface SharedProjectEntry extends Project {
  sharedVia: 'by_me' | 'with_me';
  permission?: 'view' | 'edit';
  groupName?: string;
}

const PROJECT_SELECT = 'id, name, updated_at, paper_size, canvas_width, canvas_height, is_public, title, description, keywords, citations, field_of_study, approval_status, thumbnail_url, thumbnail_updated_at, user_id, view_count, cloned_count, like_count';

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { animationEnabled } = useAnimationFeature();
  const { totalProjects, limit: projectLimit, canCreateMore, isPremiumOrAdmin, isLoading: limitLoading } = useProjectLimit();

  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<SharedProjectEntry[]>([]);
  const [chartProjects, setChartProjects] = useState<{ id: string; name: string; chart_type: string; updated_at: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingShared, setLoadingShared] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(true);

  // URL is the source of truth for filter/tab/search/page — back-forward and
  // refresh preserve state. Only the search-input value stays local so keystrokes
  // don't rewrite history.
  const [searchParams, setSearchParams] = useSearchParams();
  const contentTab = (searchParams.get('tab') as 'illustrations' | 'charts') || 'illustrations';
  const filterStatus = (searchParams.get('filter') as FilterStatus) || 'all';
  const searchQuery = searchParams.get('search') || '';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const ITEMS_PER_PAGE = 9;

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next);
  };

  const [shareDialogProject, setShareDialogProject] = useState<Project | null>(null);
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [collaborateProject, setCollaborateProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [chartToDelete, setChartToDelete] = useState<string | null>(null);

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadProjects = useCallback(async (filter: 'all' | 'public' | 'private') => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('canvas_projects')
      .select(PROJECT_SELECT)
      .order('updated_at', { ascending: false });

    if (filter === 'all') {
      query = query.or(`user_id.eq.${user.id},is_public.eq.false`);
    } else if (filter === 'public') {
      query = query.eq('user_id', user.id).eq('is_public', true);
    } else if (filter === 'private') {
      query = query.eq('user_id', user.id).eq('is_public', false);
    }

    const { data, error } = await query;
    if (error) toast.error('Failed to load projects');
    else setProjects(data || []);
    setLoading(false);
  }, [user]);

  const loadSharedProjects = useCallback(async () => {
    if (!user) return;
    setLoadingShared(true);

    const { data: invitedByMe } = await supabase
      .from('project_collaborators')
      .select('project_id')
      .eq('invited_by', user.id);

    const { data: groupSharedByMe } = await supabase
      .from('project_group_access')
      .select('project_id')
      .eq('granted_by', user.id);

    const sharedByMeIds = [...new Set([
      ...(invitedByMe || []).map((r: any) => r.project_id),
      ...(groupSharedByMe || []).map((r: any) => r.project_id),
    ])];

    const { data: sharedWithMeEntries } = await supabase
      .from('project_collaborators')
      .select('project_id, permission')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null);

    const { data: myMemberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const myGroupIds = (myMemberships || []).map((m: any) => m.group_id);
    const { data: groupSharedWithMe } = myGroupIds.length > 0
      ? await supabase
          .from('project_group_access')
          .select('project_id, permission, groups(id, name)')
          .in('group_id', myGroupIds)
      : { data: [] };

    const { data: myPageAccess } = await supabase
      .from('project_page_access')
      .select('page_id, permission')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null);

    const { data: myGroupPageAccess } = myGroupIds.length > 0
      ? await supabase
          .from('project_page_group_access')
          .select('page_id, permission')
          .in('group_id', myGroupIds)
      : { data: [] };

    const pagePermMap = new Map<string, 'view' | 'edit'>();
    (myPageAccess || []).forEach((e: any) => {
      const cur = pagePermMap.get(e.page_id);
      if (!cur || e.permission === 'edit') pagePermMap.set(e.page_id, e.permission);
    });
    (myGroupPageAccess || []).forEach((e: any) => {
      const cur = pagePermMap.get(e.page_id);
      if (!cur || e.permission === 'edit') pagePermMap.set(e.page_id, e.permission);
    });

    const myPageIds = [...pagePermMap.keys()];
    const { data: pageItems } = myPageIds.length > 0
      ? await supabase
          .from('project_page_items')
          .select('project_id, page_id')
          .in('page_id', myPageIds)
      : { data: [] };

    const sharedWithMeIds = [...new Set([
      ...(sharedWithMeEntries || []).map((r: any) => r.project_id),
      ...(groupSharedWithMe || []).map((r: any) => r.project_id),
      ...(pageItems || []).map((r: any) => r.project_id),
    ])];

    const permissionMap = new Map<string, 'view' | 'edit'>();
    const groupNameMap = new Map<string, string>();
    (sharedWithMeEntries || []).forEach((e: any) => {
      permissionMap.set(e.project_id, e.permission as 'view' | 'edit');
    });
    (groupSharedWithMe || []).forEach((e: any) => {
      if (!permissionMap.has(e.project_id)) {
        permissionMap.set(e.project_id, e.permission as 'view' | 'edit');
      }
      if (e.groups?.name) groupNameMap.set(e.project_id, e.groups.name);
    });
    (pageItems || []).forEach((item: any) => {
      const pagePerm = pagePermMap.get(item.page_id);
      if (!pagePerm) return;
      const cur = permissionMap.get(item.project_id);
      if (!cur || (pagePerm === 'edit' && cur !== 'edit')) {
        permissionMap.set(item.project_id, pagePerm);
      }
    });

    const allIds = [...new Set([...sharedByMeIds, ...sharedWithMeIds])];
    if (allIds.length === 0) {
      setSharedProjects([]);
      setLoadingShared(false);
      return;
    }

    const { data: projectData } = await supabase
      .from('canvas_projects')
      .select(PROJECT_SELECT)
      .in('id', allIds)
      .order('updated_at', { ascending: false });

    const entries: SharedProjectEntry[] = (projectData || []).map((p: any) => ({
      ...p,
      sharedVia: p.user_id === user.id ? 'by_me' : 'with_me',
      permission: p.user_id !== user.id ? permissionMap.get(p.id) : undefined,
      groupName: p.user_id !== user.id ? groupNameMap.get(p.id) : undefined,
    }));

    setSharedProjects(entries);
    setLoadingShared(false);
  }, [user]);

  const reloadCurrentTab = useCallback(() => {
    if (filterStatus === 'all' || filterStatus === 'public' || filterStatus === 'private') {
      loadProjects(filterStatus);
    } else if (filterStatus === 'shared') {
      loadSharedProjects();
    }
  }, [filterStatus, loadProjects, loadSharedProjects]);

  useEffect(() => {
    if (!user) return;
    if (filterStatus === 'all' || filterStatus === 'public' || filterStatus === 'private') {
      loadProjects(filterStatus);
    } else if (filterStatus === 'shared') {
      loadSharedProjects();
    }
  }, [filterStatus, user, loadProjects, loadSharedProjects]);

  // Fetch Chart Studio projects
  useEffect(() => {
    if (!user) return;
    setChartsLoading(true);
    supabase
      .from('chart_studio_projects')
      .select('id, name, chart_type, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setChartProjects(data);
        setChartsLoading(false);
      });
  }, [user]);

  const loadChartProject = (id: string) => {
    navigate(`/chart-studio?load=${id}`);
  };

  const confirmDeleteChartProject = async () => {
    if (!chartToDelete) return;
    const id = chartToDelete;
    setChartToDelete(null);
    const { error } = await supabase.from('chart_studio_projects').delete().eq('id', id);
    if (error) { toast.error('Failed to delete chart'); return; }
    setChartProjects((prev) => prev.filter((p) => p.id !== id));
    toast.success('Chart deleted');
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    const { id } = projectToDelete;
    setProjectToDelete(null);
    const { error } = await supabase.from('canvas_projects').delete().eq('id', id);
    if (error) toast.error('Failed to delete project');
    else { toast.success('Project deleted'); reloadCurrentTab(); }
  };

  const duplicateProject = async (projectId: string) => {
    if (!user) return;
    const blocked = await checkProjectLimit(user.id);
    if (blocked) return;
    const { data: orig, error: fetchError } = await supabase
      .from('canvas_projects').select('*').eq('id', projectId).single();
    if (fetchError || !orig) { toast.error('Failed to load project'); return; }

    const { data: newProject, error: createError } = await supabase
      .from('canvas_projects')
      .insert({
        user_id: user!.id,
        name: `Copy of ${orig.name}`,
        canvas_data: orig.canvas_data,
        paper_size: orig.paper_size,
        canvas_width: orig.canvas_width,
        canvas_height: orig.canvas_height,
        thumbnail_url: orig.thumbnail_url,
        title: orig.title,
        description: orig.description,
        keywords: orig.keywords,
        citations: orig.citations,
      })
      .select().single();

    if (createError || !newProject) { toast.error('Failed to duplicate project'); return; }
    toast.success('Project duplicated');
    navigate(`/canvas/${newProject.id}`);
  };

  // ─── Thumbnails ──────────────────────────────────────────────────────────────

  const thumbnailProjects = useMemo<Project[]>(() => {
    if (filterStatus === 'shared') return sharedProjects;
    return projects;
  }, [filterStatus, projects, sharedProjects]);

  const { getThumbnailUrl, isRegenerating, hasError } = useLazyThumbnails(thumbnailProjects, user?.id);

  // ─── Stats (own projects only) ───────────────────────────────────────────────

  const [statsProjects, setStatsProjects] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from('canvas_projects')
      .select('id, is_public, updated_at, user_id, view_count, cloned_count, like_count')
      .eq('user_id', user.id)
      .then(({ data }) => setStatsProjects(data || []));
  }, [user]);

  const stats = useMemo(() => ({
    total: statsProjects.length,
    shared: statsProjects.filter(p => p.is_public).length,
    unshared: statsProjects.filter(p => !p.is_public).length,
    totalViews: statsProjects.reduce((sum, p) => sum + (p.view_count || 0), 0),
    totalClones: statsProjects.reduce((sum, p) => sum + (p.cloned_count || 0), 0),
    totalLikes: statsProjects.reduce((sum, p) => sum + (p.like_count || 0), 0),
  }), [statsProjects]);

  // ─── Sidebar data (groups + pages) ────────────────────────────────────────────

  const [userGroups, setUserGroups] = useState<{ id: string; name: string; role: string }[]>([]);
  const [userPages, setUserPages] = useState<{ id: string; name: string }[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setSidebarLoading(true);

    Promise.all([
      supabase
        .from('group_members')
        .select('role, groups(id, name)')
        .eq('user_id', user.id)
        .then(({ data }) =>
          (data || [])
            .filter((m: any) => m.groups)
            .map((m: any) => ({ id: m.groups.id, name: m.groups.name, role: m.role }))
        ),
      supabase
        .from('project_pages')
        .select('id, name')
        .eq('created_by', user.id)
        .then(({ data }) => (data || []).map((p: any) => ({ id: p.id, name: p.name }))),
    ]).then(([groups, pages]) => {
      setUserGroups(groups);
      setUserPages(pages);
      setSidebarLoading(false);
    });
  }, [user]);

  // ─── Search + pagination ──────────────────────────────────────────────────────

  const applySearch = useCallback((list: Project[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.keywords?.some(k => k.toLowerCase().includes(q)) ?? false)
    );
  }, [searchQuery]);

  const currentProjects = useMemo(() => {
    if (filterStatus === 'shared') return applySearch(sharedProjects);
    return applySearch(projects);
  }, [filterStatus, projects, sharedProjects, applySearch]);

  const totalPages = Math.ceil(currentProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = currentProjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Unified project card ─────────────────────────────────────────────────────

  const renderProjectCard = (project: Project, index: number, opts?: { permission?: 'view' | 'edit'; groupName?: string }) => {
    const isOwner = project.user_id === user?.id;
    const thumbnailSrc = getThumbnailUrl(project.id, project.thumbnail_url || null);
    const regenerating = isRegenerating(project.id);
    const error = hasError(project.id);

    return (
      <div
        key={project.id}
        data-testid={`projects-project-card-${project.id}`}
        className="group relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 animate-fade-in cursor-pointer hover:shadow-lg"
        style={{ animationDelay: `${index * 40}ms` }}
        onClick={() => navigate(`/canvas/${project.id}`)}
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-square bg-muted/20 overflow-hidden">
          <ThumbnailWithSpinner
            src={thumbnailSrc}
            alt={project.name}
            isRegenerating={regenerating}
            hasError={error}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Top-right badges */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {project.approval_status && project.approval_status !== 'pending' && (
              <Badge
                variant={project.approval_status === 'approved' ? 'default' : project.approval_status === 'rejected' ? 'destructive' : 'secondary'}
                className="shadow-lg backdrop-blur-md text-xs h-6 capitalize"
              >
                {project.approval_status === 'approved' && <CheckCircle className="w-3 h-3 mr-0.5" />}
                {project.approval_status === 'rejected' && <XCircle className="w-3 h-3 mr-0.5" />}
                {project.approval_status}
              </Badge>
            )}
            {isOwner && (
              <div className="h-6 px-2 rounded-full text-xs font-semibold flex items-center gap-1 backdrop-blur-md shadow-sm bg-foreground/70 text-background">
                {project.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {project.is_public ? 'Public' : 'Private'}
              </div>
            )}
            {!isOwner && opts?.permission && (
              <div className="h-6 px-2 rounded-full text-xs font-semibold flex items-center gap-1 backdrop-blur-md bg-foreground/70 text-background shadow-sm">
                {opts.permission === 'edit' ? 'Edit' : 'View'}
              </div>
            )}
          </div>
        </div>

        {/* Card footer */}
        <div className="relative z-10 px-3.5 py-3">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
            {project.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
            {opts?.groupName && <span> · {opts.groupName}</span>}
          </p>

          {/* Engagement row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2.5 pt-2.5 border-t border-border">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {(project.view_count || 0).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {(project.like_count || 0).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Copy className="h-3 w-3" />
              {(project.cloned_count || 0).toLocaleString()}
            </span>
          </div>

          {/* Actions row - separate line so all buttons always fit */}
          {isOwner && (
            <div className="flex items-center justify-end gap-0.5 mt-1 -mr-1">
              <Button
                onClick={(e) => { e.stopPropagation(); setShareDialogProject(project); }}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                data-testid={`share-project-${project.id}`}
                title="Publish to community"
              >
                <Globe className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); setCollaborateProject(project); }}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                data-testid={`collaborate-project-${project.id}`}
                title="Invite collaborators"
              >
                <UsersThree className="w-3.5 h-3.5" weight="bold" />
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); duplicateProject(project.id); }}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              {animationEnabled && (
                <Button
                  onClick={(e) => { e.stopPropagation(); navigate(`/animate/${project.id}`); }}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Animate"
                >
                  <Film className="w-3.5 h-3.5" />
                </Button>
              )}
              <Separator orientation="vertical" className="h-4 mx-0.5" />
              <Button
                onClick={(e) => { e.stopPropagation(); setProjectToDelete({ id: project.id, name: project.name }); }}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                data-testid={`delete-project-${project.id}`}
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Pagination helper ────────────────────────────────────────────────────────

  const goToPage = (page: number) => {
    updateParams({ page: page <= 1 ? null : String(page) });
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center pt-6">
        <Pagination>
          <PaginationContent className="gap-1 border rounded-xl p-1.5 bg-card">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                className={`rounded-lg ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer hover:bg-muted'}`}
              />
            </PaginationItem>
            {getVisiblePages(currentPage, totalPages).map((page, i) => (
              <PaginationItem key={`${page}-${i}`}>
                {page === 'ellipsis' ? <PaginationEllipsis /> : (
                  <PaginationLink
                    onClick={() => goToPage(page)}
                    isActive={currentPage === page}
                    className={`cursor-pointer rounded-lg font-medium ${currentPage === page ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                className={`rounded-lg ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer hover:bg-muted'}`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  // ─── Tab content renderers ────────────────────────────────────────────────────

  const renderProjectsGrid = (isLoading: boolean) => {
    if (isLoading) {
      return <SkeletonGrid />;
    }

    if (paginatedProjects.length === 0) {
      return (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery || filterStatus !== 'all' ? 'No projects found' : 'Begin Your Research'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery || filterStatus !== 'all'
              ? "Try adjusting your search or filters"
              : 'Create publication-ready scientific illustrations for your research papers and presentations'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <Button
                  onClick={() => navigate('/canvas')}
                  className="gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />Start Blank Canvas
                </Button>
                <Button
                  onClick={() => setTemplateBrowserOpen(true)}
                  variant="outline"
                  className="gap-2 active:scale-[0.98]"
                >
                  <FileText className="w-4 h-4" />Browse Templates
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        {/* Project limit banner for free users */}
        {!isPremiumOrAdmin && !limitLoading && (
          <div className={`mb-4 rounded-xl border border-border px-4 py-3 flex items-center justify-between text-sm ${
            canCreateMore ? 'bg-muted/40 text-muted-foreground' : 'bg-muted text-foreground'
          }`}>
            <div>
              <span className="font-semibold">{totalProjects} / {projectLimit} projects used</span>
              {!canCreateMore && (
                <span className="ml-2">
                  — Share 3 projects with the community to unlock unlimited saves.
                </span>
              )}
            </div>
            {!canCreateMore && (
              <Button variant="outline" size="sm" className="text-xs shrink-0 ml-3"
                onClick={() => navigate('/community')}>
                Learn more
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedProjects.map((project, i) => {
            const sp = project as SharedProjectEntry;
            return renderProjectCard(project, i, {
              permission: sp.permission,
              groupName: sp.groupName,
            });
          })}
        </div>
        {renderPagination()}
      </>
    );
  };

  const renderSharedTab = () => {
    if (loadingShared) {
      return <SkeletonGrid />;
    }

    const byMe = sharedProjects.filter(p => p.sharedVia === 'by_me');
    const withMe = sharedProjects.filter(p => p.sharedVia === 'with_me');
    const filteredByMe = applySearch(byMe);
    const filteredWithMe = applySearch(withMe);

    if (filteredByMe.length === 0 && filteredWithMe.length === 0) {
      return (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No shared projects</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Projects you've shared with collaborators, or that have been shared with you, will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {filteredByMe.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <Share2 className="h-4 w-4" />
              Shared by me
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredByMe.map((p, i) => renderProjectCard(p, i))}
            </div>
          </div>
        )}
        {filteredWithMe.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Shared with me
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredWithMe.map((p, i) => renderProjectCard(p, i, { permission: p.permission }))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Filter button ──────────────────────────────────────────────────────────

  const setFilterStatus = (value: FilterStatus) => {
    updateParams({ filter: value === 'all' ? null : value, page: null });
  };

  const filterBtn = (value: FilterStatus, label: React.ReactNode) => (
    <FilterPill selected={filterStatus === value} onClick={() => setFilterStatus(value)}>
      {label}
    </FilterPill>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background">
      {/* Soft decorative blobs (matches homepage hero) */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-muted/40 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-muted/40 rounded-full blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-8 md:pt-10">

        {/* ── Hero (scientific theme) ── */}
        {(() => {
          const fullName = user?.user_metadata?.full_name as string | undefined;
          const firstName = fullName?.split(" ")[0] || user?.email?.split("@")[0] || "there";
          const hour = new Date().getHours();
          const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
          const totalAll = projects.length + chartProjects.length;
          return (
            <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
              {/* Atomic-orbit motif backdrop — soft, far-right */}
              <svg
                aria-hidden
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-muted-foreground opacity-25"
              >
                <defs>
                  <linearGradient id="orbitFade" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <g stroke="url(#orbitFade)" fill="none" strokeWidth="1.4">
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
                <div className="min-w-0">
                  {/* Eyebrow */}
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-muted/60 mb-3">
                    <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-primary" aria-hidden>
                      <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
                      <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                      <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                      <circle cx="6" cy="6" r="1.1" fill="currentColor" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Lab Notebook
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-1.5">
                    Good {timeOfDay}, {firstName}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight">
                    Your <span className="italic font-crimson text-primary">research</span> workspace
                  </h1>

                  {totalAll > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{projects.length}</span>
                        illustration{projects.length === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{chartProjects.length}</span>
                        chart{chartProjects.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-1.5 shadow-sm relative z-10">
                      <Plus className="w-4 h-4" />
                      New project
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate('/canvas')}>
                      <Shapes className="w-4 h-4 mr-2 text-muted-foreground" />
                      Blank illustration
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/ai-illustrator')}>
                      <Sparkles className="w-4 h-4 mr-2 text-muted-foreground" />
                      AI illustration
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/chart-studio')}>
                      <BarChart3 className="w-4 h-4 mr-2 text-muted-foreground" />
                      New chart
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTemplateBrowserOpen(true)}>
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      Browse templates
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })()}


        {/* ── Main Content Grid ── */}
        <div id="projects-grid" className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 pf-fade-2 scroll-mt-8">

          {/* ── Left: Projects (tabbed) ── */}
          <div className="min-w-0">
            {/* Content tabs */}
            <div className="flex items-end gap-4 border-b border-border mb-4">
              {(['illustrations', 'charts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => updateParams({ tab: tab === 'illustrations' ? null : tab, page: null })}
                  className={`relative pb-2.5 text-sm font-medium transition-colors ${
                    contentTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'illustrations' ? 'Illustrations' : 'Charts'}
                  <span className="ml-1.5 text-xs text-muted-foreground/70 font-normal tabular-nums">
                    {tab === 'illustrations'
                      ? (loading ? '—' : projects.length)
                      : (chartsLoading ? '—' : chartProjects.length)}
                  </span>
                  {contentTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Illustrations tab content */}
            {contentTab === 'illustrations' && (
              <>
                {/* Filter chips + search + result count */}
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex gap-1.5 flex-wrap">
                    {filterBtn('all', 'All')}
                    {filterBtn('public', 'Public')}
                    {filterBtn('private', 'Private')}
                    {filterBtn('shared', 'Shared')}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateParams({ search: searchInput.trim() || null, page: null });
                    }}
                    className="relative w-full sm:w-72"
                  >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchInput(val);
                        if (!val.trim() && searchQuery) updateParams({ search: null, page: null });
                      }}
                      placeholder="Search projects…"
                      className="pl-9 h-9 text-sm bg-card border-border"
                    />
                  </form>
                </div>
                {(searchQuery || filterStatus !== 'all') && (
                  <div className="text-xs text-muted-foreground mb-3">
                    {currentProjects.length} project{currentProjects.length !== 1 ? 's' : ''}
                    {searchQuery && <> matching "<span className="font-medium text-foreground">{searchQuery}</span>"</>}
                  </div>
                )}

                {filterStatus === 'shared' ? renderSharedTab() : renderProjectsGrid(loading)}
              </>
            )}

            {/* Charts tab content */}
            {contentTab === 'charts' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground">
                    {chartProjects.length} chart project{chartProjects.length !== 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/chart-studio')}
                    className="text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New Chart
                  </Button>
                </div>

                {chartProjects.length === 0 ? (
                  <div className="rounded-2xl bg-card/60 backdrop-blur-md border border-dashed border-border p-12 text-center">
                    <BarChart3 className="w-11 h-11 mx-auto mb-3 text-muted-foreground/60" strokeWidth={1.5} />
                    <p className="text-sm font-semibold text-foreground mb-1">No charts yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Create your first chart in Chart Studio</p>
                    <Button size="sm" onClick={() => navigate('/chart-studio')} className="rounded-full">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      New Chart
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {chartProjects.map((cp) => (
                      <div
                        key={cp.id}
                        className="group relative rounded-xl bg-card/80 backdrop-blur-md border border-border p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => loadChartProject(cp.id)}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className="rounded-md bg-muted p-1.5 flex-shrink-0">
                            <BarChart3 className="w-3.5 h-3.5 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {cp.name || "Untitled"}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5 font-medium truncate">
                              {cp.chart_type}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(cp.updated_at), { addSuffix: true })}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setChartToDelete(cp.id); }}
                          className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="hidden lg:block pf-fade-3">
            <div className="sticky top-20 space-y-4">
              {/* Groups */}
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-muted-foreground rounded-full" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">My Groups</h3>
                </div>

                {sidebarLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-4 flex-1 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : userGroups.length === 0 ? (
                  <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-2">No groups yet</p>
                    <Link to="/groups" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                      Create a group
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {userGroups.slice(0, 5).map(group => (
                      <Link
                        key={group.id}
                        to={`/groups/${group.id}`}
                        className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors duration-200"
                      >
                        <span className="text-xs font-medium truncate">{group.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0 capitalize rounded-full">
                          {group.role}
                        </Badge>
                      </Link>
                    ))}
                    {userGroups.length > 5 && (
                      <Link to="/groups" className="text-xs text-primary hover:underline block pt-1 px-2">
                        View all {userGroups.length} groups
                      </Link>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* Pages */}
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">My Pages</h3>
                </div>

                {sidebarLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-4 flex-1 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : userPages.length === 0 ? (
                  <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-2">No pages yet</p>
                    <Link to="/pages" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                      Create a page
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {userPages.slice(0, 5).map(page => (
                      <Link
                        key={page.id}
                        to={`/pages/${page.id}`}
                        className="flex items-center py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors duration-200"
                      >
                        <span className="text-xs font-medium truncate">{page.name}</span>
                      </Link>
                    ))}
                    {userPages.length > 5 && (
                      <Link to="/pages" className="text-xs text-primary hover:underline block pt-1 px-2">
                        View all {userPages.length} pages
                      </Link>
                    )}
                  </div>
                )}
              </GlassCard>

              <SidebarQuote />
            </div>
          </aside>
        </div>

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>

      {collaborateProject && (
        <CollaborateDialog
          project={collaborateProject}
          isOpen={!!collaborateProject}
          onClose={() => { setCollaborateProject(null); reloadCurrentTab(); }}
        />
      )}
      {shareDialogProject && (
        <ShareProjectDialog
          project={shareDialogProject}
          isOpen={!!shareDialogProject}
          onClose={() => setShareDialogProject(null)}
          onUpdate={reloadCurrentTab}
        />
      )}
      <TemplateBrowserModal
        open={templateBrowserOpen}
        onOpenChange={setTemplateBrowserOpen}
      />

      <AlertDialog open={projectToDelete !== null} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              "{projectToDelete?.name}" will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={chartToDelete !== null} onOpenChange={(open) => !open && setChartToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chart?</AlertDialogTitle>
            <AlertDialogDescription>
              This chart will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteChartProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post-3-projects donation prompt — self-suppressing via localStorage. */}
      <DonationPromptModal projectCount={totalProjects} />
    </div>
  );
}

// Sidebar surface used for the Groups and Pages panels.
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur-md border border-border p-5 shadow-sm">
      {children}
    </div>
  );
}

// Skeleton grid matches the real card shape: aspect-square thumbnail + title +
// timestamp + border-divided engagement row + actions row. Mirroring these keeps
// the layout stable when data arrives (no visible jump).
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card overflow-hidden">
          <Skeleton className="w-full aspect-square rounded-none" />
          <div className="px-3.5 py-3">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
            <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border/40">
              <Skeleton className="h-3 w-8 rounded-md" />
              <Skeleton className="h-3 w-8 rounded-md" />
              <Skeleton className="h-3 w-8 rounded-md" />
            </div>
            <div className="flex items-center justify-end gap-1 mt-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

