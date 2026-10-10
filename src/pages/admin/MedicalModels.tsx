import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Box,
  Search,
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  Sparkles,
  Upload,
  Layers,
  Heart,
  Brain,
  Bone,
  Stethoscope,
  Activity,
  Pill,
  Hexagon,
  ChevronRight,
  Copy,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface MedicalModel {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body_system: string | null;
  thumbnail_path: string | null;
  status: "draft" | "published" | "archived";
  source_kind: "upload" | "ai_generated";
  view_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

// ── Body-system theming ────────────────────────────────────────────────────
// Color palette is chosen to map roughly to anatomical convention
// (red for cardio, violet for neuro, etc.) without being garish.
type BodyTheme = { from: string; to: string; text: string; bg: string; icon: typeof Heart };
const BODY_THEMES: Record<string, BodyTheme> = {
  cardiovascular:  { from: "#ef4444", to: "#f97316", text: "#dc2626", bg: "#fef2f2", icon: Heart },
  respiratory:     { from: "#0ea5e9", to: "#3b82f6", text: "#0284c7", bg: "#eff6ff", icon: Activity },
  neuro:           { from: "#8b5cf6", to: "#d946ef", text: "#7c3aed", bg: "#f5f3ff", icon: Brain },
  gastrointestinal:{ from: "#f59e0b", to: "#fbbf24", text: "#d97706", bg: "#fffbeb", icon: Stethoscope },
  renal:           { from: "#eab308", to: "#facc15", text: "#ca8a04", bg: "#fefce8", icon: Stethoscope },
  musculoskeletal: { from: "#f97316", to: "#fb923c", text: "#ea580c", bg: "#fff7ed", icon: Bone },
  endocrine:       { from: "#10b981", to: "#34d399", text: "#059669", bg: "#ecfdf5", icon: Pill },
  reproductive:    { from: "#ec4899", to: "#f472b6", text: "#db2777", bg: "#fdf2f8", icon: Pill },
  hematologic:     { from: "#f43f5e", to: "#fb7185", text: "#e11d48", bg: "#fff1f2", icon: Activity },
  integumentary:   { from: "#a8a29e", to: "#d6d3d1", text: "#78716c", bg: "#fafaf9", icon: Hexagon },
  other:           { from: "#64748b", to: "#94a3b8", text: "#475569", bg: "#f1f5f9", icon: Hexagon },
};

const themeOf = (sys: string | null): BodyTheme =>
  (sys && BODY_THEMES[sys]) || BODY_THEMES.other;

const STATUS_STYLE: Record<MedicalModel["status"], { dot: string; text: string; bg: string; border: string }> = {
  draft:     { dot: "bg-slate-400",   text: "text-slate-700",   bg: "bg-slate-100",   border: "border-slate-200" },
  published: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  archived:  { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MedicalModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState<MedicalModel[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [systemFilter, setSystemFilter] = useState<string | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: MedicalModel[] | null; error: unknown }>;
        };
      };
    })
      .from("medical_models")
      .select("id, slug, title, description, body_system, thumbnail_path, status, source_kind, view_count, is_featured, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[medical-models] load failed:", error);
      toast.error("Could not load models");
    } else {
      const rows = data || [];
      setModels(rows);

      // Batch-sign thumbnail URLs so cards can render the actual PNG.
      const paths = rows.filter((m) => m.thumbnail_path).map((m) => m.thumbnail_path!);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("medical-models")
          .createSignedUrls(paths, 60 * 60);
        if (signed) {
          const map: Record<string, string> = {};
          signed.forEach((s) => {
            const row = rows.find((r) => r.thumbnail_path === s.path);
            if (row && s.signedUrl) map[row.id] = s.signedUrl;
          });
          setThumbUrls(map);
        }
      }
    }
    setLoading(false);
  };

  const handleDuplicate = async (e: React.MouseEvent, m: MedicalModel) => {
    e.stopPropagation();
    const toastId = toast.loading(`Duplicating "${m.title}"…`);
    try {
      // 1. Copy the GLB file in storage to a new UUID-prefixed path.
      const newGlbPath = `${crypto.randomUUID()}.glb`;
      const { error: copyErr } = await supabase.storage
        .from("medical-models")
        .copy(`${m.id}.glb`, newGlbPath);
      if (copyErr) {
        console.error("[medical-models] GLB copy failed:", copyErr);
        toast.error("Could not duplicate the GLB file", { id: toastId });
        return;
      }

      // 2. Optionally copy the thumbnail (best-effort).
      let newThumbPath: string | null = null;
      try {
        const probe = await (supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: { thumbnail_path: string | null } | null }> } };
          };
        })
          .from("medical_models")
          .select("thumbnail_path")
          .eq("id", m.id)
          .single();
        const oldThumb = probe.data?.thumbnail_path;
        if (oldThumb) {
          const proposed = newGlbPath.replace(/\.glb$/, "-thumb.png");
          const { error: thumbErr } = await supabase.storage
            .from("medical-models")
            .copy(oldThumb, proposed);
          if (!thumbErr) newThumbPath = proposed;
        }
      } catch { /* ignore thumbnail copy errors */ }

      // 3. RPC clones the row + labels atomically.
      const { data: newId, error: rpcErr } = await supabase.rpc("clone_medical_model" as never, {
        source_id: m.id,
        new_glb_path: newGlbPath,
        new_thumbnail_path: newThumbPath,
      } as never) as { data: string | null; error: { message?: string } | null };

      if (rpcErr || !newId) {
        console.error("[medical-models] clone RPC failed:", rpcErr);
        toast.error(`Duplicate failed: ${rpcErr?.message || "unknown"}`, { id: toastId });
        // Best-effort clean up the orphan GLB
        await supabase.storage.from("medical-models").remove([newGlbPath]).catch(() => {});
        if (newThumbPath) await supabase.storage.from("medical-models").remove([newThumbPath]).catch(() => {});
        return;
      }

      toast.success("Model duplicated as a draft", { id: toastId });
      navigate(`/admin/medical-models/${newId}`);
    } catch (err) {
      console.error("[medical-models] duplicate flow failed:", err);
      toast.error("Could not duplicate model", { id: toastId });
    }
  };

  const handleDelete = async (e: React.MouseEvent, m: MedicalModel) => {
    e.stopPropagation();
    if (!confirm(`Delete "${m.title}"? This removes the GLB file too.`)) return;
    const { error } = await (supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> } };
    })
      .from("medical_models")
      .delete()
      .eq("id", m.id);
    if (error) {
      console.error("[medical-models] delete failed:", error);
      toast.error("Could not delete");
      return;
    }
    try { await supabase.storage.from("medical-models").remove([`${m.id}.glb`]); } catch { /* ignore */ }
    toast.success("Model deleted");
    void load();
  };

  const stats = useMemo(() => ({
    total: models.length,
    draft: models.filter((m) => m.status === "draft").length,
    published: models.filter((m) => m.status === "published").length,
    archived: models.filter((m) => m.status === "archived").length,
  }), [models]);

  const usedSystems = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => { if (m.body_system) set.add(m.body_system); });
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => models.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (systemFilter !== "all" && m.body_system !== systemFilter) return false;
    if (query.trim() && !m.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [models, filter, systemFilter, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-32 w-[420px] h-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #60a5fa 0%, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="gap-1.5 -ml-2 mb-4 text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 mb-3">
                <Sparkles className="h-3 w-3 text-violet-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Admin · Internal · Not yet public
                </span>
              </div>
              <h1
                className="text-3xl md:text-4xl font-bold leading-[1.05] tracking-tight text-slate-900"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.025em" }}
              >
                3D{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)" }}
                >
                  medical
                </span>{" "}
                models
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Labeled anatomic 3D models for the clinic. Upload a GLB, place pins on the surface
                with descriptions, publish when ready.
              </p>
            </div>

            <Button onClick={() => navigate("/admin/medical-models/new")} className="gap-1.5 shadow-md self-start md:self-auto">
              <Plus className="h-4 w-4" />
              New model
            </Button>
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <StatCard label="Total" value={stats.total} dot="bg-slate-700" />
          <StatCard label="Draft" value={stats.draft} dot="bg-slate-400" onClick={() => setFilter("draft")} active={filter === "draft"} />
          <StatCard label="Published" value={stats.published} dot="bg-emerald-500" onClick={() => setFilter("published")} active={filter === "published"} />
          <StatCard label="Archived" value={stats.archived} dot="bg-amber-500" onClick={() => setFilter("archived")} active={filter === "archived"} />
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>

          {/* Body system chips */}
          {usedSystems.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSystemFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  systemFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                All systems
              </button>
              {usedSystems.map((s) => {
                const t = BODY_THEMES[s] ?? BODY_THEMES.other;
                const active = systemFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSystemFilter(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)` : "white",
                      color: active ? "white" : t.text,
                      borderColor: active ? "transparent" : t.bg,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: active ? "white" : t.from }}
                    />
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── List ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="h-28 bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            isEmpty={models.length === 0}
            onCreate={() => navigate("/admin/medical-models/new")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                thumbnailUrl={thumbUrls[m.id]}
                onOpen={() => navigate(`/admin/medical-models/${m.id}`)}
                onDelete={(e) => void handleDelete(e, m)}
                onDuplicate={(e) => void handleDuplicate(e, m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  dot,
  onClick,
  active,
}: {
  label: string;
  value: number;
  dot: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <button
      type={interactive ? "button" : undefined}
      onClick={onClick}
      disabled={!interactive}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        interactive ? "cursor-pointer hover:border-slate-300 hover:shadow-sm" : "cursor-default"
      } ${
        active
          ? "bg-slate-900 text-white border-slate-900 shadow-md"
          : "bg-white border-slate-200"
      }`}
    >
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? "text-white/70" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className={`text-xl font-bold tabular-nums mt-0.5 ${active ? "text-white" : "text-slate-900"}`}>{value}</p>
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${active ? "ring-2 ring-white/40" : ""}`} />
    </button>
  );
}

// ── ModelCard ───────────────────────────────────────────────────────────────
function ModelCard({
  model,
  thumbnailUrl,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  model: MedicalModel;
  thumbnailUrl?: string;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
}) {
  const theme = themeOf(model.body_system);
  const Icon = theme.icon;
  const status = STATUS_STYLE[model.status];
  const hasThumbnail = !!thumbnailUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Top banner: real PNG render when available, otherwise the body-system
         gradient with a floating icon as fallback. */}
      <div
        className="relative h-32 overflow-hidden"
        style={
          hasThumbnail
            ? { background: "#f8fafc" }
            : { background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }
        }
      >
        {hasThumbnail ? (
          <img
            src={thumbnailUrl}
            alt={model.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <>
            <div
              aria-hidden
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)",
              }}
            />
            <div className="absolute -bottom-3 -right-3 opacity-30 group-hover:opacity-45 transition-opacity">
              <Icon className="h-24 w-24 text-white" strokeWidth={1.5} />
            </div>
          </>
        )}
        {/* Top-right: status pill (always) + featured star (when applicable) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {model.is_featured && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[9px] font-bold uppercase tracking-wider shadow">
              <Star className="h-2.5 w-2.5" fill="white" /> Featured
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-white/95 ${status.text} ${status.border}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {model.status}
          </span>
        </div>
        {/* Source-kind badge top-left */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur text-[9px] font-semibold uppercase tracking-wider border ${
            hasThumbnail
              ? "bg-slate-900/70 text-white border-slate-700/40"
              : "bg-white/20 text-white border-white/30"
          }`}>
            {model.source_kind === "ai_generated" ? (
              <><Sparkles className="h-2.5 w-2.5" /> AI</>
            ) : (
              <><Upload className="h-2.5 w-2.5" /> Upload</>
            )}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-violet-700 transition-colors flex items-center gap-1">
          {model.title}
          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-violet-500" />
        </h3>
        {model.description ? (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {model.description}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60 italic mt-1">No description</p>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {model.body_system && (
              <span
                className="px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider text-[9px]"
                style={{ background: theme.bg, color: theme.text }}
              >
                {model.body_system}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-2.5 w-2.5" /> {model.view_count}
            </span>
            <span>· {timeAgo(model.updated_at)}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <span
              className="p-1.5 rounded-md text-muted-foreground hover:text-slate-700 hover:bg-slate-100"
              title="Edit"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              role="button"
            >
              <Pencil className="h-3 w-3" />
            </span>
            <span
              className="p-1.5 rounded-md text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
              title="Duplicate (clones the GLB + labels as a new draft)"
              onClick={onDuplicate}
              role="button"
            >
              <Copy className="h-3 w-3" />
            </span>
            <span
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50"
              title="Delete"
              onClick={onDelete}
              role="button"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState({ isEmpty, onCreate }: { isEmpty: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur p-14 text-center max-w-2xl mx-auto">
      <div className="relative inline-flex items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0 -m-4 rounded-full blur-2xl opacity-40"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
        />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg">
          <Box className="h-8 w-8 text-white" />
        </div>
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-900">
        {isEmpty ? "Start your model library" : "No models match this filter"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        {isEmpty
          ? "Upload your first 3D anatomic model. Drop in a GLB from Z-Anatomy, BodyParts3D, or your own Blender export."
          : "Try a different filter, clear the search, or remove the body-system constraint."}
      </p>
      {isEmpty && (
        <Button onClick={onCreate} className="mt-5 gap-1.5 shadow-md">
          <Plus className="h-4 w-4" /> Upload your first model
        </Button>
      )}
      {!isEmpty && (
        <div className="mt-3 flex items-center gap-1.5 justify-center text-[11px] text-muted-foreground">
          <Layers className="h-3 w-3" /> Tip: clear filters above to see everything
        </div>
      )}
    </div>
  );
}
