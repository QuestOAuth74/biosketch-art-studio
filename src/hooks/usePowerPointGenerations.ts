import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PowerPointGeneration } from '@/types/powerpoint';
import { toast } from 'sonner';

export const usePowerPointGenerations = () => {
  const queryClient = useQueryClient();

  const { data: generations, isLoading } = useQuery({
    queryKey: ['powerpoint-generations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('powerpoint_generations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PowerPointGeneration[];
    },
  });

  const deleteGeneration = useMutation({
    mutationFn: async (id: string) => {
      const generation = generations?.find(g => g.id === id);
      if (!generation) throw new Error('Generation not found');

      // Delete files from storage
      if (generation.word_doc_path) {
        await supabase.storage.from('ppt-word-uploads').remove([generation.word_doc_path]);
      }
      if (generation.storage_path) {
        await supabase.storage.from('ppt-generated').remove([generation.storage_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('powerpoint_generations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['powerpoint-generations'] });
      toast.success('Generation deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting generation:', error);
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const downloadGeneration = async (generation: PowerPointGeneration) => {
    try {
      const { data, error } = await supabase.storage
        .from('ppt-generated')
        .download(generation.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = generation.generated_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download started');
    } catch (error: any) {
      console.error('Error downloading generation:', error);
      toast.error(`Failed to download: ${error.message}`);
    }
  };

  return {
    generations,
    isLoading,
    deleteGeneration,
    downloadGeneration,
  };
};
