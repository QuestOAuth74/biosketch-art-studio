import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreateGroupDialogTestIds } from '@/lib/test-ids';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ isOpen, onClose }: CreateGroupDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      // Use the create_group RPC which runs as SECURITY DEFINER (postgres),
      // bypassing RLS entirely. It atomically creates the group and adds the
      // caller as owner — no trigger or complex RLS bootstrapping needed.
      const { data, error } = await supabase.rpc('create_group', {
        p_name: name.trim(),
        p_description: description.trim() || null,
      });

      if (error) throw error;

      // RPC returns SETOF row — data is an array
      const group = Array.isArray(data) ? data[0] : data;

      toast.success('Group created!');
      onClose();
      navigate(`/groups/${(group as any).id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent data-testid={CreateGroupDialogTestIds.DIALOG}>
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">
              Group Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              maxLength={100}
              data-testid={CreateGroupDialogTestIds.NAME_INPUT}
            />
            <p className="text-xs text-muted-foreground">{name.length}/100 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this group's purpose..."
              rows={3}
              maxLength={500}
              data-testid={CreateGroupDialogTestIds.DESCRIPTION_INPUT}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid={CreateGroupDialogTestIds.CANCEL_BUTTON}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid={CreateGroupDialogTestIds.SUBMIT_BUTTON}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
