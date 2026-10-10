import { useState, useMemo, useCallback } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  MoveRight,
  MessageSquare,
  Crosshair,
  Atom,
  Dna,
  BarChart3,
  Layers,
  Plus,
} from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import {
  MOTION_GRAPHICS,
  MOTION_GRAPHIC_CATEGORIES,
  type MotionGraphicCategory,
  type MotionGraphicDef,
} from "@/lib/motionGraphicsLibrary";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "arrows-flow": <MoveRight className="h-2.5 w-2.5" />,
  "callouts-labels": <MessageSquare className="h-2.5 w-2.5" />,
  highlights: <Crosshair className="h-2.5 w-2.5" />,
  molecular: <Atom className="h-2.5 w-2.5" />,
  cellular: <Dna className="h-2.5 w-2.5" />,
  "data-graphs": <BarChart3 className="h-2.5 w-2.5" />,
  transitions: <Layers className="h-2.5 w-2.5" />,
  particles: <Sparkles className="h-2.5 w-2.5" />,
};

export function MotionGraphicsPanel() {
  const { insertMotionGraphic } = useAnimation();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(MOTION_GRAPHIC_CATEGORIES.map((c) => c.id))
  );

  const filtered = useMemo(() => {
    let items = MOTION_GRAPHICS;
    if (activeCategory !== "all") {
      items = items.filter((m) => m.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, MotionGraphicDef[]> = {};
    for (const m of filtered) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleInsert = useCallback(
    (def: MotionGraphicDef) => {
      insertMotionGraphic(def.id);
    },
    [insertMotionGraphic]
  );

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
        <Sparkles className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
        <span
          className="text-[12px] font-semibold tracking-[0.1em] uppercase"
          style={{ color: "var(--aw-text-3)" }}
        >
          Motion Graphics
        </span>
        <span
          className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full"
          style={{
            background: "var(--aw-accent-dim)",
            color: "var(--aw-accent)",
          }}
        >
          {MOTION_GRAPHICS.length}
        </span>
      </div>

      {/* Search */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        <div
          className="flex items-center gap-2 h-7 px-2 rounded-md"
          style={{
            background: "var(--aw-bg)",
            border: "1px solid var(--aw-border)",
          }}
        >
          <Search
            className="h-3 w-3 shrink-0"
            style={{ color: "var(--aw-text-3)" }}
          />
          <input
            type="text"
            placeholder="Search motion graphics..."
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

        {/* Category filter pills */}
        <div className="flex gap-1 mt-2 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background:
                activeCategory === "all"
                  ? "rgba(139,92,246,0.15)"
                  : "transparent",
              color:
                activeCategory === "all"
                  ? "var(--aw-accent)"
                  : "var(--aw-text-3)",
              border: `1px solid ${
                activeCategory === "all"
                  ? "rgba(139,92,246,0.3)"
                  : "var(--aw-border)"
              }`,
            }}
          >
            All
          </button>
          {MOTION_GRAPHIC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1"
              style={{
                background:
                  activeCategory === cat.id
                    ? "rgba(139,92,246,0.15)"
                    : "transparent",
                color:
                  activeCategory === cat.id
                    ? "var(--aw-accent)"
                    : "var(--aw-text-3)",
                border: `1px solid ${
                  activeCategory === cat.id
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

      {/* Motion graphics list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarColor: "rgba(139,92,246,0.12) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {Object.entries(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-6 text-center">
            <Sparkles
              className="h-8 w-8 mb-2"
              style={{ color: "var(--aw-text-3)", opacity: 0.3 }}
            />
            <p className="text-[13px]" style={{ color: "var(--aw-text-3)" }}>
              No motion graphics found
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => {
            const catMeta = MOTION_GRAPHIC_CATEGORIES.find(
              (c) => c.id === cat
            );
            const isExpanded = expandedCategories.has(cat);
            return (
              <div key={cat}>
                {/* Category header */}
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
                  {CATEGORY_ICONS[cat] || (
                    <Sparkles className="h-2.5 w-2.5" />
                  )}
                  {catMeta?.label || cat}
                  <span className="ml-auto text-[10px] opacity-50 normal-case tracking-normal">
                    {items.length}
                  </span>
                </button>

                {/* Items */}
                {isExpanded &&
                  items.map((mg) => (
                    <div
                      key={mg.id}
                      className="flex items-center gap-2 px-3 py-2 transition-colors group"
                      style={{
                        borderBottom: "1px solid var(--aw-border)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(139,92,246,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--aw-text)" }}
                        >
                          {mg.name}
                        </p>
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "var(--aw-text-3)" }}
                        >
                          {mg.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--aw-text-3)" }}
                          >
                            {mg.objects.length} objects
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--aw-text-3)" }}
                          >
                            {mg.durationFrames}f
                          </span>
                        </div>
                      </div>

                      {/* Insert button */}
                      <button
                        onClick={() => handleInsert(mg)}
                        className="h-6 px-2 rounded text-[11px] font-medium flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100"
                        style={{
                          background: "var(--aw-accent-dim)",
                          color: "var(--aw-accent)",
                          border: "1px solid rgba(139,92,246,0.15)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(139,92,246,0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "var(--aw-accent-dim)";
                        }}
                        title="Insert onto canvas"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        Insert
                      </button>
                    </div>
                  ))}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ borderTop: "1px solid var(--aw-border)" }}
      >
        <p
          className="text-[11px] text-center leading-relaxed"
          style={{ color: "var(--aw-text-3)", opacity: 0.6 }}
        >
          Motion graphics insert pre-animated shapes at canvas center.
          Reposition and retime as needed.
        </p>
      </div>
    </div>
  );
}
