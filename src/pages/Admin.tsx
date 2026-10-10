import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Wrench,
  Film,
  Megaphone,
  Brain,
  FolderOpen,
  MessageSquareQuote,
  Upload,
  Lightbulb,
  Globe,
  ImageUp,
  LayoutGrid,
  Dna,
  Eraser,
  ShieldCheck,
  Tags,
  Mail,
  Star,
  Factory,
  Box,
  Bot,
  Shield,
  BarChart3,
  MailIcon,
  Bug,
  LayoutTemplate,
  Download,
  ClipboardList,
  FlaskConical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { IconUploader } from "@/components/admin/IconUploader";
import { IconManager } from "@/components/admin/IconManager";
import { MembraneSettingsPanel } from "@/components/admin/MembraneSettingsPanel";
import { IconCleanup } from "@/components/admin/IconCleanup";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { ThumbnailGenerator } from "@/components/admin/ThumbnailGenerator";
import { ThumbnailRegenerator } from "@/components/admin/ThumbnailRegenerator";
import { IconThumbnailRegenerator } from "@/components/admin/IconThumbnailRegenerator";
import { SubmittedProjects } from "@/components/admin/SubmittedProjects";
import { TestimonialManager } from "@/components/admin/TestimonialManager";
import { IconSubmissionManager } from "@/components/admin/IconSubmissionManager";
import { IconSuggestionManager } from "@/components/admin/IconSuggestionManager";
import { IconSanitizer } from "@/components/admin/IconSanitizer";
import { IconNameCleaner } from "@/components/admin/IconNameCleaner";
import { CommunityUploader } from "@/components/admin/CommunityUploader";
import { ContactMessagesManager } from "@/components/admin/ContactMessagesManager";
import { ToolFeedbackManager } from "@/components/admin/ToolFeedbackManager";
import { BugReportsManager } from "@/components/admin/BugReportsManager";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { AIUsageAnalytics } from "@/components/admin/AIUsageAnalytics";
import { DownloadAnalytics } from "@/components/admin/DownloadAnalytics";
import { MaintenanceToggle } from "@/components/admin/MaintenanceToggle";
import { AnimationFeatureToggle } from "@/components/admin/AnimationFeatureToggle";
import { TemplateManager } from "@/components/admin/TemplateManager";
import { SurveyResponsesManager } from "@/components/admin/SurveyResponsesManager";
import { SEOHead } from "@/components/SEO/SEOHead";
import type { LucideIcon } from "lucide-react";

// Section accent colors — keeps the dashboard quietly varied so admins
// can scan section identities at a glance. Default falls back to primary.
type SectionTone =
  | "slate" | "emerald" | "amber" | "violet" | "sky"
  | "rose" | "orange" | "pink" | "cyan" | "indigo";

// shadowRgb: matches the tone for a subtle ambient glow on the icon badge.
const SECTION_TONES: Record<SectionTone, { bg: string; border: string; text: string; shadowRgb: string }> = {
  slate:   { bg: "bg-slate-100",   border: "border-slate-200",   text: "text-slate-700",   shadowRgb: "100, 116, 139" },
  emerald: { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", shadowRgb: "16, 185, 129"  },
  amber:   { bg: "bg-amber-100",   border: "border-amber-200",   text: "text-amber-700",   shadowRgb: "234, 179, 8"   },
  violet:  { bg: "bg-violet-100",  border: "border-violet-200",  text: "text-violet-700",  shadowRgb: "139, 92, 246"  },
  sky:     { bg: "bg-sky-100",     border: "border-sky-200",     text: "text-sky-700",     shadowRgb: "14, 165, 233"  },
  rose:    { bg: "bg-rose-100",    border: "border-rose-200",    text: "text-rose-700",    shadowRgb: "244, 63, 94"   },
  orange:  { bg: "bg-orange-100",  border: "border-orange-200",  text: "text-orange-700",  shadowRgb: "249, 115, 22"  },
  pink:    { bg: "bg-pink-100",    border: "border-pink-200",    text: "text-pink-700",    shadowRgb: "236, 72, 153"  },
  cyan:    { bg: "bg-cyan-100",    border: "border-cyan-200",    text: "text-cyan-700",    shadowRgb: "6, 182, 212"   },
  indigo:  { bg: "bg-indigo-100",  border: "border-indigo-200",  text: "text-indigo-700",  shadowRgb: "99, 102, 241"  },
};

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  tone,
  priority,
  pendingCount,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone?: SectionTone;
  /** When 'high', renders a slightly larger icon badge and shows a NEEDS
   *  REVIEW pill next to the title if pendingCount > 0. */
  priority?: 'high';
  pendingCount?: number;
}) => {
  const t = tone ? SECTION_TONES[tone] : null;
  const isHigh = priority === 'high';
  const showBadge = isHigh && (pendingCount ?? 0) > 0;
  const badgeSize = isHigh ? "w-10 h-10" : "w-9 h-9";
  const iconSize = isHigh ? "h-5 w-5" : "h-4.5 w-4.5";
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3.5 mb-2">
        <div
          className={`flex items-center justify-center ${badgeSize} rounded-lg border ${t ? `${t.bg} ${t.border}` : "bg-primary/8 border-primary/10"}`}
          style={t ? { boxShadow: `0 4px ${isHigh ? 18 : 14}px -4px rgba(${t.shadowRgb}, ${isHigh ? 0.42 : 0.32})` } : undefined}
        >
          <Icon className={`${iconSize} ${t ? t.text : "text-primary"}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
              {title}
            </h2>
            {showBadge && t && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.text} ${t.bg} border ${t.border}`}
              >
                Needs review · {pendingCount}
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const SectionDivider = () => (
  <div className="my-16 border-t border-border/20" />
);

type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: SectionTone;
  count: number;
};

