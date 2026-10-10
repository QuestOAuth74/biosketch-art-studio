import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { checkProjectLimit } from '@/lib/projectLimit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, UserPlus, Copy, Check, Trash2, X, FolderOpen, FileText, Plus, Globe, Lock, Calendar, CheckCircle, XCircle, Ruler, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { InviteGroupMemberDialog } from '@/components/collaboration/InviteGroupMemberDialog';
import { ShareProjectDialog } from '@/components/projects/ShareProjectDialog';
import { CollaborateDialog } from '@/components/collaboration/CollaborateDialog';
import { AddProjectPickerDialog, type PickableProject } from '@/components/collaboration/AddProjectPickerDialog';
import { AddPagePickerDialog, type PickablePage } from '@/components/collaboration/AddPagePickerDialog';
import { ThumbnailWithSpinner } from '@/components/projects/ThumbnailWithSpinner';
import { useLazyThumbnails } from '@/hooks/useLazyThumbnails';
import { GroupDetailTestIds, CreatePageDialogTestIds } from '@/lib/test-ids';

const gdStyles = `
  @keyframes gd-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .gd-fade-1 { animation: gd-fade-up 0.4s ease-out 0.1s both; }
  .gd-fade-2 { animation: gd-fade-up 0.4s ease-out 0.2s both; }
`;

interface GroupMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles: { full_name: string | null; avatar_url: string | null };
}

interface PendingInvitation {
  id: string;
  email: string;
  token: string;
  invited_by: string;
  expires_at: string;
  declined_at: string | null;
  profiles: { full_name: string | null } | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
}

interface GroupProject {
  id: string;
  permission: 'view' | 'edit';
  granted_at: string;
  canvas_projects: {
    id: string;
    name: string;
    updated_at: string;
    user_id: string;
    thumbnail_url: string | null;
    thumbnail_updated_at: string | null;
    is_public: boolean | null;
    approval_status: string | null;
    canvas_width: number | null;
    canvas_height: number | null;
  } | null;
}

interface GroupPage {
  id: string;
  permission: 'view' | 'edit';
  granted_at: string;
  project_pages: { id: string; name: string; description: string | null } | null;
}

