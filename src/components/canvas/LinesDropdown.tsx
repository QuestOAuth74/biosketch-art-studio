import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LINE_PRESET_CATEGORIES, LinePreset, LinePresetCategory } from "@/types/linePresets";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LinesDropdownProps {
  onPresetSelect: (preset: LinePreset) => void;
}

export const LinesDropdown = ({ onPresetSelect }: LinesDropdownProps) => {
  const { isAdmin } = useAuth();
  const [presets, setPresets] = useState<Record<LinePresetCategory, LinePreset[]>>(
    () => Object.fromEntries(LINE_PRESET_CATEGORIES.map(c => [c, []])) as any
  );
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchPresets = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("line_presets")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const grouped = Object.fromEntries(
        LINE_PRESET_CATEGORIES.map(c => [c, []])
      ) as Record<LinePresetCategory, LinePreset[]>;

      for (const preset of (data || []) as LinePreset[]) {
        if (grouped[preset.category]) grouped[preset.category].push(preset);
      }
      setPresets(grouped);
    } catch (e) {
      console.error("Failed to load line presets:", e);
    }
    setLoading(false);
    setFetched(true);
  };

  const handleOpen = async () => {
    if (fetched) return;
    await fetchPresets();
  };

  const handleDelete = async (e: React.MouseEvent, presetId: string, presetName: string) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const { error } = await (supabase as any)
        .from("line_presets")
        .update({ is_active: false })
        .eq("id", presetId);

      if (error) {
        toast.error("Failed to delete: " + error.message);
        return;
      }

      toast.success(`"${presetName}" deleted`);

      // Remove from local state immediately
      setPresets((prev) => {
        const updated = { ...prev };
        for (const cat of LINE_PRESET_CATEGORIES) {
          updated[cat] = updated[cat].filter((p) => p.id !== presetId);
        }
        return updated;
      });
    } catch {
      toast.error("Failed to delete preset");
    }
  };

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) handleOpen(); }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={toolButtonInactive}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="4" x2="16" y2="4" />
                <line x1="2" y1="9" x2="16" y2="9" strokeDasharray="3 2" />
                <line x1="2" y1="14" x2="12" y2="14" />
                <polygon points="13,12 16,14 13,16" fill="currentColor" stroke="none" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Line Presets</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="center" className="w-44">
        {loading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : (
          LINE_PRESET_CATEGORIES.map((category) => {
            const items = presets[category];

            return (
              <DropdownMenuSub key={category}>
                <DropdownMenuSubTrigger className="text-sm">
                  {category}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 max-h-[300px] overflow-auto">
                  {items.length === 0 ? (
                    <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                      No presets yet
                    </DropdownMenuItem>
                  ) : (
                    items.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => onPresetSelect(preset)}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        {preset.thumbnail ? (
                          <img
                            src={preset.thumbnail}
                            alt=""
                            className="w-12 h-6 object-contain shrink-0 rounded-sm bg-muted/30"
                          />
                        ) : (
                          <svg width="48" height="24" viewBox="0 0 48 24" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <line x1="4" y1="12" x2="44" y2="12" />
                          </svg>
                        )}
                        <span className="text-xs truncate flex-1">{preset.name}</span>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(e, preset.id, preset.name)}
                            className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
