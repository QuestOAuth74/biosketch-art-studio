import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Sparkles,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Heart,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── TemplateBrowserModal ────────────────────────────────────────────────────
// Robust template picker for the Projects page. Server-side search across
// title + name + description + keywords + field_of_study; pagination at 12
// per page; clone-to-workspace on click via the existing clone_project RPC.

const PAGE_SIZE = 12;

interface CommunityTemplate {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  view_count: number;
  cloned_count: number;
  like_count: number;
  keywords: string[] | null;
  field_of_study: string | null;
  user_id: string;
  updated_at: string;
}

type SortOption = "popular" | "recent" | "cloned" | "liked";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateBrowserModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [page, setPage] = useState(1);
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);

  // Debounce the search input so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(rawQuery.trim());
      setPage(1);
    }, 220);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Reset state when the modal closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setRawQuery("");
      setQuery("");
      setPage(1);
      setSortBy("popular");
    }
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("canvas_projects")
      .select(
        "id, name, title, description, thumbnail_url, view_count, cloned_count, like_count, keywords, field_of_study, user_id, updated_at",
        { count: "exact" },
      )
      .eq("is_public", true)
      .eq("approval_status", "approved")
      .neq("is_brush", true);

    // Server-side search: ilike across the obvious text columns, plus an
    // array-contains for keyword exact-match. Escapes % and _ so the user
    // can't break the LIKE pattern.
    if (query) {
      const safe = query.replace(/[\\%_]/g, "\\$&");
      const wild = `%${safe}%`;
      q = q.or(
        `title.ilike.${wild},name.ilike.${wild},description.ilike.${wild},field_of_study.ilike.${wild}`,
      );
    }

    switch (sortBy) {
      case "recent":  q = q.order("updated_at", { ascending: false }); break;
      case "cloned":  q = q.order("cloned_count", { ascending: false }); break;
      case "liked":   q = q.order("like_count", { ascending: false }); break;
      case "popular":
      default:        q = q.order("view_count", { ascending: false });
    }

    const { data, error, count } = await q.range(from, to);
    if (error) {
      console.error("[templates] load failed:", error);
      toast.error("Could not load templates");
      setLoading(false);
      return;
    }
    setTemplates(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [query, sortBy, page]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );

  const handleClone = async (template: CommunityTemplate) => {
    if (!user) {
      toast.error("Sign in to use a template", {
        action: { label: "Sign In", onClick: () => navigate("/auth") },
      });
      return;
    }
    setCloningId(template.id);
    try {
      const name = template.name || template.title || "Cloned project";
      const { data, error } = await supabase.rpc("clone_project", {
        source_project_id: template.id,
        new_project_name: `Copy of ${name}`,
      });
      if (error || !data) {
        console.error("[templates] clone failed:", error);
        toast.error(`Could not clone: ${error?.message || "unknown"}`);
        return;
      }
      toast.success("Template added to your workspace");
      onOpenChange(false);
      navigate(`/canvas/${data}`);
    } finally {
      setCloningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <DialogTitle className="text-xl">Start from a template</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Browse community projects — click any to clone it into your workspace.
          </DialogDescription>
        </DialogHeader>

        {/* Filter row */}
        <div className="px-6 py-3 border-b flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, field of study, keyword…"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
              autoFocus
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => setRawQuery("")}
                title="Clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most viewed</SelectItem>
              <SelectItem value="cloned">Most cloned</SelectItem>
              <SelectItem value="liked">Most liked</SelectItem>
              <SelectItem value="recent">Recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Result count strip */}
        <div className="px-6 py-2 border-b text-[11px] text-muted-foreground bg-muted/30 flex items-center justify-between">
          <span>
            {loading ? "Searching…" : (
              <>
                <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span>
                {" "}template{totalCount === 1 ? "" : "s"}
                {query && (<> matching <span className="font-mono text-foreground">"{query}"</span></>)}
              </>
            )}
          </span>
          {totalPages > 1 && (
            <span>Page {page} of {totalPages}</span>
          )}
        </div>

        {/* Grid (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[260px] text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No templates match this search</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different keyword or clear the search.
              </p>
              {query && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setRawQuery("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  cloning={cloningId === t.id}
                  disabled={cloningId !== null}
                  onClick={() => void handleClone(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer: pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <PaginationDots page={page} total={totalPages} onSelect={setPage} />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  cloning,
  disabled,
  onClick,
}: {
  template: CommunityTemplate;
  cloning: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-violet-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-wait"
    >
      <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="h-8 w-8 text-slate-300" />
          </div>
        )}
        {cloning && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-slate-900 line-clamp-1 group-hover:text-violet-700">
          {template.title || template.name || "Untitled"}
        </p>
        {template.description && (
          <p className="text-[10.5px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{template.view_count}</span>
          <span className="inline-flex items-center gap-0.5"><Copy className="h-2.5 w-2.5" />{template.cloned_count}</span>
          {(template.like_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{template.like_count}</span>
          )}
          {template.field_of_study && (
            <span className="ml-auto px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold uppercase tracking-wider text-slate-600 truncate max-w-[100px]">
              {template.field_of_study}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// Compact page-number bar that shows current page ± 1, with first/last and …
function PaginationDots({ page, total, onSelect }: { page: number; total: number; onSelect: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => { if (pages[pages.length - 1] !== n) pages.push(n); };
  push(1);
  if (page - 1 > 2) push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) push(i);
  if (page + 1 < total - 1) push("…");
  if (total > 1) push(total);
  return (
    <div className="flex items-center gap-0.5">
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1.5 text-muted-foreground text-xs">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
              p === page
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        ),
      )}
    </div>
  );
}
