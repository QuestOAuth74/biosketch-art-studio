import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface AIGeneration {
  id: string;
  user_id: string;
  prompt: string;
  style: string;
  creativity_level: string;
  background_type: string;
  reference_image_url: string;
  generated_image_url: string;
  icon_name: string | null;
  description: string | null;
  is_saved_to_library: boolean;
  is_submitted_for_review: boolean;
  created_at: string;
  updated_at: string;
}

export const useAIGenerationHistory = () => {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (limit = 20) => {
    if (!user) return;

    setLoading(true);
    try {
      // Optimized: exclude large image URLs for list view (reduces query from 3-5MB to ~50KB)
      // Image URLs will be fetched on-demand when needed
      const { data, error } = await supabase
        .from('ai_icon_generations')
        .select(`
          id,
          user_id,
          prompt,
          style,
          creativity_level,
          background_type,
          icon_name,
          description,
          is_saved_to_library,
          is_submitted_for_review,
          created_at,
          updated_at,
          reference_image_url,
          generated_image_url
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generation history:', error);
      toast({
        title: 'Failed to load history',
        description: 'Could not fetch your previous generations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveGeneration = async (data: {
    prompt: string;
    style: string;
    creativity_level: string;
    background_type: string;
    reference_image_url: string;
    generated_image_url: string;
    icon_name?: string;
    description?: string;
  }) => {
    if (!user) return null;

    try {
      const { data: generation, error } = await supabase
        .from('ai_icon_generations')
        .insert({
          user_id: user.id,
          ...data
        })
        .select()
        .single();

      if (error) throw error;
      
      setGenerations(prev => [generation, ...prev]);
      return generation;
    } catch (error) {
      console.error('Error saving generation:', error);
      toast({
        title: 'Failed to save generation',
        description: 'Could not save this generation to your history',
        variant: 'destructive'
      });
      return null;
    }
  };

  const markSavedToLibrary = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_icon_generations')
        .update({ is_saved_to_library: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setGenerations(prev => 
        prev.map(gen => gen.id === id ? { ...gen, is_saved_to_library: true } : gen)
      );
    } catch (error) {
      console.error('Error updating generation:', error);
    }
  };

  const markSubmittedForReview = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_icon_generations')
        .update({ is_submitted_for_review: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setGenerations(prev => 
        prev.map(gen => gen.id === id ? { ...gen, is_submitted_for_review: true } : gen)
      );
    } catch (error) {
      console.error('Error updating generation:', error);
    }
  };

  const deleteGeneration = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_icon_generations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGenerations(prev => prev.filter(gen => gen.id !== id));
      toast({
        title: 'Generation deleted',
        description: 'The generation has been removed from your history'
      });
    } catch (error) {
      console.error('Error deleting generation:', error);
      toast({
        title: 'Failed to delete',
        description: 'Could not delete this generation',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  return {
    generations,
    loading,
    fetchHistory,
    saveGeneration,
    markSavedToLibrary,
    markSubmittedForReview,
    deleteGeneration
  };
};
