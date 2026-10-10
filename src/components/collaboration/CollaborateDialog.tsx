import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollableContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, Copy, Check, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CollaborateDialogTestIds } from '@/lib/test-ids';

interface Project {
  id: string;
  name: string;
}

interface GroupAccess {
  id: string;
  group_id: string;
  permission: 'view' | 'edit';
  groups: { name: string } | null;
}

interface Collaborator {
  id: string;
  user_id: string | null;
  email: string | null;
  permission: 'view' | 'edit';
  accepted_at: string | null;
  invitation_token: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface Group {
  id: string;
  name: string;
}

interface CollaborateDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export function CollaborateDialog({ project, isOpen, onClose }: CollaborateDialogProps) {
  const { user } = useAuth();
  const [groupAccess, setGroupAccess] = useState<GroupAccess[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupPermission, setGroupPermission] = useState<'view' | 'edit'>('view');
  const [sharingWithGroup, setSharingWithGroup] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'view' | 'edit'>('view');
  const [inviting, setInviting] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      fetchMyGroups();
    }
  }, [isOpen, project.id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchGroupAccess(), fetchCollaborators()]);
    setLoading(false);
  };

  const fetchGroupAccess = async () => {
    const { data } = await supabase
      .from('project_group_access')
      .select('id, group_id, permission, groups(name)')
      .eq('project_id', project.id)
      .order('granted_at', { ascending: true });
    if (data) setGroupAccess(data as GroupAccess[]);
  };

  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('project_collaborators')
      .select('id, user_id, email, permission, accepted_at, invitation_token, profiles!user_id(full_name, avatar_url)')
      .eq('project_id', project.id)
      .order('invited_at', { ascending: true });
    if (data) setCollaborators(data as Collaborator[]);
  };

  const fetchMyGroups = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name)')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin']);
    if (data) setMyGroups(data.map((r: any) => r.groups).filter(Boolean));
  };

  const handleShareWithGroup = async () => {
    if (!selectedGroup) { toast.error('Please select a group'); return; }
    if (!user) return;

    setSharingWithGroup(true);
    try {
      const { error } = await supabase
        .from('project_group_access')
        .upsert(
          { project_id: project.id, group_id: selectedGroup, permission: groupPermission, granted_by: user.id },
          { onConflict: 'project_id,group_id' }
        );

      if (error) throw error;

      toast.success('Project shared with group');
      setSelectedGroup('');
      fetchGroupAccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to share with group');
    } finally {
      setSharingWithGroup(false);
    }
  };

  const handleRemoveGroupAccess = async (accessId: string) => {
    const { error } = await supabase.from('project_group_access').delete().eq('id', accessId);
    if (error) { toast.error('Failed to remove group access'); return; }
    toast.success('Group access removed');
    fetchGroupAccess();
  };

  const handleInviteByEmail = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return; }
    if (!user) return;

    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-project-collaborator', {
        body: {
          projectId: project.id,
          email: inviteEmail.trim().toLowerCase(),
          permission: invitePermission,
          origin: window.location.origin,
        },
      });

      if (error) {
        // FunctionsHttpError wraps the actual response — read the body to get the real message
        let serverMsg = '';
        try {
          const body = await (error as any).context?.json?.();
          serverMsg = body?.error || '';
        } catch {}
        const status = (error as any).context?.status ?? 0;

        if (status === 409 || serverMsg.toLowerCase().includes('already')) {
          toast.error('This email is already a collaborator on this project');
        } else {
          toast.error(serverMsg || error.message || 'Failed to send invitation');
        }
        return;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      fetchCollaborators();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async (collab: Collaborator) => {
    const link = `${window.location.origin}/invite/project/${collab.invitation_token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(collab.id);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleResend = async (collab: Collaborator) => {
    setResendingId(collab.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('send-project-invitation', {
        body: { projectCollaboratorId: collab.id, origin: window.location.origin },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error) throw error;
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    const { error } = await supabase.from('project_collaborators').delete().eq('id', collaboratorId);
    if (error) { toast.error('Failed to remove collaborator'); return; }
    toast.success('Collaborator removed');
    fetchCollaborators();
  };

  // Groups not yet sharing this project
  const availableGroups = myGroups.filter(g => !groupAccess.some(a => a.group_id === g.id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid={CollaborateDialogTestIds.DIALOG}>
        <DialogHeader>
          <DialogTitle>Share "{project.name}"</DialogTitle>
        </DialogHeader>

        <DialogScrollableContent className="space-y-6">
          {/* Share with Group */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Share with a Group</h3>
            </div>
            {availableGroups.length > 0 ? (
              <div className="flex gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="flex-1" data-testid={CollaborateDialogTestIds.GROUP_SELECT}>
                    <SelectValue placeholder="Select a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={groupPermission} onValueChange={(v) => setGroupPermission(v as 'view' | 'edit')}>
                  <SelectTrigger className="w-52" data-testid={CollaborateDialogTestIds.GROUP_PERMISSION_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit">Edit — members can modify</SelectItem>
                    <SelectItem value="view">View — members can view only</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleShareWithGroup} disabled={sharingWithGroup} data-testid={CollaborateDialogTestIds.GROUP_SHARE_BUTTON}>
                  {sharingWithGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
                </Button>
              </div>
            ) : (
              myGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">You don't manage any groups yet.</p>
              )
            )}

            {/* Groups with access */}
            {groupAccess.length > 0 && (
              <div className="space-y-2">
                {groupAccess.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    data-testid={CollaborateDialogTestIds.GROUP_ACCESS_ROW}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{access.groups?.name ?? 'Unknown group'}</span>
                      <Badge variant="outline" className="text-xs">
                        {access.permission === 'edit' ? 'Edit' : 'View'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveGroupAccess(access.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invite by Email */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Invite by Email</h3>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1"
                data-testid={CollaborateDialogTestIds.EMAIL_INPUT}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInviteByEmail(); }}
              />
              <Select value={invitePermission} onValueChange={(v) => setInvitePermission(v as 'view' | 'edit')}>
                <SelectTrigger className="w-52" data-testid={CollaborateDialogTestIds.PERMISSION_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Edit — members can modify</SelectItem>
                  <SelectItem value="view">View — members can view only</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInviteByEmail} disabled={inviting} data-testid={CollaborateDialogTestIds.INVITE_BUTTON}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
              </Button>
            </div>
          </div>

          {/* Individual Collaborators */}
          {(loading || collaborators.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Individual Collaborators</h3>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      data-testid={CollaborateDialogTestIds.COLLABORATOR_ROW}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                          {collab.profiles?.full_name?.[0]?.toUpperCase() ?? collab.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{collab.profiles?.full_name ?? collab.email ?? 'Unknown user'}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {collab.permission === 'edit' ? 'Edit' : 'View'}
                            </Badge>
                            <Badge
                              variant={collab.accepted_at ? 'default' : 'secondary'}
                              className="text-xs"
                              data-testid={CollaborateDialogTestIds.COLLABORATOR_STATUS_BADGE}
                            >
                              {collab.accepted_at ? 'Active' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!collab.accepted_at && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Copy invite link"
                              onClick={() => handleCopyLink(collab)}
                              data-testid={CollaborateDialogTestIds.COPY_INVITE_LINK_BUTTON}
                            >
                              {copiedId === collab.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleResend(collab)}
                              disabled={resendingId === collab.id}
                              data-testid={CollaborateDialogTestIds.RESEND_INVITE_BUTTON}
                            >
                              {resendingId === collab.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resend'}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveCollaborator(collab.id)}
                          data-testid={CollaborateDialogTestIds.REMOVE_COLLABORATOR_BUTTON}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogScrollableContent>
      </DialogContent>
    </Dialog>
  );
}
