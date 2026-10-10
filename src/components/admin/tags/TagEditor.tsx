import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollableContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { useIconTags } from '@/hooks/useIconTags';
import { Loader2 } from 'lucide-react';

interface Icon {
  id: string;
  name: string;
  category: string;
  thumbnail: string | null;
  tags: string[] | null;
}

interface TagEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icons: Icon[];
}

export function TagEditor({ open, onOpenChange, icons }: TagEditorProps) {
  const { allTags, batchUpdateIconTags, isUpdating } = useIconTags();
  const [iconTags, setIconTags] = useState<Record<string, string[]>>({});

  // Initialize icon tags when dialog opens
  useEffect(() => {
    if (open && icons.length > 0) {
      const initialTags: Record<string, string[]> = {};
      icons.forEach(icon => {
        initialTags[icon.id] = icon.tags || [];
      });
      setIconTags(initialTags);
    }
  }, [open, icons]);

  const handleTagChange = (iconId: string, tags: string[]) => {
    setIconTags(prev => ({
      ...prev,
      [iconId]: tags
    }));
  };

  const handleSave = () => {
    const updates = icons
      .map(icon => ({
        id: icon.id,
        tags: iconTags[icon.id] || []
      }))
      .filter(update => {
        const currentTags = icons.find(i => i.id === update.id)?.tags || [];
        const newTags = update.tags;
        return JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort());
      });

    if (updates.length === 0) {
      onOpenChange(false);
      return;
    }

    batchUpdateIconTags(updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Tags</DialogTitle>
          <DialogDescription>
            Add up to 3 tags per icon. {icons.length} icon{icons.length !== 1 ? 's' : ''} selected.
          </DialogDescription>
        </DialogHeader>

        <DialogScrollableContent className="space-y-4">
            {icons.map(icon => (
              <div key={icon.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {icon.thumbnail && (
                    <img
                      src={icon.thumbnail}
                      alt={icon.name}
                      className="w-12 h-12 object-contain"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{icon.name}</p>
                    <p className="text-xs text-muted-foreground">{icon.category}</p>
                  </div>
                </div>

                <TagInput
                  value={iconTags[icon.id] || []}
                  onChange={(tags) => handleTagChange(icon.id, tags)}
                  maxTags={3}
                  suggestions={allTags}
                />
              </div>
            ))}
        </DialogScrollableContent>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
