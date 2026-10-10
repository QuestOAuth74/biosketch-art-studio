import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Trash2, Pencil, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// ── ProjectComments ──────────────────────────────────────────────────────────
// Collapsible, paginated comment thread for a community-published project.
// Backed by the project_comments table.

const MAX_LENGTH = 2000;
const PAGE_SIZE = 5;
const EDIT_WINDOW_MS = 5 * 60 * 1000;

interface ProjectComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Props {
  projectId: string;
  projectOwnerId: string;
  /** Initial collapsed state. Defaults to false (expanded). */
  defaultCollapsed?: boolean;
}

export function ProjectComments({ projectId, projectOwnerId, defaultCollapsed = false }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      // Step 1: fetch comments alone. We don't embed profiles via PostgREST
      // because project_comments.user_id FKs auth.users, not profiles —
      // so the embed would fail. We mirror the pattern used elsewhere in
      // the app: fetch comments, then look up profiles separately.
      type Row = {
        id: string;
        user_id: string;
        body: string;
        created_at: string;
        updated_at: string;
      };

      const q = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string, opts?: { count?: string }) => {
            eq: (k: string, v: string) => {
              is: (k: string, v: null) => {
                order: (col: string, opts: { ascending: boolean }) => {
                  range: (a: number, b: number) => Promise<{ data: Row[] | null; count: number | null; error: unknown }>;
                };
              };
            };
          };
        };
      })
        .from("project_comments")
        .select("id, user_id, body, created_at, updated_at", { count: "exact" })
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (q.error) {
        console.error("[project-comments] load failed:", q.error);
        if (append) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      const rows = q.data || [];
      setTotalCount(q.count ?? 0);

      // Step 2: fetch profiles for any user_ids we don't already have cached.
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              in: (k: string, v: string[]) => Promise<{ data: { id: string; full_name: string | null; avatar_url: string | null }[] | null }>;
            };
          };
        })
          .from("public_profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        profileMap = new Map((profs || []).map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
      }

      const enriched: ProjectComment[] = rows.map((r) => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null,
      }));

      setComments((prev) => (append ? [...prev, ...enriched] : enriched));
      setHasMore(offset + enriched.length < (q.count ?? 0));

      if (append) setLoadingMore(false);
      else setLoading(false);
    },
    [projectId],
  );

  useEffect(() => {
    loadPage(0, false);
  }, [loadPage]);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    if (!user) {
      toast.error("Sign in to comment", {
        action: { label: "Sign In", onClick: () => navigate("/auth") },
      });
      return;
    }
    if (body.length > MAX_LENGTH) {
      toast.error(`Comment too long (${MAX_LENGTH} char max)`);
      return;
    }
    setPosting(true);
    const { error } = await (supabase as unknown as {
      from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };
    })
      .from("project_comments")
      .insert({ project_id: projectId, user_id: user.id, body });
    setPosting(false);
    if (error) {
      console.error("[project-comments] post failed:", error);
      toast.error("Could not post comment");
      return;
    }
    setDraft("");
    setCollapsed(false);
    loadPage(0, false);
  };

  const handleSaveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
      };
    })
      .from("project_comments")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[project-comments] edit failed:", error);
      toast.error("Could not save edit");
      return;
    }
    setEditingId(null);
    setEditDraft("");
    loadPage(0, false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await (supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> } };
    })
      .from("project_comments")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[project-comments] delete failed:", error);
      toast.error("Could not delete");
      return;
    }
    loadPage(0, false);
  };

  const loadMore = () => loadPage(comments.length, true);

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20">
      {/* Header — always visible, clickable to collapse/expand */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors rounded-t-xl"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Comments
            {totalCount > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">({totalCount})</span>
            )}
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          {/* Composer */}
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={user ? "Write a comment…" : "Sign in to leave a comment"}
              disabled={!user || posting}
              className="resize-none min-h-[68px] text-sm bg-background"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {draft.length > 0 && `${draft.length} / ${MAX_LENGTH}`}
              </span>
              {user ? (
                <Button
                  size="sm"
                  onClick={handlePost}
                  disabled={posting || draft.trim().length === 0}
                  className="h-8 text-xs"
                >
                  {posting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Post
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => navigate("/auth")} className="h-8 text-xs">
                  Sign in
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Loading comments…
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center italic">
              No comments yet — be the first.
            </p>
          ) : (
            <>
              <ul className="space-y-3 max-h-[280px] overflow-y-auto pr-1 -mr-1">
                {comments.map((c) => {
                  const name = c.profiles?.full_name || "Anonymous";
                  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  const isOwn = user?.id === c.user_id;
                  const canModerate = isOwn || user?.id === projectOwnerId;
                  const editable = isOwn && Date.now() - new Date(c.created_at).getTime() < EDIT_WINDOW_MS;
                  const wasEdited = new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 2000;
                  return (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                        <AvatarImage src={c.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/author/${c.user_id}`)}
                            className="text-xs font-medium hover:text-primary truncate"
                          >
                            {name}
                          </button>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(c.created_at)}
                            {wasEdited ? " · edited" : ""}
                          </span>
                        </div>

                        {editingId === c.id ? (
                          <div className="mt-1.5 space-y-1.5">
                            <Textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value.slice(0, MAX_LENGTH))}
                              className="resize-none min-h-[56px] text-sm bg-background"
                            />
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(c.id)}>
                                <Check className="h-3 w-3 mr-1" /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => { setEditingId(null); setEditDraft(""); }}
                              >
                                <X className="h-3 w-3 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                            {c.body}
                          </p>
                        )}

                        {(editable || canModerate) && editingId !== c.id && (
                          <div className="flex items-center gap-2 mt-1">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                                className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                              >
                                <Pencil className="h-2.5 w-2.5" /> Edit
                              </button>
                            )}
                            {canModerate && (
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                className="text-[10px] text-muted-foreground hover:text-red-600 inline-flex items-center gap-0.5"
                              >
                                <Trash2 className="h-2.5 w-2.5" /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {hasMore && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…
                      </>
                    ) : (
                      <>Load {Math.min(PAGE_SIZE, totalCount - comments.length)} more</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
