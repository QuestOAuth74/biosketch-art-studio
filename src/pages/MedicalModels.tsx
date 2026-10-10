import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Box,
  Search,
  ChevronRight,
  Eye,
  Sparkles,
  Heart,
  Brain,
  Bone,
  Stethoscope,
  Activity,
  Pill,
  Hexagon,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface PublicModel {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body_system: string | null;
  thumbnail_path: string | null;
  source_kind: "upload" | "ai_generated";
  view_count: number;
  is_featured: boolean;
  search_text: string;        // from medical_models_searchable view
  published_at: string | null;
}

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

export default function MedicalModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState<PublicModel[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [systemFilter, setSystemFilter] = useState<string | "all">("all");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    // Query the searchable view so we can ilike against title + description +
    // labels in one column. Featured rows are sorted to the top.
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: PublicModel[] | null; error: unknown }>;
            };
          };
        };
      };
    })
      .from("medical_models_searchable")
      .select("id, slug, title, description, body_system, thumbnail_path, source_kind, view_count, is_featured, search_text, published_at")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false });
    if (error) {
      console.error("[medical-models public] load failed:", error);
      toast.error("Could not load models");
    } else {
      const rows = data || [];
      setModels(rows);
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

  const usedSystems = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => { if (m.body_system) set.add(m.body_system); });
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (systemFilter !== "all" && m.body_system !== systemFilter) return false;
      if (q && !(m.search_text ?? "").includes(q)) return false;
      return true;
    });
  }, [models, systemFilter, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-hidden">
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

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 mb-3">
            <Sparkles className="h-3 w-3 text-violet-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
              3D Anatomy Library
            </span>
          </div>
          <h1
            className="text-3xl md:text-5xl font-bold leading-[1.05] tracking-tight text-slate-900"
            style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.025em" }}
          >
            Explore the{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)" }}
            >
              human body
            </span>
            <br className="hidden sm:block" />
            in 3D
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-xl leading-relaxed">
            Interactive, labeled anatomic models for clinicians and patients. Rotate, zoom, and click any
            label to learn more about the structure.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
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
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "white" : t.from }} />
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="h-28 bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur p-14 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg">
              <Box className="h-7 w-7 text-white" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-900">
              {models.length === 0 ? "Coming soon" : "No models match this filter"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {models.length === 0
                ? "We're building a library of interactive 3D anatomic models. Check back soon."
                : "Try a different filter or clear the search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <PublicCard
                key={m.id}
                model={m}
                thumbnailUrl={thumbUrls[m.id]}
                onOpen={() => navigate(`/medical-models/${m.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublicCard({
  model,
  thumbnailUrl,
  onOpen,
}: {
  model: PublicModel;
  thumbnailUrl?: string;
  onOpen: () => void;
}) {
  const theme = themeOf(model.body_system);
  const Icon = theme.icon;
  const hasThumbnail = !!thumbnailUrl;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
    >
      <div
        className="relative h-36 overflow-hidden"
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
              <Icon className="h-28 w-28 text-white" strokeWidth={1.5} />
            </div>
          </>
        )}
        {model.body_system && (
          <div className="absolute top-2.5 left-2.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur text-[9px] font-semibold uppercase tracking-wider border ${
              hasThumbnail
                ? "bg-slate-900/70 text-white border-slate-700/40"
                : "bg-white/20 text-white border-white/30"
            }`}>
              {model.body_system}
            </span>
          </div>
        )}
        {model.is_featured && (
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[9px] font-bold uppercase tracking-wider shadow">
              <Star className="h-2.5 w-2.5" fill="white" /> Featured
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-violet-700 transition-colors flex items-center gap-1">
          {model.title}
          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-violet-500" />
        </h3>
        {model.description ? (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{model.description}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60 italic mt-1">No description</p>
        )}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Eye className="h-2.5 w-2.5" /> {model.view_count.toLocaleString()}
          </span>
        </div>
      </div>
    </button>
  );
}
