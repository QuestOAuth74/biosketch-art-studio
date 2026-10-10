import { useState, useEffect } from 'react';
import { X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const DISMISSAL_KEY = 'maintenance_banner_dismissed';
const DISMISSAL_HOURS = 24;

interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export const MaintenanceBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMaintenanceSettings();
  }, []);

  const fetchMaintenanceSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .single();

      if (error) {
        console.error('Error fetching maintenance settings:', error);
        return;
      }

      const settings = data?.setting_value as unknown as MaintenanceSettings;
      
      if (!settings?.enabled) return;

      // Check if user has dismissed the banner recently
      const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        const hoursSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60);
        if (hoursSinceDismissal < DISMISSAL_HOURS) {
          return;
        }
      }

      setMessage(settings.message || "We're performing scheduled maintenance.");
      setIsVisible(true);
    } catch (error) {
      console.error('Error fetching maintenance settings:', error);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="relative w-full bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-amber-900/30 border-b-2 border-dashed border-amber-400/60 dark:border-amber-600/40 maintenance-banner-animated">
      {/* Notebook paper texture effect */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" 
           style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(139, 69, 19, 0.05) 20px, rgba(139, 69, 19, 0.05) 21px)' }} />
      
      <div className="container mx-auto px-4 py-3 relative">
        <div className="flex items-center justify-center gap-3">
          {/* Wrench icon with pencil-sketch style and pulse animation */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-200/80 dark:bg-amber-800/50 flex items-center justify-center border border-amber-400/50 dark:border-amber-600/50 shadow-sm animate-pulse">
            <Wrench className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
          
          {/* Message with larger font */}
          <p className="text-lg md:text-xl font-semibold text-amber-900 dark:text-amber-100" style={{ fontFamily: "'Caveat', cursive" }}>
            <span className="hidden sm:inline-block animate-bounce">🔧 </span>
            {message}
          </p>
          
          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="flex-shrink-0 h-7 w-7 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Torn paper edge effect at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
    </div>
  );
};
