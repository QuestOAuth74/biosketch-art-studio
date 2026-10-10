import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, FileText, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CreatePageDialog } from '@/components/collaboration/CreatePageDialog';
import { SocialSidebar } from '@/components/social/SocialSidebar';
import { PagesTestIds } from '@/lib/test-ids';

const pagesStyles = `
  @keyframes pg-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .pg-fade-1 { animation: pg-fade-up 0.4s ease-out 0.1s both; }
  .pg-fade-2 { animation: pg-fade-up 0.4s ease-out 0.2s both; }
  .pg-fade-3 { animation: pg-fade-up 0.4s ease-out 0.3s both; }
`;

interface Page {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
}

interface SharedPage {
  id: string;
  permission: 'view' | 'edit';
  project_pages: Page | null;
}

export default function Pages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myPages, setMyPages] = useState<Page[]>([]);
  const [sharedPages, setSharedPages] = useState<SharedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchMyPages(), fetchSharedPages()]);
    setLoading(false);
  };

  const fetchMyPages = async () => {
    const { data } = await supabase
      .from('project_pages')
      .select('id, name, description, created_at, created_by')
      .eq('created_by', user!.id)
      .order('updated_at', { ascending: false });
    if (data) setMyPages(data as Page[]);
  };

  const fetchSharedPages = async () => {
    const { data: individual } = await supabase
      .from('project_page_access')
      .select('id, permission, project_pages(id, name, description, created_at, created_by)')
      .eq('user_id', user!.id)
      .not('accepted_at', 'is', null);

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user!.id);

    const groupIds = memberships?.map((m: any) => m.group_id) ?? [];
    let groupShared: SharedPage[] = [];
    if (groupIds.length > 0) {
      const { data: groupAccess } = await supabase
        .from('project_page_group_access')
        .select('id, permission, project_pages(id, name, description, created_at, created_by)')
        .in('group_id', groupIds);
      if (groupAccess) groupShared = groupAccess as SharedPage[];
    }

    const seen = new Set<string>();
    const combined: SharedPage[] = [];
    for (const item of [...(individual ?? []), ...groupShared]) {
      const page = item.project_pages;
      if (!page) continue;
      if (page.created_by === user!.id) continue;
      if (seen.has(page.id)) continue;
      seen.add(page.id);
      combined.push(item as SharedPage);
    }
    setSharedPages(combined);
  };

  const allEmpty = myPages.length === 0 && sharedPages.length === 0;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)" }}
      data-testid={PagesTestIds.PAGE_CONTAINER}
    >
      <style>{pagesStyles}</style>

      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header ── */}
        <div className="text-center pg-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{ background: "#FFFFFF", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)" }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <rect x={3} y={1.5} width={8} height={11} rx={1.3} stroke="#475569" strokeWidth={1.3}/>
              <path d="M5 5 H9 M5 7 H9 M5 9 H7.5" stroke="#475569" strokeWidth={1.2} strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: "#1a1a1a", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Collaboration
            </span>
          </div>

          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: "1.1",
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            My Pages
          </h1>

          <p
            className="mx-auto mt-3 max-w-xl"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(13px, 1.5vw, 15px)",
              lineHeight: "1.6",
              color: "#64748b",
            }}
          >
            Curate project collections and share them with your team.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setShowCreateDialog(true)}
              data-testid={PagesTestIds.NEW_PAGE_BUTTON}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
              style={{
                background: "hsl(var(--primary))",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                color: "#FFFFFF",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
              }}
            >
              <Plus className="h-4 w-4" />
              New Page
            </button>
            <button
              onClick={() => navigate('/groups')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
              style={{
                background: "transparent",
                border: "1px solid #cbd5e0",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                color: "#1a1a1a",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <circle cx={5} cy={6} r={2.3} stroke="currentColor" strokeWidth={1.4}/>
                <circle cx={11} cy={6} r={2.3} stroke="currentColor" strokeWidth={1.4}/>
                <path d="M1.5 13 C1.5 10 3 9 5 9 C7 9 8.5 10 8.5 13 M7 13 C7 10 8.5 9 11 9 C13 9 14.5 10 14.5 13" stroke="currentColor" strokeWidth={1.4} fill="none"/>
              </svg>
              My Groups
            </button>
          </div>
        </div>

        {/* ── Main content + sidebar ── */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 pg-fade-2">

          <div className="min-w-0">
            {loading ? (
              <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 p-12 flex justify-center" style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.06)" }}>
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : allEmpty ? (
              <div
                className="rounded-2xl bg-white/60 backdrop-blur-md border border-dashed border-slate-300 p-12 text-center"
                data-testid={PagesTestIds.EMPTY_STATE}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl p-3" style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" }}>
                  <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                    <rect x={10} y={6} width={20} height={28} rx={2.5} stroke="white" strokeWidth={2}/>
                    <path d="M15 14 H25 M15 19 H25 M15 24 H22" stroke="white" strokeWidth={2} strokeLinecap="round"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: "Inter, sans-serif" }}>No pages yet</h2>
                <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto">
                  Create a page to curate projects and share with collaborators.
                </p>
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create your first page
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* My Pages */}
                {myPages.length > 0 && (
                  <div data-testid={PagesTestIds.MY_PAGES_SECTION}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                      <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                        My Pages
                      </h2>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{myPages.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {myPages.map((page, index) => (
                        <div
                          key={page.id}
                          className="group/card rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer"
                          style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.06)", animationDelay: `${index * 50}ms` }}
                          onClick={() => navigate(`/pages/${page.id}`)}
                          data-testid={PagesTestIds.PAGE_CARD}
                        >
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg p-1.5 flex-shrink-0" style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" }}>
                              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                                <rect x={3} y={1.5} width={10} height={13} rx={1.5} stroke="white" strokeWidth={1.5}/>
                                <path d="M5.5 5.5 H10.5 M5.5 8 H10.5 M5.5 10.5 H8.5" stroke="white" strokeWidth={1.3} strokeLinecap="round"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 group-hover/card:text-emerald-600 transition-colors line-clamp-1" style={{ fontFamily: "Inter, sans-serif" }} data-testid={PagesTestIds.PAGE_NAME}>
                                {page.name}
                              </p>
                              {page.description && (
                                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{page.description}</p>
                              )}
                              <p className="text-[11px] text-slate-400 mt-2">
                                {formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared With Me */}
                {sharedPages.length > 0 && (
                  <div data-testid={PagesTestIds.SHARED_PAGES_SECTION}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-slate-400 rounded-full" />
                      <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                        Shared With Me
                      </h2>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{sharedPages.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sharedPages.map((shared, index) => {
                        const page = shared.project_pages!;
                        return (
                          <div
                            key={page.id}
                            className="group/card rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 p-5 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer"
                            style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.06)", animationDelay: `${index * 50}ms` }}
                            onClick={() => navigate(`/pages/${page.id}`)}
                            data-testid={PagesTestIds.PAGE_CARD}
                          >
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg p-1.5 flex-shrink-0 bg-slate-100">
                                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                                  <circle cx={5} cy={6} r={2.3} stroke="#475569" strokeWidth={1.4}/>
                                  <circle cx={11} cy={6} r={2.3} stroke="#475569" strokeWidth={1.4}/>
                                  <path d="M1.5 13 C1.5 10 3 9 5 9 C7 9 8.5 10 8.5 13 M7 13 C7 10 8.5 9 11 9 C13 9 14.5 10 14.5 13" stroke="#475569" strokeWidth={1.4} fill="none"/>
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-900 group-hover/card:text-slate-700 transition-colors line-clamp-1" style={{ fontFamily: "Inter, sans-serif" }} data-testid={PagesTestIds.PAGE_NAME}>
                                    {page.name}
                                  </p>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {shared.permission === 'edit' ? 'Edit' : 'View'}
                                  </Badge>
                                </div>
                                {page.description && (
                                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">{page.description}</p>
                                )}
                                <p className="text-[11px] text-slate-400 mt-2">
                                  {formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block pg-fade-3" style={{ paddingTop: 0 }}>
            <div className="sticky top-20">
              <SocialSidebar context="pages" />
            </div>
          </aside>
        </div>
      </div>

      <CreatePageDialog isOpen={showCreateDialog} onClose={() => { setShowCreateDialog(false); fetchAll(); }} />
    </div>
  );
}
