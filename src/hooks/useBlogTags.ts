import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlogTag } from "@/types/blog";
import { useToast } from "@/hooks/use-toast";

export const useBlogTags = () => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['blog-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_tags')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching tags:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tags",
          variant: "destructive",
        });
        throw error;
      }

      return data as BlogTag[];
    },
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tag: Omit<BlogTag, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('blog_tags')
        .insert(tag)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating tag:', error);
      toast({
        title: "Error",
        description: "Failed to create tag",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting tag:', error);
      toast({
        title: "Error",
        description: "Failed to delete tag",
        variant: "destructive",
      });
    },
  });
};
