import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Eye, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { useNavigate } from "react-router-dom";
import Autoplay from "embla-carousel-autoplay";
export const BlogPostsCarousel = () => {
  const navigate = useNavigate();
  const {
    data: result,
    isLoading
  } = useBlogPosts({
    status: 'published',
    limit: 6
  });
  const posts = result?.posts || [];
  if (isLoading || posts.length === 0) {
    return null;
  }
  return <div className="py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Section Header - Notebook Style */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 sticky-note bg-[hsl(var(--highlighter-yellow))]">
            <BookOpen className="h-5 w-5 text-[hsl(var(--ink-blue))]" />
            <span className="text-sm font-semibold text-[hsl(var(--ink-blue))]">Resources</span>
          </div>
          <h2 className="notebook-section-header text-4xl md:text-5xl">
            Learn & Discover
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-['Source_Serif_4']">
            Explore tutorials, tips, and insights to enhance your scientific illustrations
          </p>
        </div>

        {/* Carousel */}
        <Carousel className="relative" opts={{
        loop: true,
        align: "start"
      }} plugins={[Autoplay({
        delay: 5000,
        stopOnInteraction: true
      })]}>
          <CarouselContent className="-ml-4">
            {posts.map((post, index) => {
              // Random rotation for organic notebook look
              const rotation = (index % 2 === 0 ? 1 : -1) * (Math.random() * 1.5 + 0.5);
              
              return <CarouselItem key={post.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <Card 
                  className="h-full cursor-pointer group paper-shadow hover:shadow-lg transition-all duration-300 overflow-hidden bg-background border-[hsl(var(--pencil-gray))] relative" 
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  {/* Washi tape decoration */}
                  <div className="washi-tape top-4 left-1/2 -translate-x-1/2" />
                  
                  {post.featured_image_url && <div className="relative h-48 overflow-hidden border-b-2 border-[hsl(var(--pencil-gray))]">
                      <img src={post.featured_image_url} alt={post.featured_image_alt || post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>}
                  
                  <CardContent className="p-6 space-y-4">
                    {/* Categories - Sticky Note Style */}
                    {post.categories && post.categories.length > 0 && <div className="flex flex-wrap gap-2">
                        {post.categories.slice(0, 2).map(category => <Badge 
                          key={category.id} 
                          className="sticky-note bg-[hsl(var(--highlighter-yellow))] text-[hsl(var(--ink-blue))] border-[hsl(var(--pencil-gray))] text-xs"
                        >
                            {category.name}
                          </Badge>)}
                      </div>}

                    {/* Title - Handwritten Style */}
                    <h3 className="text-xl font-bold line-clamp-2 group-hover:text-[hsl(var(--ink-blue))] transition-colors font-['Caveat'] text-[hsl(var(--ink-blue))]">
                      {post.title}
                    </h3>

                    {/* Excerpt */}
                    {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 font-['Source_Serif_4']">
                        {post.excerpt}
                      </p>}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-[hsl(var(--pencil-gray))]/50">
                      {post.published_at && <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDistanceToNow(new Date(post.published_at), {
                        addSuffix: true
                      })}</span>
                        </div>}
                      {post.reading_time && <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{post.reading_time} min read</span>
                        </div>}
                      {post.view_count > 0 && <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" />
                          <span>{post.view_count}</span>
                        </div>}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>;
            })}
          </CarouselContent>
          <CarouselPrevious className="pencil-button bg-card border-2 border-[hsl(var(--pencil-gray))] shadow-lg hover:shadow-xl hover:scale-105 transition-all -left-4 md:-left-16" />
          <CarouselNext className="pencil-button bg-card border-2 border-[hsl(var(--pencil-gray))] shadow-lg hover:shadow-xl hover:scale-105 transition-all -right-4 md:-right-16" />
        </Carousel>
      </div>
    </div>;
};