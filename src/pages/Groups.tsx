import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Users } from 'lucide-react';
import { CreateGroupDialog } from '@/components/collaboration/CreateGroupDialog';
import { SocialSidebar } from '@/components/social/SocialSidebar';
import { GroupsTestIds } from '@/lib/test-ids';

const groupsStyles = `
  @keyframes grp-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .grp-fade-1 { animation: grp-fade-up 0.4s ease-out 0.1s both; }
  .grp-fade-2 { animation: grp-fade-up 0.4s ease-out 0.2s both; }
  .grp-fade-3 { animation: grp-fade-up 0.4s ease-out 0.3s both; }
`;

interface GroupMembership {
  role: 'owner' | 'admin' | 'member';
  groups: {
    id: string;
    name: string;
    description: string | null;
    member_count: number;
  };
}

export default function Groups() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('group_members')
      .select('role, groups(id, name, description, group_members(count))')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (!error && data) {
      setMemberships(data.map((m: any) => ({
        role: m.role,
        groups: {
          ...m.groups,
          member_count: m.groups.group_members?.[0]?.count ?? 0,
        },
      })));
    }
    setLoading(false);
  };

  const roleVariant = (role: string) => {
    if (role === 'owner') return 'default';
    if (role === 'admin') return 'secondary';
    return 'outline';
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)" }}
      data-testid={GroupsTestIds.PAGE_CONTAINER}
    >
      <style>{groupsStyles}</style>

      {/* Soft decorative blobs (matches Projects page) */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-violet-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header ── */}
        <div className="text-center grp-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{ background: "#FFFFFF", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)" }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <circle cx={4.5} cy={5} r={2} stroke="#475569" strokeWidth={1.3}/>
              <circle cx={9.5} cy={5} r={2} stroke="#475569" strokeWidth={1.3}/>
              <path d="M1 11.5 C1 9 2.5 8 4.5 8 C6.5 8 8 9 8 11.5 M6 11.5 C6 9 7.5 8 9.5 8 C11.5 8 13 9 13 11.5" stroke="#475569" strokeWidth={1.3} fill="none"/>
            </svg>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: "#1a1a1a", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Collaboration
            </span>
          </div>

          <h1
            data-testid={GroupsTestIds.PAGE_TITLE}
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: "1.1",
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            My Groups
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
            Create teams to collaborate with colleagues on scientific illustrations.
          </p>

          {/* Action */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setShowCreateDialog(true)}
              data-testid={GroupsTestIds.NEW_GROUP_BUTTON}
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
              New Group
            </button>
            <button
              onClick={() => navigate('/pages')}
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
                <rect x={3} y={2} width={10} height={12} rx={1.5} stroke="currentColor" strokeWidth={1.4}/>
                <path d="M5.5 6 H10.5 M5.5 8.5 H10.5 M5.5 11 H8.5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round"/>
              </svg>
              My Pages
            </button>
          </div>
        </div>

        {/* ── Main content + sidebar ── */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 grp-fade-2">

          {/* Groups list */}
          <div className="min-w-0">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                  My Groups
                </h2>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{memberships.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 p-12 flex justify-center" style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.06)" }}>
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : memberships.length === 0 ? (
              <div
                className="rounded-2xl bg-white/60 backdrop-blur-md border border-dashed border-slate-300 p-12 text-center"
                data-testid={GroupsTestIds.EMPTY_STATE}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl p-3" style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)" }}>
                  <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                    <circle cx={14} cy={14} r={5} stroke="white" strokeWidth={2}/>
                    <circle cx={26} cy={14} r={5} stroke="white" strokeWidth={2}/>
                    <path d="M4 32 C4 26 8 24 14 24 C20 24 24 26 24 32 M16 32 C16 26 20 24 26 24 C32 24 36 26 36 32" stroke="white" strokeWidth={2} fill="none"/>
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: "Inter, sans-serif" }}>No groups yet</h3>
                <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto">
                  Create a group to start collaborating with your colleagues
                </p>
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create your first group
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {memberships.map(({ role, groups: group }, index) => (
                  <div
                    key={group.id}
                    className="group/card rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
                    style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.06)", animationDelay: `${index * 50}ms` }}
                    data-testid={GroupsTestIds.GROUP_CARD}
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-lg p-1.5 flex-shrink-0" style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)" }}>
                          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                            <circle cx={4.5} cy={5} r={2} stroke="white" strokeWidth={1.4}/>
                            <circle cx={9.5} cy={5} r={2} stroke="white" strokeWidth={1.4}/>
                            <path d="M1 11.5 C1 9 2.5 8 4.5 8 C6.5 8 8 9 8 11.5 M6 11.5 C6 9 7.5 8 9.5 8 C11.5 8 13 9 13 11.5" stroke="white" strokeWidth={1.4} fill="none"/>
                          </svg>
                        </div>
                        <h3 className="font-semibold text-slate-900 group-hover/card:text-indigo-600 transition-colors truncate" style={{ fontFamily: "Inter, sans-serif" }} data-testid={GroupsTestIds.GROUP_NAME}>
                          {group.name}
                        </h3>
                      </div>
                      <Badge variant={roleVariant(role)} className="shrink-0 capitalize text-[10px]" data-testid={GroupsTestIds.GROUP_ROLE_BADGE}>
                        {role}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">{group.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/groups/${group.id}`); }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                        data-testid={GroupsTestIds.GROUP_OPEN_BUTTON}
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar (aligned with first card) */}
          <aside className="hidden lg:block grp-fade-3" style={{ paddingTop: 36 }}>
            <div className="sticky top-20">
              <SocialSidebar context="groups" />
            </div>
          </aside>
        </div>
      </div>

      <CreateGroupDialog
        isOpen={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); fetchGroups(); }}
      />
    </div>
  );
}
