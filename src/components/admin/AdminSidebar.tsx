import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Wrench,
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
  Film,
  Settings,
  Users,
  Palette,
  Headphones,
  PenLine,
  Bug,
  LayoutTemplate,
  Download,
  ClipboardList,
  Sparkles,
  GraduationCap,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
}

interface MenuGroup {
  group: string;
  icon: LucideIcon;
  items: MenuItem[];
}

const menuItems: MenuGroup[] = [
  {
    group: "Management",
    icon: Settings,
    items: [
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'animation-feature', label: 'Animation', icon: Film },
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
      { id: 'ai-usage', label: 'AI Usage', icon: Brain },
      { id: 'ai-credits', label: 'AI Credits', icon: Sparkles, route: '/admin/ai-credits' },
      { id: 'scholars', label: 'Scholars', icon: GraduationCap, route: '/admin/scholars' },
      { id: 'download-analytics', label: 'Downloads', icon: Download },
      { id: 'submitted-projects', label: 'Projects', icon: FolderOpen },
      { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    ]
  },
  {
    group: "Blog",
    icon: PenLine,
    items: [
      { id: 'blog-management', label: 'Blog Posts', icon: PenLine, route: '/admin/blog' },
    ]
  },
  {
    group: "Community",
    icon: Users,
    items: [
      { id: 'icon-submissions', label: 'Submissions', icon: Upload },
      { id: 'icon-suggestions', label: 'Suggestions', icon: Lightbulb },
      { id: 'community-uploads', label: 'Uploads', icon: Globe },
    ]
  },
  {
    group: "Icons",
    icon: Palette,
    items: [
      { id: 'upload-icons', label: 'Upload', icon: ImageUp },
      { id: 'manage-icons', label: 'Manage', icon: LayoutGrid },
      { id: 'membrane-settings', label: 'Membranes', icon: Dna },
      { id: 'clean-names', label: 'Clean Names', icon: Eraser },
      { id: 'sanitize', label: 'Sanitizer', icon: ShieldCheck },
      { id: 'categories', label: 'Categories', icon: Tags },
      { id: 'template-manager', label: 'Templates', icon: LayoutTemplate },
    ]
  },
  {
    group: "Support",
    icon: Headphones,
    items: [
      { id: 'contact-messages', label: 'Messages', icon: Mail },
      { id: 'tool-feedback', label: 'Feedback', icon: Star },
      { id: 'bug-reports', label: 'Bug Reports', icon: Bug },
      { id: 'survey-responses', label: 'Survey', icon: ClipboardList },
    ]
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('submitted-projects');
  const [searchFilter, setSearchFilter] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            g.group.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [searchFilter]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('adminSidebar.openGroups');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { Management: true, Icons: true };
  });

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        localStorage.setItem('adminSidebar.openGroups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isGroupOpen = (name: string) => {
    if (searchFilter.trim() || isCollapsed) return true;
    return openGroups[name] ?? false;
  };

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sections = menuItems.flatMap(group => group.items).map(item => item.id);
    sections.forEach(sectionId => {
      const element = document.getElementById(sectionId);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.route) {
      navigate(item.route);
    } else {
      scrollToSection(item.id);
    }
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-border/30 bg-background">
      <SidebarContent className="pt-16 px-1">
        {!isCollapsed && (
          <div className="px-2 pt-1 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchFilter('');
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search admin…"
                aria-label="Search admin sections"
                className="w-full pl-8 pr-14 py-1.5 rounded-md border border-border/60 bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              />
              {searchFilter ? (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <span
                  aria-hidden
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/50 border border-border/60 rounded px-1 py-[1px] leading-none select-none"
                >
                  ⌘K
                </span>
              )}
            </div>
          </div>
        )}

        {filteredGroups.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground/70">
            No sections match "{searchFilter}"
          </div>
        ) : (
          filteredGroups.map(group => {
            const GroupIcon = group.icon;
            const open = isGroupOpen(group.group);
            const canCollapse = !searchFilter.trim() && !isCollapsed;
            return (
              <SidebarGroup key={group.group}>
                <SidebarGroupLabel asChild>
                  <button
                    type="button"
                    onClick={canCollapse ? () => toggleGroup(group.group) : undefined}
                    disabled={!canCollapse}
                    aria-expanded={open}
                    className={cn(
                      "w-full text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50 font-semibold flex items-center gap-1.5 mb-1 mt-2 px-2 py-1 rounded-md",
                      canCollapse && "hover:text-muted-foreground hover:bg-muted/40 cursor-pointer",
                    )}
                  >
                    {!isCollapsed && <GroupIcon className="h-3 w-3" />}
                    <span className="flex-1 text-left">{group.group}</span>
                    {canCollapse && (
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          !open && "-rotate-90",
                        )}
                      />
                    )}
                  </button>
                </SidebarGroupLabel>
                {open && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map(item => {
                        const ItemIcon = item.icon;
                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              onClick={() => handleItemClick(item)}
                              className={cn(
                                "rounded-md transition-all duration-150 cursor-pointer gap-2.5",
                                activeSection === item.id && !item.route
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <ItemIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                              {!isCollapsed && <span className="text-[13px]">{item.label}</span>}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>
    </Sidebar>
  );
}
