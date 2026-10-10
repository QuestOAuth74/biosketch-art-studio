import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { format } from "date-fns";

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image_url?: string;
  published_at?: string;
  reading_time?: number;
}

interface RelatedPostsProps {
  posts: RelatedPost[];
}

export const RelatedPosts = ({ posts }: RelatedPostsProps) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-primary rounded-full" />
        <h2 className="text-xl font-serif font-semibold text-foreground">Related Articles</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
            <div className="h-full rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
              {post.featured_image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                    {post.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  {post.published_at && (
                    <time dateTime={post.published_at}>
                      {format(new Date(post.published_at), 'MMM d, yyyy')}
                    </time>
                  )}
                  {post.reading_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.reading_time} min
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
