import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { checkProjectLimit } from '@/lib/projectLimit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollableContent, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Plus, Share2, X, FolderOpen, Copy, Check, Mail, Users, Pencil, Trash2 } from 'lucide-react';
import { AddProjectPickerDialog, type PickableProject } from '@/components/collaboration/AddProjectPickerDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { PageDetailTestIds } from '@/lib/test-ids';

const pdStyles = `
  @keyframes pd-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .pd-fade-1 { animation: pd-fade-up 0.4s ease-out 0.1s both; }
  .pd-fade-2 { animation: pd-fade-up 0.4s ease-out 0.2s both; }
`;

interface Page {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

interface PageProject {
  id: string;
  sort_order: number;
  project_id: string;
  canvas_projects: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    updated_at: string;
  } | null;
}

interface GroupAccess {
  id: string;
  group_id: string;
  permission: 'view' | 'edit';
  groups: { name: string } | null;
}

interface PageInvite {
  id: string;
  email: string;
  permission: 'view' | 'edit';
  accepted_at: string | null;
  invitation_token: string;
}

interface Group {
  id: string;
  name: string;
}

export default function PageDetail() {
  const { id: pageId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [page, setPage] = useState<Page | null>(null);
  const [projects, setProjects] = useState<PageProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [showShareDialog, setShowShareDialog] = useState(false);
  const [groupAccess, setGroupAccess] = useState<GroupAccess[]>([]);
  const [invites, setInvites] = useState<PageInvite[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupPermission, setGroupPermission] = useState<'view' | 'edit'>('view');
  const [sharingWithGroup, setSharingWithGroup] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'view' | 'edit'>('view');
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPage, setDeletingPage] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (pageId) fetchAll();
  }, [pageId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchPage(), fetchProjects()]);
    setLoading(false);
  };

  const fetchPage = async () => {
    const { data } = await supabase
      .from('project_pages')
      .select('id, name, description, created_by')
      .eq('id', pageId!)
      .single();
    if (data) setPage(data as Page);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('project_page_items')
      .select('id, sort_order, project_id, canvas_projects(id, name, thumbnail_url, updated_at)')
      .eq('page_id', pageId!)
      .order('sort_order', { ascending: true });
    if (data) setProjects(data as PageProject[]);
  };

  const fetchShareData = async () => {
    await Promise.all([fetchGroupAccess(), fetchInvites(), fetchMyGroups()]);
  };

  const fetchGroupAccess = async () => {
    const { data } = await supabase
      .from('project_page_group_access')
      .select('id, group_id, permission, groups(name)')
      .eq('page_id', pageId!)
      .order('granted_at', { ascending: true });
    if (data) setGroupAccess(data as GroupAccess[]);
  };

  const fetchInvites = async () => {
    const { data } = await supabase
      .from('project_page_access')
      .select('id, email, permission, accepted_at, invitation_token')
      .eq('page_id', pageId!)
      .order('invited_at', { ascending: true });
    if (data) setInvites(data as PageInvite[]);
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

  const isOwner = page?.created_by === user?.id;

  const handleOpenShare = () => {
    fetchShareData();
    setShowShareDialog(true);
  };

  const handleShareWithGroup = async () => {
    if (!selectedGroup) { toast.error('Please select a group'); return; }
    if (!user) return;
    setSharingWithGroup(true);
    try {
      const { error } = await supabase
        .from('project_page_group_access')
        .upsert(
          { page_id: pageId, group_id: selectedGroup, permission: groupPermission, granted_by: user.id },
          { onConflict: 'page_id,group_id' }
        );
      if (error) throw error;
      toast.success('Page shared with group');
      setSelectedGroup('');
      fetchGroupAccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to share with group');
    } finally {
      setSharingWithGroup(false);
    }
  };

  const handleRemoveGroupAccess = async (accessId: string) => {
    const { error } = await supabase.from('project_page_group_access').delete().eq('id', accessId);
    if (error) { toast.error('Failed to remove group access'); return; }
    toast.success('Group access removed');
    fetchGroupAccess();
  };

  const handleInviteByEmail = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return; }
    if (!user) return;

    setInviting(true);
    try {
      const { data: inviteData, error: insertErr } = await supabase
        .from('project_page_access')
        .insert({
          page_id: pageId,
          email: inviteEmail.trim().toLowerCase(),
          permission: invitePermission,
          invited_by: user.id,
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          toast.error('This email has already been invited to this page');
        } else {
          throw insertErr;
        }
        return;
      }

      const { error: emailErr } = await supabase.functions.invoke('send-page-invitation', {
        body: { pageAccessId: inviteData.id, origin: window.location.origin },
      });

      if (emailErr) {
        toast.warning('Invitation saved but email could not be sent');
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
      }

      setInviteEmail('');
      fetchInvites();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async (invite: PageInvite) => {
    const link = `${window.location.origin}/invite/page/${invite.invitation_token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleResend = async (invite: PageInvite) => {
    setResendingId(invite.id);
    try {
      const { error } = await supabase.functions.invoke('send-page-invitation', {
        body: { pageAccessId: invite.id, origin: window.location.origin },
      });
      if (error) throw error;
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    const { error } = await supabase.from('project_page_access').delete().eq('id', inviteId);
    if (error) { toast.error('Failed to remove invitation'); return; }
    toast.success('Invitation removed');
    fetchInvites();
  };

  const handleAddProject = async (project: PickableProject, _permission: 'view' | 'edit') => {
    const nextOrder = projects.length > 0 ? Math.max(...projects.map(p => p.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('project_page_items')
      .insert({ page_id: pageId, project_id: project.id, sort_order: nextOrder });
    if (error) {
      if (error.code === '23505') toast.error('This project is already on this page');
      else toast.error('Failed to add project');
    } else {
      toast.success('Project added');
      fetchProjects();
    }
  };

  const handleCreateProject = async () => {
    if (!createProjectName.trim()) { toast.error('Project name is required'); return; }
    if (!user) return;
    setCreatingProject(true);

    // Enforce 5-project limit for non-premium, non-admin users
    const limitBlocked = await checkProjectLimit(user.id);
    if (limitBlocked) { setCreatingProject(false); return; }

    const { data: project, error: projectError } = await supabase
      .from('canvas_projects')
      .insert({ user_id: user.id, name: createProjectName.trim(), canvas_data: {}, canvas_width: 1200, canvas_height: 800 })
      .select('id')
      .single();

    if (projectError || !project) {
      setCreatingProject(false);
      toast.error('Failed to create project');
      return;
    }

    const nextOrder = projects.length > 0 ? Math.max(...projects.map(p => p.sort_order)) + 1 : 0;
    await supabase.from('project_page_items').insert({ page_id: pageId, project_id: project.id, sort_order: nextOrder });

    setCreatingProject(false);
    setShowCreateProjectDialog(false);
    setCreateProjectName('');
    toast.success('Project created and added to page');
    navigate(`/canvas/${project.id}`);
  };

  const handleRemoveProject = async (itemId: string) => {
    const { error } = await supabase.from('project_page_items').delete().eq('id', itemId);
    if (error) { toast.error('Failed to remove project'); return; }
    toast.success('Project removed');
    fetchProjects();
  };

  const handleStartEditName = () => {
    setEditNameValue(page!.name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editNameValue.trim() || !pageId) { setIsEditingName(false); return; }
    if (editNameValue.trim() === page!.name) { setIsEditingName(false); return; }
    setSavingName(true);
    const { error } = await supabase
      .from('project_pages')
      .update({ name: editNameValue.trim() })
      .eq('id', pageId);
    setSavingName(false);
    if (error) { toast.error('Failed to update page name'); return; }
    setPage({ ...page!, name: editNameValue.trim() });
    setIsEditingName(false);
    toast.success('Page name updated');
  };

  const handleDeletePage = async () => {
    if (!pageId) return;
    setDeletingPage(true);
    const { error } = await supabase.from('project_pages').delete().eq('id', pageId);
    setDeletingPage(false);
    if (error) { toast.error('Failed to delete page'); return; }
    toast.success('Page deleted');
    navigate('/pages');
  };

  const availableGroups = myGroups.filter(g => !groupAccess.some(a => a.group_id === g.id));
  const alreadyOnPage = new Set(projects.map(p => p.project_id));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <style>{pdStyles}</style>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Page not found.</p>
          <Button variant="link" onClick={() => navigate('/pages')}>Back to Pages</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid={PageDetailTestIds.PAGE_CONTAINER}>
      <style>{pdStyles}</style>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8 pd-fade-1">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pages')}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                  Page
                </span>
              </div>
              {isEditingName ? (
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  onBlur={handleSaveName}
                  autoFocus
                  disabled={savingName}
                  className="text-3xl md:text-4xl font-serif font-semibold bg-transparent border-b-2 border-dashed border-primary outline-none w-full text-foreground tracking-tight"
                  data-testid={PageDetailTestIds.EDIT_NAME_INPUT}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground tracking-tight" data-testid={PageDetailTestIds.PAGE_NAME}>
                    {page.name}
                  </h1>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleStartEditName}
                      data-testid={PageDetailTestIds.EDIT_NAME_BUTTON}
                      title="Edit page name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
              {page.description && (
                <p className="text-muted-foreground mt-1">{page.description}</p>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(true)}
                  className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                  data-testid={PageDetailTestIds.ADD_PROJECTS_BUTTON}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Add Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateProjectDialog(true)}
                  className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                  data-testid={PageDetailTestIds.NEW_PROJECT_BUTTON}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenShare}
                  className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                  data-testid={PageDetailTestIds.SHARE_BUTTON}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="transition-all duration-200 active:scale-[0.98]"
                  data-testid={PageDetailTestIds.DELETE_PAGE_BUTTON}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Page
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="pd-fade-2">
          {projects.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-12 text-center transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden group">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No projects on this page yet.</p>
                {isOwner && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddDialog(true)}
                      className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Add Project
                    </Button>
                    <Button
                      onClick={() => setShowCreateProjectDialog(true)}
                      className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((item, index) => {
                const proj = item.canvas_projects;
                if (!proj) return null;
                return (
                  <div
                    key={item.id}
                    className="group/card rounded-xl border-2 border-dashed border-border/60 bg-card/60 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-border relative animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                    data-testid={PageDetailTestIds.PROJECT_CARD}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 opacity-0 group-hover/card:opacity-[0.015] transition-opacity duration-500 pointer-events-none z-[5]"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                      }}
                    />
                    <div className="w-full min-h-[120px] bg-muted/30 flex items-center justify-center overflow-hidden">
                      {proj.thumbnail_url ? (
                        <img
                          src={proj.thumbnail_url}
                          alt={proj.name}
                          className="max-w-full max-h-[200px] object-contain transition-transform duration-500 group-hover/card:scale-105"
                        />
                      ) : (
                        <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="relative z-10 p-4 space-y-3">
                      <h3 className="font-semibold line-clamp-1 group-hover/card:text-primary transition-colors duration-200">{proj.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proj.updated_at), { addSuffix: true })}
                      </p>
                      <div className="flex gap-2 pt-2 border-t border-dashed border-border/40">
                        <Button
                          size="sm"
                          className="flex-1 gap-2 active:scale-[0.98]"
                          onClick={() => navigate(`/canvas/${proj.id}`)}
                        >
                          <FolderOpen className="w-4 h-4" />
                          Open
                        </Button>
                        {isOwner && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveProject(item.id)}
                            title="Remove from page"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-2xl" data-testid={PageDetailTestIds.SHARE_DIALOG}>
          <DialogHeader>
            <DialogTitle>Share "{page.name}"</DialogTitle>
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
                    <SelectTrigger className="flex-1" data-testid={PageDetailTestIds.GROUP_SELECT}>
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={groupPermission} onValueChange={(v) => setGroupPermission(v as 'view' | 'edit')}>
                    <SelectTrigger className="w-28" data-testid={PageDetailTestIds.GROUP_PERMISSION_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleShareWithGroup} disabled={sharingWithGroup} data-testid={PageDetailTestIds.GROUP_SHARE_BUTTON}>
                    {sharingWithGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
                  </Button>
                </div>
              ) : myGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">You don't manage any groups yet.</p>
              )}

              {groupAccess.length > 0 && (
                <div className="space-y-2">
                  {groupAccess.map((access) => (
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-border/60 bg-card/60"
                      data-testid={PageDetailTestIds.GROUP_ACCESS_ROW}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{access.groups?.name ?? 'Unknown group'}</span>
                        <Badge variant="outline" className="text-xs border-dashed">
                          {access.permission === 'edit' ? 'Edit' : 'View'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveGroupAccess(access.id)}
                        data-testid={PageDetailTestIds.REMOVE_GROUP_ACCESS_BUTTON}
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
                  data-testid={PageDetailTestIds.INVITE_EMAIL_INPUT}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInviteByEmail(); }}
                />
                <Select value={invitePermission} onValueChange={(v) => setInvitePermission(v as 'view' | 'edit')}>
                  <SelectTrigger className="w-28" data-testid={PageDetailTestIds.INVITE_PERMISSION_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInviteByEmail} disabled={inviting} data-testid={PageDetailTestIds.INVITE_SUBMIT_BUTTON}>
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                </Button>
              </div>
            </div>

            {/* Invited Users */}
            {invites.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Invited Users</h3>
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-border/60 bg-card/60"
                    data-testid={PageDetailTestIds.INVITE_ROW}
                  >
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-xs border-dashed">
                          {invite.permission === 'edit' ? 'Edit' : 'View'}
                        </Badge>
                        <Badge
                          variant={invite.accepted_at ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {invite.accepted_at ? 'Active' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!invite.accepted_at && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Copy invite link"
                            onClick={() => handleCopyLink(invite)}
                            data-testid={PageDetailTestIds.COPY_INVITE_LINK_BUTTON}
                          >
                            {copiedId === invite.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleResend(invite)}
                            disabled={resendingId === invite.id}
                            data-testid={PageDetailTestIds.RESEND_INVITE_BUTTON}
                          >
                            {resendingId === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resend'}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveInvite(invite.id)}
                        data-testid={PageDetailTestIds.REMOVE_INVITE_BUTTON}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogScrollableContent>
        </DialogContent>
      </Dialog>

      <AddProjectPickerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add Project to Page"
        excludeIds={alreadyOnPage}
        onSelect={handleAddProject}
        onCreateNew={() => { setShowAddDialog(false); setShowCreateProjectDialog(true); }}
      />

      {/* New Project Dialog */}
      <Dialog
        open={showCreateProjectDialog}
        onOpenChange={(open) => { if (!open) { setShowCreateProjectDialog(false); setCreateProjectName(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-project-name">Project Name *</Label>
              <Input
                id="new-project-name"
                value={createProjectName}
                onChange={(e) => setCreateProjectName(e.target.value)}
                placeholder="e.g. Membrane Transport Study"
                maxLength={100}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateProjectDialog(false); setCreateProjectName(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={creatingProject}>
              {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Page Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{page.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deletingPage}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePage} disabled={deletingPage}>
              {deletingPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
