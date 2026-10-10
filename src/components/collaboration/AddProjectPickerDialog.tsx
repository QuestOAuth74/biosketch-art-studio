import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollableContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ProjectThumbnail } from '@/components/projects/ProjectThumbnail';

export interface PickableProject {
  id: string;
  name: string;
  updated_at: string;
  thumbnail_url: string | null;
  thumbnail_updated_at: string | null;
  user_id: string;
  canvas_width: number;
  canvas_height: number;
}

interface AddProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  excludeIds?: Set<string>;
  showPermission?: boolean;
  onSelect: (project: PickableProject, permission: 'view' | 'edit') => void;
  onCreateNew: () => void;
}

export function AddProjectPickerDialog({
  open,
  onOpenChange,
  title,
  excludeIds,
  showPermission = false,
  onSelect,
  onCreateNew,
}: AddProjectPickerDialogProps) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<'view' | 'edit'>('view');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['user-projects-for-picker', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('id, name, updated_at, thumbnail_url, thumbnail_updated_at, user_id, canvas_width, canvas_height')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as PickableProject[];
    },
    enabled: open && !!user,
  });

  const eligible = projects?.filter(p => !excludeIds?.has(p.id)) ?? [];

  const handleSelect = (project: PickableProject) => {
    onSelect(project, permission);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{title}</DialogTitle>
            {showPermission && (
              <Select value={permission} onValueChange={(v) => setPermission(v as 'view' | 'edit')}>
                <SelectTrigger className="w-52 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Edit — can modify</SelectItem>
                  <SelectItem value="view">View — read only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </DialogHeader>

        <DialogScrollableContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : eligible.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {eligible.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary transition-colors overflow-hidden group"
                  onClick={() => handleSelect(project)}
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <ProjectThumbnail
                      project={project}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">
                  {projects?.length === 0 ? 'No projects yet' : 'All your projects are already added'}
                </h3>
                <p className="text-sm text-muted-foreground">Create a new project to add it here.</p>
              </div>
              <Button onClick={() => { onOpenChange(false); onCreateNew(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
            </div>
          )}
        </DialogScrollableContent>
      </DialogContent>
    </Dialog>
  );
}