const QuickActionCard = ({ action }: { action: QuickAction }) => {
  const t = SECTION_TONES[action.tone];
  const Icon = action.icon;
  const hasPending = action.count > 0;
  const onClick = () => {
    const el = document.getElementById(action.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-2 rounded-xl border ${t.border} ${t.bg} p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md`}
      style={{ boxShadow: `0 4px 14px -6px rgba(${t.shadowRgb}, 0.32)` }}
    >
      <div className="flex items-center justify-between w-full">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/70 ${t.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        {hasPending && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${t.text} bg-white/80`}>
            {action.count}
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-bold text-foreground">{action.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {hasPending ? `${action.count} pending` : "All clear"}
        </div>
      </div>
    </button>
  );
};

const Admin = () => {
  const navigate = useNavigate();
  const [quickCounts, setQuickCounts] = useState({
    submittedProjects: 0,
    iconSubmissions: 0,
    bugReports: 0,
    contactMessages: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projects, icons, bugs, messages] = await Promise.all([
          supabase
            .from("canvas_projects")
            .select("id", { count: "exact", head: true })
            .eq("approval_status", "pending"),
          supabase
            .from("icon_submissions")
            .select("id", { count: "exact", head: true })
            .eq("approval_status", "pending"),
          supabase
            .from("bug_reports" as any)
            .select("id", { count: "exact", head: true })
            .or("is_viewed.is.null,is_viewed.eq.false"),
          supabase
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false),
        ]);
        if (cancelled) return;
        setQuickCounts({
          submittedProjects: projects.count ?? 0,
          iconSubmissions: icons.count ?? 0,
          bugReports: bugs.count ?? 0,
          contactMessages: messages.count ?? 0,
        });
      } catch (err) {
        console.warn("[admin] quick counts fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quickActions: QuickAction[] = [
    { id: "submitted-projects", label: "Submitted Projects", icon: FolderOpen, tone: "emerald", count: quickCounts.submittedProjects },
    { id: "icon-submissions",   label: "Icon Submissions",   icon: Upload,     tone: "indigo",  count: quickCounts.iconSubmissions },
    { id: "bug-reports",        label: "Bug Reports",        icon: Bug,        tone: "rose",    count: quickCounts.bugReports },
    { id: "contact-messages",   label: "Messages",           icon: Mail,       tone: "sky",     count: quickCounts.contactMessages },
  ];

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen w-full flex bg-background">
        <SEOHead
          title="Admin Dashboard - BioSketch"
          description="BioSketch Admin Dashboard"
          noindex={true}
        />

        <AdminSidebar />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
            <div className="px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="rounded-lg hover:bg-muted/60 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="border-l border-border/40 pl-4">
                  <h1 className="text-base font-semibold leading-tight tracking-tight">
                    Admin Dashboard
                  </h1>
                  <p className="text-[11px] text-muted-foreground/70 leading-none mt-0.5">
                    BioSketch Control Center
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/icon-factory")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <Factory className="h-3.5 w-3.5" /> Icon Factory
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/medical-models")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <Box className="h-3.5 w-3.5" /> 3D Models
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/ai-credits")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <Star className="h-3.5 w-3.5" /> AI Credits
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/rate-limits")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <Shield className="h-3.5 w-3.5" /> Rate Limits
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/analytics")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Analytics
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/email-notifications")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <MailIcon className="h-3.5 w-3.5" /> Email
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin/scientific-illustrator")}
                  className="rounded-lg text-xs gap-1.5 h-8 px-3 text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                >
                  <FlaskConical className="h-3.5 w-3.5" /> Sci Illustrator
                </Button>
                <AdminNotificationBell />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto bg-muted/20">
            <div className="max-w-4xl mx-auto px-10 py-14 space-y-0">

              {/* Quick Actions — high-touch queues surfaced above the fold */}
              <section aria-label="Quick actions" className="mb-14">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                    Needs your attention
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {quickActions.map((a) => (
                    <QuickActionCard key={a.id} action={a} />
                  ))}
                </div>
              </section>

              <section id="maintenance">
                <SectionHeader icon={Wrench} title="Maintenance Mode" subtitle="Toggle the maintenance banner on the homepage" tone="amber" />
                <MaintenanceToggle />
              </section>

              <SectionDivider />

              <section id="animation-feature">
                <SectionHeader icon={Film} title="Animation Feature" subtitle="Control whether users can access the 2D animation editor" tone="amber" />
                <AnimationFeatureToggle />
              </section>

              <SectionDivider />

              <section id="announcements">
                <SectionHeader icon={Megaphone} title="Announcements" subtitle="Send in-app notifications to all users" tone="sky" />
                <AnnouncementManager />
              </section>

              <SectionDivider />

              <section id="ai-usage">
                <SectionHeader icon={Brain} title="AI Usage Analytics" subtitle="Track AI generation usage, top users, and history" tone="violet" />
                <AIUsageAnalytics />
              </section>

              <SectionDivider />

              <section id="download-analytics">
                <SectionHeader icon={Download} title="Download Analytics" subtitle="Track downloads by user — community vs personal projects" tone="violet" />
                <DownloadAnalytics />
              </section>

              <SectionDivider />

              <section id="submitted-projects">
                <SectionHeader icon={FolderOpen} title="Submitted Projects" subtitle="Review and manage community submitted projects" tone="emerald" priority="high" pendingCount={quickCounts.submittedProjects} />
                <SubmittedProjects />
              </section>

              <SectionDivider />

              <section id="testimonials">
                <SectionHeader icon={MessageSquareQuote} title="Testimonials" subtitle="Approve, reject, or delete user testimonials" tone="sky" />
                <TestimonialManager />
              </section>

              <SectionDivider />

              <section id="icon-submissions">
                <SectionHeader icon={Upload} title="Icon Submissions" subtitle="Review and manage community submitted icons" tone="emerald" priority="high" pendingCount={quickCounts.iconSubmissions} />
                <IconSubmissionManager />
              </section>

              <SectionDivider />

              <section id="icon-suggestions">
                <SectionHeader icon={Lightbulb} title="Icon Suggestions" subtitle="Review icon suggestions from users" tone="emerald" />
                <IconSuggestionManager />
              </section>

              <SectionDivider />

              <section id="community-uploads">
                <SectionHeader icon={Globe} title="Community Uploads" subtitle="Upload assets to the community library" tone="emerald" />
                <CommunityUploader />
              </section>

              <SectionDivider />

              <section id="upload-icons">
                <SectionHeader icon={ImageUp} title="Upload Icons" subtitle="Upload, cleanup, and generate thumbnails" tone="indigo" />
                <div className="space-y-4">
                  <IconUploader />
                  <IconCleanup />
                  <ThumbnailGenerator />
                  <ThumbnailRegenerator />
                  <IconThumbnailRegenerator />
                </div>
              </section>

              <SectionDivider />

              <section id="manage-icons">
                <SectionHeader icon={LayoutGrid} title="Manage Icons" subtitle="View, edit, and delete existing icons" tone="indigo" />
                <IconManager />
              </section>

              <SectionDivider />

              <section id="membrane-settings">
                <SectionHeader icon={Dna} title="Membrane Settings" subtitle="Configure default membrane tool settings" tone="amber" />
                <MembraneSettingsPanel />
              </section>

              <SectionDivider />

              <section id="clean-names">
                <SectionHeader icon={Eraser} title="Clean Icon Names" subtitle="Scan and fix corrupted icon names" tone="indigo" />
                <IconNameCleaner />
              </section>

              <SectionDivider />

              <section id="sanitize">
                <SectionHeader icon={ShieldCheck} title="Icon Sanitizer" subtitle="Sanitize and validate icon SVG content" tone="indigo" />
                <IconSanitizer />
              </section>

              <SectionDivider />

              <section id="categories">
                <SectionHeader icon={Tags} title="Categories" subtitle="Add, view, and manage icon categories" tone="indigo" />
                <CategoryManager />
              </section>

              <SectionDivider />

              <section id="template-manager">
                <SectionHeader icon={LayoutTemplate} title="Template Manager" subtitle="Edit, enable/disable, and manage built-in canvas templates" tone="indigo" />
                <TemplateManager />
              </section>

              <SectionDivider />

              <section id="contact-messages">
                <SectionHeader icon={Mail} title="Contact Messages" subtitle="View and respond to user contact submissions" tone="sky" priority="high" pendingCount={quickCounts.contactMessages} />
                <ContactMessagesManager />
              </section>

              <SectionDivider />

              <section id="tool-feedback">
                <SectionHeader icon={Star} title="Tool Feedback" subtitle="User ratings and feedback for the design tool" tone="rose" />
                <ToolFeedbackManager />
              </section>

              <SectionDivider />

              <section id="bug-reports">
                <SectionHeader icon={Bug} title="Bug Reports" subtitle="Review user-submitted bug reports" tone="rose" priority="high" pendingCount={quickCounts.bugReports} />
                <BugReportsManager />
              </section>

              <SectionDivider />

              <section id="survey-responses">
                <SectionHeader icon={ClipboardList} title="Survey Responses" subtitle="View community survey responses and letters of support" tone="rose" />
                <SurveyResponsesManager />
              </section>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
