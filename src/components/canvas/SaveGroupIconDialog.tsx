import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CANVAS_CUSTOM_PROPS } from "@/contexts/CanvasContext";

interface SaveGroupIconDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas: any; // Fabric canvas
  selectedObject: any; // Fabric object (group or active selection)
}

interface IconCategory {
  id: string;
  name: string;
}

export function SaveGroupIconDialog({ open, onOpenChange, canvas, selectedObject }: SaveGroupIconDialogProps) {
  const [iconName, setIconName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<IconCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("icon_categories")
      .select("id, name")
      .order("name");
    if (!error && data) setCategories(data);
  };

  const generateThumbnailFromCanvas = (): string => {
    // Render the selected object and its associated endpoint markers
    // by temporarily hiding all other canvas objects and exporting
    // the region around the selection.
    try {
      if (!canvas || !selectedObject) return "";

      const bound = selectedObject.getBoundingRect();
      const padding = 20;

      // Collect the group's endpoint marker IDs (lines inside group
      // may have startMarker/endMarker refs to top-level canvas objects)
      const markerSet = new Set<any>();
      const collectMarkers = (container: any) => {
        if (!container?._objects) return;
        for (const child of container._objects) {
          if (child.startMarker) markerSet.add(child.startMarker);
          if (child.endMarker) markerSet.add(child.endMarker);
          if (child.type === 'group') collectMarkers(child);
        }
      };
      collectMarkers(selectedObject);

      // Expand bounding rect to include markers
      for (const marker of markerSet) {
        const mb = marker.getBoundingRect();
        const minX = Math.min(bound.left, mb.left);
        const minY = Math.min(bound.top, mb.top);
        const maxX = Math.max(bound.left + bound.width, mb.left + mb.width);
        const maxY = Math.max(bound.top + bound.height, mb.top + mb.height);
        bound.left = minX;
        bound.top = minY;
        bound.width = maxX - minX;
        bound.height = maxY - minY;
      }

      // Hide everything except the selected group and its markers
      const hidden: any[] = [];
      canvas.forEachObject((obj: any) => {
        if (obj === selectedObject || markerSet.has(obj)) return;
        if (obj.visible !== false) {
          hidden.push(obj);
          obj.set({ visible: false });
        }
      });

      // Deselect to hide selection controls
      canvas.discardActiveObject();
      canvas.renderAll(); // Must be synchronous — toDataURL() reads pixels immediately after

      // Export the region as data URL
      const dataUrl = canvas.toDataURL({
        left: bound.left - padding,
        top: bound.top - padding,
        width: bound.width + padding * 2,
        height: bound.height + padding * 2,
        format: 'png',
        quality: 0.8,
        multiplier: 256 / Math.max(bound.width + padding * 2, bound.height + padding * 2),
      });

      // Restore visibility and selection
      hidden.forEach((obj: any) => obj.set({ visible: true }));
      canvas.setActiveObject(selectedObject);
      canvas.requestRenderAll();

      return dataUrl;
    } catch (e) {
      console.error("Thumbnail generation failed:", e);
      return "";
    }
  };

  const handleSave = async () => {
    if (!iconName.trim()) {
      toast.error("Please enter an icon name");
      return;
    }
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }
    if (!selectedObject) {
      toast.error("No objects selected");
      return;
    }

    setIsSaving(true);
    try {
      // Serialize the entire selection as a Group object, preserving relative positions
      // This ensures child objects maintain their exact layout
      const groupData = selectedObject.toObject(CANVAS_CUSTOM_PROPS);

      // Normalize: if it's an activeSelection, change type to Group for deserialization
      if (groupData.type === 'activeSelection' || groupData.type === 'ActiveSelection') {
        groupData.type = 'Group';
      }

      // Rasterized membranes/helixes have custom toObject() that strips `src` to save
      // space during project serialization (they regenerate from bezier points on load).
      // For group icons we need the image data so they render when placed. Walk through
      // the serialized children and inject the src back from the live objects.
      const liveObjects = (selectedObject as any)._objects || (selectedObject as any).getObjects?.() || [];
      const injectRasterizedSrc = (serializedObjects: any[], liveObjs: any[]) => {
        if (!serializedObjects || !liveObjs) return;
        for (let i = 0; i < serializedObjects.length && i < liveObjs.length; i++) {
          const sObj = serializedObjects[i];
          const lObj = liveObjs[i] as any;
          // Check if this is a rasterized object missing its src
          if ((lObj.isRasterizedMembrane || lObj.isRasterizedHelix) && !sObj.src) {
            const el = lObj.getElement?.();
            if (el instanceof HTMLCanvasElement) {
              sObj.src = el.toDataURL('image/png');
            } else if (el instanceof HTMLImageElement && el.src) {
              sObj.src = el.src;
            }
          }
          // Recurse into nested groups
          if (sObj.objects && lObj._objects) {
            injectRasterizedSrc(sObj.objects, lObj._objects);
          }
        }
      };
      if (groupData.objects && liveObjects.length > 0) {
        injectRasterizedSrc(groupData.objects, liveObjects);
      }

      // Reset position to origin — the group will be centered on canvas when placed
      groupData.left = 0;
      groupData.top = 0;

      const canvasData = {
        version: "6.0.0",
        groupObject: groupData,
      };

      // Generate thumbnail
      const thumbnail = generateThumbnailFromCanvas();

      // Create a minimal SVG placeholder (the real data is in canvas_data)
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="4"/>
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#999">Group</text>
</svg>`;

      const sanitizedName = iconName
        .trim()
        .replace(/[^a-zA-Z0-9\s\-_()]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const { error } = await supabase.from("icons").insert([
        {
          name: sanitizedName,
          category: selectedCategory,
          svg_content: placeholderSvg,
          canvas_data: canvasData as any,
          thumbnail: thumbnail || null,
          tags: ["group-icon"],
        },
      ]);

      if (error) throw error;

      toast.success(`Group icon "${sanitizedName}" saved to library!`);
      setIconName("");
      setSelectedCategory("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Save group icon error:", error);
      toast.error(error.message || "Failed to save group icon");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Group Icon</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Save the selected objects as a reusable group icon. When placed on a canvas, users can ungroup and edit each component individually.
          </p>

          <div className="space-y-1.5">
            <Label className="text-sm">Icon Name</Label>
            <Input
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              placeholder="e.g. Cell Membrane with Receptors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !iconName.trim() || !selectedCategory}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save to Library
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
