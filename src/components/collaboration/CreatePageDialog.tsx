import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePageDialogTestIds } from '@/lib/test-ids';

interface CreatePageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePageDialog({ isOpen, onClose }: CreatePageDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Page name is required'); return; }
    if (!user) return;

    setSubmitting(true);
    const { data, error } = await supabase.rpc('create_page', {
      p_name: name.trim(),
      p_description: description.trim() || null,
    });

    setSubmitting(false);

    if (error || !data?.length) {
      console.error('Failed to create page:', error);
      toast.error('Failed to create page');
      return;
    }

    toast.success('Page created!');
    onClose();
    navigate(`/pages/${data[0].id}`);
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent data-testid={CreatePageDialogTestIds.DIALOG}>
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="page-name">Name *</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lab Meeting Spring 2026"
              maxLength={100}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              data-testid={CreatePageDialogTestIds.NAME_INPUT}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-description">Description</Label>
            <Textarea
              id="page-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={500}
              rows={3}
              data-testid={CreatePageDialogTestIds.DESCRIPTION_INPUT}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid={CreatePageDialogTestIds.CANCEL_BUTTON}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid={CreatePageDialogTestIds.SUBMIT_BUTTON}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
