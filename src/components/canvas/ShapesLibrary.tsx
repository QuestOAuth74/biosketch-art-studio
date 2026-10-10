import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, ChevronLeft, Search, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconCategory, IconItem, IconDbRow } from "@/types/icon";
import { toast } from "sonner";
import { useFavoriteIcons } from "@/hooks/useFavoriteIcons";
import { useAuth } from "@/contexts/AuthContext";
import noPreview from "@/assets/no_preview.png";

// OPTIMIZATION: Load icons in pages to prevent massive data transfers
const ICONS_PER_PAGE = 20;

interface ShapesLibraryProps {
  onShapeSelect: (shape: string) => void;
}

export const ShapesLibrary = ({ onShapeSelect }: ShapesLibraryProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [categories, setCategories] = useState<IconCategory[]>([]);
  const [iconsByCategory, setIconsByCategory] = useState<Record<string, IconItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const [categoryTotalCounts, setCategoryTotalCounts] = useState<Record<string, number>>({});
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});
  const { favoriteIconIds, toggleFavorite, isFavorite } = useFavoriteIcons();

  const handleImageError = (iconId: string) => {
    setBrokenImages(prev => ({ ...prev, [iconId]: true }));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('icon_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load icon categories');
    } finally {
      setLoading(false);
    }
  };

  const loadIconsForCategory = async (categoryId: string, page: number = 0) => {
    try {
      setLoadingCategories(prev => ({ ...prev, [categoryId]: true }));

      // Get total count (only once per category)
      if (categoryTotalCounts[categoryId] === undefined) {
        const { count, error: countError } = await supabase
          .from('icons')
          .select('id', { count: 'exact', head: true })
          .eq('category', categoryId);

        if (!countError && count !== null) {
          setCategoryTotalCounts(prev => ({ ...prev, [categoryId]: count }));
        }
      }

      // OPTIMIZATION: Load only one page at a time (20 icons per page)
      // This prevents loading 237 icons × 230 KB = 54.8 MB
      const offset = page * ICONS_PER_PAGE;
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail, created_at')
        .eq('category', categoryId)
        .order('name')
        .range(offset, offset + ICONS_PER_PAGE - 1);

      if (error) throw error;
      // Convert IconDbRow to IconItem format
      const icons: IconItem[] = (data || []).map((icon: IconDbRow) => ({
        id: icon.id,
        name: icon.name,
        category: icon.category,
        svgData: undefined, // Loaded on-demand when icon is clicked
        thumbnail: icon.thumbnail || undefined,
        createdAt: new Date(icon.created_at).getTime(),
      }));

      // Replace icons for current page (not merge - true pagination)
      setIconsByCategory(current => ({
        ...current,
        [categoryId]: icons
      }));
    } catch (error) {
      console.error('Error loading icons:', error);
      toast.error('Failed to load icons');
    } finally {
      setLoadingCategories(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Helper to fetch svg_content on-demand when icon is clicked
  const handleIconClick = async (icon: IconItem) => {
    try {
      // If svg_content is already loaded (cached), use it directly
      if (icon.svgData) {
        window.dispatchEvent(
          new CustomEvent("addIconToCanvas", { detail: { svgData: icon.svgData } })
        );
        return;
      }

      // Otherwise, fetch svg_content on-demand
      const { data, error } = await supabase
        .from('icons')
        .select('svg_content')
        .eq('id', icon.id)
        .single();

      if (error) throw error;

      if (data?.svg_content) {
        // Cache the svgData in the icon for future clicks
        icon.svgData = data.svg_content;

        window.dispatchEvent(
          new CustomEvent("addIconToCanvas", { detail: { svgData: data.svg_content } })
        );
      } else {
        toast.error('Icon data not found');
      }
    } catch (error) {
      console.error('Error loading icon:', error);
      toast.error('Failed to load icon');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const isExpanding = !prev.includes(section);

      // Lazy load icons only when expanding (start at page 0)
      if (isExpanding && !iconsByCategory[section]) {
        loadIconsForCategory(section, 0);
      }

      return isExpanding
        ? [...prev, section]
        : prev.filter(s => s !== section);
    });
  };

  // Helper functions for pagination
  const getCurrentPage = (categoryId: string) => categoryPages[categoryId] || 0;

  const setCurrentPage = (categoryId: string, page: number) => {
    setCategoryPages(prev => ({ ...prev, [categoryId]: page }));
  };

  const getTotalPages = (categoryId: string) => {
    const totalCount = categoryTotalCounts[categoryId] || 0;
    return Math.ceil(totalCount / ICONS_PER_PAGE);
  };

  const goToPage = async (categoryId: string, page: number) => {
    setCurrentPage(categoryId, page);
    await loadIconsForCategory(categoryId, page);
  };

  const goToNextPage = async (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    if (currentPage < totalPages - 1) {
      await goToPage(categoryId, currentPage + 1);
    }
  };

  const goToPreviousPage = async (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    if (currentPage > 0) {
      await goToPage(categoryId, currentPage - 1);
    }
  };

  const hasNextPage = (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    return currentPage < totalPages - 1;
  };

  const hasPreviousPage = (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    return currentPage > 0;
  };

  // Render pagination controls
  const renderPaginationControls = (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    const totalCount = categoryTotalCounts[categoryId] || 0;

    if (totalPages <= 1 || totalCount === 0) {
      return null;
    }

    const isLoading = loadingCategories[categoryId];

    return (
      <div className="flex items-center justify-center gap-2 px-2 pb-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPreviousPage(categoryId)}
          disabled={!hasPreviousPage(categoryId) || isLoading}
          className="h-7 w-7 p-0"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-xs text-foreground font-medium px-2 min-w-[65px] text-center">
          {currentPage + 1} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToNextPage(categoryId)}
          disabled={!hasNextPage(categoryId) || isLoading}
          className="h-7 w-7 p-0"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const filteredCategories = categories.filter((c) => {
    if (!searchQuery) return true;
    const icons = iconsByCategory[c.id];
    if (!icons) return true;
    return icons.some(icon => icon.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const FavoritesSection = () => {
    const [favoriteIcons, setFavoriteIcons] = useState<IconItem[]>([]);
    const [favLoading, setFavLoading] = useState(true);

    useEffect(() => {
      loadFavoriteIcons();
    }, [favoriteIconIds]);

    const loadFavoriteIcons = async () => {
      if (favoriteIconIds.size === 0) {
        setFavoriteIcons([]);
        setFavLoading(false);
        return;
      }

      try {
        setFavLoading(true);
        // OPTIMIZATION: Only load thumbnails initially - svg_content is fetched on-demand when icon is clicked
        const { data, error } = await supabase
          .from('icons')
          .select('id, name, category, thumbnail, created_at')
          .in('id', Array.from(favoriteIconIds));

        if (error) throw error;

        const icons: IconItem[] = (data || []).map((icon: IconDbRow) => ({
          id: icon.id,
          name: icon.name,
          category: icon.category,
          svgData: undefined, // Loaded on-demand when icon is clicked
          thumbnail: icon.thumbnail || undefined,
          createdAt: new Date(icon.created_at).getTime(),
        }));

        setFavoriteIcons(icons);
      } catch (error) {
        console.error('Error loading favorite icons:', error);
      } finally {
        setFavLoading(false);
      }
    };

    if (favLoading) {
      return (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-square rounded" />
          ))}
        </div>
      );
    }

    if (favoriteIcons.length === 0) {
      return (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No favorite icons yet. Star icons to add them here!
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-1.5">
        {favoriteIcons
          .filter(icon => !searchQuery || icon.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((icon) => (
            <div key={icon.id} className="relative group">
              <button
                onClick={() => handleIconClick(icon)}
                className="aspect-square border-2 border-border/40 rounded p-2 w-full
                           bg-background
                           bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)]
                           bg-[length:10px_10px]
                           hover:border-primary/60 hover:bg-accent/40 hover:shadow-md
                           transition-all hover:scale-[1.08]"
                title={icon.name}
              >
                  {icon.thumbnail && !brokenImages[icon.id] ? (
                  <img 
                    src={icon.thumbnail} 
                    alt={icon.name} 
                    className="w-full h-full object-contain" 
                    loading="lazy"
                    onError={() => handleImageError(icon.id)}
                  />
                ) : (
                  <img 
                    src={noPreview}
                    alt={`${icon.name} preview unavailable`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(icon.id);
                }}
                className="absolute top-0.5 right-0.5 p-1 bg-background/80 backdrop-blur-sm rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background z-10"
                title="Remove from favorites"
              >
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              </button>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" data-onboarding="shapes-library">
      {/* Search Bar */}
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs glass-effect"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Favorites Section */}
              {user && favoriteIconIds.size > 0 && (
                <div className="border border-border/40 rounded-lg overflow-hidden bg-yellow-400/10 mb-2">
                  <button
                    onClick={() => toggleSection('favorites')}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-accent/50 text-sm font-semibold transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      ⭐ My Favorites
                      <span className="text-xs text-muted-foreground font-normal">
                        ({favoriteIconIds.size} icon{favoriteIconIds.size !== 1 ? 's' : ''})
                      </span>
                    </span>
                    {expandedSections.includes('favorites') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSections.includes('favorites') && (
                    <div className="p-2 border-t border-border/40">
                      <FavoritesSection />
                    </div>
                  )}
                </div>
              )}

              {/* Regular Categories */}
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No categories found
                </div>
              ) : (
                filteredCategories.map((c) => {
              const sectionId = c.id;
              const categoryIcons = iconsByCategory[c.id] || [];
              const totalCount = categoryTotalCounts[c.id] || 0;
              const hasMore = hasMorePages(c.id);
              return (
                <div key={c.id} className="border border-border/40 rounded-lg overflow-hidden bg-card/50 backdrop-blur-sm">
                  <button
                    onClick={() => toggleSection(sectionId)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-accent/50 text-sm font-semibold transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {c.name}
                      {totalCount > 0 && (
                        <span className="text-xs text-muted-foreground font-normal">
                          ({totalCount} icon{totalCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </span>
                    {expandedSections.includes(sectionId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSections.includes(sectionId) && (
                    <div className="border-t border-border/40">
                      <div className="grid grid-cols-4 gap-1.5 p-2">
                        {categoryIcons.length > 0 ? (
                          categoryIcons
                            .filter(icon => !searchQuery || icon.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((icon) => {
                              const isFavorited = isFavorite(icon.id);
                              return (
                                <div key={icon.id} className="relative group">
                                  <button
                                    onClick={() => handleIconClick(icon)}
                                     className="aspect-square border-2 border-border/40 rounded p-2 w-full
                                               bg-background
                                               bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)]
                                               bg-[length:10px_10px]
                                               hover:border-primary/60 hover:bg-accent/40 hover:shadow-md
                                               transition-all hover:scale-[1.08]"
                                    title={icon.name}
                                  >
                                      {icon.thumbnail && !brokenImages[icon.id] ? (
                                      <img
                                        src={icon.thumbnail}
                                        alt={icon.name}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                        onError={() => handleImageError(icon.id)}
                                      />
                                    ) : (
                                      <img
                                        src={noPreview}
                                        alt={`${icon.name} preview unavailable`}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                      />
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(icon.id);
                                    }}
                                    className="absolute top-0.5 right-0.5 p-1 bg-background/80 backdrop-blur-sm rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background z-10"
                                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                                  >
                                    <Star
                                      className={`h-3 w-3 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                                    />
                                  </button>
                                </div>
                              );
                            })
                        ) : (
                          <div className="col-span-4 text-center py-4 text-sm text-muted-foreground">
                            {loadingCategories[c.id] ? 'Loading icons...' : 'No icons found'}
                          </div>
                        )}
                      </div>

                      {renderPaginationControls(c.id)}
                    </div>
                  )}
                </div>
              );
            })
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
