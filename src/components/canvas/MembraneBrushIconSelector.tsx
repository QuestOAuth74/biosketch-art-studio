import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, Search, ChevronLeft, ChevronRight, X, ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from "lucide-react";
import { WavesIcon } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembraneIcons } from "@/hooks/useMembraneIcons";
import noPreview from "@/assets/no_preview.png";
import { scoreSearchResults } from "@/lib/searchUtils";

// Helper functions for thumbnail handling
const isUrl = (str: string): boolean => {
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:');
};

const sanitizeSvg = (raw: string): string => {
  let svg = raw.trim();
  svg = svg
    .replace(/<\?xml[^>]*?>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");

  if (!svg.includes('viewBox')) {
    const widthMatch = svg.match(/width\s*=\s*["']([^"']+)["']/i);
    const heightMatch = svg.match(/height\s*=\s*["']([^"']+)["']/i);
    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      if (!isNaN(width) && !isNaN(height)) {
        svg = svg.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
      }
    }
  }
  
  return svg;
};

const svgToDataUrl = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
};

const ICONS_PER_PAGE = 20;

interface Category {
  id: string;
  name: string;
}

interface Icon {
  id: string;
  name: string;
  category: string;
  svg_content?: string; // Optional - loaded on-demand when icon is selected
  thumbnail?: string;
}

interface MembraneBrushIconSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (iconId: string, iconName: string, options: {
    iconSize: number;
    spacing: number;
    rotateToPath: boolean;
    doubleSided: boolean;
    orientationOffset: number;
  }) => void;
}

