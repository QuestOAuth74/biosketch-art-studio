import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Eye, X } from 'lucide-react';

const REFRESH_MS = 5 * 60 * 1000;
const ROTATE_MS = 5 * 1000;

export function ActiveUsersToast() {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [mode, setMode] = useState<'active' | 'visitors'>('active');
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('activeUsersToastDismissed') === '1';
  });

  useEffect(() => {
    if (dismissed) return;

    const fetchCounts = async () => {
      const [active, visitors] = await Promise.all([
        supabase.rpc('get_active_user_count', { hours_ago: 6 }),
        supabase.rpc('get_unique_visitors_24h'),
      ]);
      if (!active.error && typeof active.data === 'number') setActiveCount(active.data);
      if (!visitors.error && typeof visitors.data === 'number') setVisitorCount(visitors.data);
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, REFRESH_MS);
    return () => clearInterval(interval);
  }, [dismissed]);

  // Rotate display between active users and 24h visitors every 5s.
  useEffect(() => {
    if (dismissed) return;
    const rotate = setInterval(() => {
      setMode((m) => (m === 'active' ? 'visitors' : 'active'));
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('activeUsersToastDismissed', '1');
  };

  if (dismissed) return null;

  // Prefer active users when available and non-zero; otherwise show whichever is non-null.
  const effectiveMode: 'active' | 'visitors' =
    mode === 'active' && (activeCount ?? 0) > 0
      ? 'active'
      : mode === 'visitors' && (visitorCount ?? 0) > 0
      ? 'visitors'
      : (activeCount ?? 0) > 0
      ? 'active'
      : (visitorCount ?? 0) > 0
      ? 'visitors'
      : 'active';

  const showing = effectiveMode === 'active' ? activeCount : visitorCount;
  if (showing === null || showing === 0) return null;

  const isActive = effectiveMode === 'active';
  const Icon = isActive ? Users : Eye;
  const iconTint = isActive ? 'text-green-500' : 'text-blue-500';
  const iconBg = isActive ? 'bg-green-500/10' : 'bg-blue-500/10';
  const pulseColor = isActive ? 'bg-green-500' : 'bg-blue-500';
  const primaryLabel = isActive
    ? `${showing} Active User${showing !== 1 ? 's' : ''}`
    : `${showing} Visitor${showing !== 1 ? 's' : ''}`;
  const secondaryLabel = isActive ? 'Doodling Right Now' : 'In the Past 24 Hours';

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-border/60 bg-card/95 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl hover:border-border">
        <div className={`relative w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${iconTint}`} />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${pulseColor} opacity-75`}></span>
            <span className={`relative inline-flex h-3 w-3 rounded-full ${pulseColor}`}></span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{primaryLabel}</p>
          <p className="text-xs text-muted-foreground">{secondaryLabel}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
