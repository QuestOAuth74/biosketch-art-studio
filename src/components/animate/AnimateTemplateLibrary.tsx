import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  BookTemplate,
  Search,
  Play,
  Save,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  Move,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAnimation } from "@/contexts/AnimationContext";
import {
  type AnimationTemplate,
  BUILT_IN_TEMPLATES,
  loadCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  applyTemplate,
  createTemplateFromTrack,
  getAllTemplates,
} from "@/lib/animationTemplates";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "entrance", label: "Entrance" },
  { id: "exit", label: "Exit" },
  { id: "emphasis", label: "Emphasis" },
  { id: "motion", label: "Motion" },
  { id: "custom", label: "My Templates" },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  entrance: "↗",
  exit: "↙",
  emphasis: "✦",
  motion: "⟳",
  custom: "★",
};

// ─── Animation Preview Thumbnail ──────────────────────────────────────────
// Renders a tiny canvas showing a looping preview of the template's keyframes.

const PREVIEW_W = 60;
const PREVIEW_H = 40;
const PREVIEW_LOOP_MS = 2000; // loop duration in real time

function TemplatePreview({ template, anchorEl }: { template: AnimationTemplate; anchorEl: HTMLElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Position the preview relative to the anchor element
  useEffect(() => {
    if (!anchorEl || !containerRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const el = containerRef.current;
    el.style.position = "fixed";
    el.style.left = `${rect.right + 6}px`;
    el.style.top = `${rect.top + rect.height / 2}px`;
    el.style.transform = "translateY(-50%)";
  }, [anchorEl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pre-compute normalized keyframes with all interpolatable properties
    const kfs = template.keyframes.map((kf) => ({
      t: template.durationFrames > 0 ? kf.frameOffset / template.durationFrames : 0,
      left: kf.properties.left ?? null,
      top: kf.properties.top ?? null,
      scaleX: kf.properties.scaleX ?? null,
      scaleY: kf.properties.scaleY ?? null,
      opacity: kf.properties.opacity ?? null,
      angle: kf.properties.angle ?? null,
    }));

    // Collect which properties are actually animated
    const props = ["left", "top", "scaleX", "scaleY", "opacity", "angle"] as const;
    const animated = props.filter((p) => kfs.some((k) => k[p] !== null));

    // For each animated property, build a dense list of {t, value} for interpolation
    type PropTimeline = { t: number; value: number }[];
    const timelines: Partial<Record<(typeof props)[number], PropTimeline>> = {};
    for (const p of animated) {
      timelines[p] = kfs.filter((k) => k[p] !== null).map((k) => ({ t: k.t, value: k[p] as number }));
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function sampleTimeline(tl: PropTimeline, t: number): number {
      if (tl.length === 0) return 0;
      if (t <= tl[0].t) return tl[0].value;
      if (t >= tl[tl.length - 1].t) return tl[tl.length - 1].value;
      for (let i = 0; i < tl.length - 1; i++) {
        if (t >= tl[i].t && t <= tl[i + 1].t) {
          const seg = (t - tl[i].t) / (tl[i + 1].t - tl[i].t || 1);
          return lerp(tl[i].value, tl[i + 1].value, seg);
        }
      }
      return tl[tl.length - 1].value;
    }

    // Determine ranges for position mapping
    let minLeft = 0, maxLeft = 0, minTop = 0, maxTop = 0;
    if (timelines.left) {
      const vals = timelines.left.map((e) => e.value);
      minLeft = Math.min(...vals);
      maxLeft = Math.max(...vals);
    }
    if (timelines.top) {
      const vals = timelines.top.map((e) => e.value);
      minTop = Math.min(...vals);
      maxTop = Math.max(...vals);
    }
    const rangeLeft = maxLeft - minLeft || 1;
    const rangeTop = maxTop - minTop || 1;

    // Padding inside the preview
    const pad = 10;
    const innerW = PREVIEW_W - pad * 2;
    const innerH = PREVIEW_H - pad * 2;

    startRef.current = 0;

    function draw(timestamp: number) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const t = (elapsed % PREVIEW_LOOP_MS) / PREVIEW_LOOP_MS; // 0..1

      // Sample all properties
      const leftVal = timelines.left ? sampleTimeline(timelines.left, t) : 0;
      const topVal = timelines.top ? sampleTimeline(timelines.top, t) : 0;
      const scaleXVal = timelines.scaleX ? sampleTimeline(timelines.scaleX, t) : 1;
      const scaleYVal = timelines.scaleY ? sampleTimeline(timelines.scaleY, t) : 1;
      const opacityVal = timelines.opacity ? sampleTimeline(timelines.opacity, t) : 1;
      const angleVal = timelines.angle ? sampleTimeline(timelines.angle, t) : 0;

      // Map position into preview space
      const x = timelines.left
        ? pad + ((leftVal - minLeft) / rangeLeft) * innerW
        : PREVIEW_W / 2;
      const y = timelines.top
        ? pad + ((topVal - minTop) / rangeTop) * innerH
        : PREVIEW_H / 2;

      ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

      // Faint border
      ctx.strokeStyle = "rgba(139,92,246,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, PREVIEW_W - 1, PREVIEW_H - 1);

      // Draw animated shape
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacityVal));
      ctx.translate(x, y);
      ctx.rotate((angleVal * Math.PI) / 180);
      ctx.scale(
        Math.max(0.1, Math.min(3, scaleXVal)),
        Math.max(0.1, Math.min(3, scaleYVal))
      );
      ctx.fillStyle = "rgba(139, 92, 246, 0.85)";
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [template]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        zIndex: 9999,
        background: "rgba(15, 15, 20, 0.95)",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: 6,
        padding: 3,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        style={{ display: "block", borderRadius: 3 }}
      />
    </div>
  );
}

export function AnimateTemplateLibrary() {
  const {
    selectedTrack,
    currentFrame,
    animProject,
    objectMapRef,
    applyKeyframesToTrack,
  } = useAnimation();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["entrance", "emphasis", "motion"])
  );
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [customTemplates, setCustomTemplates] = useState(() => loadCustomTemplates());
  const [hoveredTemplate, setHoveredTemplate] = useState<{ id: string; el: HTMLElement } | null>(null);

  const allTemplates = useMemo(() => {
    const templates = [...BUILT_IN_TEMPLATES, ...customTemplates];
    let filtered = templates;

    if (category !== "all") {
      filtered = filtered.filter((t) => t.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [category, search, customTemplates]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, AnimationTemplate[]> = {};
    for (const t of allTemplates) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [allTemplates]);

  const handleApplyTemplate = useCallback(
    (template: AnimationTemplate) => {
      if (!selectedTrack || !animProject) {
        toast.error("Select a track first");
        return;
      }

      const obj = objectMapRef.current.get(selectedTrack.objectId);
      const currentProps = obj
        ? {
            left: obj.left ?? 0,
            top: obj.top ?? 0,
            scaleX: obj.scaleX ?? 1,
            scaleY: obj.scaleY ?? 1,
            angle: obj.angle ?? 0,
            opacity: obj.opacity ?? 1,
          }
        : {};

      const keyframes = applyTemplate(
        template,
        currentFrame,
        currentProps,
        animProject.fps
      );

      // Apply keyframes through the context (proper state management)
      applyKeyframesToTrack(selectedTrack.objectId, keyframes);

      // Apply the first keyframe's properties to the object visually
      if (obj && keyframes.length > 0) {
        for (const [prop, val] of Object.entries(keyframes[0].properties)) {
          if (val !== undefined) {
            (obj as any).set(prop, val);
          }
        }
        obj.setCoords();
      }

      toast.success(`Applied "${template.name}" template`);
    },
    [selectedTrack, currentFrame, animProject, objectMapRef]
  );

  const handleSaveAsTemplate = useCallback(() => {
    if (!selectedTrack || !templateName.trim()) return;

    try {
      const template = createTemplateFromTrack(
        templateName.trim(),
        selectedTrack.keyframes
      );
      saveCustomTemplate(template);
      setCustomTemplates(loadCustomTemplates());
      setSavingTemplate(false);
      setTemplateName("");
      toast.success(`Saved template "${template.name}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  }, [selectedTrack, templateName]);

  const handleDeleteCustomTemplate = useCallback((id: string) => {
    deleteCustomTemplate(id);
    setCustomTemplates(loadCustomTemplates());
    toast.success("Template deleted");
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: "var(--aw-surface)",
        backdropFilter: "var(--aw-glass-blur)",
        WebkitBackdropFilter: "var(--aw-glass-blur)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        <BookTemplate
          className="h-3 w-3"
          style={{ color: "var(--aw-text-3)" }}
        />
        <span
          className="text-[12px] font-semibold tracking-[0.1em] uppercase"
          style={{ color: "var(--aw-text-3)" }}
        >
          Templates
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--aw-border)" }}>
        <div
          className="flex items-center gap-2 h-7 px-2 rounded-md"
          style={{
            background: "var(--aw-bg)",
            border: "1px solid var(--aw-border)",
          }}
        >
          <Search className="h-3 w-3 shrink-0" style={{ color: "var(--aw-text-3)" }} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: "var(--aw-text)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
              style={{
                background:
                  category === cat.id
                    ? "rgba(139,92,246,0.15)"
                    : "transparent",
                color:
                  category === cat.id
                    ? "var(--aw-accent)"
                    : "var(--aw-text-3)",
                border: `1px solid ${
                  category === cat.id
                    ? "rgba(139,92,246,0.3)"
                    : "var(--aw-border)"
                }`,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarColor: "rgba(139,92,246,0.12) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {Object.entries(groupedTemplates).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-6 text-center">
            <BookTemplate className="h-8 w-8 mb-2" style={{ color: "var(--aw-text-3)", opacity: 0.3 }} />
            <p className="text-[13px]" style={{ color: "var(--aw-text-3)" }}>
              No templates found
            </p>
          </div>
        ) : (
          Object.entries(groupedTemplates).map(([cat, templates]) => {
            const isExpanded = expandedCategories.has(cat);
            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: "var(--aw-text-3)",
                    background: "rgba(139,92,246,0.03)",
                    borderBottom: "1px solid var(--aw-border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.03)";
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-2.5 w-2.5" />
                  ) : (
                    <ChevronRight className="h-2.5 w-2.5" />
                  )}
                  <span>{CATEGORY_ICONS[cat] || "•"}</span>
                  {cat}
                  <span className="ml-auto text-[10px] opacity-50 normal-case tracking-normal">
                    {templates.length}
                  </span>
                </button>

                {isExpanded &&
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-2 px-3 py-2 transition-colors group"
                      style={{
                        borderBottom: "1px solid var(--aw-border)",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(139,92,246,0.04)";
                        setHoveredTemplate({ id: template.id, el: e.currentTarget });
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        setHoveredTemplate(null);
                      }}
                    >
                      {hoveredTemplate?.id === template.id && (
                        <TemplatePreview template={template} anchorEl={hoveredTemplate.el} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--aw-text)" }}
                        >
                          {template.name}
                        </p>
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "var(--aw-text-3)" }}
                        >
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--aw-text-3)" }}
                          >
                            {template.durationFrames}f
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--aw-text-3)" }}
                          >
                            {template.keyframes.length} keys
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleApplyTemplate(template)}
                          disabled={!selectedTrack}
                          className="h-6 px-2 rounded text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-25"
                          style={{
                            background: "var(--aw-accent-dim)",
                            color: "var(--aw-accent)",
                            border: "1px solid rgba(139,92,246,0.15)",
                          }}
                          title="Apply to selected track"
                        >
                          <Play className="h-2.5 w-2.5" />
                          Apply
                        </button>

                        {template.category === "custom" && (
                          <button
                            onClick={() =>
                              handleDeleteCustomTemplate(template.id)
                            }
                            className="h-6 w-6 rounded flex items-center justify-center transition-colors"
                            style={{ color: "#ef4444" }}
                            title="Delete template"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })
        )}
      </div>

      {/* Save current animation as template */}
      <div
        className="px-3 py-2.5 shrink-0"
        style={{ borderTop: "1px solid var(--aw-border)" }}
      >
        {savingTemplate ? (
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Template name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsTemplate();
                if (e.key === "Escape") setSavingTemplate(false);
              }}
              autoFocus
              className="w-full h-7 px-2 rounded-md text-[13px] outline-none"
              style={{
                background: "var(--aw-bg)",
                border: "1px solid var(--aw-accent)",
                color: "var(--aw-text)",
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim() || !selectedTrack}
                className="flex-1 h-6 rounded text-[12px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-30"
                style={{
                  background: "var(--aw-accent-dim)",
                  color: "var(--aw-accent)",
                  border: "1px solid rgba(139,92,246,0.15)",
                }}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={() => {
                  setSavingTemplate(false);
                  setTemplateName("");
                }}
                className="flex-1 h-6 rounded text-[12px] font-medium transition-colors"
                style={{
                  color: "var(--aw-text-3)",
                  border: "1px solid var(--aw-border)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSavingTemplate(true)}
            disabled={!selectedTrack || (selectedTrack?.keyframes.length ?? 0) < 2}
            className="w-full h-8 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-25"
            style={{
              background: "var(--aw-accent-dim)",
              color: "var(--aw-accent)",
              border: "1px solid rgba(139,92,246,0.18)",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = "rgba(139,92,246,0.18)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--aw-accent-dim)";
            }}
          >
            <Save className="h-3.5 w-3.5" />
            Save Current as Template
          </button>
        )}
      </div>
    </div>
  );
}
