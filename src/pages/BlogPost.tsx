import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useBlogPost, useIncrementViewCount, useRelatedPosts } from "@/hooks/useBlogPosts";
import { SEOHead } from "@/components/SEO/SEOHead";
import { BlogContentRenderer } from "@/components/blog/BlogContentRenderer";
import { BlogPostSidebar } from "@/components/blog/BlogPostSidebar";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { AuthorCard } from "@/components/blog/AuthorCard";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Clock, Eye, User, BookmarkPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPost(slug!);
  const incrementView = useIncrementViewCount();
  const { data: relatedPosts } = useRelatedPosts(post?.id || '', 4);

  useEffect(() => {
    if (post?.id && post.status === 'published') {
      incrementView.mutate(post.id);
    }
  }, [post?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="space-y-4 mb-8">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl mb-12" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-muted/50 rounded-2xl flex items-center justify-center">
            <BookmarkPlus className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Post not found</h1>
          <p className="text-muted-foreground">The article you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const categoryNames = (post.categories || []).map((c: any) => c.category?.name).filter(Boolean);

  const extractText = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(' ');
    return '';
  };
  const wordCount = post.content ? extractText(post.content).split(/\s+/).filter(Boolean).length : undefined;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        image: post.featured_image_url || "",
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at,
        author: {
          "@type": "Person",
          name: post.author?.full_name || "BioSketch Team",
        },
        publisher: {
          "@type": "Organization",
          name: "BioSketch",
          logo: {
            "@type": "ImageObject",
            url: window.location.origin + "/logo.png",
          },
          url: "https://biosketch.art",
        },
        description: post.excerpt || post.seo_description || "",
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://biosketch.art/blog/${post.slug}`,
        },
        ...(wordCount && { wordCount }),
        ...(categoryNames.length > 0 && { articleSection: categoryNames[0] }),
        ...(post.seo_keywords?.length > 0 && { keywords: post.seo_keywords.join(', ') }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://biosketch.art/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: "https://biosketch.art/blog" },
          { "@type": "ListItem", position: 3, name: post.title, item: `https://biosketch.art/blog/${post.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <SEOHead
        title={post.seo_title || `${post.title} | BioSketch Blog`}
        description={post.seo_description || post.excerpt || ""}
        keywords={(post.seo_keywords || []).join(', ')}
        ogImage={post.og_image || post.featured_image_url}
        canonical={`https://biosketch.art/blog/${post.slug}`}
        ogType="article"
        structuredData={structuredData}
      />

      <div className="min-h-screen bg-background relative">
        {/* Navigation Bar */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground -ml-2"
            >
              <Link to="/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                All Articles
              </Link>
            </Button>
            
            <div className="flex items-center gap-2">
              <ShareButtons
                url={window.location.href}
                title={post.title}
                compact
              />
            </div>
          </div>
        </div>

        {/* Article Header — Scientific Journal Style */}
        <header className="container mx-auto px-4 pt-16 pb-8 max-w-4xl relative z-10">
          {/* Categories — small caps above title */}
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.categories.map((cat: any) => (
                <Link
                  key={cat.category.id}
                  to={`/blog?category=${cat.category.slug}`}
                >
                  <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-primary/70 hover:text-primary transition-colors">
                    {cat.category.name}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-[2.5rem] font-serif font-bold text-foreground leading-[1.25] tracking-tight mb-4">
            {post.title}
          </h1>

          {/* Excerpt / Abstract */}
          {post.excerpt && (
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-serif italic max-w-3xl">
              {post.excerpt}
            </p>
          )}

          {/* Author & meta — journal byline */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-6 pt-4 border-t border-border/40 text-sm text-muted-foreground">
            {post.author && (
              <span className="font-medium text-foreground/80">
                {post.author.full_name || 'BioSketch Team'}
              </span>
            )}
            {post.published_at && (
              <>
                <span className="text-border">|</span>
                <time dateTime={post.published_at} className="tabular-nums">
                  {format(new Date(post.published_at), 'MMMM d, yyyy')}
                </time>
              </>
            )}
            {post.reading_time && (
              <>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.reading_time} min read
                </span>
              </>
            )}
            <span className="text-border">|</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.view_count.toLocaleString()} views
            </span>
          </div>
        </header>

        {/* Featured Image */}
        {post.featured_image_url && (
          <div className="container mx-auto px-4 mb-12 max-w-4xl relative z-10">
            <figure>
              <img
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                className="w-full h-auto object-cover rounded-md border border-border/30"
              />
              {post.featured_image_alt && (
                <figcaption className="mt-2 text-center text-xs text-muted-foreground italic">
                  {post.featured_image_alt}
                </figcaption>
              )}
            </figure>
          </div>
        )}

        {/* Main Content Area */}
        <div className="container mx-auto px-4 pb-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
            {/* Article Content - Clean Academic */}
            <article className="lg:col-span-8">
              {/* Article body — styled via .blog-content-modern CSS */}
              <div>
                <BlogContentRenderer content={post.content} />
              </div>

              {/* Keywords */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-10 pt-6 border-t border-border/30">
                  <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground/70">Keywords:</span>
                  {post.tags.map((tag: any, i: number) => (
                    <Link
                      key={tag.tag.id}
                      to={`/blog?tag=${tag.tag.slug}`}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors font-serif italic"
                    >
                      {tag.tag.name}{i < post.tags.length - 1 ? ',' : ''}
                    </Link>
                  ))}
                </div>
              )}

              {/* Share */}
              <div className="mt-10 pt-6 border-t border-border/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground font-serif italic">Share this article with colleagues</p>
                  <ShareButtons
                    url={window.location.href}
                    title={post.title}
                    compact
                  />
                </div>
              </div>

              {/* Author Card */}
              {post.author && (
                <div className="mt-12">
                  <AuthorCard author={post.author} />
                </div>
              )}

              {/* Related Posts */}
              {relatedPosts && relatedPosts.length > 0 && (
                <div className="mt-16 pt-12 border-t border-border/30">
                  <RelatedPosts posts={relatedPosts} />
                </div>
              )}
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-24">
                <BlogPostSidebar content={post.content} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default BlogPost;