export default function GroupDetail() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [groupProjects, setGroupProjects] = useState<GroupProject[]>([]);
  const [groupPages, setGroupPages] = useState<GroupPage[]>([]);

  const [shareDialogProject, setShareDialogProject] = useState<GroupProject['canvas_projects'] | null>(null);
  const [collaborateProject, setCollaborateProject] = useState<GroupProject['canvas_projects'] | null>(null);

  const thumbnailProjects = useMemo(
    () => groupProjects.flatMap(gp => {
      const cp = gp.canvas_projects;
      if (!cp || cp.user_id !== user?.id) return [];
      return [{
        id: cp.id,
        user_id: cp.user_id,
        thumbnail_url: cp.thumbnail_url,
        thumbnail_updated_at: cp.thumbnail_updated_at,
        updated_at: cp.updated_at,
        canvas_width: cp.canvas_width ?? 1200,
        canvas_height: cp.canvas_height ?? 800,
      }];
    }),
    [groupProjects, user?.id]
  );
  const { getThumbnailUrl, isRegenerating, hasError } = useLazyThumbnails(thumbnailProjects);

  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectPermission, setCreateProjectPermission] = useState<'view' | 'edit'>('edit');
  const [creatingProject, setCreatingProject] = useState(false);

  const [activeTab, setActiveTab] = useState('members');

  const [showAddPageDialog, setShowAddPageDialog] = useState(false);
  const [showCreatePageDialog, setShowCreatePageDialog] = useState(false);
  const [createPageName, setCreatePageName] = useState('');
  const [createPageDescription, setCreatePageDescription] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (groupId) fetchAll();
  }, [groupId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchGroup(), fetchMembers(), fetchInvitations(), fetchGroupProjects(), fetchGroupPages()]);
    setLoading(false);
  };

  const fetchGroup = async () => {
    const { data } = await supabase.from('groups').select('*').eq('id', groupId!).single();
    if (data) {
      setGroup(data);
      setSettingsName(data.name);
      setSettingsDescription(data.description ?? '');
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('id, user_id, role, joined_at, profiles(full_name, avatar_url)')
      .eq('group_id', groupId!)
      .order('joined_at', { ascending: true });

    if (data) {
      setMembers(data as GroupMember[]);
      const me = data.find((m: any) => m.user_id === user?.id);
      setMyRole(me?.role ?? null);
    }
  };

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from('group_invitations')
      .select('id, email, token, invited_by, expires_at, declined_at, profiles!invited_by(full_name)')
      .eq('group_id', groupId!)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (data) setInvitations(data as PendingInvitation[]);
  };

  const fetchGroupProjects = async () => {
    const { data } = await supabase
      .from('project_group_access')
      .select('id, permission, granted_at, canvas_projects(id, name, updated_at, user_id, thumbnail_url, thumbnail_updated_at, is_public, approval_status, canvas_width, canvas_height)')
      .eq('group_id', groupId!)
      .order('granted_at', { ascending: false });
    if (data) setGroupProjects(data as GroupProject[]);
  };

  const fetchGroupPages = async () => {
    const { data } = await supabase
      .from('project_page_group_access')
      .select('id, permission, granted_at, project_pages(id, name, description)')
      .eq('group_id', groupId!)
      .order('granted_at', { ascending: false });
    if (data) setGroupPages(data as GroupPage[]);
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

    const { error: accessError } = await supabase
      .from('project_group_access')
      .insert({ project_id: project.id, group_id: groupId!, permission: createProjectPermission, granted_by: user.id });

    setCreatingProject(false);
    if (accessError) {
      toast.error('Project created but failed to share with group');
    } else {
      toast.success('Project created and shared with group');
    }
    setShowCreateProjectDialog(false);
    setCreateProjectName('');
    setCreateProjectPermission('edit');
    navigate(`/canvas/${project.id}`);
  };

  const alreadyInGroupIds = useMemo(
    () => new Set(groupProjects.flatMap(gp => gp.canvas_projects ? [gp.canvas_projects.id] : [])),
    [groupProjects]
  );

  const alreadyInGroupPageIds = useMemo(
    () => new Set(groupPages.flatMap(gp => gp.project_pages ? [gp.project_pages.id] : [])),
    [groupPages]
  );

  const handleAddProjectToGroup = async (project: PickableProject, permission: 'view' | 'edit') => {
    if (!user) return;
    const { error } = await supabase
      .from('project_group_access')
      .insert({ project_id: project.id, group_id: groupId!, permission, granted_by: user.id });
    if (error) {
      if (error.code === '23505') toast.error('This project is already shared with this group');
      else toast.error('Failed to add project to group');
    } else {
      toast.success('Project added to group');
      fetchGroupProjects();
    }
  };

  const handleAddPageToGroup = async (page: PickablePage, permission: 'view' | 'edit') => {
    if (!user) return;
    const { error } = await supabase
      .from('project_page_group_access')
      .insert({ page_id: page.id, group_id: groupId!, permission, granted_by: user.id });
    if (error) {
      if (error.code === '23505') toast.error('This page is already shared with this group');
      else toast.error('Failed to add page to group');
    } else {
      toast.success('Page added to group');
      fetchGroupPages();
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('canvas_projects').delete().eq('id', projectId);
    if (error) toast.error('Failed to delete project');
    else { toast.success('Project deleted'); fetchGroupProjects(); }
  };

  const handleDuplicateProject = async (projectId: string) => {
    const { data: orig, error: fetchError } = await supabase
      .from('canvas_projects').select('*').eq('id', projectId).single();
    if (fetchError || !orig) { toast.error('Failed to load project'); return; }
    const { data: newProject, error: createError } = await supabase
      .from('canvas_projects')
      .insert({
        user_id: user!.id,
        name: `Copy of ${orig.name}`,
        canvas_data: orig.canvas_data,
        paper_size: orig.paper_size,
        canvas_width: orig.canvas_width,
        canvas_height: orig.canvas_height,
        thumbnail_url: orig.thumbnail_url,
        title: orig.title,
        description: orig.description,
        keywords: orig.keywords,
        citations: orig.citations,
      })
      .select().single();
    if (createError || !newProject) { toast.error('Failed to duplicate project'); return; }
    toast.success('Project duplicated');
    navigate(`/canvas/${newProject.id}`);
  };

  const handleCreatePage = async () => {
    if (!createPageName.trim()) { toast.error('Page name is required'); return; }
    if (!user) return;
    setCreatingPage(true);

    const { data: pageData, error: pageError } = await supabase
      .rpc('create_page', { p_name: createPageName.trim(), p_description: createPageDescription.trim() || null });

    if (pageError || !pageData?.length) {
      setCreatingPage(false);
      toast.error('Failed to create page');
      return;
    }

    const pageId = pageData[0].id;
    const { error: accessError } = await supabase
      .from('project_page_group_access')
      .insert({ page_id: pageId, group_id: groupId!, permission: 'edit', granted_by: user.id });

    setCreatingPage(false);
    if (accessError) {
      toast.error('Page created but failed to share with group');
    } else {
      toast.success('Page created and shared with group');
    }
    setShowCreatePageDialog(false);
    setCreatePageName('');
    setCreatePageDescription('');
    navigate(`/pages/${pageId}`);
  };

  const isManager = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const handleRemoveMember = (memberId: string, memberUserId: string, memberName: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (targetMember?.role === 'owner') {
      toast.error('The group owner cannot be removed from the group');
      return;
    }
    const isSelf = memberUserId === user?.id;
    setConfirmDialog({
      title: isSelf ? 'Leave group?' : `Remove ${memberName}?`,
      description: isSelf
        ? 'You will lose access to this group.'
        : `${memberName} will be removed from the group.`,
      onConfirm: async () => {
        const { error } = await supabase.from('group_members').delete().eq('id', memberId);
        if (error) { toast.error('Failed to remove member'); return; }
        toast.success(isSelf ? 'You left the group' : 'Member removed');
        fetchMembers();
      },
    });
  };

  const handleCopyInviteLink = async (invitation: PendingInvitation) => {
    const link = `${window.location.origin}/invite/group/${invitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(invitation.id);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    setResendingId(invitation.id);
    try {
      const { error } = await supabase.functions.invoke('resend-group-invitation', {
        body: { groupInvitationId: invitation.id, origin: window.location.origin },
      });
      if (error) throw error;
      toast.success(`Invitation resent to ${invitation.email}`);
      fetchInvitations();
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const handleRevokeInvitation = (invitationId: string, email: string) => {
    setConfirmDialog({
      title: 'Cancel invitation?',
      description: `The invitation to ${email} will be cancelled.`,
      onConfirm: async () => {
        const { error } = await supabase.from('group_invitations').delete().eq('id', invitationId);
        if (error) { toast.error('Failed to revoke invitation'); return; }
        toast.success('Invitation cancelled');
        fetchInvitations();
      },
    });
  };

  const handleSaveSettings = async () => {
    if (!settingsName.trim()) { toast.error('Group name is required'); return; }
    setSavingSettings(true);
    const { error } = await supabase
      .from('groups')
      .update({ name: settingsName.trim(), description: settingsDescription.trim() || null })
      .eq('id', groupId!);
    setSavingSettings(false);
    if (error) { toast.error('Failed to save settings'); return; }
    toast.success('Settings saved');
    fetchGroup();
  };

  const handleDeleteGroup = () => {
    setConfirmDialog({
      title: `Delete "${group?.name}"?`,
      description: 'This will permanently remove the group and all its members.',
      onConfirm: async () => {
        const { error } = await supabase.from('groups').delete().eq('id', groupId!);
        if (error) { toast.error('Failed to delete group'); return; }
        toast.success('Group deleted');
        navigate('/groups');
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <style>{gdStyles}</style>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Group not found.</p>
          <Button variant="link" onClick={() => navigate('/groups')}>Back to Groups</Button>
        </div>
      </div>
    );
  }

  const roleVariant = (role: string) => {
    if (role === 'owner') return 'default';
    if (role === 'admin') return 'secondary';
    return 'outline';
  };

  const membersContent = (
    <div className="space-y-6 mt-4">
      {isManager && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowInviteDialog(true)}
            className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            data-testid={GroupDetailTestIds.INVITE_BUTTON}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Members ({members.length})
        </h3>
        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-border hover:shadow-sm"
            data-testid={GroupDetailTestIds.MEMBER_ROW}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                  {member.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-medium text-sm" data-testid={GroupDetailTestIds.MEMBER_NAME}>
                    {member.profiles?.full_name ?? 'Unknown user'}
                    {member.user_id === user?.id && ' (you)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleVariant(member.role)} className="capitalize border-dashed" data-testid={GroupDetailTestIds.MEMBER_ROLE_BADGE}>
                  {member.role}
                </Badge>
                {(isManager || member.user_id === user?.id) && member.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveMember(member.id, member.user_id, member.profiles?.full_name ?? 'This member')}
                    data-testid={GroupDetailTestIds.REMOVE_MEMBER_BUTTON}
                    aria-label={member.user_id === user?.id ? 'Leave group' : undefined}
                    title={member.user_id === user?.id ? 'Leave group' : 'Remove member'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Invitations */}
      {isManager && invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Pending Invitations ({invitations.length})
          </h3>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-border hover:shadow-sm"
              data-testid={GroupDetailTestIds.PENDING_INVITE_ROW}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" data-testid={GroupDetailTestIds.PENDING_INVITE_EMAIL}>
                      {inv.email}
                    </p>
                    {inv.declined_at && (
                      <Badge variant="secondary" className="text-xs">Declined</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Copy invite link"
                    onClick={() => handleCopyInviteLink(inv)}
                    data-testid={GroupDetailTestIds.COPY_INVITE_LINK_BUTTON}
                  >
                    {copiedToken === inv.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleResendInvitation(inv)}
                    disabled={resendingId === inv.id}
                    data-testid={GroupDetailTestIds.RESEND_INVITE_BUTTON}
                  >
                    {resendingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resend'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                    data-testid={GroupDetailTestIds.REVOKE_INVITE_BUTTON}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid={GroupDetailTestIds.PAGE_CONTAINER}>
      <style>{gdStyles}</style>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8 gd-fade-1">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/groups')}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                  Group
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground tracking-tight" data-testid={GroupDetailTestIds.GROUP_NAME}>
                  {group.name}
                </h1>
                {myRole && (
                  <Badge variant={roleVariant(myRole)} className="capitalize border-dashed" data-testid={GroupDetailTestIds.ROLE_BADGE}>
                    {myRole}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="gd-fade-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex gap-1 rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-1.5 w-fit">
              {(['members', 'projects', 'pages', ...(isManager ? ['settings'] : [])] as string[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-testid={tab === 'projects' ? GroupDetailTestIds.PROJECTS_TAB : tab === 'pages' ? GroupDetailTestIds.PAGES_TAB : undefined}
                  className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 capitalize ${
                    activeTab === tab
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <TabsContent value="members">{membersContent}</TabsContent>

            <TabsContent value="projects" className="mt-4">
              {isManager && (
                <div className="flex justify-end gap-2 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddProjectDialog(true)}
                    className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                    data-testid={GroupDetailTestIds.ADD_PROJECT_BUTTON}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Add Project
                  </Button>
                  <Button
                    onClick={() => setShowCreateProjectDialog(true)}
                    className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                    data-testid={GroupDetailTestIds.NEW_PROJECT_BUTTON}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </div>
              )}
              {groupProjects.length === 0 ? (
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
                    <p className="text-muted-foreground">No projects have been shared with this group yet.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {groupProjects.map((gp, index) => {
                    const cp = gp.canvas_projects;
                    if (!cp) return null;
                    const isProjectOwner = cp.user_id === user?.id;
                    const thumbnailSrc = getThumbnailUrl(cp.id, cp.thumbnail_url || null);
                    const regenerating = isRegenerating(cp.id);
                    const error = hasError(cp.id);
                    return (
                      <div
                        key={gp.id}
                        data-testid={GroupDetailTestIds.PROJECT_ROW}
                        className="group/card relative rounded-xl border-2 border-dashed border-border/60 bg-card/60 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-border animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 opacity-0 group-hover/card:opacity-[0.015] transition-opacity duration-500 pointer-events-none z-[5]"
                          style={{
                            backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                          }}
                        />

                        {/* Thumbnail */}
                        <div className="relative w-full min-h-[160px] max-h-[280px] flex items-center justify-center bg-muted/30 overflow-hidden">
                          <ThumbnailWithSpinner
                            src={thumbnailSrc}
                            alt={cp.name}
                            isRegenerating={regenerating}
                            hasError={error}
                            className="max-w-full max-h-[280px] object-contain transition-transform duration-500 group-hover/card:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />
                          {cp.approval_status && cp.approval_status !== 'pending' && (
                            <div className="absolute top-4 right-4">
                              <Badge
                                variant={cp.approval_status === 'approved' ? 'default' : cp.approval_status === 'rejected' ? 'destructive' : 'secondary'}
                                className="shadow-lg backdrop-blur-sm"
                              >
                                {cp.approval_status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                                {cp.approval_status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                                {cp.approval_status}
                              </Badge>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                            <Button
                              onClick={() => navigate(`/canvas/${cp.id}`)}
                              size="lg"
                              className="shadow-xl bg-white/95 hover:bg-white text-foreground font-medium active:scale-[0.98]"
                            >
                              <FolderOpen className="w-5 h-5 mr-2" />
                              Open Project
                            </Button>
                          </div>
                        </div>

                        {/* Card content */}
                        <div className="relative z-10 p-5 space-y-4">
                          <h3 className="font-semibold text-foreground text-lg line-clamp-1 group-hover/card:text-primary transition-colors duration-200">
                            {cp.name}
                          </h3>
                          <div className="flex items-center justify-between text-sm">
                            <p className="text-muted-foreground flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {formatDistanceToNow(new Date(cp.updated_at), { addSuffix: true })}
                            </p>
                            {isProjectOwner ? (
                              <Badge
                                variant="outline"
                                className={`gap-1.5 font-medium border-dashed ${cp.is_public ? 'border-emerald-500/50 text-emerald-600 bg-emerald-500/5' : 'border-amber-500/50 text-amber-600 bg-amber-500/5'}`}
                              >
                                {cp.is_public ? <><Globe className="w-3.5 h-3.5" />Public</> : <><Lock className="w-3.5 h-3.5" />Private</>}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1.5 font-medium text-xs border-dashed">
                                {gp.permission === 'edit' ? 'Edit access' : 'View access'}
                              </Badge>
                            )}
                          </div>
                          {isProjectOwner && cp.canvas_width && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Ruler className="w-3.5 h-3.5" />
                              <span>{cp.canvas_width} × {cp.canvas_height} px</span>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2 border-t border-dashed border-border/40">
                            <Button
                              onClick={() => navigate(`/canvas/${cp.id}`)}
                              className="flex-1 gap-2 h-10 active:scale-[0.98]"
                              size="sm"
                            >
                              <FolderOpen className="w-4 h-4" />
                              Open
                            </Button>
                            {isProjectOwner && (
                              <>
                                <Button
                                  onClick={() => setShareDialogProject(cp)}
                                  variant="outline" size="sm"
                                  className="h-10 w-10 p-0 border-dashed"
                                  title="Publish to community"
                                >
                                  <Globe className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => setCollaborateProject(cp)}
                                  variant="outline" size="sm"
                                  className="h-10 w-10 p-0 border-dashed"
                                  title="Share"
                                >
                                  <Users className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDuplicateProject(cp.id)}
                                  variant="outline" size="sm"
                                  className="h-10 w-10 p-0 border-dashed"
                                  title="Duplicate project"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDeleteProject(cp.id, cp.name)}
                                  variant="ghost" size="sm"
                                  className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pages" className="mt-4">
              {isManager && (
                <div className="flex justify-end gap-2 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddPageDialog(true)}
                    className="border-2 border-dashed border-border/60 hover:border-border transition-all duration-200 active:scale-[0.98]"
                    data-testid={GroupDetailTestIds.ADD_PAGE_BUTTON}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Add Page
                  </Button>
                  <Button
                    onClick={() => setShowCreatePageDialog(true)}
                    className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                    data-testid={GroupDetailTestIds.NEW_PAGE_BUTTON}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Page
                  </Button>
                </div>
              )}
              {groupPages.length === 0 ? (
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
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No pages have been shared with this group yet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupPages.map((gp) => (
                    <div
                      key={gp.id}
                      className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-border hover:shadow-sm"
                      data-testid={GroupDetailTestIds.PAGE_ROW}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{gp.project_pages?.name ?? 'Unknown page'}</p>
                          {gp.project_pages?.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{gp.project_pages.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-dashed">
                            {gp.permission === 'edit' ? 'Edit' : 'View'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/pages/${gp.project_pages?.id}`)}
                            disabled={!gp.project_pages}
                            className="border-dashed transition-all duration-200 active:scale-[0.98]"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {isManager && (
              <TabsContent value="settings" className="space-y-6 mt-4">
                <div className="max-w-lg rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Group Name</Label>
                    <Input
                      id="settings-name"
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      maxLength={100}
                      className="border-2 border-dashed border-border/60 bg-background hover:border-border focus:border-primary/50 transition-all duration-200"
                      data-testid={GroupDetailTestIds.SETTINGS_NAME_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-description">Description</Label>
                    <Textarea
                      id="settings-description"
                      value={settingsDescription}
                      onChange={(e) => setSettingsDescription(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="border-2 border-dashed border-border/60 bg-background hover:border-border focus:border-primary/50 transition-all duration-200"
                      data-testid={GroupDetailTestIds.SETTINGS_DESCRIPTION_INPUT}
                    />
                  </div>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                    data-testid={GroupDetailTestIds.SETTINGS_SAVE_BUTTON}
                  >
                    {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Settings
                  </Button>
                </div>

                {isOwner && (
                  <div className="max-w-lg rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5 p-6">
                    <h3 className="font-medium text-destructive mb-2">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Deleting this group will remove all members and cannot be undone.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteGroup}
                      className="transition-all duration-200 active:scale-[0.98]"
                      data-testid={GroupDetailTestIds.DELETE_GROUP_BUTTON}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Group
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <InviteGroupMemberDialog
        groupId={groupId!}
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        onInvited={fetchAll}
      />

      <AddProjectPickerDialog
        open={showAddProjectDialog}
        onOpenChange={setShowAddProjectDialog}
        title="Add Project to Group"
        excludeIds={alreadyInGroupIds}
        showPermission
        onSelect={handleAddProjectToGroup}
        onCreateNew={() => { setShowAddProjectDialog(false); setShowCreateProjectDialog(true); }}
      />

      <AddPagePickerDialog
        open={showAddPageDialog}
        onOpenChange={setShowAddPageDialog}
        title="Add Page to Group"
        excludeIds={alreadyInGroupPageIds}
        onSelect={handleAddPageToGroup}
        onCreateNew={() => { setShowAddPageDialog(false); setShowCreatePageDialog(true); }}
      />

      {/* Create Project Dialog */}
      <Dialog
        open={showCreateProjectDialog}
        onOpenChange={(open) => { if (!open) { setShowCreateProjectDialog(false); setCreateProjectName(''); setCreateProjectPermission('edit'); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-project-name">Project Name *</Label>
              <Input
                id="create-project-name"
                value={createProjectName}
                onChange={(e) => setCreateProjectName(e.target.value)}
                placeholder="e.g. Membrane Transport Study"
                maxLength={100}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Group Access</Label>
              <Select value={createProjectPermission} onValueChange={(v) => setCreateProjectPermission(v as 'view' | 'edit')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Edit — members can modify</SelectItem>
                  <SelectItem value="view">View — members can view only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateProjectDialog(false); setCreateProjectName(''); setCreateProjectPermission('edit'); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={creatingProject}>
              {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Page Dialog */}
      <Dialog
        open={showCreatePageDialog}
        onOpenChange={(open) => { if (!open) { setShowCreatePageDialog(false); setCreatePageName(''); setCreatePageDescription(''); } }}
      >
        <DialogContent data-testid={CreatePageDialogTestIds.DIALOG}>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-page-name">Page Name *</Label>
              <Input
                id="create-page-name"
                value={createPageName}
                onChange={(e) => setCreatePageName(e.target.value)}
                placeholder="e.g. Lab Meeting Spring 2026"
                maxLength={100}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePage(); }}
                data-testid={CreatePageDialogTestIds.NAME_INPUT}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-page-description">Description</Label>
              <Textarea
                id="create-page-description"
                value={createPageDescription}
                onChange={(e) => setCreatePageDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreatePageDialog(false); setCreatePageName(''); setCreatePageDescription(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={creatingPage} data-testid={CreatePageDialogTestIds.SUBMIT_BUTTON}>
              {creatingPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDialog?.description}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareDialogProject && (
        <ShareProjectDialog
          project={shareDialogProject}
          isOpen={true}
          onClose={() => setShareDialogProject(null)}
          onUpdate={() => { setShareDialogProject(null); fetchGroupProjects(); }}
        />
      )}

      {collaborateProject && (
        <CollaborateDialog
          project={collaborateProject}
          isOpen={true}
          onClose={() => setCollaborateProject(null)}
        />
      )}
    </div>
  );
}
