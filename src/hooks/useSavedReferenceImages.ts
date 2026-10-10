import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SavedReferenceImage {
  id: string;
  user_id: string;
  prompt: string;
  sources: string[];
  storage_path: string;
  mime_type: string;
  file_size: number | null;
  created_at: string;
}

const TABLE = 'saved_reference_images' as any;

export function useSavedReferenceImages() {
  const { user } = useAuth();
  const [savedImages, setSavedImages] = useState<SavedReferenceImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSavedImages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSavedImages((data as SavedReferenceImage[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch saved references:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchSavedImages();
  }, [user, fetchSavedImages]);

  const saveReferenceImage = async (params: {
    imageDataUrl: string;
    prompt: string;
    sources: string[];
  }): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    try {
      // Convert base64 data URL to Blob
      const base64Data = params.imageDataUrl.split(',')[1];
      const mimeMatch = params.imageDataUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch?.[1] || 'image/png';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });

      // Upload to storage
      const fileId = crypto.randomUUID();
      const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const storagePath = `${user.id}/references/${fileId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('user-assets')
        .upload(storagePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      // Insert metadata row
      const { error: insertError } = await supabase
        .from(TABLE)
        .insert({
          user_id: user.id,
          prompt: params.prompt,
          sources: params.sources,
          storage_path: storagePath,
          mime_type: mimeType,
          file_size: blob.size,
        });

      if (insertError) throw insertError;

      toast.success('Reference image saved');
      await fetchSavedImages();
      return true;
    } catch (err: any) {
      console.error('Failed to save reference image:', err);
      toast.error('Failed to save reference image');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteReferenceImage = async (id: string) => {
    const image = savedImages.find((img) => img.id === id);
    if (!image) return;

    try {
      // Delete from storage
      await supabase.storage.from('user-assets').remove([image.storage_path]);

      // Delete from database
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;

      setSavedImages((prev) => prev.filter((img) => img.id !== id));
      toast.success('Reference image deleted');
    } catch (err: any) {
      console.error('Failed to delete reference image:', err);
      toast.error('Failed to delete reference image');
    }
  };

  const getImageUrl = (storagePath: string): string => {
    const { data } = supabase.storage.from('user-assets').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  return {
    savedImages,
    loading,
    saving,
    saveReferenceImage,
    deleteReferenceImage,
    getImageUrl,
    fetchSavedImages,
  };
}
