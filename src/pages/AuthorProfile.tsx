import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/community/VerifiedBadge";
import { ArrowLeft, Eye, Heart, Copy, MapPin, FlaskConical, CalendarDays, Library, Users, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SEOHead } from "@/components/SEO/SEOHead";
import { AuthorProfileTestIds } from "@/lib/test-ids";
import { ProjectThumbnail } from "@/components/projects/ProjectThumbnail";
import { ProfileBadges } from "@/components/profile/ProfileBadges";
import { ProjectPreviewModal } from "@/components/community/ProjectPreviewModal";

export default function AuthorProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // Fetch author profile via SECURITY DEFINER RPC so users without
  // any public projects still get a profile page (with an empty
  // projects state below) instead of a "Profile not found" wall.
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['author-profile', userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_author_profile', { p_user_id: userId });
      if (error) throw error;
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!userId,
  });

  // Fetch verification status
  const { data: verificationData } = useQuery({
    queryKey: ['author-verification', userId],
    queryFn: async () => {
      const { data } = await supabase
        .rpc('get_user_premium_progress', { check_user_id: userId! })
        .single();
      return data;
    },
    enabled: !!userId,
  });

  // Fetch public projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['author-projects', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('id, title, description, thumbnail_url, thumbnail_updated_at, view_count, like_count, cloned_count, updated_at, keywords, user_id, canvas_width, canvas_height, paper_size')
        .eq('user_id', userId)
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch total projects (including private) and collaborations for badges
  const { data: authorStats } = useQuery({
    queryKey: ['author-full-stats', userId],
    queryFn: async () => {
      const [allProjectsRes, collabsRes] = await Promise.all([
        supabase
          .from('canvas_projects')
          .select('id', { count: 'exact' })
          .eq('user_id', userId),
        supabase
          .from('project_collaborators')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .not('accepted_at', 'is', null),
      ]);
      return {
        totalProjects: allProjectsRes.count || 0,
        totalCollaborations: collabsRes.count || 0,
      };
    },
    enabled: !!userId,
  });

  // Calculate aggregate stats
  const stats = projects ? {
    projectCount: projects.length,
    totalViews: projects.reduce((sum, p) => sum + (p.view_count || 0), 0),
    totalLikes: projects.reduce((sum, p) => sum + (p.like_count || 0), 0),
    totalClones: projects.reduce((sum, p) => sum + (p.cloned_count || 0), 0),
  } : null;

  const isVerified = verificationData?.approved_count >= 3;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <Skeleton className="h-8 w-32 mb-10" />
          <div className="flex flex-col md:flex-row items-start gap-8 mb-10">
            <Skeleton className="w-24 h-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-3 w-full">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden border-border">
                <Skeleton className="w-full aspect-[4/3]" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <Button variant="ghost" size="sm" onClick={() => navigate('/community')} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Community
          </Button>
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/40 flex items-center justify-center">
              <Library className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-3">Profile not found</h2>
            <p className="text-muted-foreground">This author profile doesn't exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = (profile.full_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <SEOHead
        title={`${profile.full_name || 'Anonymous'} - Author Profile`}
        description={profile.bio || `View ${profile.full_name || 'Anonymous'}'s scientific diagrams and projects`}
      />

      <div className="min-h-screen bg-background" data-testid={AuthorProfileTestIds.PAGE_CONTAINER}>
        <main className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/community')} className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Community
          </Button>

          {/* Hero card — bespoke, matches settings Profile page design language */}
          <div className="pf-fade-1 mb-10 relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm px-6 md:px-10 py-10 md:py-14">
            {/* Atomic-orbit motif backdrop */}
            <svg
              aria-hidden
              viewBox="0 0 200 200"
              className="pointer-events-none absolute -top-8 -right-8 w-56 h-56 md:w-72 md:h-72 text-muted-foreground opacity-25"
            >
              <defs>
                <linearGradient id="authorOrbitFade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <g stroke="url(#authorOrbitFade)" fill="none" strokeWidth="1.4">
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

            {/* Centered content stack */}
            <div className="relative flex flex-col items-center text-center gap-5 max-w-3xl mx-auto">
              {/* Avatar */}
              <Avatar
                className="w-24 h-24 md:w-28 md:h-28 ring-4 ring-background shadow-lg border border-border"
                data-testid={AuthorProfileTestIds.PROFILE_AVATAR}
              >
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || 'Author'} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Name + optional Premium pill */}
              <div className="flex flex-col items-center gap-2">
                <h1
                  className="text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight"
                  data-testid={AuthorProfileTestIds.PROFILE_NAME}
                >
                  {profile.full_name || 'Anonymous'}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary text-xs font-semibold">
                    <Sparkles className="h-3 w-3" />
                    Premium
                  </span>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p
                  className="text-sm md:text-base text-muted-foreground max-w-lg leading-relaxed"
                  data-testid={AuthorProfileTestIds.PROFILE_BIO}
                >
                  {profile.bio}
                </p>
              )}

              {/* Meta info (field · country · joined) */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                {profile.field_of_study && (
                  <span
                    className="inline-flex items-center gap-1 text-muted-foreground"
                    data-testid={AuthorProfileTestIds.PROFILE_FIELD}
                  >
                    <FlaskConical className="h-3 w-3" />
                    {profile.field_of_study}
                  </span>
                )}
                {profile.country && (
                  <>
                    {profile.field_of_study && <span className="text-border">·</span>}
                    <span
                      className="inline-flex items-center gap-1 text-muted-foreground"
                      data-testid={AuthorProfileTestIds.PROFILE_COUNTRY}
                    >
                      <MapPin className="h-3 w-3" />
                      {profile.country}
                    </span>
                  </>
                )}
                {profile.created_at && (
                  <>
                    {(profile.field_of_study || profile.country) && <span className="text-border">·</span>}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </>
                )}
              </div>

              {/* Stats */}
              {stats && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border"
                    data-testid={AuthorProfileTestIds.STAT_PROJECTS}
                  >
                    <Library className="w-4 h-4 text-primary" />
                    <span className="text-base font-bold text-foreground tabular-nums">{stats.projectCount}</span>
                    <span className="text-xs text-muted-foreground">project{stats.projectCount !== 1 ? 's' : ''}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border"
                    data-testid={AuthorProfileTestIds.STAT_VIEWS}
                  >
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-base font-bold text-foreground tabular-nums">{stats.totalViews.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">view{stats.totalViews !== 1 ? 's' : ''}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border"
                    data-testid={AuthorProfileTestIds.STAT_LIKES}
                  >
                    <Heart className="w-4 h-4 text-muted-foreground" />
                    <span className="text-base font-bold text-foreground tabular-nums">{stats.totalLikes.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">like{stats.totalLikes !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Earned Badges */}
          {profile && (
            <div className="mb-10">
              <ProfileBadges
                avatarUrl={profile.avatar_url || ''}
                bio={profile.bio || ''}
                quote={profile.quote || ''}
                totalProjects={authorStats?.totalProjects || 0}
                publicProjects={stats?.projectCount || 0}
                totalViews={stats?.totalViews || 0}
                totalLikes={stats?.totalLikes || 0}
                totalClones={stats?.totalClones || 0}
                totalCollaborations={authorStats?.totalCollaborations || 0}
                earnedOnly
              />
            </div>
          )}

          {/* Projects Section Header — matches Community page section style */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Published Work
              </span>
            </div>
            <h2 className="text-2xl font-serif font-semibold text-foreground tracking-tight">
              Public Projects
            </h2>
          </div>

          {/* Projects Grid */}
          <div data-testid={AuthorProfileTestIds.PROJECTS_SECTION}>
            {projectsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="overflow-hidden border-border rounded-xl">
                    <Skeleton className="w-full aspect-[4/3]" />
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                {projects.map((project, index) => (
                  <div key={project.id} data-testid={AuthorProfileTestIds.PROJECT_CARD} onClick={() => setSelectedProject({
                      ...project,
                      paper_size: project.paper_size || 'Custom',
                      profiles: { full_name: profile?.full_name || null, avatar_url: profile?.avatar_url || null },
                    })}>
                    <Card
                      className="group overflow-hidden bg-card border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300 cursor-pointer animate-fade-in rounded-xl"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Thumbnail */}
                      <div className="relative overflow-hidden bg-muted/40 aspect-[4/3]">
                        <ProjectThumbnail
                          project={project}
                          alt={project.title || 'Project'}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      </div>

                      {/* Title & Description */}
                      <CardContent className="px-4 py-3 space-y-1">
                        <h3 className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {project.title || 'Untitled Project'}
                        </h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                            {project.description}
                          </p>
                        )}
                        {project.keywords && project.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {project.keywords.slice(0, 3).map((keyword, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs px-2 py-0 rounded-full font-normal bg-muted/40 text-muted-foreground"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>

                      {/* Stats bar — matches ProjectCard */}
                      <div className="flex items-center justify-around border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="font-medium">{(project.view_count || 0).toLocaleString()}</span>
                        </div>
                        <div className="w-px h-3.5 bg-border" />
                        <div className="flex items-center gap-1">
                          <Copy className="h-3.5 w-3.5" />
                          <span className="font-medium">{(project.cloned_count || 0).toLocaleString()}</span>
                        </div>
                        <div className="w-px h-3.5 bg-border" />
                        <div className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" />
                          <span className="font-medium">{(project.like_count || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <Library className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-serif font-semibold text-foreground mb-3">No Shared Community Projects Yet</h2>
                  <p className="text-muted-foreground">
                    This author hasn't shared any public projects with the community yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <ProjectPreviewModal
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </>
  );
}
