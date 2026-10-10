import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function useTrackVisit() {
  const location = useLocation();

  useEffect(() => {
    supabase.functions.invoke('track-visit').catch(() => {});
  }, [location.pathname]);
}
