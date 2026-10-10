import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { InviteGroupMemberDialogTestIds } from '@/lib/test-ids';

interface InviteGroupMemberDialogProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteGroupMemberDialog({ groupId, isOpen, onClose, onInvited }: InviteGroupMemberDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const handleSave = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { data: invitation, error } = await supabase
        .from('group_invitations')
        .insert({ group_id: groupId, email: email.trim().toLowerCase(), invited_by: user.id, invited_role: role })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('An invitation has already been sent to this email address');
          return;
        }
        throw error;
      }

      // Send invitation email
      try {
        const { data: session } = await supabase.auth.getSession();
        await supabase.functions.invoke('send-group-invitation', {
          body: { groupInvitationId: invitation.id, origin: window.location.origin },
          headers: { Authorization: `Bearer ${session.session?.access_token}` },
        });
      } catch (emailErr) {
        console.warn('Failed to send invitation email:', emailErr);
        toast.warning('Invitation created but email failed to send. Copy the invite link manually.');
      }

      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      setRole('member');
      onInvited();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail('');
      setRole('member');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent data-testid={InviteGroupMemberDialogTestIds.DIALOG}>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              data-testid={InviteGroupMemberDialogTestIds.EMAIL_INPUT}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}>
              <SelectTrigger id="invite-role" data-testid={InviteGroupMemberDialogTestIds.ROLE_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid={InviteGroupMemberDialogTestIds.CANCEL_BUTTON}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid={InviteGroupMemberDialogTestIds.SUBMIT_BUTTON}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
