import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO/SEOHead";
import { AnomalousMatterHero } from "@/components/ui/anomalous-matter-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clapperboard,
  Search,
  Trash2,
  Clock,
  Film,
  Pencil,
  Check,
  X,
  ArrowLeft,
  Play,
  MoreHorizontal,
  ArrowUpDown,
  LayoutGrid,
  List,
  Maximize2,
  Layers,
  Sparkles,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAnimationFeature } from "@/hooks/useAnimationFeature";

const pageStyles = `
  @keyframes anim-card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes anim-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes anim-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes anim-pulse-ring {
    0% { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  .anim-card-enter { animation: anim-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .anim-fade-1 { animation: anim-fade-up 0.4s ease-out 0.1s both; }
  .anim-fade-2 { animation: anim-fade-up 0.4s ease-out 0.2s both; }
  .anim-fade-3 { animation: anim-fade-up 0.4s ease-out 0.3s both; }
`;

type SortOption = "updated" | "created" | "name" | "duration";
type ViewMode = "grid" | "list";

interface AnimationEntry {
  id: string;
  name: string;
  source_project_id: string | null;
  fps: number;
  duration_seconds: number;
  total_frames: number;
  canvas_width: number | null;
  canvas_height: number | null;
  created_at: string;
  updated_at: string;
  source_name?: string;
}

