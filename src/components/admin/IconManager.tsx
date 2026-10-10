import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Search, Tag } from "lucide-react";
import { WavesIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeSVG } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { generateCompressedThumbnail } from "@/utils/thumbnailGenerator";
import { useMembraneIcons } from "@/hooks/useMembraneIcons";
import { useIconTags } from "@/hooks/useIconTags";
import { TagCSVExport } from "./tags/TagCSVExport";
import { TagCSVImport } from "./tags/TagCSVImport";
import { TagInput } from "@/components/ui/tag-input";
import { Label } from "@/components/ui/label";

interface Icon {
  id: string;
  name: string;
  category: string;
  svg_content?: string; // Optional - only loaded on-demand for thumbnail regeneration
  thumbnail: string | null;
  created_at?: string;
  icon_categories?: { name: string } | null;
  is_membrane_icon?: boolean;
  is_default_membrane_icon?: boolean;
  tags?: string[] | null;
}

export const IconManager = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [brokenThumbnails, setBrokenThumbnails] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [editMode, setEditMode] = useState(false);
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "name_asc" | "name_desc">("created_desc");

  const ITEMS_PER_PAGE = 20;

  // Membrane icon management hooks
  const { toggleMembraneIcon, setDefaultMembraneIcon, unsetDefaultMembraneIcon } = useMembraneIcons();

  // Tag management hooks
  const { allTags, updateIconTags } = useIconTags();

  // Fetch categories with React Query
  const { data: categories = [] } = useQuery({
    queryKey: ['icon-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('icon_categories')
        .select('id, name')
        .order('name');
      return data || [];
    }
  });

  // Fetch icons with React Query
  const { data: iconsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-icons', currentPage, selectedCategory, searchQuery, selectedTag, sortBy],
    queryFn: async () => {
      // Build query with optional category and search filters
      let countQuery = supabase.from('icons').select('*', { count: 'exact', head: true });
      // OPTIMIZATION: Only load essential columns - svg_content is fetched on-demand when needed
      let dataQuery = supabase.from('icons').select('id, name, category, thumbnail, created_at, is_membrane_icon, is_default_membrane_icon, tags');

      if (selectedCategory !== "all") {
        countQuery = countQuery.eq('category', selectedCategory);
        dataQuery = dataQuery.eq('category', selectedCategory);
      }

      if (searchQuery.trim()) {
        countQuery = countQuery.ilike('name', `%${searchQuery.trim()}%`);
        dataQuery = dataQuery.ilike('name', `%${searchQuery.trim()}%`);
      }

      if (selectedTag === "untagged") {
        countQuery = countQuery.eq('tags', '[]');
        dataQuery = dataQuery.eq('tags', '[]');
      } else if (selectedTag !== "all") {
        countQuery = countQuery.contains('tags', [selectedTag]);
        dataQuery = dataQuery.contains('tags', [selectedTag]);
      }

      // Get total count
      const { count } = await countQuery;

      // Get paginated data
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const sortConfig = {
        created_desc: { column: 'created_at', ascending: false },
        created_asc:  { column: 'created_at', ascending: true  },
        name_asc:     { column: 'name',       ascending: true  },
        name_desc:    { column: 'name',       ascending: false },
      }[sortBy];

      const { data, error } = await dataQuery
        .order(sortConfig.column, { ascending: sortConfig.ascending, nullsFirst: false })
        .range(from, to);

      if (error) throw error;

      // Fetch category names separately
      const { data: categoryData } = await supabase
        .from('icon_categories')
        .select('id, name');

      const categoryMap = new Map(categoryData?.map(cat => [cat.id, cat.name]) || []);

      // Augment icons with category names
      const iconsWithCategories = data?.map(icon => ({
        ...icon,
        icon_categories: categoryMap.has(icon.category)
          ? { name: categoryMap.get(icon.category)! }
          : null
      }));

      return {
        icons: iconsWithCategories || [],
        totalIcons: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      };
    }
  });

  const icons = iconsData?.icons || [];
  const totalIcons = iconsData?.totalIcons || 0;
  const totalPages = iconsData?.totalPages || 1;

  // Debounce search input (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset selection and page when category, search, tag, or sort changes
  useEffect(() => {
    setSelectedIcons(new Set());
  }, [currentPage, selectedCategory, searchQuery, selectedTag, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, selectedTag, sortBy]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('icons')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Failed to delete icon");
    } else {
      toast.success("Icon deleted");
      refetch();
    }
  };

  const toggleIconSelection = (iconId: string) => {
    const newSelection = new Set(selectedIcons);
    if (newSelection.has(iconId)) {
      newSelection.delete(iconId);
    } else {
      newSelection.add(iconId);
    }
    setSelectedIcons(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIcons.size === icons.length) {
      setSelectedIcons(new Set());
    } else {
      setSelectedIcons(new Set(icons.map(icon => icon.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIcons.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedIcons.size} icon${selectedIcons.size > 1 ? 's' : ''}? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);

    try {
      const deletePromises = Array.from(selectedIcons).map(iconId =>
        supabase.from('icons').delete().eq('id', iconId)
      );

      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter(r => r.status === 'rejected').length;
      const successes = selectedIcons.size - failures;

      if (failures > 0) {
        toast.error(`Deleted ${successes} icons, ${failures} failed`);
      } else {
        toast.success(`Successfully deleted ${successes} icon${successes > 1 ? 's' : ''}`);
      }

      setSelectedIcons(new Set());
      refetch();
    } catch (error) {
      toast.error("Failed to delete icons");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchMembraneToggle = async (isMembrane: boolean) => {
    if (selectedIcons.size === 0) return;

    try {
      const updatePromises = Array.from(selectedIcons).map(iconId =>
        toggleMembraneIcon({ iconId, isMembrane })
      );

      await Promise.all(updatePromises);

      toast.success(`Updated ${selectedIcons.size} icon${selectedIcons.size > 1 ? 's' : ''} membrane status`);
      refetch();
    } catch (error) {
      toast.error("Failed to update icons");
      console.error(error);
    }
  };

  // Check if all selected icons have is_membrane_icon set to true
  const getSelectedMembraneStatus = (): boolean => {
    if (selectedIcons.size === 0) return false;

    const selectedIconsData = icons.filter(icon => selectedIcons.has(icon.id));
    return selectedIconsData.every(icon => icon.is_membrane_icon === true);
  };

  const handleRegenerateThumbnail = async (icon: Icon) => {
    setRegeneratingId(icon.id);

    try {
      // Fetch svg_content on-demand (not loaded initially for performance)
      const { data: iconData, error: fetchError } = await supabase
        .from('icons')
        .select('svg_content')
        .eq('id', icon.id)
        .single();

      if (fetchError || !iconData?.svg_content) {
        toast.error("Failed to fetch icon data");
        console.error(fetchError);
        return;
      }

      // Generate PNG thumbnail (target: 5-20 KB vs 200-300 KB full SVG)
      const thumbnail = await generateCompressedThumbnail(iconData.svg_content, 128);

      const { error } = await supabase
        .from('icons')
        .update({ thumbnail })
        .eq('id', icon.id);

      if (error) {
        toast.error("Failed to regenerate thumbnail");
        console.error(error);
      } else {
        toast.success("Thumbnail regenerated successfully!");
        refetch();
        brokenThumbnails.delete(icon.id);
        setBrokenThumbnails(new Set(brokenThumbnails));
      }
    } catch (error) {
      toast.error("Error regenerating thumbnail");
      console.error(error);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleThumbnailError = (iconId: string) => {
    brokenThumbnails.add(iconId);
    setBrokenThumbnails(new Set(brokenThumbnails));
  };

  const getThumbnailSize = (thumbnail: string | null): number => {
    if (!thumbnail) return 0;
    return new Blob([thumbnail]).size;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Icons</CardTitle>
        <CardDescription>
          View and delete uploaded icons - Showing {icons.length} of {totalIcons} icons
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search icons by name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Category:</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]" aria-label="Filter by category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Tag:</label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-[200px]" aria-label="Filter by tag">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  <SelectItem value="untagged">Untagged Icons</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag.tag} value={tag.tag}>
                      {tag.tag} ({tag.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Sort:</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[200px]" aria-label="Sort icons">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Newest first</SelectItem>
                  <SelectItem value="created_asc">Oldest first</SelectItem>
                  <SelectItem value="name_asc">Name A → Z</SelectItem>
                  <SelectItem value="name_desc">Name Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* CSV Export/Import and Edit Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TagCSVExport />
            <TagCSVImport />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background">
            <Label htmlFor="edit-mode" className="text-sm font-medium cursor-pointer">
              Edit tags
            </Label>
            <Switch
              id="edit-mode"
              checked={editMode}
              onCheckedChange={setEditMode}
            />
          </div>
        </div>

        {/* Selection Controls */}
        {icons.length > 0 && (
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIcons.size === icons.length && icons.length > 0}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label 
                  htmlFor="select-all" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Select All on This Page ({icons.length})
                </label>
              </div>
              {selectedIcons.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedIcons.size} icon{selectedIcons.size > 1 ? 's' : ''} selected
                </span>
              )}
            </div>

            {selectedIcons.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background">
                  <WavesIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Membrane</span>
                  <Switch
                    checked={getSelectedMembraneStatus()}
                    onCheckedChange={handleBatchMembraneToggle}
                    disabled={isDeleting}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected ({selectedIcons.size})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Grid or List View based on editMode */}
        {editMode ? (
          // List view for tag editing
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                <div key={`skeleton-${index}`} className="border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              icons.map((icon) => (
                <div
                  key={icon.id}
                  className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon thumbnail */}
                    <div className="w-16 h-16 border border-border rounded-lg p-2 flex items-center justify-center bg-muted flex-shrink-0">
                      {icon.thumbnail ? (
                        icon.thumbnail.startsWith('data:image/png') ? (
                          <img
                            src={icon.thumbnail}
                            alt={icon.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.thumbnail) }}
                            className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                          />
                        )
                      ) : (
                        <div className="text-xs text-muted-foreground text-center">
                          No preview
                        </div>
                      )}
                    </div>

                    {/* Icon info and tag editor */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium truncate">{icon.name}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground truncate">
                          {icon.icon_categories?.name || icon.category}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {icon.tags?.length || 0}/3
                        </span>
                      </div>
                      <TagInput
                        value={icon.tags || []}
                        onChange={(tags) => updateIconTags({ id: icon.id, tags })}
                        maxTags={3}
                        suggestions={allTags}
                        placeholder="Add tags..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Grid view (original)
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                <div key={`skeleton-${index}`} className="border rounded-lg p-3 space-y-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex gap-1">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </div>
              ))
            ) : (
              icons.map((icon) => {
            const thumbnailSize = getThumbnailSize(icon.thumbnail);
            const isOversized = thumbnailSize > 100000;
            const isBroken = brokenThumbnails.has(icon.id);
            const isSelected = selectedIcons.has(icon.id);
            
            return (
              <div 
                key={icon.id} 
                className={`border rounded-lg p-3 space-y-2 transition-all overflow-hidden ${
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                    : 'border-border'
                }`}
              >
                {/* Checkbox at top */}
                <div className="flex items-start justify-between">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleIconSelection(icon.id)}
                    className="mt-1"
                  />
                  {(isOversized || isBroken) && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" />
                      {isOversized ? "Large" : "Error"}
                    </div>
                  )}
                </div>
                
                {/* Thumbnail preview */}
                <div className="aspect-square border border-border rounded-lg p-2 flex items-center justify-center bg-muted">
                  {icon.thumbnail && !isBroken ? (
                    // Check if thumbnail is PNG data URL or SVG
                    icon.thumbnail.startsWith('data:image/png') ? (
                      <img
                        src={icon.thumbnail}
                        alt={icon.name}
                        className="w-16 h-16 object-contain"
                        onError={() => handleThumbnailError(icon.id)}
                      />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.thumbnail) }}
                        className="w-16 h-16 [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                        onError={() => handleThumbnailError(icon.id)}
                      />
                    )
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center text-xs text-muted-foreground">
                      No preview
                    </div>
                  )}
                </div>
                <div className="w-full overflow-hidden">
                  <p className="text-sm font-medium truncate" title={icon.name}>
                    {icon.name}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {icon.icon_categories?.name || icon.category}
                </p>
                {thumbnailSize > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(thumbnailSize / 1024).toFixed(1)} KB
                  </p>
                )}

                {/* Tags display */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tags:</p>
                  <div className="flex flex-wrap gap-1 min-h-[20px]">
                    {icon.tags && icon.tags.length > 0 ? (
                      icon.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRegenerateThumbnail(icon)}
                    disabled={regeneratingId === icon.id}
                  >
                    <RefreshCw className={`h-3 w-3 ${regeneratingId === icon.id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(icon.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Membrane Icon Controls */}
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={icon.is_membrane_icon || false}
                      onCheckedChange={(checked) => toggleMembraneIcon({ iconId: icon.id, isMembrane: checked })}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Membrane</span>
                  </div>

                  {icon.is_membrane_icon && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={icon.is_default_membrane_icon || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDefaultMembraneIcon(icon.id);
                          } else {
                            unsetDefaultMembraneIcon(icon.id);
                          }
                        }}
                        className="scale-75"
                      />
                      <span className="text-xs text-muted-foreground">Default</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
          )}
          </div>
        )}

        {!isLoading && icons.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No icons uploaded yet
          </p>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>

    </Card>
  );
};
