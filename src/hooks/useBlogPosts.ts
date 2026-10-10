import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlogPost } from "@/types/blog";
import { useToast } from "@/hooks/use-toast";

export const useBlogPosts = (options?: {
  status?: 'draft' | 'published' | 'scheduled';
  categorySlug?: string;
  tagSlug?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}) => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['blog-posts', options],
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes (was 0 - force fresh)
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
    refetchInterval: 5 * 60 * 1000, // Background refresh every 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    queryFn: async () => {
      const hasSearch = options?.searchQuery && options.searchQuery.trim().length > 0;
      
      let query = supabase
        .from('blog_posts')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url, email),
          categories:blog_post_categories(category:blog_categories(*)),
          tags:blog_post_tags(tag:blog_tags(*))
        `, { count: 'exact' });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.categorySlug) {
        const { data: category } = await supabase
          .from('blog_categories')
          .select('id')
          .eq('slug', options.categorySlug)
          .single();
        
        if (category) {
          const { data: postIds } = await supabase
            .from('blog_post_categories')
            .select('post_id')
            .eq('category_id', category.id);
          
          if (postIds) {
            query = query.in('id', postIds.map(p => p.post_id));
          }
        }
      }

      if (options?.tagSlug) {
        const { data: tag } = await supabase
          .from('blog_tags')
          .select('id')
          .eq('slug', options.tagSlug)
          .single();
        
        if (tag) {
          const { data: postIds } = await supabase
            .from('blog_post_tags')
            .select('post_id')
            .eq('tag_id', tag.id);
          
          if (postIds) {
            query = query.in('id', postIds.map(p => p.post_id));
          }
        }
      }

      // Full-text search with ranking
      if (hasSearch) {
        query = query.textSearch('search_vector', options.searchQuery, {
          type: 'websearch',
          config: 'english'
        });
      }

      // Apply ordering - by relevance if searching, otherwise by date
      if (hasSearch) {
        // Note: ts_rank ordering would require a custom RPC function
        // For now, full-text search with filter is already quite good
        query = query.order('published_at', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('published_at', { ascending: false, nullsFirst: false })
                     .order('created_at', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching blog posts:', error);
        toast({
          title: "Error",
          description: "Failed to fetch blog posts",
          variant: "destructive",
        });
        throw error;
      }

      // Fallback to fuzzy search if no results from full-text search
      if (hasSearch && (!data || data.length === 0)) {
        const fuzzyQuery = supabase
          .from('blog_posts')
          .select(`
            *,
            author:profiles(id, full_name, avatar_url, email),
            categories:blog_post_categories(category:blog_categories(*)),
            tags:blog_post_tags(tag:blog_tags(*))
          `, { count: 'exact' })
          .or(`title.ilike.%${options.searchQuery}%,excerpt.ilike.%${options.searchQuery}%`)
          .order('published_at', { ascending: false, nullsFirst: false });

        if (options?.status) {
          fuzzyQuery.eq('status', options.status);
        }

        if (options?.limit) {
          fuzzyQuery.limit(options.limit);
        }

        const { data: fuzzyData, error: fuzzyError, count: fuzzyCount } = await fuzzyQuery;

        if (!fuzzyError && fuzzyData) {
          return {
            posts: fuzzyData as any as BlogPost[],
            count: fuzzyCount || 0
          };
        }
      }

      return {
        posts: (data || []) as any as BlogPost[],
        count: count || 0
      };
    },
  });
};

export const useBlogPost = (slug: string) => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['blog-post', slug],
    staleTime: 5 * 60 * 1000, // Cache individual posts for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep popular posts in memory for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url, email),
          categories:blog_post_categories(category:blog_categories(*)),
          tags:blog_post_tags(tag:blog_tags(*))
        `)
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error('Error fetching blog post:', error);
        toast({
          title: "Error",
          description: "Failed to fetch blog post",
          variant: "destructive",
        });
        throw error;
      }

      if (!data) {
        return null;
      }

      return data as any as BlogPost;
    },
  });
};

export const useIncrementViewCount = () => {
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc('increment_blog_post_view_count', {
        post_id_param: postId
      });

      if (error) throw error;
    },
  });
};

export const useRelatedPosts = (postId: string, limit: number = 4) => {
  return useQuery({
    queryKey: ['related-posts', postId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_related_blog_posts', {
        post_id_param: postId,
        limit_param: limit
      });

      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });
};
