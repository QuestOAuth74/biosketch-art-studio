import { useParams, Link } from "react-router-dom";
import { useIconById, useRelatedIcons } from "@/hooks/useIconGallery";
import { useFavoriteIcons } from "@/hooks/useFavoriteIcons";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEO/SEOHead";
import { IconCard } from "@/components/icons/IconCard";
import { SafeSvgRenderer } from "@/components/icons/SafeSvgRenderer";
import { formatIconName } from "@/lib/iconNameFormatter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, Info, Paintbrush } from "lucide-react";
import { toast } from "sonner";

const IconDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: icon, isLoading } = useIconById(id!);
  const { data: relatedIcons } = useRelatedIcons(id!, 8);
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteIcons();

  const isFavorited = icon ? isFavorite(icon.id) : false;

  const handleLike = () => {
    if (!user) {
      toast.error('Sign in to like icons', {
        action: {
          label: 'Sign In',
          onClick: () => { window.location.href = '/auth'; },
        },
      });
      return;
    }
    if (icon) toggleFavorite(icon.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!icon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-serif font-semibold text-foreground">Icon not found</h1>
          <p className="text-muted-foreground">The icon you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/icons">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Icons
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = formatIconName(icon.name);
  const thumbnailSrc = icon.thumbnail
    ? (icon.thumbnail.startsWith('data:') ? icon.thumbnail : `data:image/png;base64,${icon.thumbnail}`)
    : null;
  const publicImageUrl = `https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/icon-image?id=${icon.id}`;

  return (
    <>
      <SEOHead
        title={`${displayName} - Scientific Icon | BioSketch Icons`}
        description={`${displayName} scientific icon available in the BioSketch canvas editor. Use in research figures, academic publications, and biomedical illustrations.`}
        keywords={`${displayName}, scientific icon, BioSketch, canvas editor, research figure, biomedical illustration`}
        canonical={`https://biosketch.art/icons/${icon.id}`}
        ogImage={publicImageUrl}
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ImageObject",
              name: displayName,
              description: `${displayName} scientific icon for research figures and academic publications.`,
              contentUrl: publicImageUrl,
              thumbnailUrl: publicImageUrl,
              url: `https://biosketch.art/icons/${icon.id}`,
              encodingFormat: "image/png",
              license: "https://biosketch.art/terms",
              acquireLicensePage: "https://biosketch.art/terms",
              creator: {
                "@type": "Organization",
                name: "BioSketch",
                url: "https://biosketch.art",
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://biosketch.art/" },
                { "@type": "ListItem", position: 2, name: "Icons", item: "https://biosketch.art/icons" },
                { "@type": "ListItem", position: 3, name: displayName, item: `https://biosketch.art/icons/${icon.id}` },
              ],
            },
          ],
        }}
      />

      <div className="min-h-screen bg-background relative">
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />

        <main className="container mx-auto px-4 py-8 max-w-5xl relative z-10">
          {/* Back */}
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-6 -ml-2">
            <Link to="/icons">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Icons
            </Link>
          </Button>

          {/* Main content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Preview */}
            <div className="rounded-xl border border-border/50 bg-white p-8 flex items-center justify-center aspect-square relative overflow-hidden">
              {icon.svg_content ? (
                <SafeSvgRenderer
                  svgContent={icon.svg_content}
                  className="w-full h-full flex items-center justify-center max-w-[400px] max-h-[400px]"
                />
              ) : thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={displayName}
                  className="w-full h-full object-contain max-w-[400px] max-h-[400px]"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg" />
              )}
              {/* Preview watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-5xl md:text-6xl font-bold uppercase tracking-widest text-black/[0.07] select-none rotate-[-25deg]">
                  Preview
                </span>
              </div>
            </div>

            {/* Info + actions */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground tracking-tight mb-3">
                  {displayName}
                </h1>
                {icon.like_count > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4" />
                    {icon.like_count} like{icon.like_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              </div>

              {/* Like button */}
              <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                onClick={handleLike}
                className="rounded-full"
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? 'Liked' : 'Like'}
              </Button>

              {/* Preview disclaimer */}
              <div className="rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Preview Only</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This is a preview of an icon available in the BioSketch canvas editor.
                      Icons cannot be downloaded directly. Use the canvas editor to build figures with this icon.
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  className="w-full rounded-full"
                  size="sm"
                >
                  <Link to="/canvas">
                    <Paintbrush className="h-4 w-4 mr-2" />
                    Go to Canvas Editor
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Related icons */}
          {relatedIcons && relatedIcons.length > 0 && (
            <div className="mt-16 pt-12 border-t border-border/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-primary rounded-full" />
                <h2 className="text-xl font-serif font-semibold text-foreground">More Icons</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {relatedIcons.map((related: any, index: number) => (
                  <IconCard key={related.id} icon={related} index={index} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default IconDetail;
