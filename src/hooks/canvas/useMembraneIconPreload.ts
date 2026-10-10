import { useEffect, useRef, RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMembraneIconPreload(
  membraneSettings: any
): RefObject<string | null> {
  const defaultMembraneIconSVGRef = useRef<string | null>(null);

  // Preload default membrane icon SVG when settings change
  useEffect(() => {
    const FALLBACK_MEMBRANE_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="20" r="15" fill="#3b82f6"/><circle cx="50" cy="80" r="15" fill="#3b82f6"/><line x1="50" y1="35" x2="50" y2="65" stroke="#1e40af" stroke-width="3"/></svg>`;

    const preloadDefaultIcon = async () => {
      try {
        let iconData = null;

        // Method 1: Try using the icon ID from settings
        if (membraneSettings?.default_icon_id) {
          const { data, error } = await supabase
            .from('icons')
            .select('id, name, svg_content')
            .eq('id', membraneSettings.default_icon_id)
            .single();

          if (!error && data?.svg_content) {
            iconData = data;
          }
        }

        // Method 2: If no icon from settings, query for the default membrane icon directly
        if (!iconData) {
          const { data, error } = await supabase
            .from('icons')
            .select('id, name, svg_content')
            .eq('is_default_membrane_icon', true)
            .eq('is_membrane_icon', true)
            .maybeSingle();

          if (!error && data?.svg_content) {
            iconData = data;
          }
        }

        // Store the icon SVG or fallback
        defaultMembraneIconSVGRef.current = iconData?.svg_content || FALLBACK_MEMBRANE_ICON;
      } catch (error) {
        console.error('Error preloading default membrane icon:', error);
        defaultMembraneIconSVGRef.current = FALLBACK_MEMBRANE_ICON;
      }
    };

    preloadDefaultIcon();
  }, [membraneSettings]);

  return defaultMembraneIconSVGRef;
}
