import { Link } from "react-router-dom";
import { useBlogCategories } from "@/hooks/useBlogCategories";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { Badge } from "@/components/ui/badge";
import { Eye, TrendingUp, Folder, ChevronRight, Tag } from "lucide-react";
import { SidebarQuote } from "@/components/sidebar/SidebarQuote";

export const BlogSidebar = () => {
  const { data: categories } = useBlogCategories();
  const { data: result } = useBlogPosts({
    status: 'published',
    limit: 5,
  });

  const popularPosts = result?.posts || [];

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5" style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Categories</h3>
        </div>
        <nav className="space-y-0.5">
          {categories?.map((category) => (
            <Link
              key={category.id}
              to={`/blog?category=${category.slug}`}
              className="group/item flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors duration-200"
            >
              <div className="flex items-center gap-2.5">
                {category.icon && <span className="text-sm">{category.icon}</span>}
                <span className="text-xs font-medium text-muted-foreground group-hover/item:text-foreground transition-colors duration-200">
                  {category.name}
                </span>
              </div>
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />
            </Link>
          ))}
        </nav>
      </div>

      {/* Trending */}
      <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5" style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-primary rounded-full" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Trending</h3>
        </div>
        <div className="space-y-3">
          {popularPosts.sort((a, b) => b.view_count - a.view_count).slice(0, 5).map((post, index) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group/item flex items-start gap-2.5"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors duration-200">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground/90 line-clamp-2 leading-snug group-hover/item:text-primary transition-colors duration-200">
                  {post.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                  <Eye className="h-2.5 w-2.5" />
                  {post.view_count.toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tags cloud */}
      {popularPosts.length > 0 && (() => {
        const allTags = popularPosts.flatMap(p => p.tags || []);
        const uniqueTags = Array.from(new Map(allTags.map(t => [t.id, t])).values()).slice(0, 8);
        if (uniqueTags.length === 0) return null;
        return (
          <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5" style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-orange-500 rounded-full" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Popular Tags</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {uniqueTags.map(tag => (
                <Link key={tag.id} to={`/blog?tag=${tag.slug}`}>
                  <Badge variant="outline" className="rounded-full text-[10px] hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors duration-200 cursor-pointer">
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      <SidebarQuote />
    </div>
  );
};
