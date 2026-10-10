import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Upload, User as UserIcon, Bell, BellOff, Trash2, Lock, Settings, AlertTriangle,
  Eye, Heart, FolderOpen, MapPin, FlaskConical, CalendarDays, Quote as QuoteIcon,
  Pencil, ExternalLink, Sparkles,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { COUNTRIES, FIELDS_OF_STUDY } from '@/lib/constants';
import { ProfileCompletenessBar } from '@/components/profile/ProfileCompletenessBar';
import { VerifiedBadge } from '@/components/community/VerifiedBadge';
import { Switch } from '@/components/ui/switch';
import { ProfileTestIds } from '@/lib/test-ids';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { PurchaseHistoryPanel } from '@/components/credits/PurchaseHistoryPanel';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasAccess, approvedCount: featureApproved } = useFeatureAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle return from Stripe Checkout — refresh the balance and toast.
  useEffect(() => {
    const status = searchParams.get('checkout');
    if (!status) return;
    if (status === 'success') {
      toast.success('Credits added to your account');
      // Give the webhook a moment to land, then refresh the balance pill + dialog.
      const t = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['generation-balance', user?.id] });
      }, 1200);
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(t);
    }
    if (status === 'cancel') {
      toast.message('Checkout canceled');
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, user?.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [quote, setQuote] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [country, setCountry] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletionRequesting, setDeletionRequesting] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences state
  type NotifPrefs = Record<string, { in_app: boolean; email: boolean }>;
  const DEFAULT_NOTIF_PREFS: NotifPrefs = {
    group_invitation:   { in_app: true, email: true },
    project_invitation: { in_app: true, email: true },
    page_invitation:    { in_app: true, email: true },
    comment_new:        { in_app: true, email: true },
    comment_reply:      { in_app: true, email: true },
    project_locked:     { in_app: true, email: false },
    email_drip:         { in_app: false, email: true },
  };
  const NOTIF_LABELS: Record<string, string> = {
    group_invitation:   'Group invitations',
    project_invitation: 'Project collaboration invitations',
    page_invitation:    'Page invitations',
    comment_new:        'New comments on your projects',
    comment_reply:      'Replies to your comments',
    project_locked:     'Project locked/unlocked',
    email_drip:         'Getting started & tips emails',
  };
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch user's project stats
  const { data: projectStats } = useQuery({
    queryKey: ['profile-project-stats', user?.id],
    queryFn: async () => {
      const [publicRes, allRes, collabsRes] = await Promise.all([
        supabase
          .from('canvas_projects')
          .select('id, view_count, like_count, cloned_count')
          .eq('user_id', user!.id)
          .eq('is_public', true)
          .eq('approval_status', 'approved'),
        supabase
          .from('canvas_projects')
          .select('id', { count: 'exact' })
          .eq('user_id', user!.id),
        supabase
          .from('project_collaborators')
          .select('id', { count: 'exact' })
          .eq('user_id', user!.id)
          .not('accepted_at', 'is', null),
      ]);

      const publicProjects = publicRes.data || [];
      return {
        totalProjects: allRes.count || 0,
        publicProjects: publicProjects.length,
        totalViews: publicProjects.reduce((sum, p) => sum + (p.view_count || 0), 0),
        totalLikes: publicProjects.reduce((sum, p) => sum + (p.like_count || 0), 0),
        totalClones: publicProjects.reduce((sum, p) => sum + (p.cloned_count || 0), 0),
        totalCollaborations: collabsRes.count || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch user notifications
  const { data: notifications, isLoading: loadingNotifications, refetch: refetchNotifications } = useQuery({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // Mark notification as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] });
      toast.success('Notification marked as read');
    },
    onError: () => toast.error('Failed to mark notification as read'),
  });

  // Mark all as read mutation
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] });
      toast.success('All notifications marked as read');
    },
    onError: () => toast.error('Failed to mark notifications as read'),
  });

  // Delete notification mutation
  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] });
      toast.success('Notification deleted');
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Password updated successfully');
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update password'),
  });

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const handleSaveNotifPrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const prefsToSave: NotifPrefs = { ...notifPrefs };
    for (const type of ['group_invitation', 'project_invitation', 'page_invitation'] as const) {
      if (prefsToSave[type]) prefsToSave[type] = { ...prefsToSave[type], email: true };
    }
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: prefsToSave })
      .eq('id', user.id);
    setSavingPrefs(false);
    if (error) {
      toast.error('Failed to save notification settings');
    } else {
      toast.success('Notification settings saved');
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadProfile();
  }, [user, navigate]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || '');
        setEmail(data.email || user?.email || '');
        setQuote(data.quote || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
        setCountry(data.country || '');
        setFieldOfStudy(data.field_of_study || '');
        setCreatedAt(data.created_at || '');
        if (data.notification_preferences) {
          const merged = { ...DEFAULT_NOTIF_PREFS, ...(data.notification_preferences as NotifPrefs) };
          for (const type of ['group_invitation', 'project_invitation', 'page_invitation'] as const) {
            if (merged[type]) merged[type] = { ...merged[type], email: true };
          }
          setNotifPrefs(merged);
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG or JPG file only');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('Image must be less than 500KB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-assets')
        .getPublicUrl(filePath);

      // Persist the new avatar URL to profiles immediately so it
      // survives a page reload without requiring the user to also
      // click Save. The Save button still applies other field edits.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
      // Refresh anything that reads the cached avatar (UserMenu,
      // public_profiles, etc.) so the new image shows up right away.
      queryClient.invalidateQueries({ queryKey: ['user-profile-avatar', user.id] });
      queryClient.invalidateQueries({ queryKey: ['author-profile', user.id] });
      toast.success('Avatar updated');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: email,
          quote: quote,
          bio: bio,
          avatar_url: avatarUrl,
          country: country,
          field_of_study: fieldOfStudy,
        })
        .eq('id', user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['ai-generation-usage'] });
      queryClient.invalidateQueries({ queryKey: ['profile-project-stats'] });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const stats = projectStats || {
    totalProjects: 0, publicProjects: 0, totalViews: 0,
    totalLikes: 0, totalClones: 0, totalCollaborations: 0,
  };

  const inputClass = "h-11 bg-card/80 border border-border focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl transition-all duration-200 text-foreground font-medium placeholder:text-muted-foreground";
  const selectTriggerClass = "h-11 bg-card/80 border border-border focus:border-primary rounded-xl transition-all duration-200 text-foreground font-medium";

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background">
      {/* ── Profile Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 md:pt-10">
        {/* ── Hero card (scientific theme — matches Projects) ── */}
        <div className="pf-fade-1 relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm px-7 md:px-10 py-7 md:py-9">
          {/* Atomic-orbit motif backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-muted-foreground opacity-25"
          >
            <defs>
              <linearGradient id="profileOrbitFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g stroke="url(#profileOrbitFade)" fill="none" strokeWidth="1.4">
              <ellipse cx="100" cy="100" rx="78" ry="28" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(60 100 100)" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(-60 100 100)" />
            </g>
            <g className="text-primary" fill="currentColor">
              <circle cx="100" cy="100" r="6" opacity="0.55" />
              <circle cx="172" cy="106" r="3.5" opacity="0.7" />
              <circle cx="56" cy="72" r="2.8" opacity="0.5" />
              <circle cx="68" cy="146" r="2.5" opacity="0.4" />
            </g>
          </svg>

          <div className="relative flex items-start gap-5 flex-wrap">
            {/* Avatar with upload */}
            <div className="relative flex-shrink-0">
              <Avatar className="h-20 w-20 ring-2 ring-background shadow-md border border-border">
                <AvatarImage src={avatarUrl} alt={fullName} />
                <AvatarFallback className="text-xl bg-muted text-muted-foreground font-semibold">
                  {initials || <UserIcon className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <Input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card shadow-md border border-border"
                disabled={uploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              </Button>
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + verified badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight tracking-tight">
                  {fullName || "Your Name"}
                </h1>
                {hasAccess && <VerifiedBadge size="sm" showTooltip={false} />}
              </div>

              {/* Meta line: [Premium badge?] · Joined · Field · Country */}
              <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                {hasAccess && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary font-semibold">
                    <Sparkles className="h-3 w-3" />
                    Premium
                  </span>
                )}
                {createdAt && (
                  <>
                    {hasAccess && <span className="text-border">·</span>}
                    <span className="text-muted-foreground">
                      Joined{" "}
                      {new Date(createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </>
                )}
                {fieldOfStudy && (
                  <>
                    {(hasAccess || createdAt) && <span className="text-border">·</span>}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <FlaskConical className="h-3 w-3" />
                      {fieldOfStudy}
                    </span>
                  </>
                )}
                {country && (
                  <>
                    {(hasAccess || createdAt || fieldOfStudy) && <span className="text-border">·</span>}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {country}
                    </span>
                  </>
                )}
              </div>
              {bio && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 max-w-xl">{bio}</p>
              )}

              {/* Anchor stats — projects, views, likes */}
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{stats.totalProjects}</span>
                  project{stats.totalProjects === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <Eye className="h-2.5 w-2.5" />
                  <span className="font-semibold text-foreground tabular-nums">{stats.totalViews}</span>
                  view{stats.totalViews === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                  <Heart className="h-2.5 w-2.5" />
                  <span className="font-semibold text-foreground tabular-nums">{stats.totalLikes}</span>
                  like{stats.totalLikes === 1 ? "" : "s"}
                </span>
              </div>

              {quote && (
                <div className="flex items-start gap-2 mt-3 max-w-xl">
                  <QuoteIcon className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground italic leading-relaxed">"{quote}"</p>
                </div>
              )}
            </div>

            {/* Action buttons (top-right) */}
            <div className="flex sm:flex-col gap-2 flex-shrink-0 relative z-10">
              <Button
                size="sm"
                onClick={() => navigate(`/author/${user?.id}`)}
                className="gap-1.5 shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Public profile
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/projects")}
                className="gap-1.5"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                My projects
              </Button>
            </div>
          </div>
        </div>

        {/* ── Profile Completeness ── */}
        <div className="mt-6 pf-fade-2">
          <ProfileCompletenessBar
            avatarUrl={avatarUrl}
            bio={bio}
            quote={quote}
            publicProjectCount={stats.publicProjects}
          />
        </div>

        {/* ── Main Content Grid ── */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 pf-fade-3">

          {/* ── Edit Profile + Notifications ── */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-sm p-6">
              <Tabs
                defaultValue="profile"
                className="w-full"
                onValueChange={(v) => { if (v === 'notifications') refetchNotifications(); }}
              >
                <TabsList className="grid w-full grid-cols-3 mb-6 h-10 rounded-full bg-muted/60 p-1">
                  <TabsTrigger value="profile" className="text-sm rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit Profile
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="relative text-sm rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200">
                    <Bell className="h-3.5 w-3.5 mr-1.5" />
                    Notifications
                    {!loadingNotifications && unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-1.5 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-sm rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200">
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Settings
                  </TabsTrigger>
                </TabsList>

                {/* ── Edit Profile Tab ── */}
                <TabsContent value="profile" className="space-y-5 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-sm font-semibold text-foreground">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-sm font-semibold text-foreground">Country</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger id="country" className={selectTriggerClass}>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[280px]">
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fieldOfStudy" className="text-sm font-semibold text-foreground">Field of Study</Label>
                      <Select value={fieldOfStudy} onValueChange={setFieldOfStudy}>
                        <SelectTrigger id="fieldOfStudy" className={selectTriggerClass}>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELDS_OF_STUDY.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="quote" className="text-sm font-semibold text-foreground">Quote</Label>
                    <Input
                      id="quote"
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      placeholder="A short motto or quote"
                      maxLength={200}
                      className={inputClass}
                    />
                    <p className={cn(
                      "text-xs text-right",
                      quote.length >= 200 ? "text-destructive font-medium"
                        : quote.length >= 160 ? "text-amber-600"
                        : "text-muted-foreground"
                    )}>
                      {quote.length}/200
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-sm font-semibold text-foreground">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      maxLength={500}
                      className="resize-none bg-card/80 border border-border focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl transition-all duration-200 text-foreground font-medium placeholder:text-muted-foreground min-h-[90px]"
                    />
                    <p className={cn(
                      "text-xs text-right",
                      bio.length >= 500 ? "text-destructive font-medium"
                        : bio.length >= 400 ? "text-amber-600"
                        : "text-muted-foreground"
                    )}>
                      {bio.length}/500
                    </p>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </TabsContent>

                {/* ── Notifications Tab ── */}
                <TabsContent value="notifications" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </p>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllAsRead.mutate()}
                        disabled={markAllAsRead.isPending}
                        className="active:scale-[0.98]"
                      >
                        <BellOff className="h-4 w-4 mr-1.5" />
                        Mark All Read
                      </Button>
                    )}
                  </div>

                  {loadingNotifications ? (
                    <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 p-12 flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : notifications && notifications.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "p-4 rounded-xl border border-border bg-muted/40 transition-all duration-200 hover:border-border",
                              !notification.is_read && "border-l-4 border-l-primary bg-primary/5"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {!notification.is_read && (
                                    <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>
                                  )}
                                  <h4 className="text-sm font-medium text-foreground truncate">{notification.subject}</h4>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                                {(notification as any).link && (
                                  <a
                                    href={(notification as any).link}
                                    className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                                    onClick={() => markAsRead.mutate(notification.id)}
                                  >
                                    Accept Invitation →
                                  </a>
                                )}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{notification.sender_name}</span>
                                  <span>·</span>
                                  <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => markAsRead.mutate(notification.id)}
                                    disabled={markAsRead.isPending}
                                    title="Mark as read"
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setNotificationToDelete(notification.id)}
                                  disabled={deleteNotification.isPending}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 p-12 text-center">
                      <BellOff className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  )}

                  <Dialog
                    open={notificationToDelete !== null}
                    onOpenChange={(open) => !open && setNotificationToDelete(null)}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete notification?</DialogTitle>
                        <DialogDescription>
                          This notification will be permanently removed. This can't be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNotificationToDelete(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={deleteNotification.isPending}
                          onClick={() => {
                            if (!notificationToDelete) return;
                            deleteNotification.mutate(notificationToDelete, {
                              onSettled: () => setNotificationToDelete(null),
                            });
                          }}
                        >
                          {deleteNotification.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                {/* ── Settings Tab ── */}
                <TabsContent value="settings" className="space-y-5 mt-0">
                  {/* Password */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Password</p>
                        <p className="text-xs text-muted-foreground">Change your account password</p>
                      </div>
                    </div>
                    <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="active:scale-[0.98]">Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Password</DialogTitle>
                          <DialogDescription>
                            Enter your current password and choose a new one.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                              id="current-password"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                              id="new-password"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input
                              id="confirm-password"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPasswordDialogOpen(false);
                              setCurrentPassword('');
                              setNewPassword('');
                              setConfirmPassword('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handlePasswordChange}
                            disabled={changePassword.isPending}
                            className="active:scale-[0.98]"
                          >
                            {changePassword.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              'Update Password'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Purchase History (AI credits) */}
                  <PurchaseHistoryPanel />

                  {/* Notification Preferences */}
                  <div
                    className="rounded-xl border border-border bg-muted/40 p-5"
                    data-testid={ProfileTestIds.NOTIFICATION_SETTINGS_CARD}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Bell className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Notification Preferences</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-3 items-center">
                        <span className="text-xs font-medium text-muted-foreground col-start-2">In-App</span>
                        <span className="text-xs font-medium text-muted-foreground">Email</span>
                        {Object.entries(NOTIF_LABELS).map(([key, label]) => {
                          const emailLocked = ['group_invitation', 'project_invitation', 'page_invitation'].includes(key);
                          const emailOnly = key === 'email_drip';
                          return (
                            <React.Fragment key={key}>
                              <span className="text-sm">{label}</span>
                              {emailOnly ? (
                                <span />
                              ) : (
                                <Switch
                                  checked={notifPrefs[key]?.in_app ?? true}
                                  onCheckedChange={(v) =>
                                    setNotifPrefs((p) => ({ ...p, [key]: { ...p[key], in_app: v } }))
                                  }
                                  data-testid={`${ProfileTestIds.NOTIF_TOGGLE_IN_APP}-${key}`}
                                />
                              )}
                              <Switch
                                checked={emailLocked ? true : (notifPrefs[key]?.email ?? true)}
                                disabled={emailLocked}
                                onCheckedChange={emailLocked ? undefined : (v) =>
                                  setNotifPrefs((p) => ({ ...p, [key]: { ...p[key], email: v } }))
                                }
                                data-testid={`${ProfileTestIds.NOTIF_TOGGLE_EMAIL}-${key}`}
                              />
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div className="flex justify-end pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={handleSaveNotifPrefs}
                          disabled={savingPrefs}
                          data-testid={ProfileTestIds.NOTIF_SAVE_BUTTON}
                          className="active:scale-[0.98]"
                        >
                          {savingPrefs ? (
                            <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Saving...</>
                          ) : (
                            'Save Settings'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Delete Account */}
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-destructive/10 p-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">Delete Account</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Request permanent deletion of your account and all associated data. This action cannot be undone.
                        </p>
                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="mt-3 rounded-lg">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Request Account Deletion
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Request Account Deletion</DialogTitle>
                              <DialogDescription>
                                This will send a deletion request to our admin team. Your account will remain active until an admin processes the request.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                              <Label htmlFor="delete-reason">Reason for leaving (optional)</Label>
                              <Textarea
                                id="delete-reason"
                                placeholder="Help us improve — why are you leaving?"
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                className="min-h-[80px]"
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                disabled={deletionRequesting}
                                onClick={async () => {
                                  setDeletionRequesting(true);
                                  try {
                                    const { error } = await supabase.functions.invoke('request-account-deletion', {
                                      body: {
                                        userId: user?.id,
                                        userEmail: user?.email || email,
                                        userName: fullName,
                                        reason: deleteReason,
                                      },
                                    });
                                    if (error) throw error;
                                    toast.success('Your account deletion request has been submitted.');
                                    setShowDeleteDialog(false);
                                    setDeleteReason('');
                                  } catch (err: any) {
                                    console.error('Deletion request error:', err);
                                    toast.error('Failed to submit deletion request. Please try again.');
                                  }
                                  setDeletionRequesting(false);
                                }}
                              >
                                {deletionRequesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Submit Deletion Request
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>
    </div>
  );
}
