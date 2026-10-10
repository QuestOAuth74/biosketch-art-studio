import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Sparkles, AlertCircle, Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { MedicalModelViewer, type LabelPoint, type ViewerHandle } from "@/components/medical-models/MedicalModelViewer";
import { SharePopover } from "@/components/medical-models/SharePopover";
import { SEOHead } from "@/components/SEO/SEOHead";

interface PublicModel {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body_system: string | null;
  glb_path: string;
  thumbnail_path: string | null;
  source_attribution: string | null;
  view_count: number;
}

interface PublicLabel {
  id: string;
  title: string;
  description: string | null;
  position_xyz: { x: number; y: number; z: number };
  sort_order: number;
}

export default function MedicalModelView() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<PublicModel | null>(null);
  const [labels, setLabels] = useState<PublicLabel[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [thumbnailOgUrl, setThumbnailOgUrl] = useState<string | null>(null);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);

  // ── Tour mode ────────────────────────────────────────────────────────
  const viewerRef = useRef<ViewerHandle>(null);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const TOUR_STEP_MS = 5000;

  // When tour state changes, focus the camera + activate the label.
  useEffect(() => {
    if (!tourPlaying || labels.length === 0) return;
    const current = labels[tourIndex];
    if (!current) return;
    setActiveLabelId(current.id);
    viewerRef.current?.focusLabel(current.position_xyz);
  }, [tourPlaying, tourIndex, labels]);

  // Auto-advance when playing.
  useEffect(() => {
    if (!tourPlaying || labels.length === 0) return;
    const t = setTimeout(() => {
      setTourIndex((i) => (i + 1) % labels.length);
    }, TOUR_STEP_MS);
    return () => clearTimeout(t);
  }, [tourPlaying, tourIndex, labels.length]);

  const startTour = () => {
    if (labels.length === 0) return;
    setTourIndex(0);
    setTourPlaying(true);
  };
  const stopTour = () => {
    setTourPlaying(false);
    setActiveLabelId(null);
    viewerRef.current?.resetView();
  };
  const tourPrev = () => setTourIndex((i) => (i - 1 + labels.length) % labels.length);
  const tourNext = () => setTourIndex((i) => (i + 1) % labels.length);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      setLoading(true);
      setError(null);

      // Step 1: fetch the model row (RLS only returns published models for anon)
      const { data: rows, error: mErr } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                limit: (n: number) => Promise<{ data: PublicModel[] | null; error: unknown }>;
              };
            };
          };
        };
      })
        .from("medical_models")
        .select("id, slug, title, description, body_system, glb_path, thumbnail_path, source_attribution, view_count")
        .eq("slug", slug)
        .eq("status", "published")
        .limit(1);

      if (mErr) {
        console.error("[medical-models view] model load failed:", mErr);
        setError("Could not load this model.");
        setLoading(false);
        return;
      }
      const m = rows?.[0];
      if (!m) {
        setError("This model is not available.");
        setLoading(false);
        return;
      }
      setModel(m);

      // Step 2: signed URL for the GLB (storage RLS allows anon for published model files)
      const { data: signed, error: sErr } = await supabase.storage
        .from("medical-models")
        .createSignedUrl(m.glb_path, 60 * 60);
      if (sErr || !signed?.signedUrl) {
        console.error("[medical-models view] signed URL failed:", sErr);
        setError("Could not load the 3D file.");
        setLoading(false);
        return;
      }
      setSignedUrl(signed.signedUrl);

      // Sign the thumbnail too (for OpenGraph image).
      if (m.thumbnail_path) {
        const { data: thumbSigned } = await supabase.storage
          .from("medical-models")
          .createSignedUrl(m.thumbnail_path, 60 * 60 * 24);
        setThumbnailOgUrl(thumbSigned?.signedUrl || null);
      }

      // Step 2b: bump view_count (best-effort; ignore failures).
      void supabase.rpc("increment_medical_model_view" as never, { p_model_id: m.id } as never);

      // Step 3: labels for this model
      const { data: labelRows } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: PublicLabel[] | null }>;
            };
          };
        };
      })
        .from("medical_model_labels")
        .select("id, title, description, position_xyz, sort_order")
        .eq("model_id", m.id)
        .order("sort_order", { ascending: true });
      setLabels(labelRows || []);

      setLoading(false);
    })();
  }, [slug]);

  const viewerLabels: LabelPoint[] = labels.map((l, idx) => ({
    id: l.id,
    position: l.position_xyz,
    title: l.title,
    description: l.description,
    index: idx + 1,
    active: l.id === activeLabelId,
  }));

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {model && (
        <SEOHead
          title={`${model.title}${model.body_system ? ` · ${model.body_system}` : ""} | BioSketch 3D`}
          description={
            model.description ||
            `Interactive 3D anatomic model of ${model.title}. Rotate, zoom, and explore labeled structures.`
          }
          canonical={`https://biosketch.art/medical-models/${model.slug}`}
          ogImage={thumbnailOgUrl || "https://biosketch.art/logo.png"}
          ogType="article"
        />
      )}
      {/* Sticky header */}
      <header className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-200 z-20">
        <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/medical-models")}
              className="gap-1.5 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              All models
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="min-w-0 flex items-center gap-2">
              <h1
                className="text-sm font-bold tracking-tight text-slate-900 truncate max-w-[420px]"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}
              >
                {model?.title || (loading ? "Loading…" : "Model")}
              </h1>
              {model?.body_system && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  {model.body_system}
                </span>
              )}
              {labels.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  · {labels.length} label{labels.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          {model && <SharePopover title={`Share "${model.title}"`} />}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-[1600px] mx-auto h-full p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Viewer */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden relative min-h-[400px]">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-xs text-slate-500 mt-2">Loading 3D model…</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
                <p className="text-sm font-medium text-slate-700">{error}</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/medical-models")} className="mt-4 gap-1.5">
                  Back to catalog
                </Button>
              </div>
            ) : signedUrl ? (
              <MedicalModelViewer
                ref={viewerRef}
                url={signedUrl}
                cacheKey={model?.id}
                labels={viewerLabels}
                onLabelClick={(id) => {
                  if (tourPlaying) setTourPlaying(false);
                  const newActive = activeLabelId === id ? null : id;
                  setActiveLabelId(newActive);
                  // Fire-and-forget click event when activating (not when closing)
                  if (newActive && model) {
                    void (supabase as unknown as {
                      from: (t: string) => { insert: (r: Record<string, unknown>) => Promise<{ error: unknown }> };
                    })
                      .from("medical_model_label_clicks")
                      .insert({ model_id: model.id, label_id: id })
                      .then(({ error }: { error: unknown }) => {
                        if (error) console.warn("[medical-models] label click log failed:", error);
                      });
                  }
                }}
              />
            ) : null}

            {/* Floating tour control bar — shows when a tour is active */}
            {tourPlaying && labels[tourIndex] && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-slate-900/95 backdrop-blur text-white shadow-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={tourPrev}
                    title="Previous label"
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTourPlaying((p) => !p)}
                    title={tourPlaying ? "Pause" : "Resume"}
                    className="h-7 w-7 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500"
                  >
                    {tourPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={tourNext}
                    title="Next label"
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[11px] px-2.5 min-w-[140px]">
                    <span className="text-white/60 font-semibold tracking-wider mr-1">
                      {tourIndex + 1}/{labels.length}
                    </span>
                    <span className="font-medium truncate">{labels[tourIndex].title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopTour}
                    title="End tour"
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column: description + label index */}
          <div className="overflow-y-auto pr-1 space-y-3">
            {model && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  About this model
                </p>
                {model.description ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{model.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}
                {model.source_attribution && (
                  <p className="text-[11px] text-muted-foreground border-t border-slate-100 pt-2">
                    Source: {model.source_attribution}
                  </p>
                )}
              </div>
            )}

            {labels.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Labels ({labels.length})
                    </p>
                  </div>
                  {!tourPlaying ? (
                    <Button
                      size="sm"
                      onClick={startTour}
                      className="h-7 px-2.5 text-[11px] gap-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shadow-md"
                    >
                      <Play className="h-3 w-3" />
                      Guided tour
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={stopTour}
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      <X className="h-3 w-3" />
                      Stop tour
                    </Button>
                  )}
                </div>
                <ol className="space-y-1.5">
                  {labels.map((l, idx) => {
                    const isActive = activeLabelId === l.id;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setActiveLabelId(isActive ? null : l.id)}
                          className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
                            isActive ? "bg-violet-50 border border-violet-200" : "border border-transparent hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold shrink-0 ${
                              isActive ? "bg-violet-600" : "bg-slate-700"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 line-clamp-1">{l.title}</p>
                            {l.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                                {l.description}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