export const MembraneBrushIconSelector = ({ open, onOpenChange, onStart }: MembraneBrushIconSelectorProps) => {
  const { membraneIcons, isLoading: membraneIconsLoading } = useMembraneIcons();

  const [categories, setCategories] = useState<Category[]>([]);
  const [iconsByCategory, setIconsByCategory] = useState<Record<string, Icon[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState<Icon | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const [categoryTotalCounts, setCategoryTotalCounts] = useState<Record<string, number>>({});
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});
  const [searchResults, setSearchResults] = useState<Icon[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(0);

  // Brush options
  const [iconSize, setIconSize] = useState(40);
  const [spacing, setSpacing] = useState(0);
  const [rotateToPath, setRotateToPath] = useState(true);
  const [doubleSided, setDoubleSided] = useState(true);
  const [orientationOffset, setOrientationOffset] = useState(270);

  // Pagination helpers for server-side pagination
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

  const getPaginatedSearchResults = () => {
    const startIdx = searchPage * ICONS_PER_PAGE;
    return searchResults.slice(startIdx, startIdx + ICONS_PER_PAGE);
  };

  const getTotalSearchPages = () => Math.ceil(searchResults.length / ICONS_PER_PAGE);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchPage(0);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("icon_categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load icon categories");
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const searchTerms = query.trim().split(/\s+/).join(' & ');
      const searchPattern = `%${query.trim()}%`;

      // OPTIMIZATION: Only load thumbnails, svg_content fetched on-demand when "Start Drawing" clicked
      // Fetch results using both textSearch (for relevance) and ILIKE (for partial substring matching)
      const [textSearchResult, iLikeResult] = await Promise.all([
        supabase
          .from('icons')
          .select('id, name, category, thumbnail, tags')
          .textSearch('search_vector', searchTerms, {
            type: 'websearch',
            config: 'english'
          })
          .limit(150),
        supabase
          .from('icons')
          .select('id, name, category, thumbnail, tags')
          .or(`name.ilike.${searchPattern}`)
          .limit(150)
      ]);

      if (textSearchResult.error) throw textSearchResult.error;
      if (iLikeResult.error) throw iLikeResult.error;

      // Combine and deduplicate results
      const combinedResults = [...(textSearchResult.data || []), ...(iLikeResult.data || [])];
      const uniqueResults = Array.from(
        new Map(combinedResults.map(icon => [icon.id, icon])).values()
      );

      // Apply relevance scoring and sorting
      const scoredResults = scoreSearchResults(uniqueResults, query);
      setSearchResults(scoredResults);
      setSearchPage(0);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
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
        .from("icons")
        .select("id, name, category, thumbnail")
        .eq("category", categoryId)
        .order("name")
        .range(offset, offset + ICONS_PER_PAGE - 1);

      if (error) throw error;

      // Replace icons for current page (not merge - true pagination)
      setIconsByCategory(prev => ({
        ...prev,
        [categoryId]: data || []
      }));
    } catch (error) {
      console.error("Error loading icons:", error);
    } finally {
      setLoadingCategories(prev => ({ ...prev, [categoryId]: false }));
    }
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

  // Render pagination skeleton
  const renderPaginationSkeleton = () => {
    return (
      <div className="flex items-center justify-center gap-2 px-2 pb-2 pt-1">
        <Skeleton className="h-7 w-7 rounded" />
        <Skeleton className="h-4 w-[65px] rounded" />
        <Skeleton className="h-7 w-7 rounded" />
      </div>
    );
  };

  const handleAccordionChange = (value: string[]) => {
    setOpenAccordions(value);
    value.forEach(categoryId => {
      if (!iconsByCategory[categoryId]) {
        loadIconsForCategory(categoryId, 0);
      }
    });
  };

  const handleIconClick = (icon: Icon) => {
    setSelectedIcon(icon);
  };

  const handleStartDrawing = () => {
    if (!selectedIcon) {
      toast.error("Please select an icon first");
      return;
    }

    // Pass iconId and name instead of SVG content (icon-by-reference)
    onStart(selectedIcon.id, selectedIcon.name, {
      iconSize,
      spacing,
      rotateToPath,
      doubleSided,
      orientationOffset,
    });

    onOpenChange(false);
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const suggestedIcons = [
    { name: "Phospholipid", search: "phospholipid" },
    { name: "Channel", search: "channel" },
    { name: "Receptor", search: "receptor" },
    { name: "Pump", search: "pump" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Select Membrane Brush Icon
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search icons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-sm transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Suggested Icons */}
          {!searchQuery.trim() && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">Suggested for Membranes:</Label>
              <div className="flex gap-2 flex-wrap">
                {suggestedIcons.map((item) => (
                  <Button
                    key={item.search}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(item.search)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery.trim() && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">
                {isSearching ? "Searching..." : `Search Results (${searchResults.length} icons)`}
              </Label>
              {searchResults.length > 0 ? (
                <>
                  <div className="grid grid-cols-8 gap-2 border rounded-md p-3">
                    {getPaginatedSearchResults().map((icon) => {
                      let thumbSrc = '';
                      if (icon.thumbnail) {
                        if (isUrl(icon.thumbnail)) {
                          thumbSrc = icon.thumbnail;
                        } else {
                          thumbSrc = svgToDataUrl(sanitizeSvg(icon.thumbnail));
                        }
                      }

                      return (
                        <button
                          key={icon.id}
                          onClick={() => handleIconClick(icon)}
                          className={`p-2 rounded border transition-all hover:scale-110 ${
                            selectedIcon?.id === icon.id
                              ? 'border-primary bg-primary/10 ring-2 ring-primary'
                              : 'border-border hover:border-primary'
                          }`}
                          title={icon.name}
                        >
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={icon.name}
                              className="w-full h-auto"
                            />
                          ) : icon.svg_content ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: icon.svg_content }}
                              className="w-full h-auto"
                            />
                          ) : (
                            <img
                              src={noPreview}
                              alt="No preview"
                              className="w-full h-auto opacity-50"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Pagination */}
                  {getTotalSearchPages() > 1 && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        Page {searchPage + 1} of {getTotalSearchPages()}
                        {' '}({searchResults.length} results)
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={searchPage === 0}
                          onClick={() => setSearchPage(searchPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={searchPage >= getTotalSearchPages() - 1}
                          onClick={() => setSearchPage(searchPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : !isSearching && (
                <div className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                  No icons found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Categories - only show when NOT searching */}
          {!searchQuery.trim() && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">All Categories:</Label>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {/* Membrane Icons Section - only show if not searching */}
                {!searchQuery.trim() && membraneIcons.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <WavesIcon className="h-5 w-5 text-primary" />
                      <Label className="text-sm font-medium">Membrane Icons ({membraneIcons.length})</Label>
                    </div>

                    <div className="border-2 border-primary/30 rounded-lg bg-primary/5 p-3">
                      <div className="grid grid-cols-8 gap-2">
                        {membraneIcons.map((icon: any) => {
                          let thumbSrc = '';
                          if (icon.thumbnail) {
                            if (isUrl(icon.thumbnail)) {
                              thumbSrc = icon.thumbnail;
                            } else {
                              thumbSrc = svgToDataUrl(sanitizeSvg(icon.thumbnail));
                            }
                          }

                          return (
                            <button
                              key={icon.id}
                              onClick={() => handleIconClick(icon)}
                              className={`relative p-2 rounded border ${
                                selectedIcon?.id === icon.id ? 'border-primary ring-2' : 'border-border'
                              }`}
                              title={icon.name}
                            >
                              {icon.is_default_membrane_icon && (
                                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[10px] px-1 rounded">
                                  DEFAULT
                                </div>
                              )}
                              {thumbSrc && <img src={thumbSrc} alt={icon.name} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <Accordion
                  type="multiple"
                  value={openAccordions}
                  onValueChange={handleAccordionChange}
                >
                  {filteredCategories.map((category) => (
                    <AccordionItem key={category.id} value={category.id}>
                      <AccordionTrigger className="text-sm font-medium">
                        {category.name}
                      </AccordionTrigger>
                      <AccordionContent>
                        {iconsByCategory[category.id] ? (
                          <>
                            <div className="grid grid-cols-8 gap-2">
                              {iconsByCategory[category.id].map((icon) => {
                                // Determine proper thumbnail source
                                let thumbSrc = '';
                                if (icon.thumbnail) {
                                  if (isUrl(icon.thumbnail)) {
                                    thumbSrc = icon.thumbnail;
                                  } else {
                                    // Raw SVG - convert to data URL
                                    thumbSrc = svgToDataUrl(sanitizeSvg(icon.thumbnail));
                                  }
                                }

                                return (
                                  <button
                                    key={icon.id}
                                    onClick={() => handleIconClick(icon)}
                                    className={`p-2 rounded border transition-all hover:scale-110 ${
                                      selectedIcon?.id === icon.id
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                        : 'border-border hover:border-primary'
                                    }`}
                                    title={icon.name}
                                  >
                                    {thumbSrc ? (
                                      <img
                                        src={thumbSrc}
                                        alt={icon.name}
                                        className="w-full h-auto"
                                      />
                                    ) : icon.svg_content ? (
                                      <div
                                        dangerouslySetInnerHTML={{ __html: icon.svg_content }}
                                        className="w-full h-auto"
                                      />
                                    ) : (
                                      <img
                                        src={noPreview}
                                        alt="No preview"
                                        className="w-full h-auto opacity-50"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {renderPaginationControls(category.id)}
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {loadingCategories[category.id] ? 'Loading icons...' : 'No icons found'}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            )}
            </div>
          )}

          {/* Selected Icon Preview & Options */}
          {selectedIcon && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium mb-3 block">Selected Icon & Options:</Label>
              
              <div className="flex gap-6">
                {/* Preview */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 border rounded-lg bg-background flex items-center justify-center p-2">
                    {(() => {
                      let thumbSrc = '';
                      if (selectedIcon.thumbnail) {
                        if (isUrl(selectedIcon.thumbnail)) {
                          thumbSrc = selectedIcon.thumbnail;
                        } else {
                          thumbSrc = svgToDataUrl(sanitizeSvg(selectedIcon.thumbnail));
                        }
                      }

                      return thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={selectedIcon.name}
                          className="max-w-full max-h-full"
                        />
                      ) : selectedIcon.svg_content ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: selectedIcon.svg_content }}
                          className="max-w-full max-h-full"
                        />
                      ) : (
                        <img
                          src={noPreview}
                          alt="No preview"
                          className="max-w-full max-h-full opacity-50"
                        />
                      );
                    })()}
                  </div>
                  <p className="text-xs text-center mt-1 text-muted-foreground">{selectedIcon.name}</p>
                </div>

                {/* Options */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm">Icon Size</Label>
                      <span className="text-sm text-muted-foreground">{iconSize}px</span>
                    </div>
                    <Slider
                      value={[iconSize]}
                      onValueChange={(v) => setIconSize(v[0])}
                      min={20}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm">Spacing</Label>
                      <span className="text-sm text-muted-foreground">
                        {spacing}px {spacing === 0 && "(touching)"}
                      </span>
                    </div>
                    <Slider
                      value={[spacing]}
                      onValueChange={(v) => setSpacing(v[0])}
                      min={0}
                      max={50}
                      step={5}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Rotate to follow path</Label>
                    <Switch
                      checked={rotateToPath}
                      onCheckedChange={setRotateToPath}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Double-sided (bilayer)</Label>
                    <Switch
                      checked={doubleSided}
                      onCheckedChange={setDoubleSided}
                    />
                  </div>

                  {/* Orientation Control */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Icon Orientation</Label>
                      <span className="text-sm text-muted-foreground">{orientationOffset}°</span>
                    </div>
                    
                    {/* Preset Direction Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      <Button 
                        variant={orientationOffset === 0 ? "default" : "outline"} 
                        size="sm"
                        onClick={() => setOrientationOffset(0)}
                        type="button"
                      >
                        <ArrowUp className="h-4 w-4 mr-1" /> Up
                      </Button>
                      <Button 
                        variant={orientationOffset === 90 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOrientationOffset(90)}
                        type="button"
                      >
                        <ArrowRight className="h-4 w-4 mr-1" /> Right
                      </Button>
                      <Button 
                        variant={orientationOffset === 180 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOrientationOffset(180)}
                        type="button"
                      >
                        <ArrowDown className="h-4 w-4 mr-1" /> Down
                      </Button>
                      <Button 
                        variant={orientationOffset === 270 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOrientationOffset(270)}
                        type="button"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" /> Left
                      </Button>
                    </div>

                    {/* Fine-tune Slider */}
                    <Slider
                      value={[orientationOffset]}
                      onValueChange={([value]) => setOrientationOffset(value)}
                      min={0}
                      max={360}
                      step={15}
                      className="w-full"
                    />

                    {/* Orientation Preview */}
                    {selectedIcon && (
                      <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                        <div className="relative w-16 h-16 border rounded flex items-center justify-center bg-background">
                          {/* Path direction arrow */}
                          <div className="absolute w-full h-0.5 bg-muted-foreground/50" />
                          <ArrowRight className="absolute h-4 w-4 text-muted-foreground" />
                          
                          {/* Icon preview with rotation */}
                          <div 
                            className="w-8 h-8 z-10"
                            style={{ transform: `rotate(${90 + orientationOffset}deg)` }}
                          >
                            {(() => {
                              let thumbSrc = '';
                              if (selectedIcon.thumbnail) {
                                if (isUrl(selectedIcon.thumbnail)) {
                                  thumbSrc = selectedIcon.thumbnail;
                                } else {
                                  thumbSrc = svgToDataUrl(sanitizeSvg(selectedIcon.thumbnail));
                                }
                              }

                              return thumbSrc ? (
                                <img 
                                  src={thumbSrc} 
                                  alt="Preview" 
                                  className="w-full h-full object-contain" 
                                />
                              ) : (
                                <img 
                                  src={noPreview}
                                  alt="Preview" 
                                  className="w-full h-full object-contain opacity-50" 
                                />
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex-1">
                          Preview shows icon orientation relative to path direction (→)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStartDrawing} disabled={!selectedIcon}>
            Start Drawing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
