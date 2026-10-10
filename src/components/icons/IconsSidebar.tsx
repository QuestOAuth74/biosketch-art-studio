import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarQuote } from "@/components/sidebar/SidebarQuote";

interface CategoryCount {
  id: string;
  name: string;
  count: number;
}

const useCategoryCounts = () => {
  return useQuery({
    queryKey: ['icon-category-counts'],
    queryFn: async () => {
      // Get all categories
      const { data: categories, error: catError } = await supabase
        .from('icon_categories')
        .select('id, name')
        .order('name');

      if (catError || !categories) return [];

      // Get icon counts per category
      const results: CategoryCount[] = [];
      for (const cat of categories) {
        const { count, error } = await supabase
          .from('icons')
          .select('id', { count: 'exact', head: true })
          .eq('category', cat.id);

        if (!error) {
          results.push({ id: cat.id, name: cat.name, count: count ?? 0 });
        }
      }

      // Sort by count descending
      return results.sort((a, b) => b.count - a.count);
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const IconsSidebar = () => {
  const { data: categoryCounts = [], isLoading } = useCategoryCounts();
  const totalIcons = categoryCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Icons by Category</h3>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Total */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/30">
              <span className="text-sm font-semibold text-foreground">All Icons</span>
              <span className="text-sm font-bold text-primary">{totalIcons.toLocaleString()}</span>
            </div>

            {/* Category list */}
            <div className="space-y-2">
              {categoryCounts.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between group">
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate mr-2">
                    {cat.name}
                  </span>
                  <span className="text-xs font-medium text-foreground tabular-nums shrink-0">
                    {cat.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <SidebarQuote />
    </div>
  );
};
