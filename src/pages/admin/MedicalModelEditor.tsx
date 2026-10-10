import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, Save, CheckCircle2, FileBox, AlertCircle, Camera } from "lucide-react";
import { toast } from "sonner";
import { MedicalModelViewer, type LabelPoint, type ViewerMode, type ViewerHandle } from "@/components/medical-models/MedicalModelViewer";
import { MedicalModelLabelsPanel, type LabelRow } from "@/components/medical-models/MedicalModelLabelsPanel";
import { SharePopover } from "@/components/medical-models/SharePopover";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB matches the bucket cap

const BODY_SYSTEMS = [
  "cardiovascular",
  "respiratory",
  "neuro",
  "gastrointestinal",
  "renal",
  "musculoskeletal",
  "endocrine",
  "reproductive",
  "hematologic",
  "integumentary",
  "other",
] as const;

interface ModelRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body_system: string | null;
  glb_path: string;
  thumbnail_path: string | null;
  status: "draft" | "published" | "archived";
  source_kind: "upload" | "ai_generated";
  source_attribution: string | null;
  ai_prompt: string | null;
  file_size_bytes: number | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export default function MedicalModelEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { user } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [model, setModel] = useState<ModelRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [capturingThumbnail, setCapturingThumbnail] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const viewerRef = useRef<ViewerHandle>(null);

  // ── Labels state (Phase 2) ────────────────────────────────────────────
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("view");
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bodySystem, setBodySystem] = useState<string>("");
  const [attribution, setAttribution] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing model ────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              single: () => Promise<{ data: ModelRow | null; error: unknown }>;
            };
          };
        };
      })
        .from("medical_models")
        .select("*")
        .eq("id", id!)
        .single();
      if (error || !data) {
        console.error("[medical-models] load failed:", error);
        toast.error("Model not found");
        navigate("/admin/medical-models");
        return;
      }
      setModel(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setBodySystem(data.body_system || "");
      setAttribution(data.source_attribution || "");
      setStatus(data.status);
      setIsFeatured(data.is_featured ?? false);

      // Sign a 1-hour URL for the GLB so the viewer can fetch it
      const { data: signed } = await supabase.storage
        .from("medical-models")
        .createSignedUrl(data.glb_path, 60 * 60);
      setSignedUrl(signed?.signedUrl || null);
      if (data.thumbnail_path) {
        const { data: thumbSigned } = await supabase.storage
          .from("medical-models")
          .createSignedUrl(data.thumbnail_path, 60 * 60);
        setThumbnailUrl(thumbSigned?.signedUrl || null);
      } else {
        // Auto-capture a thumbnail at the default camera angle once the viewer
        // has had a moment to load + auto-fit. Skipped if the admin manually
        // captures first (the button updates thumbnail_path which we re-check
        // before firing).
        setTimeout(() => {
          if (!viewerRef.current) return;
          void (async () => {
            try {
              const dataUrl = viewerRef.current?.screenshot();
              if (!dataUrl || !data.id) return;
              const blob = await (await fetch(dataUrl)).blob();
              const thumbPath = `${data.id}-thumb.png`;
              const { error } = await supabase.storage
                .from("medical-models")
                .upload(thumbPath, blob, { contentType: "image/png", upsert: false, cacheControl: "60" });
              if (error) return; // silent: another path may have created it
              await (supabase as unknown as {
                from: (t: string) => {
                  update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
                };
              })
                .from("medical_models")
                .update({ thumbnail_path: thumbPath })
                .eq("id", data.id);
              const { data: signed } = await supabase.storage
                .from("medical-models")
                .createSignedUrl(thumbPath, 60 * 60);
              setThumbnailUrl(signed?.signedUrl || null);
            } catch (err) {
              console.warn("[medical-models] auto-thumbnail skipped:", err);
            }
          })();
        }, 1800);
      }
      setLoading(false);
      void loadLabels(data.id);
    })();
  }, [id, isNew, navigate]);

  // Capture the current viewer frame as a PNG, upload to storage, and persist
  // the thumbnail_path on the model row.
  const handleCaptureThumbnail = async () => {
    if (!model || !viewerRef.current || capturingThumbnail) return;
    setCapturingThumbnail(true);
    try {
      const dataUrl = viewerRef.current.screenshot();
      if (!dataUrl) {
        toast.error("Could not capture viewer frame");
        return;
      }
      const blob = await (await fetch(dataUrl)).blob();
      const thumbPath = `${model.id}-thumb.png`;
      const { error: uploadErr } = await supabase.storage
        .from("medical-models")
        .upload(thumbPath, blob, { contentType: "image/png", upsert: true, cacheControl: "60" });
      if (uploadErr) {
        console.error("[medical-models] thumb upload failed:", uploadErr);
        toast.error("Thumbnail upload failed");
        return;
      }
      const { error: updateErr } = await (supabase as unknown as {
        from: (t: string) => {
          update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
        };
      })
        .from("medical_models")
        .update({ thumbnail_path: thumbPath })
        .eq("id", model.id);
      if (updateErr) {
        console.error("[medical-models] thumb path save failed:", updateErr);
        toast.error("Could not save thumbnail path");
        return;
      }
      // Refresh the displayed preview with a brand-new signed URL.
      const { data: signed } = await supabase.storage
        .from("medical-models")
        .createSignedUrl(thumbPath, 60 * 60);
      setThumbnailUrl(signed?.signedUrl ? `${signed.signedUrl}&t=${Date.now()}` : null);
      setModel({ ...model, thumbnail_path: thumbPath });
      toast.success("Thumbnail captured");
    } finally {
      setCapturingThumbnail(false);
    }
  };

  // ── Labels CRUD ────────────────────────────────────────────────────────
  const loadLabels = async (modelId: string) => {
    setLabelsLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{ data: LabelRow[] | null; error: unknown }>;
          };
        };
      };
    })
      .from("medical_model_labels")
      .select("id, title, description, position_xyz, sort_order")
      .eq("model_id", modelId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[medical-models] load labels failed:", error);
    } else {
      setLabels(data || []);
    }
    setLabelsLoading(false);
  };

  const handleMeshClick = async (
    position: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number } | null,
  ) => {
    console.log("[medical-models] mesh click in place mode", { modelId: model?.id, position, normal });
    if (!model) {
      toast.error("Save the model first before adding labels");
      return;
    }
    const nextOrder = labels.length > 0 ? Math.max(...labels.map((l) => l.sort_order)) + 1 : 0;
    const payload = {
      model_id: model.id,
      position_xyz: position,
      normal_xyz: normal,
      title: `Label ${labels.length + 1}`,
      sort_order: nextOrder,
    };
    console.log("[medical-models] inserting label", payload);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (s: string) => {
            single: () => Promise<{
              data: LabelRow | null;
              error: { message?: string; code?: string; details?: string; hint?: string } | null;
            }>;
          };
        };
      };
    })
      .from("medical_model_labels")
      .insert(payload)
      .select("id, title, description, position_xyz, sort_order")
      .single();
    if (error || !data) {
      console.error("[medical-models] create label failed:", error);
      const detail = error?.message || error?.details || error?.hint || "unknown error";
      toast.error(`Could not add label: ${detail}`, { duration: 8000 });
      return;
    }
    setLabels((prev) => [...prev, data]);
    setActiveLabelId(data.id);
    setViewerMode("view");
    document.body.style.cursor = "default";
    toast.success("Label added — edit the title in the sidebar");
  };

  const handleEditLabel = async (
    labelId: string,
    patch: { title?: string; description?: string | null },
  ): Promise<boolean> => {
    console.log("[medical-models] updating label", { labelId, patch });
    // Add .select() so we get the actual updated rows back. If RLS silently
    // filters out the row, data will be [] with no error — that's the failure
    // mode we want to surface as a real toast.
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => {
            select: (s: string) => Promise<{
              data: LabelRow[] | null;
              error: { message?: string; code?: string; details?: string; hint?: string } | null;
            }>;
          };
        };
      };
    })
      .from("medical_model_labels")
      .update(patch)
      .eq("id", labelId)
      .select("id, title, description, position_xyz, sort_order");

    if (error) {
      console.error("[medical-models] update label failed:", error);
      const detail = error?.message || error?.details || error?.hint || "unknown error";
      toast.error(`Could not save label: ${detail}`, { duration: 8000 });
      return false;
    }
    if (!data || data.length === 0) {
      console.warn("[medical-models] update affected 0 rows — RLS likely blocked it");
      toast.error("Could not save label: no rows updated (permissions?)", { duration: 8000 });
      return false;
    }
    console.log("[medical-models] update succeeded", data[0]);
    setLabels((prev) => prev.map((l) => (l.id === labelId ? { ...l, ...data[0] } : l)));
    toast.success("Label saved");
    return true;
  };

  const handleDeleteLabel = async (labelId: string) => {
    const { error } = await (supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> } };
    })
      .from("medical_model_labels")
      .delete()
      .eq("id", labelId);
    if (error) {
      console.error("[medical-models] delete label failed:", error);
      toast.error("Could not delete label");
      return;
    }
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
    if (activeLabelId === labelId) setActiveLabelId(null);
  };

  // Build the viewer's label list with rendering index + active highlight
  const viewerLabels: LabelPoint[] = labels.map((l, idx) => ({
    id: l.id,
    position: l.position_xyz,
    title: l.title,
    description: l.description,
    index: idx + 1,
    active: l.id === activeLabelId,
  }));

  // ── Handle file selection ──────────────────────────────────────────────
  const handlePickFile = () => fileInputRef.current?.click();

  const acceptFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".glb") && !file.name.toLowerCase().endsWith(".gltf")) {
      toast.error("Please choose a .glb or .gltf file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`);
      return;
    }
    setPendingFile(file);
    if (!title) setTitle(file.name.replace(/\.(glb|gltf)$/i, ""));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptFile(file);
  };

  const handleFileDropped = (file: File) => acceptFile(file);

  // Local preview URL for the chosen-but-not-yet-uploaded file
  const localPreviewUrl = useMemo(() => {
    if (!pendingFile) return null;
    return URL.createObjectURL(pendingFile);
  }, [pendingFile]);

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (isNew && !pendingFile) {
      toast.error("Choose a GLB file first");
      return;
    }
    setSaving(true);

    try {
      if (isNew) {
        // 1. Generate a model row first so we have a UUID for the storage path
        const newId = crypto.randomUUID();
        const glbPath = `${newId}.glb`;

        // 2. Upload the GLB
        setUploading(true);
        const { error: uploadErr } = await supabase.storage
          .from("medical-models")
          .upload(glbPath, pendingFile!, {
            cacheControl: "3600",
            upsert: false,
            contentType: "model/gltf-binary",
          });
        setUploading(false);
        if (uploadErr) {
          console.error("[medical-models] upload failed:", uploadErr);
          toast.error("Upload failed: " + (uploadErr.message || "unknown"));
          setSaving(false);
          return;
        }

        // 3. Insert the row
        const { error: insertErr } = await (supabase as unknown as {
          from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };
        })
          .from("medical_models")
          .insert({
            id: newId,
            slug: `${slugify(title)}-${newId.slice(0, 6)}`,
            title: title.trim(),
            description: description.trim() || null,
            body_system: bodySystem || null,
            glb_path: glbPath,
            file_size_bytes: pendingFile!.size,
            source_kind: "upload",
            source_attribution: attribution.trim() || null,
            status,
            is_featured: isFeatured,
            created_by: user.id,
          });
        if (insertErr) {
          console.error("[medical-models] insert failed:", insertErr);
          toast.error("Could not save model row");
          // Best-effort orphan cleanup
          await supabase.storage.from("medical-models").remove([glbPath]).catch(() => {});
          setSaving(false);
          return;
        }

        toast.success("Model saved");
        navigate(`/admin/medical-models/${newId}`);
        return;
      }

      // Editing an existing row
      const updates: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        body_system: bodySystem || null,
        source_attribution: attribution.trim() || null,
        status,
        is_featured: isFeatured,
      };

      // If a new file was chosen, replace the GLB in place
      if (pendingFile && model) {
        setUploading(true);
        const { error: uploadErr } = await supabase.storage
          .from("medical-models")
          .upload(model.glb_path, pendingFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: "model/gltf-binary",
          });
        setUploading(false);
        if (uploadErr) {
          console.error("[medical-models] re-upload failed:", uploadErr);
          toast.error("Could not replace GLB");
          setSaving(false);
          return;
        }
        updates.file_size_bytes = pendingFile.size;
      }

      const { error: updateErr } = await (supabase as unknown as {
        from: (t: string) => {
          update: (patch: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
        };
      })
        .from("medical_models")
        .update(updates)
        .eq("id", id!);
      if (updateErr) {
        console.error("[medical-models] update failed:", updateErr);
        toast.error("Could not save");
        setSaving(false);
        return;
      }
      toast.success("Saved");
      setPendingFile(null);

      // Re-sign URL if we replaced the file
      if (model) {
        const { data: signed } = await supabase.storage
          .from("medical-models")
          .createSignedUrl(model.glb_path, 60 * 60);
        setSignedUrl(signed?.signedUrl || null);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const viewerUrl = localPreviewUrl ?? signedUrl;

  const statusBadge = model && (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
        status === "published"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : status === "archived"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === "published"
            ? "bg-emerald-500"
            : status === "archived"
            ? "bg-amber-500"
            : "bg-slate-400"
        }`}
      />
      {status}
    </span>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-200 z-20">
        <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/medical-models")}
              className="gap-1.5 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Models
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="min-w-0 flex items-center gap-2.5">
              <h1
                className="text-sm font-bold tracking-tight text-slate-900 truncate max-w-[420px]"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}
              >
                {isNew ? "New 3D model" : title || "Untitled"}
              </h1>
              {statusBadge}
              {model && labels.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  · {labels.length} label{labels.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {model && model.status === "published" && (
              <SharePopover
                title={`Share "${model.title}" with a patient`}
                url={`${window.location.origin}/medical-models/${model.slug}`}
              />
            )}
            <Button
              onClick={handleSave}
              disabled={saving || (isNew && !pendingFile)}
              size="sm"
              className="gap-1.5 h-8"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body: viewer + right column ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-[1600px] mx-auto h-full p-4 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
          {/* Left: viewer fills available height; doubles as a drop zone for GLBs */}
          <div
            className={`rounded-2xl border bg-white overflow-hidden relative min-h-[400px] transition-colors ${
              dragActive ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileDropped(file);
            }}
          >
            {viewerUrl ? (
              <MedicalModelViewer
                ref={viewerRef}
                url={viewerUrl}
                cacheKey={pendingFile?.name || model?.id}
                labels={viewerLabels}
                mode={viewerMode}
                onMeshClick={handleMeshClick}
                onLabelClick={(id) => setActiveLabelId(activeLabelId === id ? null : id)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                <FileBox className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">No model loaded</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Drag a GLB onto this area, or choose one.
                </p>
                <Button variant="outline" size="sm" onClick={handlePickFile} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Choose GLB
                </Button>
              </div>
            )}
            {dragActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-50/90 backdrop-blur-sm pointer-events-none">
                <Upload className="h-10 w-10 text-violet-500 mb-2" />
                <p className="text-sm font-bold text-violet-800">Drop to {model ? "replace" : "upload"} the GLB</p>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-md">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  <span className="text-sm font-medium">Uploading…</span>
                </div>
              </div>
            )}
          </div>

          {/* Right column — scrollable */}
          <div className="overflow-y-auto pr-1 space-y-3">
            {/* Labels FIRST (primary workflow), only after model is saved */}
            {!isNew && model && (
              <MedicalModelLabelsPanel
                labels={labels}
                loading={labelsLoading}
                placeMode={viewerMode === "place"}
                activeLabelId={activeLabelId}
                onTogglePlaceMode={() => {
                  setViewerMode((m) => (m === "place" ? "view" : "place"));
                  if (viewerMode === "place") document.body.style.cursor = "default";
                }}
                onSelect={setActiveLabelId}
                onEdit={handleEditLabel}
                onDelete={handleDeleteLabel}
              />
            )}

            {/* Metadata */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground -mb-1">
                Details
              </p>
              <div>
                <Label htmlFor="title" className="text-[11px] text-muted-foreground">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mitral Regurgitation"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-[11px] text-muted-foreground">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Plain-language overview the clinician will use with patients."
                  className="mt-1 min-h-[72px] resize-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Body system</Label>
                  <Select value={bodySystem} onValueChange={setBodySystem}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_SYSTEMS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="attribution" className="text-[11px] text-muted-foreground">Source / license</Label>
                <Input
                  id="attribution"
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                  placeholder="e.g. Z-Anatomy (CC BY 4.0)"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="mt-0.5 accent-violet-600 w-3.5 h-3.5"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800">Featured</p>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">
                    Promote to the top of the public catalog with a "Featured" badge.
                  </p>
                </div>
              </label>
              <div className="text-[10.5px] text-muted-foreground flex items-start gap-1.5 pt-1 border-t border-slate-100">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Even "published" models stay hidden from end users until the public catalog ships.</span>
              </div>
            </div>

            {/* GLB file controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                GLB file
              </p>
              {pendingFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pendingFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(pendingFile.size / 1024 / 1024).toFixed(2)} MB · ready to save
                    </p>
                  </div>
                </div>
              ) : model ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileBox className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{model.glb_path}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {model.file_size_bytes
                        ? `${(model.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                        : "size unknown"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No file selected.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePickFile}
                className="mt-3 w-full gap-1.5 h-8 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                {model || pendingFile ? "Replace GLB" : "Choose GLB"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                Max 50 MB. GLB recommended over GLTF.
              </p>
              <p className="mt-1 text-[10.5px] text-violet-700">
                💡 <span className="font-medium">Tip:</span> enable Draco compression
                when exporting from Blender (or run <span className="font-mono bg-violet-50 px-1 rounded">gltfpack -i in.glb -o out.glb -cc</span>) — typically 10-50× smaller, loads much faster on cellular.
              </p>
            </div>

            {/* Thumbnail capture — only after the model is saved */}
            {!isNew && model && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  Thumbnail
                </p>
                {thumbnailUrl ? (
                  <div className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={thumbnailUrl} alt="Model thumbnail" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1">
                    <Camera className="h-5 w-5 text-slate-300" />
                    <p className="text-[11px] text-muted-foreground">No thumbnail yet</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCaptureThumbnail()}
                  disabled={capturingThumbnail || !viewerUrl}
                  className="mt-3 w-full gap-1.5 h-8 text-xs"
                >
                  {capturingThumbnail ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {thumbnailUrl ? "Re-capture from current view" : "Capture from current view"}
                </Button>
                <p className="mt-2 text-[10.5px] text-muted-foreground">
                  Rotate the model to the angle you want, then capture. This image is what users see on the catalog cards.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
