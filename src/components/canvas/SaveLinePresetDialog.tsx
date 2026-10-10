import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LINE_PRESET_CATEGORIES, LinePresetCategory } from "@/types/linePresets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveLinePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fabricJson: Record<string, any> | null;
}

export const SaveLinePresetDialog = ({ open, onOpenChange, fabricJson }: SaveLinePresetDialogProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LinePresetCategory>("Lines");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !fabricJson) return;
    setSaving(true);

    // Extract thumbnail and clean JSON
    const { _thumbnail, ...cleanJson } = fabricJson;
    const normalized = { ...cleanJson, left: 0, top: 0 };

    try {
      const { error } = await (supabase as any).from("line_presets").insert({
        name: name.trim(),
        category,
        fabric_json: normalized,
        thumbnail: _thumbnail || null,
      });

      if (error) {
        toast.error("Failed to save: " + error.message);
      } else {
        toast.success(`Line preset "${name.trim()}" saved to ${category}`);
        setName("");
        setCategory("Lines");
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error("Failed to save preset");
    }

    setSaving(false);
  };

  // Preview thumbnail if available
  const thumbnail = fabricJson?._thumbnail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save Line Preset</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {thumbnail && (
            <div className="flex justify-center p-3 bg-muted/30 rounded-lg border border-border/30">
              <img src={thumbnail} alt="Preview" className="max-h-16 object-contain" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="preset-name">Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Single Arrow"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LinePresetCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_PRESET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving..." : "Save Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
