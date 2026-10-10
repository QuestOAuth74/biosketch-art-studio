import { useState, useCallback } from "react";
import {
  Bone,
  Crosshair,
  Link,
  Unlink,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAnimation } from "@/contexts/AnimationContext";

export function RigPanel() {
  const {
    rigs,
    rigMode,
    setRigMode,
    selectedTrackId,
    animProject,
    decomposeSVGForRig,
    addAnchorToRig,
    removeAnchorFromRig,
    setAnchorParent,
    renameAnchor,
    removeRig,
  } = useAnimation();

  const [expandedRigs, setExpandedRigs] = useState<Set<string>>(new Set());
  const [editingAnchor, setEditingAnchor] = useState<{
    rigId: string;
    anchorId: string;
  } | null>(null);
  const [anchorName, setAnchorName] = useState("");
  const [linkingAnchor, setLinkingAnchor] = useState<{
    rigId: string;
    anchorId: string;
  } | null>(null);

  const toggleRig = (rigId: string) => {
    setExpandedRigs((prev) => {
      const next = new Set(prev);
      if (next.has(rigId)) next.delete(rigId);
      else next.add(rigId);
      return next;
    });
  };

  // Find the selected track's rig (if any)
  const selectedRig = rigs.find(
    (r) =>
      r.partIds.includes(selectedTrackId ?? "") ||
      r.sourceObjectId === selectedTrackId
  );

  const handleDecompose = useCallback(() => {
    if (!selectedTrackId) {
      toast.error("Select an SVG icon first");
      return;
    }
    decomposeSVGForRig(selectedTrackId);
  }, [selectedTrackId, decomposeSVGForRig]);

  const handleStartLink = (rigId: string, anchorId: string) => {
    if (linkingAnchor?.anchorId === anchorId) {
      setLinkingAnchor(null);
      return;
    }

    if (linkingAnchor && linkingAnchor.rigId === rigId) {
      // Complete the link: set the first anchor as parent of the second
      setAnchorParent(rigId, anchorId, linkingAnchor.anchorId);
      setLinkingAnchor(null);
      toast.success("Bone linked");
      return;
    }

    setLinkingAnchor({ rigId, anchorId });
    toast.info("Click another anchor to link as parent");
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
        <Bone className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
        <span
          className="text-[12px] font-semibold tracking-[0.1em] uppercase"
          style={{ color: "var(--aw-text-3)" }}
        >
          Skeletal Rig
        </span>
        {rigs.length > 0 && (
          <span
            className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--aw-accent-dim)",
              color: "var(--aw-accent)",
            }}
          >
            {rigs.length}
          </span>
        )}
      </div>

      {/* Rig mode toggle */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        <button
          onClick={() => setRigMode(!rigMode)}
          className="w-full h-7 rounded-md text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: rigMode ? "rgba(139,92,246,0.2)" : "var(--aw-accent-dim)",
            color: rigMode ? "#c4b5fd" : "var(--aw-accent)",
            border: `1px solid ${rigMode ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.15)"}`,
          }}
        >
          <Crosshair className="h-3 w-3" />
          {rigMode ? "Exit Rig Mode" : "Enter Rig Mode"}
        </button>

        {rigMode && (
          <p
            className="text-[11px] mt-1.5 leading-relaxed text-center"
            style={{ color: "var(--aw-text-3)" }}
          >
            Click on anchor points to reposition. Drag to move joints.
          </p>
        )}
      </div>

      {/* Decompose button */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        <button
          onClick={handleDecompose}
          disabled={!selectedTrackId}
          className="w-full h-8 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-25"
          style={{
            background: "var(--aw-accent-dim)",
            color: "var(--aw-accent)",
            border: "1px solid rgba(139,92,246,0.18)",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled)
              e.currentTarget.style.background = "rgba(139,92,246,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--aw-accent-dim)";
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Decompose SVG & Create Rig
        </button>
        <p
          className="text-[11px] mt-1 leading-relaxed text-center"
          style={{ color: "var(--aw-text-3)", opacity: 0.6 }}
        >
          Select an SVG icon, then click to break it into riggable parts.
        </p>
      </div>

      {/* Rig list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarColor: "rgba(139,92,246,0.12) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {rigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-6 text-center">
            <Bone
              className="h-8 w-8 mb-2"
              style={{ color: "var(--aw-text-3)", opacity: 0.3 }}
            />
            <p className="text-[13px]" style={{ color: "var(--aw-text-3)" }}>
              No rigs yet
            </p>
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--aw-text-3)", opacity: 0.5 }}
            >
              Select an SVG icon and click "Decompose" to create a rig.
            </p>
          </div>
        ) : (
          rigs.map((rig) => {
            const isExpanded = expandedRigs.has(rig.id);
            const isSelected = selectedRig?.id === rig.id;
            return (
              <div key={rig.id}>
                {/* Rig header */}
                <button
                  onClick={() => toggleRig(rig.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    color: isSelected ? "var(--aw-accent)" : "var(--aw-text-2)",
                    background: isSelected
                      ? "rgba(139,92,246,0.08)"
                      : "rgba(139,92,246,0.03)",
                    borderBottom: "1px solid var(--aw-border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected
                      ? "rgba(139,92,246,0.08)"
                      : "rgba(139,92,246,0.03)";
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-2.5 w-2.5" />
                  ) : (
                    <ChevronRight className="h-2.5 w-2.5" />
                  )}
                  <Bone className="h-2.5 w-2.5" />
                  <span className="truncate">
                    Rig ({rig.partIds.length} parts)
                  </span>
                  <span
                    className="ml-auto text-[10px] opacity-50"
                  >
                    {rig.anchors.length} joints
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this rig? Parts will remain on canvas.")) {
                        removeRig(rig.id);
                      }
                    }}
                    className="ml-1 h-4 w-4 rounded flex items-center justify-center transition-colors"
                    style={{ color: "var(--aw-text-3)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--aw-text-3)";
                    }}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </button>

                {/* Anchors list */}
                {isExpanded &&
                  rig.anchors.map((anchor) => {
                    const isLinking =
                      linkingAnchor?.rigId === rig.id &&
                      linkingAnchor?.anchorId === anchor.id;
                    const isRoot = anchor.parentId === null;
                    const parentAnchor = anchor.parentId
                      ? rig.anchors.find((a) => a.id === anchor.parentId)
                      : null;

                    return (
                      <div
                        key={anchor.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 transition-colors group"
                        style={{
                          borderBottom: "1px solid var(--aw-border)",
                          paddingLeft: isRoot ? 12 : 24,
                          background: isLinking
                            ? "rgba(139,92,246,0.1)"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isLinking)
                            e.currentTarget.style.background =
                              "rgba(139,92,246,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isLinking)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Joint icon */}
                        <div
                          className="h-3 w-3 rounded-full border-2 shrink-0"
                          style={{
                            borderColor: isRoot
                              ? "#f59e0b"
                              : "var(--aw-accent)",
                            background: isRoot
                              ? "rgba(245,158,11,0.2)"
                              : "rgba(139,92,246,0.15)",
                          }}
                        />

                        {/* Name (editable) */}
                        {editingAnchor?.rigId === rig.id &&
                        editingAnchor?.anchorId === anchor.id ? (
                          <input
                            type="text"
                            value={anchorName}
                            onChange={(e) => setAnchorName(e.target.value)}
                            onBlur={() => {
                              if (anchorName.trim()) {
                                renameAnchor(rig.id, anchor.id, anchorName.trim());
                              }
                              setEditingAnchor(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (anchorName.trim()) {
                                  renameAnchor(
                                    rig.id,
                                    anchor.id,
                                    anchorName.trim()
                                  );
                                }
                                setEditingAnchor(null);
                              }
                              if (e.key === "Escape") setEditingAnchor(null);
                            }}
                            autoFocus
                            className="flex-1 bg-transparent text-[12px] outline-none px-1 rounded"
                            style={{
                              color: "var(--aw-text)",
                              border: "1px solid var(--aw-accent)",
                            }}
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[12px] font-medium truncate"
                              style={{ color: "var(--aw-text)" }}
                            >
                              {anchor.name}
                              {isRoot && (
                                <span
                                  className="ml-1 text-[10px] font-normal"
                                  style={{ color: "#f59e0b" }}
                                >
                                  root
                                </span>
                              )}
                            </p>
                            {parentAnchor && (
                              <p
                                className="text-[10px] truncate"
                                style={{ color: "var(--aw-text-3)" }}
                              >
                                → {parentAnchor.name}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Rename */}
                          <button
                            onClick={() => {
                              setEditingAnchor({
                                rigId: rig.id,
                                anchorId: anchor.id,
                              });
                              setAnchorName(anchor.name);
                            }}
                            className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                            style={{ color: "var(--aw-text-3)" }}
                            title="Rename"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>

                          {/* Link/unlink parent */}
                          <button
                            onClick={() =>
                              handleStartLink(rig.id, anchor.id)
                            }
                            className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                            style={{
                              color: isLinking
                                ? "var(--aw-accent)"
                                : "var(--aw-text-3)",
                            }}
                            title={
                              isLinking
                                ? "Cancel linking"
                                : "Link to parent"
                            }
                          >
                            <Link className="h-2.5 w-2.5" />
                          </button>

                          {/* Unlink from parent */}
                          {!isRoot && (
                            <button
                              onClick={() =>
                                setAnchorParent(rig.id, anchor.id, null)
                              }
                              className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                              style={{ color: "var(--aw-text-3)" }}
                              title="Unlink from parent (make root)"
                            >
                              <Unlink className="h-2.5 w-2.5" />
                            </button>
                          )}

                          {/* Delete anchor */}
                          <button
                            onClick={() =>
                              removeAnchorFromRig(rig.id, anchor.id)
                            }
                            className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                            style={{ color: "var(--aw-text-3)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ef4444";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--aw-text-3)";
                            }}
                            title="Remove anchor"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* Add anchor button (when expanded) */}
                {isExpanded && (
                  <button
                    onClick={() => {
                      // Add anchor at rig center
                      addAnchorToRig(rig.id, rig.originX, rig.originY, "New Joint");
                    }}
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      color: "var(--aw-text-3)",
                      borderBottom: "1px solid var(--aw-border)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(139,92,246,0.04)";
                      e.currentTarget.style.color = "var(--aw-accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--aw-text-3)";
                    }}
                  >
                    <Crosshair className="h-2.5 w-2.5" />
                    Add Anchor Point
                  </button>
                )}
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
          Rig an SVG to animate individual parts with skeletal joints.
          Keyframe joint rotations on the timeline.
        </p>
      </div>
    </div>
  );
}
