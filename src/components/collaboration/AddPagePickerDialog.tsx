import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollableContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export interface PickablePage {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface AddPagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  excludeIds?: Set<string>;
  onSelect: (page: PickablePage, permission: 'view' | 'edit') => void;
  onCreateNew: () => void;
}

export function AddPagePickerDialog({
  open,
  onOpenChange,
  title,
  excludeIds,
  onSelect,
  onCreateNew,
}: AddPagePickerDialogProps) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<'view' | 'edit'>('view');

  const { data: pages, isLoading } = useQuery({
    queryKey: ['user-pages-for-picker', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('project_pages')
        .select('id, name, description, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PickablePage[];
    },
    enabled: open && !!user,
  });

  const eligible = pages?.filter(p => !excludeIds?.has(p.id)) ?? [];

  const handleSelect = (page: PickablePage) => {
    onSelect(page, permission);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{title}</DialogTitle>
            <Select value={permission} onValueChange={(v) => setPermission(v as 'view' | 'edit')}>
              <SelectTrigger className="w-52 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edit">Edit — can modify</SelectItem>
                <SelectItem value="view">View — read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <DialogScrollableContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : eligible.length > 0 ? (
            <div className="space-y-2">
              {eligible.map((page) => (
                <Card
                  key={page.id}
                  className="cursor-pointer hover:border-primary transition-colors p-4 group"
                  onClick={() => handleSelect(page)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{page.name}</h3>
                      {page.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{page.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">
                  {pages?.length === 0 ? 'No pages yet' : 'All your pages are already added'}
                </h3>
                <p className="text-sm text-muted-foreground">Create a new page to add it here.</p>
              </div>
              <Button onClick={() => { onOpenChange(false); onCreateNew(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Page
              </Button>
            </div>
          )}
        </DialogScrollableContent>
      </DialogContent>
    </Dialog>
  );
}
