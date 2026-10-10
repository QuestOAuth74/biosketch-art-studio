import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IconSortBy = 'recent' | 'downloads' | 'likes' | 'name';

export interface GalleryIcon {
  id: string;
  name: string;
  category: string;
  svg_content?: string;
  thumbnail: string | null;
  download_count: number;
  like_count: number;
  created_at: string;
}

interface UseIconGalleryParams {
  searchQuery?: string;
  sortBy?: IconSortBy;
  category?: string;
  page?: number;
  pageSize?: number;
}

export const useIconGallery = ({
  searchQuery = '',
  sortBy = 'recent',
  category = '',
  page = 1,
  pageSize = 20,
}: UseIconGalleryParams = {}) => {
  return useQuery({
    queryKey: ['icon-gallery', searchQuery, sortBy, category, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('icons')
        .select('id, name, category, thumbnail, svg_content, download_count, like_count, created_at', { count: 'exact' });

      if (category) {
        query = query.eq('category', category);
      }

      if (searchQuery) {
        // Try semantic search to expand terms
        let searchTerms = [searchQuery];
        try {
          const { data: semanticData } = await supabase.functions.invoke('semantic-icon-search', {
            body: { query: searchQuery },
          });
          if (semanticData?.terms?.length > 0) {
            searchTerms = semanticData.terms;
          }
        } catch {
          // Fall back to direct search
        }

        // Use the tsvector GIN index (`icons_search_idx`) instead of an ILIKE
        // sequential scan. Each expanded term is quoted so multi-word phrases
        // stay together, and `websearch_to_tsquery` handles stemming +
        // user-friendly OR syntax.
        const tsQueryString = searchTerms
          .map((t: string) => `"${String(t).replace(/"/g, '')}"`)
          .filter((t) => t !== '""')
          .join(' OR ');

        if (tsQueryString) {
          query = query.textSearch('search_vector', tsQueryString, {
            type: 'websearch',
            config: 'english',
          });
        }
      }

      // Sort
      switch (sortBy) {
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        case 'recent':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching icon gallery:', error);
        throw error;
      }

      const icons: GalleryIcon[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        thumbnail: row.thumbnail,
        svg_content: row.svg_content,
        download_count: row.download_count ?? 0,
        like_count: row.like_count ?? 0,
        created_at: row.created_at,
      }));

      return { icons, totalCount: count ?? 0 };
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
};

export const useIconById = (id: string) => {
  return useQuery({
    queryKey: ['icon-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category, svg_content, thumbnail, download_count, like_count, created_at')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching icon:', error);
        throw error;
      }

      return {
        ...data,
        download_count: data.download_count ?? 0,
        like_count: data.like_count ?? 0,
      } as GalleryIcon;
    },
    enabled: !!id,
  });
};

export const useRelatedIcons = (iconId: string, limit = 8) => {
  return useQuery({
    queryKey: ['related-icons', iconId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail, download_count, like_count')
        .neq('id', iconId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching related icons:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        download_count: row.download_count ?? 0,
        like_count: row.like_count ?? 0,
      }));
    },
    enabled: !!iconId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useIconsTotalCount = () => {
  return useQuery({
    queryKey: ['icons-total-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('icons')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 10,
  });
};

export const useIconCategories = () => {
  return useQuery({
    queryKey: ['icon-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icon_categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
};