export default function Animations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { animationEnabled } = useAnimationFeature();

  const [animations, setAnimations] = useState<AnimationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadAnimations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("animation_projects")
        .select("id, name, source_project_id, fps, duration_seconds, total_frames, canvas_width, canvas_height, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const entries: AnimationEntry[] = data || [];

      const sourceIds = [...new Set(entries.filter(e => e.source_project_id).map(e => e.source_project_id!))];
      if (sourceIds.length > 0) {
        const { data: sourceProjects } = await supabase
          .from("canvas_projects")
          .select("id, name")
          .in("id", sourceIds);
        const nameMap = new Map((sourceProjects || []).map((p: any) => [p.id, p.name]));
        entries.forEach(e => {
          if (e.source_project_id) e.source_name = nameMap.get(e.source_project_id);
        });
      }
      setAnimations(entries);
    } catch {
      toast.error("Failed to load animations");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAnimations(); }, [loadAnimations]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  const deleteAnimation = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const { error } = await (supabase as any).from("animation_projects").delete().eq("id", id);
      if (error) throw error;
      toast.success("Animation deleted");
      setAnimations(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error("Failed to delete animation");
    }
  };

  const duplicateAnimation = async (anim: AnimationEntry) => {
    try {
      const { data: full } = await (supabase as any)
        .from("animation_projects")
        .select("*")
        .eq("id", anim.id)
        .single();
      if (!full) throw new Error("Not found");

      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = full;
      const { data: newAnim, error } = await (supabase as any)
        .from("animation_projects")
        .insert({ ...rest, name: `${anim.name} (copy)` })
        .select("id, name, source_project_id, fps, duration_seconds, total_frames, canvas_width, canvas_height, created_at, updated_at")
        .single();
      if (error) throw error;
      setAnimations(prev => [{ ...newAnim, source_name: anim.source_name }, ...prev]);
      toast.success("Animation duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setMenuOpenId(null);
  };

  const applyRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    try {
      const { error } = await (supabase as any)
        .from("animation_projects")
        .update({ name: renameValue.trim() })
        .eq("id", renamingId);
      if (error) throw error;
      setAnimations(prev => prev.map(a => a.id === renamingId ? { ...a, name: renameValue.trim() } : a));
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
    } finally {
      setRenamingId(null);
    }
  };

  const filtered = useMemo(() => {
    let list = animations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.source_name?.toLowerCase().includes(q) ?? false)
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case "updated":
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "created":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "duration":
        sorted.sort((a, b) => Number(b.duration_seconds) - Number(a.duration_seconds));
        break;
    }
    return sorted;
  }, [animations, searchQuery, sortBy]);

  // ─── Stats ──────────────────────────────────────────────────────────────

  const totalDuration = useMemo(
    () => animations.reduce((s, a) => s + Number(a.duration_seconds), 0),
    [animations]
  );
  const totalFrames = useMemo(
    () => animations.reduce((s, a) => s + a.total_frames, 0),
    [animations]
  );

  if (!animationEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SEOHead title="Animations - BioSketch" description="Your saved animations" noindex />
        <p className="text-muted-foreground">Animation feature is not enabled.</p>
      </div>
    );
  }

  // ─── Kebab Menu ─────────────────────────────────────────────────────────

  const renderKebabMenu = (anim: AnimationEntry) => (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpenId(menuOpenId === anim.id ? null : anim.id);
        }}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpenId === anim.id && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl overflow-hidden border-2 border-dashed border-border/60 bg-card shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => startRename(anim.id, anim.name)}
            className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-violet-500/60" />
            Rename
          </button>
          <button
            onClick={() => { duplicateAnimation(anim); setMenuOpenId(null); }}
            className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-violet-500/60" />
            Duplicate
          </button>
          <div className="h-px mx-2 bg-border/60" />
          <button
            onClick={() => { deleteAnimation(anim.id, anim.name); setMenuOpenId(null); }}
            className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center gap-2.5 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );

  // ─── Card ───────────────────────────────────────────────────────────────

  const renderCard = (anim: AnimationEntry, i: number) => (
    <div
      key={anim.id}
      className="anim-card-enter group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 border-2 border-dashed border-border/60 bg-card/60 hover:shadow-lg hover:border-border"
      style={{ animationDelay: `${i * 50}ms` }}
      onClick={() => navigate(`/animate/saved/${anim.id}`)}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted/30">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground) / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.2) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Decorative timeline bars */}
        <div className="absolute bottom-0 left-0 right-0 h-8 flex items-end gap-px px-4 pb-2 opacity-30 group-hover:opacity-60 transition-opacity">
          {Array.from({ length: 16 }).map((_, j) => {
            const h = 4 + Math.sin((j + (anim.total_frames % 10)) * 0.7) * 12 + Math.random() * 4;
            return (
              <div
                key={j}
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${h}px`,
                  background: j % 4 === 0
                    ? "linear-gradient(to top, hsl(var(--primary)), hsl(var(--primary) / 0.3))"
                    : "hsl(var(--foreground) / 0.08)",
                }}
              />
            );
          })}
        </div>

        {/* Play indicator on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-primary/20"
              style={{ animation: "anim-pulse-ring 1.5s ease-out infinite" }}
            />
            <div className="h-12 w-12 rounded-full flex items-center justify-center bg-primary shadow-lg">
              <Play className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute top-3 left-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tabular-nums bg-background/80 text-foreground backdrop-blur-sm border border-border/40">
            <Clock className="h-3 w-3" />
            {Number(anim.duration_seconds)}s
          </div>
        </div>

        {/* FPS badge */}
        <div className="absolute top-3 right-3">
          <div className="px-2 py-1 rounded-md text-[10px] font-semibold tabular-nums bg-background/80 text-foreground backdrop-blur-sm border border-border/40">
            {anim.fps} fps
          </div>
        </div>

        {/* Kebab menu */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {renderKebabMenu(anim)}
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5">
        {renamingId === anim.id ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyRename(); if (e.key === "Escape") setRenamingId(null); }}
              className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-primary outline-none py-0.5 text-foreground"
            />
            <button onClick={applyRename} className="h-6 w-6 rounded-md flex items-center justify-center text-primary hover:bg-primary/10">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setRenamingId(null)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <h3 className="font-semibold text-[14px] text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
            {anim.name}
          </h3>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[12px] text-muted-foreground">
            {formatDistanceToNow(new Date(anim.updated_at), { addSuffix: true })}
          </p>
          {anim.canvas_width && anim.canvas_height && (
            <p className="text-[11px] text-muted-foreground/60 font-mono tabular-nums">
              {anim.canvas_width}&times;{anim.canvas_height}
            </p>
          )}
        </div>

        {anim.source_name && (
          <p className="text-[11px] text-muted-foreground/60 mt-1 line-clamp-1">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3 inline" />
              {anim.source_name}
            </span>
          </p>
        )}
      </div>
    </div>
  );

  // ─── List row ───────────────────────────────────────────────────────────

  const renderListRow = (anim: AnimationEntry, i: number) => (
    <div
      key={anim.id}
      className="anim-card-enter group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border-2 border-dashed border-border/60 bg-card/60 hover:shadow-lg hover:border-border"
      style={{ animationDelay: `${i * 30}ms` }}
      onClick={() => navigate(`/animate/saved/${anim.id}`)}
    >
      {/* Mini thumbnail */}
      <div className="h-12 w-20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-muted/30 border-2 border-dashed border-border/40">
        <Clapperboard className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Name + source */}
      <div className="flex-1 min-w-0">
        {renamingId === anim.id ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyRename(); if (e.key === "Escape") setRenamingId(null); }}
              className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-primary outline-none py-0.5 text-foreground"
            />
            <button onClick={applyRename} className="h-6 w-6 rounded-md flex items-center justify-center text-primary hover:bg-primary/10">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setRenamingId(null)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {anim.name}
            </h3>
            {anim.source_name && (
              <p className="text-[11px] text-muted-foreground/60 truncate">
                {anim.source_name}
              </p>
            )}
          </>
        )}
      </div>

      {/* Metadata columns */}
      <div className="hidden sm:flex items-center gap-6 shrink-0 text-[12px] text-muted-foreground tabular-nums font-mono">
        <span className="w-14 text-right">{Number(anim.duration_seconds)}s</span>
        <span className="w-12 text-right">{anim.fps} fps</span>
        {anim.canvas_width && anim.canvas_height && (
          <span className="w-24 text-right">{anim.canvas_width}&times;{anim.canvas_height}</span>
        )}
      </div>

      {/* Date */}
      <p className="text-[12px] text-muted-foreground shrink-0 w-28 text-right hidden md:block">
        {formatDistanceToNow(new Date(anim.updated_at), { addSuffix: true })}
      </p>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {renderKebabMenu(anim)}
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="My Animations - BioSketch" description="Browse and manage your saved animations" noindex />
      <style>{pageStyles}</style>

      {/* ── Anomalous Matter Hero (full-bleed, dark, WebGL) ── */}
      <div className="relative">
        {/* Back button overlaid on hero */}
        <button
          onClick={() => navigate("/projects")}
          className="absolute top-5 left-5 z-30 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md text-xs font-medium text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </button>

        <AnomalousMatterHero
          title="BioSketch · Motion Studio"
          subtitle="My Animations"
          description="Manage and continue working on your motion projects. Bring your science to life — frame by frame."
          colorHex="#a78bfa"
          className="h-[85vh] min-h-[560px]"
        >
          {/* Stats row inside hero */}
          {animations.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md">
                <Film className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-base font-bold text-white tabular-nums">{animations.length}</span>
                <span className="text-[11px] text-white/60 uppercase tracking-wider font-semibold">
                  project{animations.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md">
                <Clock className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-base font-bold text-white tabular-nums">{totalDuration.toFixed(1)}s</span>
                <span className="text-[11px] text-white/60 uppercase tracking-wider font-semibold">total</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md">
                <Layers className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-base font-bold text-white tabular-nums">{totalFrames.toLocaleString()}</span>
                <span className="text-[11px] text-white/60 uppercase tracking-wider font-semibold">frames</span>
              </div>
            </div>
          )}
        </AnomalousMatterHero>
      </div>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 max-w-6xl">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 anim-fade-2">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search animations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl border-2 border-dashed border-border/60 bg-card/60 focus:bg-background focus:border-primary/40 transition-all duration-200"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="h-10 pl-8 pr-3 rounded-xl text-sm text-foreground appearance-none cursor-pointer transition-colors border-2 border-dashed border-border/60 bg-card/60"
              >
                <option value="updated">Last modified</option>
                <option value="created">Date created</option>
                <option value="name">Name A-Z</option>
                <option value="duration">Duration</option>
              </select>
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-xl p-0.5 border-2 border-dashed border-border/60 bg-card/60">
              <button
                onClick={() => setViewMode("grid")}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === "list"
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="anim-fade-3">
          {loading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border-2 border-dashed border-border/60 bg-card/60">
                    <Skeleton className="aspect-[16/10] w-full" />
                    <div className="p-4 space-y-2.5">
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                      <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-3 border-2 border-dashed border-border/60 bg-card/60">
                    <Skeleton className="h-12 w-20 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 rounded-md" />
                      <Skeleton className="h-3 w-32 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
            /* ─── Empty state ───────────────────────────────────────────── */
            <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-12 text-center transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden group">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <div style={{ animation: "anim-float 3s ease-in-out infinite" }}>
                    <Clapperboard className="w-8 h-8 text-muted-foreground" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {searchQuery ? "No animations found" : "Start animating"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  {searchQuery
                    ? "Try adjusting your search or check for typos."
                    : "Create stunning motion graphics from your scientific illustrations. Open any project and start animating."}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => navigate("/projects")}
                    className="shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Browse Projects
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((anim, i) => renderCard(anim, i))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* List header */}
              <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <div className="w-20 shrink-0" />
                <div className="flex-1">Name</div>
                <div className="hidden sm:flex items-center gap-6 shrink-0">
                  <span className="w-14 text-right">Duration</span>
                  <span className="w-12 text-right">FPS</span>
                  <span className="w-24 text-right">Dimensions</span>
                </div>
                <div className="w-28 text-right hidden md:block">Modified</div>
                <div className="w-8 shrink-0" />
              </div>
              {filtered.map((anim, i) => renderListRow(anim, i))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-[12px] text-muted-foreground">
              Showing {filtered.length} of {animations.length} animation{animations.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
