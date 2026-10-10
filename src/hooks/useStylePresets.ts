import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  StylePreset,
  UserStylePresetRow,
  CreateStylePresetParams,
  UpdateStylePresetParams,
  PresetType
} from '@/types/stylePresets';

export function useStylePresets() {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all presets for current user
  const fetchPresets = useCallback(async (type?: PresetType) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setPresets([]);
        return;
      }

      let query = supabase
        .from('user_style_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []) as UserStylePresetRow[];
      setPresets(typedData.map(row => ({
        ...row,
        properties: row.properties as any
      })));
    } catch (error) {
      console.error('Error fetching style presets:', error);
      toast.error('Failed to load style presets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new preset
  const createPreset = useCallback(async (params: CreateStylePresetParams): Promise<StylePreset | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please sign in to create presets');
        return null;
      }


      const { data, error } = await supabase
        .from('user_style_presets')
        .insert({
          user_id: user.id,
          name: params.name,
          type: params.type,
          properties: params.properties as any
        })
        .select()
        .single();

      if (error) {
        console.error('[useStylePresets] Database error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      toast.success(`Preset "${params.name}" created`);
      await fetchPresets();

      return {
        ...data,
        properties: data.properties as any
      };
    } catch (error: any) {
      console.error('[useStylePresets] Error creating preset:', error);
      const errorMessage = error?.message || 'Unknown error';
      const errorHint = error?.hint ? ` (${error.hint})` : '';
      toast.error(`Failed to create preset: ${errorMessage}${errorHint}`);
      return null;
    }
  }, [fetchPresets]);

  // Update existing preset
  const updatePreset = useCallback(async (id: string, updates: UpdateStylePresetParams) => {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.properties !== undefined) updateData.properties = updates.properties;

      const { error } = await supabase
        .from('user_style_presets')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Preset updated');
      await fetchPresets();
    } catch (error) {
      console.error('Error updating preset:', error);
      toast.error('Failed to update preset');
    }
  }, [fetchPresets]);

  // Delete preset
  const deletePreset = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_style_presets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Preset deleted');
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting preset:', error);
      toast.error('Failed to delete preset');
    }
  }, [fetchPresets]);

  // Mark preset as used (updates last_used_at)
  const markPresetUsed = useCallback(async (id: string) => {
    try {
      await supabase
        .from('user_style_presets')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', id);
    } catch (error) {
      console.error('Error marking preset as used:', error);
    }
  }, []);

  // Load presets on mount
  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    loading,
    fetchPresets,
    createPreset,
    updatePreset,
    deletePreset,
    markPresetUsed
  };
}
