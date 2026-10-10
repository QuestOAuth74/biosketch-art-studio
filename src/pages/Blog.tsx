import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { useBlogCategories } from "@/hooks/useBlogCategories";
import { SEOHead } from "@/components/SEO/SEOHead";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { BlogFilters } from "@/components/blog/BlogFilters";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Layers, PenTool } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getVisiblePages } from "@/lib/pagination";

const blogStyles = `
  @keyframes blog-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .blog-fade-1 { animation: blog-fade-up 0.4s ease-out 0.1s both; }
  .blog-fade-2 { animation: blog-fade-up 0.4s ease-out 0.2s both; }
  .blog-fade-3 { animation: blog-fade-up 0.4s ease-out 0.3s both; }
`;

const Blog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('category') || undefined;
  const tagSlug = searchParams.get('tag') || undefined;
  const searchQuery = searchParams.get('search') || undefined;
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 12;

  const { data: result, isLoading } = useBlogPosts({
    status: 'published',
    categorySlug,
    tagSlug,
    searchQuery,
    limit: postsPerPage,
    offset: (currentPage - 1) * postsPerPage,
  });

  const posts = result?.posts || [];
  const totalCount = result?.count || 0;

  const { data: categories } = useBlogCategories();

  return (
    <>
      <SEOHead
        title="BioSketch Blog | Scientific Figure Creation Tips & Tutorials"
        description="Learn how to create stunning scientific figures with BioSketch. Get tips, tutorials, and insights on biomedical illustration, research visualization, and figure design."
        keywords="scientific figures, biomedical illustration, research visualization, BioSketch blog, figure creation tips, scientific diagrams, biology figures"
        canonical="https://biosketch.art/blog"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Blog",
              name: "BioSketch Blog",
              description: "Tips, tutorials, and insights on scientific figure creation, biomedical illustration, and research visualization.",
              url: "https://biosketch.art/blog",
              publisher: {
                "@type": "Organization",
                name: "BioSketch",
                url: "https://biosketch.art",
              },
              blogPost: posts.map((post: any) => ({
                "@type": "BlogPosting",
                headline: post.title,
                url: `https://biosketch.art/blog/${post.slug}`,
                datePublished: post.published_at || post.created_at,
                ...(post.featured_image_url && { image: post.featured_image_url }),
              })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://biosketch.art/" },
                { "@type": "ListItem", position: 2, name: "Blog", item: "https://biosketch.art/blog" },
              ],
            },
          ],
        }}
      />

      <div
        className="min-h-screen relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #F5F5F5 0%, #FAFAFA 35%, #FFFFFF 100%)",
        }}
      >
        <style>{blogStyles}</style>

        {/* Soft decorative blobs */}
        <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gray-200/25 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-gray-200/20 rounded-full blur-3xl" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-16">

          {/* ── Hero header (homepage style) ── */}
          <div className="text-center blog-fade-1">
            {/* Pill badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <PenTool className="h-3.5 w-3.5 text-slate-700" />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#1a1a1a",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                The Blog
              </span>
            </div>

            <h1
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(32px, 5vw, 56px)",
                lineHeight: "1.1",
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
              }}
            >
              Insights for science creators.
            </h1>

            <p
              className="mx-auto mt-4 max-w-xl"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(14px, 1.8vw, 18px)",
                lineHeight: "1.6",
                color: "#4a5568",
              }}
            >
              Tutorials, insights, and best practices for creating professional scientific figures.
            </p>
          </div>

          {/* ── Stats Cards ── */}
          <div className="grid grid-cols-3 gap-3 mt-10 max-w-2xl mx-auto blog-fade-2">
            {[
              { icon: FileText, value: isLoading ? '—' : totalCount, label: 'Articles' },
              { icon: Layers, value: categories?.length || '—', label: 'Categories' },
              { icon: BookOpen, value: 'Free', label: 'Open Access' },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-5 text-center"
                style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
              >
                <div className="flex items-center justify-center mb-2">
                  <div className="rounded-lg bg-primary p-1.5">
                    <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <p
                  className="text-2xl font-bold text-slate-900 tabular-nums"
                  style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
                >
                  {value}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 font-medium">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Search bar (centered, prominent) ── */}
          <div className="mt-8 max-w-xl mx-auto blog-fade-2">
            <BlogFilters />
          </div>

          {/* ── Main Content Grid ── */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 blog-fade-2">

            {/* ── Left: Posts ── */}
            <div className="min-w-0 space-y-4">
              {/* Active filters */}
              {(categorySlug || tagSlug) && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">Filters:</span>
                  {categorySlug && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        searchParams.delete('category');
                        setSearchParams(searchParams);
                        setCurrentPage(1);
                      }}
                      className="h-7 rounded-full text-xs gap-1"
                    >
                      {categorySlug}
                      <span className="text-muted-foreground">&times;</span>
                    </Button>
                  )}
                  {tagSlug && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        searchParams.delete('tag');
                        setSearchParams(searchParams);
                        setCurrentPage(1);
                      }}
                      className="h-7 rounded-full text-xs gap-1"
                    >
                      {tagSlug}
                      <span className="text-muted-foreground">&times;</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Results info */}
              {!isLoading && (
                <div className="text-xs text-muted-foreground">
                  {searchQuery ? (
                    totalCount > 0 ? (
                      <>
                        <span className="font-semibold text-foreground">{totalCount}</span> result{totalCount !== 1 ? 's' : ''} for "<span className="font-medium text-foreground">{searchQuery}</span>"
                      </>
                    ) : (
                      <>No results for "<span className="font-medium">{searchQuery}</span>". Try different keywords.</>
                    )
                  ) : totalCount > 0 ? (
                    <>{totalCount} article{totalCount !== 1 ? 's' : ''}</>
                  ) : null}
                </div>
              )}

              {/* Posts Grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden border bg-card">
                      <Skeleton className="w-full aspect-[4/3]" />
                      <div className="px-4 py-3 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts && posts.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {posts.map((post, index) => (
                      <BlogCard key={post.id} post={post} index={index} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalCount > postsPerPage && (() => {
                    const totalPages = Math.ceil(totalCount / postsPerPage);

                    return (
                      <div className="flex justify-center pt-6">
                        <Pagination>
                          <PaginationContent className="gap-1 border rounded-xl p-1.5 bg-card">
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => {
                                  setCurrentPage(p => Math.max(1, p - 1));
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`rounded-lg ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'} transition-colors`}
                              />
                            </PaginationItem>

                            {getVisiblePages(currentPage, totalPages).map((page, index) => (
                              <PaginationItem key={`${page}-${index}`}>
                                {page === 'ellipsis' ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    onClick={() => {
                                      setCurrentPage(page);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    isActive={currentPage === page}
                                    className={`rounded-lg cursor-pointer ${
                                      currentPage === page
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                        : 'hover:bg-muted'
                                    } transition-colors`}
                                  >
                                    {page}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => {
                                  setCurrentPage(p => Math.min(totalPages, p + 1));
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`rounded-lg ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'} transition-colors`}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    );
                  })()}
                </>
              ) : !searchQuery ? (
                <div
                  className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-12 text-center"
                  style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
                >
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}>
                    No posts yet
                  </h2>
                  <p className="text-sm text-slate-600">Check back soon for new articles and tutorials.</p>
                </div>
              ) : null}
            </div>

            {/* ── Right Sidebar ── */}
            <aside className="hidden lg:block blog-fade-3">
              <div className="sticky top-20">
                <BlogSidebar />
              </div>
            </aside>
          </div>

          {/* Bottom spacing */}
          <div className="h-12" />
        </div>
      </div>
    </>
  );
};

export default Blog;
