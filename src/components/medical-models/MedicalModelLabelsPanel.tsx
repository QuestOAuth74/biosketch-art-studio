import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, X, Check, MapPin, Crosshair, Loader2 } from "lucide-react";

export interface LabelRow {
  id: string;
  title: string;
  description: string | null;
  position_xyz: { x: number; y: number; z: number };
  sort_order: number;
}

interface Props {
  labels: LabelRow[];
  /** When true, the editor is currently in "click on mesh to place" mode. */
  placeMode: boolean;
  loading?: boolean;
  activeLabelId?: string | null;
  onTogglePlaceMode: () => void;
  onSelect: (id: string | null) => void;
  onEdit: (id: string, patch: { title?: string; description?: string | null }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

export function MedicalModelLabelsPanel({
  labels,
  placeMode,
  loading,
  activeLabelId,
  onTogglePlaceMode,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const startEdit = (l: LabelRow) => {
    setEditingId(l.id);
    setEditTitle(l.title);
    setEditDesc(l.description || "");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    const ok = await onEdit(id, { title: editTitle.trim(), description: editDesc.trim() || null });
    if (ok) setEditingId(null);
    // On failure, keep the form open so the user doesn't lose what they typed —
    // the error toast (from the editor) tells them why.
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-violet-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Labels {labels.length > 0 && <span className="text-foreground">({labels.length})</span>}
          </h3>
        </div>
        <Button
          variant={placeMode ? "default" : "outline"}
          size="sm"
          onClick={onTogglePlaceMode}
          className="h-7 px-2.5 text-[11px] gap-1"
        >
          {placeMode ? (
            <>
              <X className="h-3 w-3" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" /> Add label
            </>
          )}
        </Button>
      </div>

      {placeMode && (
        <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-violet-50 border border-violet-200 text-[11px] text-violet-900">
          <Crosshair className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Click any point on the 3D model to drop a label there. Click "Cancel" to exit add mode.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading labels…
        </div>
      ) : labels.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center italic">
          No labels yet. Click "Add label" and pick a point on the model.
        </p>
      ) : (
        <ol className="space-y-2">
          {labels.map((l, idx) => {
            const isActive = activeLabelId === l.id;
            const isEditing = editingId === l.id;
            return (
              <li
                key={l.id}
                className={`rounded-xl border p-2.5 transition-colors ${
                  isActive ? "border-violet-300 bg-violet-50/40" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0 ${
                      isActive ? "bg-violet-600" : "bg-slate-700"
                    }`}
                    style={{ width: 20, height: 20 }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Label title"
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <Textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description (optional)"
                          className="text-xs resize-none min-h-[48px]"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={() => void saveEdit(l.id)}
                            className="h-6 text-[11px] px-2 gap-1"
                          >
                            <Check className="h-3 w-3" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="h-6 text-[11px] px-2 gap-1"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(isActive ? null : l.id)}
                        className="w-full text-left"
                      >
                        <p className="text-xs font-semibold text-slate-900 line-clamp-1">{l.title}</p>
                        {l.description && (
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {l.description}
                          </p>
                        )}
                      </button>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(l)}
                        title="Edit"
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete label "${l.title}"?`)) void onDelete(l.id);
                        }}
                        title="Delete"
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
