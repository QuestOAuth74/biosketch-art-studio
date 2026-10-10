import { supabase } from '@/integrations/supabase/client';

/**
 * Get the BioSketch logo URL from the current Supabase environment
 * This ensures the logo works in both development and production
 */
export function getBioSketchLogoUrl(): string {
  const { data } = supabase.storage
    .from('icon site')
    .getPublicUrl('biosketch art-min.png');

  return data.publicUrl;
}

/**
 * Fallback logo URL (can use a local asset if storage is unavailable)
 */
export const FALLBACK_LOGO_URL = '/placeholder.svg';

/**
 * Get logo URL with fallback
 */
export function getLogoUrlWithFallback(): string {
  try {
    return getBioSketchLogoUrl();
  } catch (error) {
    console.warn('Failed to get logo from storage, using fallback');
    return FALLBACK_LOGO_URL;
  }
}
