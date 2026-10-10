import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFavoriteIcons = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [favoriteIconIds, setFavoriteIconIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavoriteIconIds(new Set());
      setLoading(false);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('user_favorite_icons')
        .select('icon_id')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const ids = new Set<string>(data.map((fav: any) => fav.icon_id as string));
      setFavoriteIconIds(ids);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (iconId: string) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return false;
    }

    const isFavorited = favoriteIconIds.has(iconId);

    try {
      if (isFavorited) {
        const { error } = await (supabase as any)
          .from('user_favorite_icons')
          .delete()
          .eq('user_id', user.id)
          .eq('icon_id', iconId);

        if (error) throw error;

        setFavoriteIconIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(iconId);
          return newSet;
        });
        
        toast.success('Removed from favorites');
      } else {
        const { error } = await (supabase as any)
          .from('user_favorite_icons')
          .insert({
            user_id: user.id,
            icon_id: iconId,
          });

        if (error) throw error;

        setFavoriteIconIds(prev => new Set(prev).add(iconId));
        toast.success('Added to favorites');
      }

      // Invalidate sidebar and icon caches so like counts update
      queryClient.invalidateQueries({ queryKey: ['icon-sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['icon-detail', iconId] });
      queryClient.invalidateQueries({ queryKey: ['icon-gallery'] });

      return true;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
      return false;
    }
  };

  const isFavorite = (iconId: string) => favoriteIconIds.has(iconId);

  return {
    favoriteIconIds,
    loading,
    toggleFavorite,
    isFavorite,
    loadFavorites,
  };
};
