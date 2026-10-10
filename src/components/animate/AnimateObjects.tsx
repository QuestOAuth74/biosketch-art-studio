import { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
  Search,
  Layers,
  Plus,
  Package,
  ImageIcon,
  FolderPlus,
  FolderOpen,
  FolderClosed,
  Ungroup,
  ChevronDown,
  ChevronRight,
  ListOrdered,
  Route,
} from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface IconRecord {
  id: string;
  name: string;
  category: string;
  thumbnail: string | null;
  svg_content: string | null;
}

interface IconCategory {
  id: string;
  name: string;
}

type Tab = "objects" | "icons";

// ─── Object Row ─────────────────────────────────────────────────────────────

function ObjectRow({
  trackId,
  name,
  objectType,
  visible,
  locked,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  availablePaths,
  onFollowPath,
}: {
  trackId: string;
  name: string;
  objectType: string;
  visible: boolean;
  locked: boolean;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  availablePaths: { id: string; name: string }[];
  onFollowPath: (targetTrackId: string, pathTrackId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPathMenu, setShowPathMenu] = useState(false);
  const pathMenuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: trackId });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeBadge = objectType.replace(/^(Group|Image|Path|Rect|Circle|Textbox|Polygon|Ellipse|Line)$/i, (m) =>
    m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...sortableStyle,
        background: isSelected ? "var(--aw-accent-glow)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--aw-accent)" : "2px solid transparent",
      }}
      className="flex items-center gap-1 px-1.5 py-0.5 cursor-pointer transition-colors group"
      onClick={(e) => onSelect(e)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(139,92,246,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Drag handle */}
      <button
        className="p-0.5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
      </button>

      {/* Visibility */}
      <button
        className="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        title={visible ? "Hide" : "Show"}
      >
        {visible ? (
          <Eye className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
        ) : (
          <EyeOff className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
        )}
      </button>

      {/* Lock */}
      <button
        className="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        title={locked ? "Unlock" : "Lock"}
      >
        {locked ? (
          <Lock className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
        ) : (
          <Unlock className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
        )}
      </button>

      {/* Name + type */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span
          className="text-[13px] truncate leading-tight"
          style={{
            color: isSelected ? "var(--aw-text)" : "var(--aw-text-2)",
            fontWeight: isSelected ? 600 : 400,
          }}
        >
          {name}
        </span>
        <span
          className="text-[10px] font-medium px-1 py-px rounded shrink-0"
          style={{
            background: "var(--aw-accent-dim)",
            color: "var(--aw-accent)",
          }}
        >
          {typeBadge}
        </span>
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 relative">
        {/* Follow Path button — only show for non-path objects when paths exist */}
        {availablePaths.length > 0 && objectType.toLowerCase() !== "path" && (
          <div className="relative" ref={pathMenuRef}>
            <button
              className="p-0.5 rounded hover:bg-[rgba(139,92,246,0.1)]"
              onClick={(e) => {
                e.stopPropagation();
                setShowPathMenu((v) => !v);
              }}
              title="Follow path..."
            >
              <Route className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
            </button>
            {showPathMenu && (
              <div
                className="absolute right-0 top-full mt-0.5 z-50 min-w-[120px] rounded shadow-lg py-0.5"
                style={{
                  background: "var(--aw-surface)",
                  border: "1px solid var(--aw-border)",
                }}
                onMouseLeave={() => setShowPathMenu(false)}
              >
                <div
                  className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--aw-text-3)", borderBottom: "1px solid var(--aw-border)" }}
                >
                  Follow path
                </div>
                {availablePaths.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-2 py-1 text-[12px] transition-colors hover:bg-[rgba(139,92,246,0.08)]"
                    style={{ color: "var(--aw-text-2)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowPath(trackId, p.id);
                      setShowPathMenu(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {confirmDelete ? (
          <button
            className="px-1 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setConfirmDelete(false);
            }}
            onBlur={() => setConfirmDelete(false)}
          >
            Delete?
          </button>
        ) : (
          <button
            className="p-0.5 rounded hover:bg-[rgba(239,68,68,0.1)]"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            title="Delete object"
          >
            <Trash2 className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Icon Library ───────────────────────────────────────────────────────────

function IconLibrary({
  onAddIcon,
}: {
  onAddIcon: (svgData: string, iconName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<IconCategory[]>([]);
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch categories on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("icon_categories")
        .select("id, name")
        .order("name");
      if (data) setCategories(data);
    })();
  }, []);

  // Fetch icons when search or category changes
  const fetchIcons = useCallback(async () => {
    setLoadingIcons(true);
    try {
      let query = supabase
        .from("icons")
        .select("id, name, category, thumbnail, svg_content")
        .order("created_at", { ascending: false })
        .range(0, 29);

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      if (category) {
        query = query.eq("category", category);
      }

      const { data } = await query;
      if (data) setIcons(data);
    } finally {
      setLoadingIcons(false);
    }
  }, [search, category]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchIcons, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchIcons]);

  const handleClickIcon = async (icon: IconRecord) => {
    setAddingId(icon.id);
    try {
      let svgContent = icon.svg_content;

      // If svg_content wasn't loaded, fetch full record
      if (!svgContent) {
        const { data } = await supabase
          .from("icons")
          .select("svg_content")
          .eq("id", icon.id)
          .single();
        svgContent = data?.svg_content ?? null;
      }

      if (!svgContent) {
        return;
      }

      onAddIcon(svgContent, icon.name);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 pt-2 pb-1.5">
        <div
          className="flex items-center gap-1.5 px-2 h-7 rounded"
          style={{
            background: "var(--aw-bg)",
            border: "1px solid var(--aw-border)",
          }}
        >
          <Search className="h-3 w-3 shrink-0" style={{ color: "var(--aw-text-3)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: "var(--aw-text)" }}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="px-2 pb-1.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-6 rounded text-[12px] px-1.5 outline-none"
          style={{
            background: "var(--aw-bg)",
            border: "1px solid var(--aw-border)",
            color: "var(--aw-text-2)",
          }}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Icon grid */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-2"
        style={{
          scrollbarColor: "rgba(139,92,246,0.12) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {loadingIcons ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-[12px]" style={{ color: "var(--aw-text-3)" }}>
              Loading...
            </span>
          </div>
        ) : icons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-2">
            <Package className="h-6 w-6 mb-2" style={{ color: "var(--aw-text-3)" }} />
            <span className="text-[12px]" style={{ color: "var(--aw-text-3)" }}>
              No icons found
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {icons.map((icon) => (
              <button
                key={icon.id}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded transition-colors"
                style={{
                  border: "1px solid var(--aw-border)",
                  background: addingId === icon.id ? "var(--aw-accent-dim)" : "var(--aw-bg)",
                }}
                onClick={() => handleClickIcon(icon)}
                disabled={addingId !== null}
                onMouseEnter={(e) => {
                  if (addingId !== icon.id) e.currentTarget.style.borderColor = "var(--aw-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--aw-border)";
                }}
                title={icon.name}
              >
                {icon.thumbnail ? (
                  <img
                    src={icon.thumbnail}
                    alt={icon.name}
                    className="w-6 h-6 object-contain"
                    style={{ border: "1px solid var(--aw-border)", borderRadius: 3 }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 flex items-center justify-center rounded"
                    style={{
                      background: "var(--aw-accent-dim)",
                      border: "1px solid var(--aw-border)",
                    }}
                  >
                    <ImageIcon className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
                  </div>
                )}
                <span
                  className="text-[10px] truncate w-full text-center leading-tight"
                  style={{ color: "var(--aw-text-3)" }}
                >
                  {icon.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AnimateObjects() {
  const {
    animProject,
    objectMapRef,
    selectedTrackId,
    setSelectedTrackId,
    toggleTrackVisibility,
    toggleTrackLock,
    removeObject,
    reorderTracksByIds,
    addObjectToCanvas,
    createTrackGroup,
    removeTrackGroup,
    renameTrackGroup,
    addTracksToGroup,
    removeTrackFromGroup,
    toggleGroupCollapsed,
    staggerEntranceForGroup,
    currentFrame,
    applyPathFollow,
    getPathTrackIds,
  } = useAnimation();

  const [activeTab, setActiveTab] = useState<Tab>("objects");
  const [multiSelect, setMultiSelect] = useState<Set<string>>(new Set());
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const tracks = animProject?.tracks ?? [];
  const groups = animProject?.trackGroups ?? [];
  const trackIds = tracks.map((t) => t.objectId);
  const availablePaths = getPathTrackIds();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderTracksByIds(active.id as string, over.id as string);
      }
    },
    [reorderTracksByIds]
  );

  const handleAddIcon = useCallback(
    (svgData: string, iconName: string) => {
      addObjectToCanvas(svgData, iconName);
    },
    [addObjectToCanvas]
  );

  const handleSelect = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle multi-select
        setMultiSelect((prev) => {
          const next = new Set(prev);
          if (next.has(trackId)) next.delete(trackId);
          else next.add(trackId);
          return next;
        });
      } else if (e.shiftKey && selectedTrackId) {
        // Range select
        const startIdx = tracks.findIndex((t) => t.objectId === selectedTrackId);
        const endIdx = tracks.findIndex((t) => t.objectId === trackId);
        if (startIdx >= 0 && endIdx >= 0) {
          const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const range = tracks.slice(lo, hi + 1).map((t) => t.objectId);
          setMultiSelect(new Set(range));
        }
      } else {
        setMultiSelect(new Set());
        setSelectedTrackId(trackId);
      }
    },
    [selectedTrackId, tracks, setSelectedTrackId]
  );

  const handleCreateGroup = useCallback(() => {
    const ids = Array.from(multiSelect);
    if (ids.length < 2) return;
    createTrackGroup("New Group", ids);
    setMultiSelect(new Set());
  }, [multiSelect, createTrackGroup]);

  const handleStaggerEntrance = useCallback(
    (ids: string[]) => {
      if (ids.length < 2) return;
      staggerEntranceForGroup(ids, 10, currentFrame);
    },
    [staggerEntranceForGroup, currentFrame]
  );

  const handleStartRename = (groupId: string, currentName: string) => {
    setRenamingGroup(groupId);
    setRenameValue(currentName);
  };

  const handleFinishRename = (groupId: string) => {
    if (renameValue.trim()) {
      renameTrackGroup(groupId, renameValue.trim());
    }
    setRenamingGroup(null);
  };

  // Organize tracks by group
  const ungroupedTracks = tracks.filter((t) => !t.groupId);
  const groupedTracksMap = new Map<string, typeof tracks>();
  for (const t of tracks) {
    if (t.groupId) {
      if (!groupedTracksMap.has(t.groupId)) groupedTracksMap.set(t.groupId, []);
      groupedTracksMap.get(t.groupId)!.push(t);
    }
  }

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
        <Layers className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
        <span
          className="text-[12px] font-semibold tracking-[0.1em] uppercase flex-1"
          style={{ color: "var(--aw-text-3)" }}
        >
          Objects
        </span>
        {multiSelect.size >= 2 && (
          <>
            <button
              className="p-0.5 rounded hover:bg-[rgba(139,92,246,0.1)] transition-colors"
              onClick={() => handleStaggerEntrance(Array.from(multiSelect))}
              title="Stagger entrance (auto-sequence)"
            >
              <ListOrdered className="h-3.5 w-3.5" style={{ color: "var(--aw-accent)" }} />
            </button>
            <button
              className="p-0.5 rounded hover:bg-[rgba(139,92,246,0.1)] transition-colors"
              onClick={handleCreateGroup}
              title="Group selected objects"
            >
              <FolderPlus className="h-3.5 w-3.5" style={{ color: "var(--aw-accent)" }} />
            </button>
          </>
        )}
        <button
          className="p-0.5 rounded hover:bg-[rgba(139,92,246,0.1)] transition-colors"
          onClick={() => setActiveTab("icons")}
          title="Import icon"
        >
          <Plus className="h-3.5 w-3.5" style={{ color: "var(--aw-accent)" }} />
        </button>
      </div>

      {/* Multi-select hint */}
      {multiSelect.size > 0 && (
        <div
          className="px-3 py-1 text-[11px] flex items-center justify-between"
          style={{
            background: "rgba(139,92,246,0.06)",
            borderBottom: "1px solid var(--aw-border)",
            color: "var(--aw-accent)",
          }}
        >
          <span>{multiSelect.size} selected (Ctrl+click to toggle)</span>
          <button onClick={() => setMultiSelect(new Set())} className="opacity-60 hover:opacity-100">
            Clear
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        {(["objects", "icons"] as const).map((tab) => (
          <button
            key={tab}
            className="flex-1 py-1.5 text-[12px] font-semibold tracking-wide uppercase transition-colors"
            style={{
              color: activeTab === tab ? "var(--aw-accent)" : "var(--aw-text-3)",
              borderBottom: activeTab === tab ? "2px solid var(--aw-accent)" : "2px solid transparent",
              background: activeTab === tab ? "var(--aw-accent-glow)" : "transparent",
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "objects" ? "Objects" : "Icons"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{
          scrollbarColor: "rgba(139,92,246,0.12) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {activeTab === "objects" ? (
          tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: "rgba(139,92,246,0.05)",
                  border: "1px dashed var(--aw-border-strong)",
                }}
              >
                <Layers className="h-4 w-4" style={{ color: "var(--aw-text-3)" }} />
              </div>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--aw-text-3)" }}
              >
                No objects on canvas
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
                <div className="py-1">
                  {/* Groups */}
                  {groups.map((group) => {
                    const groupTracks = groupedTracksMap.get(group.id) ?? [];
                    return (
                      <div key={group.id}>
                        {/* Group header */}
                        <div
                          className="flex items-center gap-1 px-1.5 py-1 cursor-pointer transition-colors group/hdr"
                          style={{
                            background: "rgba(139,92,246,0.04)",
                            borderBottom: "1px solid var(--aw-border)",
                          }}
                          onClick={() => toggleGroupCollapsed(group.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(139,92,246,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(139,92,246,0.04)";
                          }}
                        >
                          {group.collapsed ? (
                            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "var(--aw-text-3)" }} />
                          ) : (
                            <ChevronDown className="h-3 w-3 shrink-0" style={{ color: "var(--aw-text-3)" }} />
                          )}
                          {group.collapsed ? (
                            <FolderClosed className="h-3 w-3 shrink-0" style={{ color: "var(--aw-accent)" }} />
                          ) : (
                            <FolderOpen className="h-3 w-3 shrink-0" style={{ color: "var(--aw-accent)" }} />
                          )}
                          {renamingGroup === group.id ? (
                            <input
                              className="flex-1 bg-transparent text-[12px] outline-none px-1"
                              style={{ color: "var(--aw-text)", borderBottom: "1px solid var(--aw-accent)" }}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleFinishRename(group.id);
                                if (e.key === "Escape") setRenamingGroup(null);
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              onBlur={() => handleFinishRename(group.id)}
                            />
                          ) : (
                            <span
                              className="text-[12px] font-semibold flex-1 truncate"
                              style={{ color: "var(--aw-text-2)" }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(group.id, group.name);
                              }}
                            >
                              {group.name}
                            </span>
                          )}
                          <span className="text-[10px] opacity-50" style={{ color: "var(--aw-text-3)" }}>
                            {groupTracks.length}
                          </span>
                          <button
                            className="p-0.5 rounded opacity-0 group-hover/hdr:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStaggerEntrance(groupTracks.map((t) => t.objectId));
                            }}
                            title="Stagger entrance (auto-sequence)"
                          >
                            <ListOrdered className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
                          </button>
                          <button
                            className="p-0.5 rounded opacity-0 group-hover/hdr:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTrackGroup(group.id);
                            }}
                            title="Ungroup (keeps objects)"
                          >
                            <Ungroup className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
                          </button>
                        </div>
                        {/* Group children */}
                        {!group.collapsed &&
                          groupTracks.map((track) => (
                            <div key={track.objectId} style={{ paddingLeft: 12 }}>
                              <ObjectRow
                                trackId={track.objectId}
                                name={track.objectName}
                                objectType={track.objectType}
                                visible={track.visible}
                                locked={track.locked}
                                isSelected={selectedTrackId === track.objectId || multiSelect.has(track.objectId)}
                                onSelect={(e) => handleSelect(track.objectId, e)}
                                onToggleVisibility={() => toggleTrackVisibility(track.objectId)}
                                onToggleLock={() => toggleTrackLock(track.objectId)}
                                onDelete={() => removeObject(track.objectId)}
                                availablePaths={availablePaths.filter((p) => p.id !== track.objectId)}
                                onFollowPath={applyPathFollow}
                              />
                            </div>
                          ))}
                      </div>
                    );
                  })}
                  {/* Ungrouped tracks */}
                  {ungroupedTracks.map((track) => (
                    <ObjectRow
                      key={track.objectId}
                      trackId={track.objectId}
                      name={track.objectName}
                      objectType={track.objectType}
                      visible={track.visible}
                      locked={track.locked}
                      isSelected={selectedTrackId === track.objectId || multiSelect.has(track.objectId)}
                      onSelect={(e) => handleSelect(track.objectId, e)}
                      onToggleVisibility={() => toggleTrackVisibility(track.objectId)}
                      onToggleLock={() => toggleTrackLock(track.objectId)}
                      onDelete={() => removeObject(track.objectId)}
                      availablePaths={availablePaths.filter((p) => p.id !== track.objectId)}
                      onFollowPath={applyPathFollow}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )
        ) : (
          <IconLibrary onAddIcon={handleAddIcon} />
        )}
      </div>
    </div>
  );
}
