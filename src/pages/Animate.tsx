import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AnimationProvider, useAnimation } from "@/contexts/AnimationContext";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Clapperboard } from "lucide-react";
import { AnimateHeader } from "@/components/animate/AnimateHeader";
import { AnimateStage } from "@/components/animate/AnimateStage";
import { AnimateObjects } from "@/components/animate/AnimateObjects";
import { AnimateProperties } from "@/components/animate/AnimateProperties";
import { AnimateTemplateLibrary } from "@/components/animate/AnimateTemplateLibrary";
import { MotionGraphicsPanel } from "@/components/animate/MotionGraphicsPanel";
import { RigPanel } from "@/components/animate/RigPanel";
import { AnimateCreationToolbar } from "@/components/animate/AnimateCreationToolbar";
import { AnimateTimeline } from "@/components/animate/AnimateTimeline";
import { ShortcutsOverlay } from "@/components/animate/ShortcutsOverlay";

function AnimateContent() {
  const navigate = useNavigate();
  const { sourceProject, loading, error, workspaceTheme } = useAnimation();

  // ── Resizable panel state (must be before early returns per React rules of hooks) ──
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [objectsWidth, setObjectsWidth] = useState(220);
  const [propertiesWidth, setPropertiesWidth] = useState(250);
  const [rightPanelTab, setRightPanelTab] = useState<"properties" | "templates" | "motion" | "rig">("properties");

  // ── Horizontal resize (Objects panel) ──
  const objectsDragRef = useRef(false);
  const onObjectsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    objectsDragRef.current = true;
    const startX = e.clientX;
    const startW = objectsWidth;
    const onMove = (ev: MouseEvent) => {
      if (!objectsDragRef.current) return;
      setObjectsWidth(Math.max(140, Math.min(400, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      objectsDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [objectsWidth]);

  // ── Horizontal resize (Properties panel) ──
  const propsDragRef = useRef(false);
  const onPropsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    propsDragRef.current = true;
    const startX = e.clientX;
    const startW = propertiesWidth;
    const onMove = (ev: MouseEvent) => {
      if (!propsDragRef.current) return;
      setPropertiesWidth(Math.max(180, Math.min(420, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      propsDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [propertiesWidth]);

  // ── Vertical resize (Timeline) ──
  const tlDragRef = useRef(false);
  const onTimelineResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    tlDragRef.current = true;
    const startY = e.clientY;
    const startH = timelineHeight;
    const onMove = (ev: MouseEvent) => {
      if (!tlDragRef.current) return;
      setTimelineHeight(Math.max(120, Math.min(600, startH - (ev.clientY - startY))));
    };
    const onUp = () => {
      tlDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [timelineHeight]);

  if (loading) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--aw-accent-dim)", border: "1px solid var(--aw-border)" }}>
              <Clapperboard className="h-7 w-7" style={{ color: "var(--aw-accent)" }} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--aw-text-3)" }} />
            <p className="text-[13px] font-medium tracking-wide" style={{ color: "var(--aw-text-3)" }}>Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sourceProject) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <div className="flex flex-col items-center gap-5 text-center max-w-xs">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <Clapperboard className="h-7 w-7" style={{ color: "#ef4444" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#ef4444" }}>{error || "Project not found"}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--aw-text-3)" }}>The project could not be loaded. It may have been deleted or you may not have access.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/projects")}
            className="gap-2"
            style={{ borderColor: "var(--aw-border-strong)", color: "var(--aw-text-2)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`anim-workspace${workspaceTheme === "light" ? " aw-light" : ""} h-screen w-screen flex flex-col overflow-hidden`}>
      <SEOHead
        title={`Animate: ${sourceProject.name} - BioSketch`}
        description="BioSketch Animation Editor"
        noindex
      />
      <AnimateHeader />

      {/* Main content row */}
      <div className="flex-1 flex min-h-0">
        {/* Objects panel */}
        <div style={{ width: objectsWidth, minWidth: objectsWidth }} className="flex shrink-0">
          <AnimateObjects />
        </div>
        {/* Objects resize handle */}
        <div
          className="w-[5px] shrink-0 cursor-col-resize flex items-center justify-center group"
          style={{ background: "var(--aw-border)" }}
          onMouseDown={onObjectsResizeStart}
        >
          <div
            className="w-[3px] h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--aw-accent)" }}
          />
        </div>

        {/* Creation toolbar */}
        <AnimateCreationToolbar />

        {/* Canvas stage */}
        <AnimateStage />

        {/* Properties resize handle */}
        <div
          className="w-[5px] shrink-0 cursor-col-resize flex items-center justify-center group"
          style={{ background: "var(--aw-border)" }}
          onMouseDown={onPropsResizeStart}
        >
          <div
            className="w-[3px] h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--aw-accent)" }}
          />
        </div>
        {/* Properties / Templates panel */}
        <div style={{ width: propertiesWidth, minWidth: propertiesWidth }} className="flex flex-col shrink-0">
          {/* Tab switcher */}
          <div
            className="flex shrink-0"
            style={{ borderBottom: "1px solid var(--aw-border)" }}
          >
            {([
              { id: "properties" as const, label: "Properties" },
              { id: "templates" as const, label: "Templates" },
              { id: "motion" as const, label: "Motion" },
              { id: "rig" as const, label: "Rig" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightPanelTab(tab.id)}
                className="flex-1 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors"
                style={{
                  color: rightPanelTab === tab.id ? "var(--aw-accent)" : "var(--aw-text-3)",
                  background: rightPanelTab === tab.id ? "rgba(139,92,246,0.06)" : "transparent",
                  borderBottom: rightPanelTab === tab.id ? "2px solid var(--aw-accent)" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightPanelTab === "properties" ? (
              <AnimateProperties />
            ) : rightPanelTab === "templates" ? (
              <AnimateTemplateLibrary />
            ) : rightPanelTab === "motion" ? (
              <MotionGraphicsPanel />
            ) : (
              <RigPanel />
            )}
          </div>
        </div>
      </div>

      {/* Timeline resize handle */}
      <div
        className="h-[5px] shrink-0 cursor-row-resize flex justify-center items-center group"
        style={{ background: "var(--aw-border-strong)" }}
        onMouseDown={onTimelineResizeStart}
      >
        <div
          className="h-[3px] w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "var(--aw-accent)" }}
        />
      </div>

      {/* Timeline */}
      <div style={{ height: timelineHeight, minHeight: timelineHeight }} className="shrink-0">
        <AnimateTimeline />
      </div>

      {/* Shortcuts overlay */}
      <ShortcutsOverlay />
    </div>
  );
}

export default function Animate() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (!id || !user) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <p className="text-sm" style={{ color: "var(--aw-text-3)" }}>Invalid project or not authenticated.</p>
      </div>
    );
  }

  return (
    <AnimationProvider projectId={id} userId={user.id}>
      <AnimateContent />
    </AnimationProvider>
  );
}

/** Entry point for /animate/saved/:animId — resolves source project from animation record */
export function AnimateSaved() {
  const { animId } = useParams<{ animId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!animId || !user) return;

    const resolve = async () => {
      setResolving(true);
      try {
        const { data, error } = await (supabase as any)
          .from("animation_projects")
          .select("source_project_id")
          .eq("id", animId)
          .single();

        if (error || !data) throw new Error("Animation not found");
        if (!data.source_project_id) throw new Error("Animation has no linked project");

        setSourceProjectId(data.source_project_id);
      } catch (err: any) {
        setResolveError(err.message || "Failed to load animation");
      } finally {
        setResolving(false);
      }
    };

    resolve();
  }, [animId, user]);

  if (!animId || !user) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <p className="text-sm" style={{ color: "var(--aw-text-3)" }}>Invalid animation or not authenticated.</p>
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <div className="flex flex-col items-center gap-5">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--aw-accent-dim)", border: "1px solid var(--aw-border)" }}>
            <Clapperboard className="h-7 w-7" style={{ color: "var(--aw-accent)" }} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--aw-text-3)" }} />
            <p className="text-[13px] font-medium tracking-wide" style={{ color: "var(--aw-text-3)" }}>Loading animation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (resolveError || !sourceProjectId) {
    return (
      <div className="anim-workspace h-screen w-screen flex items-center justify-center">
        <SEOHead title="Animation Editor - BioSketch" description="BioSketch Animation Editor" noindex />
        <div className="flex flex-col items-center gap-5 text-center max-w-xs">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <Clapperboard className="h-7 w-7" style={{ color: "#ef4444" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#ef4444" }}>{resolveError || "Animation not found"}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--aw-text-3)" }}>
              The animation could not be loaded. The source project may have been deleted.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/animations")}
            className="gap-2"
            style={{ borderColor: "var(--aw-border-strong)", color: "var(--aw-text-2)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Animations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AnimationProvider projectId={sourceProjectId} userId={user.id} animationId={animId}>
      <AnimateContent />
    </AnimationProvider>
  );
}
