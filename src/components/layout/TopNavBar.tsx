import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Menu, ChevronDown, FolderOpen, Globe, Shapes, BarChart3, Wrench, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/UserMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Simplified three-group navigation:
 *   1. Home            — top-level link.
 *   2. Diagrams ▾      — dropdown containing Projects / Community / Icons /
 *                        Graphs / Tools / AI Illustrator.
 *   3. Login / Sign Up — handled inside UserMenu (renders a Sign In button
 *                        when logged out and a user avatar dropdown when
 *                        logged in). The generation balance pill and its
 *                        details live inside that dropdown, so users still
 *                        see credits without cluttering the top bar.
 *
 * Everything else that used to sit in the top nav (notifications, standalone
 * balance pill, admin bell) has been intentionally removed to reduce noise.
 * Admin surfaces still appear inside the UserMenu when the user is admin.
 */
export const TopNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [diagramsOpen, setDiagramsOpen] = useState(false);

  const diagramLinks = [
    { label: 'Projects', path: '/projects', authRequired: true, icon: FolderOpen },
    { label: 'Community', path: '/community', authRequired: false, icon: Globe },
    { label: 'Icons', path: '/icons', authRequired: false, icon: Shapes },
    { label: 'Graphs', path: '/chart-studio-intro', authRequired: false, icon: BarChart3 },
    { label: 'Tools', path: '/tools', authRequired: false, icon: Wrench },
    { label: 'AI Illustrator', path: '/ai-illustrator', authRequired: false, icon: Sparkles },
  ];

  // Hide auth-only entries from signed-out users; keeps the Diagrams dropdown
  // clean instead of showing links that immediately dead-end at the sign-in page.
  const visibleDiagramLinks = diagramLinks.filter((l) => !l.authRequired || user);

  const isHomeActive = location.pathname === '/';
  const isDiagramsActive = visibleDiagramLinks.some((l) => location.pathname.startsWith(l.path));
  const isAboutActive = location.pathname.startsWith('/about');

  const go = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    setDiagramsOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/60">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left — logo + wordmark. */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0"
              alt="BioSketch Logo"
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-bold font-['Caveat'] text-foreground">
              BioSketch.Art
            </span>
          </button>

          {/* Center — Home + Diagrams (desktop only). Text-only, no leading
              icons — cleaner top-nav treatment per the simpler-nav direction. */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => navigate('/')}
              className={cn(
                'inline-flex items-center px-4 py-2 rounded-full text-base font-bold transition-colors',
                isHomeActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/75 hover:text-foreground hover:bg-muted',
              )}
            >
              Home
            </button>

            <DropdownMenu open={diagramsOpen} onOpenChange={setDiagramsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base font-bold transition-colors',
                    isDiagramsActive || diagramsOpen
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/75 hover:text-foreground hover:bg-muted',
                  )}
                >
                  Diagrams
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      diagramsOpen && 'rotate-180',
                    )}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                sideOffset={8}
                className="w-56 rounded-2xl p-1.5"
              >
                {visibleDiagramLinks.map((l) => {
                  const isActive = location.pathname.startsWith(l.path);
                  return (
                    <DropdownMenuItem
                      key={l.path}
                      onClick={() => go(l.path)}
                      className={cn(
                        'px-3 py-2 rounded-lg cursor-pointer text-base font-bold',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                    >
                      {l.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => navigate('/about')}
              className={cn(
                'inline-flex items-center px-4 py-2 rounded-full text-base font-bold transition-colors',
                isAboutActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/75 hover:text-foreground hover:bg-muted',
              )}
            >
              About Us
            </button>
          </div>

          {/* Right — UserMenu (Sign In when logged out, avatar dropdown when
              logged in). The generation balance pill has been moved into the
              UserMenu dropdown, so it's still visible per-click. */}
          <div className="flex items-center gap-3 shrink-0">
            <UserMenu showName={true} />

            {/* Mobile menu — same three groups, list layout. */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 bg-background border-l border-border/60">
                <div className="flex flex-col gap-1 mt-8">
                  <Button
                    variant={isHomeActive ? 'secondary' : 'ghost'}
                    onClick={() => go('/')}
                    className="justify-start text-base rounded-full px-4 gap-3"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Button>

                  <div className="mt-4 mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Diagrams
                  </div>
                  {visibleDiagramLinks.map((l) => {
                    const IconEl = l.icon;
                    const isActive = location.pathname.startsWith(l.path);
                    return (
                      <Button
                        key={l.path}
                        variant={isActive ? 'secondary' : 'ghost'}
                        onClick={() => go(l.path)}
                        className="justify-start text-base rounded-full px-4 gap-3"
                      >
                        <IconEl className="h-4 w-4" />
                        {l.label}
                      </Button>
                    );
                  })}

                  <Button
                    variant={isAboutActive ? 'secondary' : 'ghost'}
                    onClick={() => go('/about')}
                    className="justify-start text-base rounded-full px-4 gap-3 mt-4"
                  >
                    <Info className="h-4 w-4" />
                    About Us
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
