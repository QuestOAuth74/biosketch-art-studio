import { Link } from "react-router-dom";
import { BlogPost } from "@/types/blog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BlogCardProps {
  post: BlogPost;
  index?: number;
}

export const BlogCard = ({ post, index = 0 }: BlogCardProps) => {
  const authorName = post.author?.full_name || 'BioSketch Team';
  const initials = authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Link to={`/blog/${post.slug}`} className="block group">
      <div
        className="h-full overflow-hidden rounded-xl border-2 border-dashed border-border/60 bg-card/60 hover:border-border hover:shadow-lg transition-all duration-300 animate-fade-in relative"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Hover dot overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none z-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Thumbnail */}
        <div className="relative overflow-hidden aspect-[4/3]">
          {post.featured_image_url ? (
            <img
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Category pill */}
          {post.categories && post.categories.length > 0 && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-white/90 text-foreground backdrop-blur-sm text-[11px] font-medium shadow-sm hover:bg-white/90">
                {post.categories[0].name}
              </Badge>
            </div>
          )}

          {/* Author overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <Avatar className="h-9 w-9 ring-2 ring-white/80 shadow-md">
              <AvatarImage src={post.author?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-white drop-shadow-md">
              {authorName}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-1">
          <h2 className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
              {post.excerpt}
            </p>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-around border-t border-dashed border-border/40 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          {post.published_at && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <time dateTime={post.published_at}>
                {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
              </time>
            </div>
          )}
          <div className="w-px h-3.5 bg-border/60" />
          {post.reading_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{post.reading_time}m</span>
            </div>
          )}
          <div className="w-px h-3.5 bg-border/60" />
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span className="font-medium">{post.view_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
