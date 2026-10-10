import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { Search, X, Pin, Sparkles, Plus, FolderOpen, Users, ChevronLeft, ChevronRight, Layers, Wand2, Loader2 } from "lucide-react";
import { usePinnedCategories } from "@/hooks/usePinnedCategories";
import { useAIGenerationUsage } from "@/hooks/useAIGenerationUsage";
import { useGenerationBalance } from "@/hooks/useGenerationBalance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import noPreview from "@/assets/no_preview.png";
import { LoadingProgress } from "@/components/canvas/LoadingProgress";
import { categoryAnalytics } from "@/lib/categoryAnalytics";
import { trackIconSearch } from "@/lib/analyticsTracker";
import { IconLibraryTestIds } from "@/lib/test-ids";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PremiumFeaturesPopover } from "./PremiumFeaturesPopover";
import { scoreSearchResults } from "@/lib/searchUtils";

interface Icon {
  id: string;
  name: string;
  category: string;
  svg_content?: string;
  thumbnail?: string;
  uploaded_by?: string | null;
  tags?: any;
}

interface Category {
  id: string;
  name: string;
}

interface IconLibraryProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAIIconGenerate?: (initialPrompt?: string) => void;
  onShareClick?: () => void;
}

const ICONS_PER_PAGE = 20;

// Helper to normalize category names for matching
const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Helper functions to sanitize and encode SVG content
const sanitizeSvg = (raw: string): string => {
  try {
    let svg = raw.trim();
    // Remove XML declarations and DOCTYPE
    svg = svg
      .replace(/<\?xml[^>]*?>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
    
    // Ensure viewBox if missing and width/height exist
    if (!/viewBox=/i.test(svg)) {
      const w = svg.match(/\bwidth=["']?(\d+(\.\d+)?)\s*(px)?["']?/i);
      const h = svg.match(/\bheight=["']?(\d+(\.\d+)?)\s*(px)?["']?/i);
      if (w && h) {
        const width = parseFloat(w[1]);
        const height = parseFloat(h[1]);
        svg = svg.replace(/<svg([^>]*?)>/i, `<svg$1 viewBox=\"0 0 ${width} ${height}\">`);
        svg = svg.replace(/\b(width|height)=["'][^"']*["']/gi, "");
      }
    }
    
    return svg;
  } catch {
    return raw;
  }
};

const svgToDataUrl = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, "")
  .replace(/%20/g, " ");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
};

// Helper to check if thumbnail is a URL (not raw SVG)
const isUrl = (str: string): boolean => {
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:');
};

export const IconLibrary = ({ selectedCategory, onCategoryChange, isCollapsed, onToggleCollapse, onAIIconGenerate, onShareClick }: IconLibraryProps) => {
  const { usage: aiUsage } = useAIGenerationUsage();
  // New credit system — authoritative for numeric display.
  const { data: aiBalance } = useGenerationBalance();
  const [categories, setCategories] = useState<Category[]>([]);
  const [iconsByCategory, setIconsByCategory] = useState<Record<string, Icon[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<string>("checking");
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const [categoryTotalCounts, setCategoryTotalCounts] = useState<Record<string, number>>({});
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const [brokenMap, setBrokenMap] = useState<Record<string, boolean>>({});
  const [thumbnailLoadedMap, setThumbnailLoadedMap] = useState<Record<string, boolean>>({});
  const [fullSvgLoadedMap, setFullSvgLoadedMap] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Icon[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const { pinnedCategoryIds, togglePin, isPinned } = usePinnedCategories();
  const { hasAccess } = useFeatureAccess();
  const [aiIconHeaderPopoverOpen, setAiIconHeaderPopoverOpen] = useState(false);
  const [aiIconCategoryPopoverOpen, setAiIconCategoryPopoverOpen] = useState(false);
  const [aiIconEmptyPopoverOpen, setAiIconEmptyPopoverOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'community'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myIcons, setMyIcons] = useState<Icon[]>([]);
  const [myLibraryIcons, setMyLibraryIcons] = useState<Icon[]>([]);
  const [communityAIIcons, setCommunityAIIcons] = useState<Icon[]>([]);
  const [loadingCommunityIcons, setLoadingCommunityIcons] = useState(false);
  const [loadingMyLibraryIcons, setLoadingMyLibraryIcons] = useState(false);

  // Loading progress state
  const [loadingProgress, setLoadingProgress] = useState<{
    iconName: string;
    progress: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Find the BioSketch Icons category
  const biosketchCategory = useMemo(() => {
    return categories.find(cat => cat.name.toLowerCase().includes('biosketch'));
  }, [categories]);

  // Split categories into pinned and unpinned, excluding biosketch (shown at top)
  const { pinnedCategories, unpinnedCategories } = useMemo(() => {
    if (searchQuery.trim()) {
      return { pinnedCategories: [], unpinnedCategories: categories };
    }

    // Exclude biosketch from regular categories list (it's shown at top separately)
    const filteredCategories = categories.filter(cat => cat.id !== biosketchCategory?.id);

    const pinned = filteredCategories.filter(cat => isPinned(cat.id));
    const unpinned = filteredCategories.filter(cat => !isPinned(cat.id));

    return { pinnedCategories: pinned, unpinnedCategories: unpinned };
  }, [categories, isPinned, searchQuery, biosketchCategory]);

  useEffect(() => {
    loadData();
    loadCurrentUser();

    // Listen for thumbnail generation completion
    const handleThumbnailsGenerated = () => {
      loadData();
    };

    window.addEventListener('thumbnailsGenerated', handleThumbnailsGenerated);
    return () => window.removeEventListener('thumbnailsGenerated', handleThumbnailsGenerated);
  }, []);

  // Load my icons when user ID is available
  useEffect(() => {
    if (currentUserId) {
      loadMyIcons();
      loadMyLibraryIcons();
    }
  }, [currentUserId]);

  // Load community AI icons when switching to community view
  useEffect(() => {
    if (viewMode === 'community') {
      loadCommunityAIIcons();
    }
  }, [viewMode]);

  // Debounced search (500ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadMyIcons = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail, uploaded_by, tags')
        .eq('uploaded_by', currentUserId)
        .order('name');

      if (error) throw error;
      setMyIcons(data || []);

      // Set total count for "My Icons" pseudo-category
      setCategoryTotalCounts(prev => ({ ...prev, 'my-icons': data?.length || 0 }));
      setIconsByCategory(prev => ({ ...prev, 'my-icons': data || [] }));
    } catch (error) {
      console.error('Error loading my icons:', error);
    }
  };

  const loadMyLibraryIcons = async () => {
    if (!currentUserId) return;

    try {
      setLoadingMyLibraryIcons(true);

      // Fetch user assets with category 'ai-icons'
      const { data: assets, error } = await supabase
        .from('user_assets')
        .select('id, original_name, storage_path, created_at')
        .eq('user_id', currentUserId)
        .eq('category', 'ai-icons')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert user_assets to Icon format
      const icons: Icon[] = (assets || []).map(asset => {
        // Get public URL for the asset
        const { data } = supabase.storage
          .from('user-assets')
          .getPublicUrl(asset.storage_path);

        return {
          id: asset.id,
          name: asset.original_name.replace(/\.(png|jpg|jpeg)$/i, ''),
          category: 'ai-icons',
          thumbnail: data.publicUrl,
          uploaded_by: currentUserId
        };
      });

      setMyLibraryIcons(icons);
    } catch (error) {
      console.error('Error loading my library icons:', error);
    } finally {
      setLoadingMyLibraryIcons(false);
    }
  };

  const loadCommunityAIIcons = async () => {
    try {
      setLoadingCommunityIcons(true);
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail, uploaded_by, tags')
        .eq('category', 'ai-icons')
        .not('uploaded_by', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunityAIIcons(data || []);
    } catch (error) {
      console.error('Error loading community AI icons:', error);
      toast.error('Failed to load community icons');
    } finally {
      setLoadingCommunityIcons(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const searchTerms = query.trim().split(/\s+/).join(' & ');

      // Expand search terms via AI semantic search
      let expandedTerms = [query.trim()];
      try {
        const { data } = await supabase.functions.invoke('semantic-icon-search', {
          body: { query: query.trim() },
        });
        if (data?.terms?.length > 0) expandedTerms = data.terms;
      } catch {}

      // Build OR filter from all expanded terms
      const ilikeFilters = expandedTerms.map((t: string) => `name.ilike.%${t}%`).join(',');

      // Fetch results using both textSearch (for relevance) and ILIKE with expanded terms
      let textSearchQuery = supabase
        .from('icons')
        .select('id, name, category, thumbnail, uploaded_by, tags')
        .textSearch('search_vector', searchTerms, {
          type: 'websearch',
          config: 'english'
        })
        .limit(100);

      let iLikeQuery = supabase
        .from('icons')
        .select('id, name, category, thumbnail, uploaded_by, tags')
        .or(ilikeFilters)
        .limit(100);

      // Filter for community view
      if (viewMode === 'community') {
        textSearchQuery = textSearchQuery
          .eq('category', 'ai-icons')
          .not('uploaded_by', 'is', null);
        iLikeQuery = iLikeQuery
          .eq('category', 'ai-icons')
          .not('uploaded_by', 'is', null);
      }

      // Execute both queries in parallel
      const [textSearchResult, iLikeResult] = await Promise.all([
        textSearchQuery,
        iLikeQuery
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
      trackIconSearch(query, scoredResults.length);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadIconsForCategory = async (categoryId: string, categoryName: string, page: number = 0) => {
    setLoadingCategories(prev => ({ ...prev, [categoryId]: true }));

    try {
      const id = categoryId;
      const name = categoryName;
      const idSlug = slugify(id);
      const nameSlug = slugify(name);

      // Build OR filter for flexible category matching
      const filters = [
        `category.eq.${id}`,
        `category.eq.${name}`,
        `category.ilike.%${id}%`,
        `category.ilike.%${nameSlug}%`,
      ];

      const uniqueFilters = Array.from(new Set(filters));
      const orFilter = uniqueFilters.join(',');

      // Get total count (only once per category)
      if (categoryTotalCounts[categoryId] === undefined) {
        let countQuery = supabase
          .from('icons')
          .select('id', { count: 'exact', head: true })
          .or(orFilter);

        // Filter by uploaded_by for community view
        if (viewMode === 'community') {
          countQuery = countQuery.not('uploaded_by', 'is', null);
        }

        const { count, error: countError } = await countQuery;

        if (!countError && count !== null) {
          setCategoryTotalCounts(prev => ({ ...prev, [categoryId]: count }));
        }
      }

      // OPTIMIZATION: Load only one page at a time (default 20 icons)
      // This prevents loading 237 icons × 230 KB = 54.8 MB
      const offset = page * ICONS_PER_PAGE;
      let queryBuilder = supabase
        .from('icons')
        .select('id, name, category, thumbnail, uploaded_by, tags')
        .or(orFilter)
        .order('name')
        .range(offset, offset + ICONS_PER_PAGE - 1);

      // Filter by uploaded_by for community view
      if (viewMode === 'community') {
        queryBuilder = queryBuilder.not('uploaded_by', 'is', null);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error(`Icons error for category ${categoryId}:`, error);
        toast.error(`Failed to load icons for ${categoryName}`);
        return;
      }

      // Replace icons for current page (not merge - true pagination)
      setIconsByCategory(prev => ({
        ...prev,
        [categoryId]: data || []
      }));
    } catch (error) {
      console.error(`Error loading category ${categoryId}:`, error);
      toast.error(`Failed to load icons for ${categoryName}`);
    } finally {
      setLoadingCategories(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      setAuthState(session ? "authenticated" : "not authenticated");
      
      // Load categories only (icons loaded on-demand)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('icon_categories')
        .select('*')
        .order('name');

      if (categoriesError) {
        console.error("Categories error:", categoriesError);
        throw new Error(`Failed to load categories: ${categoriesError.message}`);
      }
      if (categoriesData) {
        setCategories(categoriesData);

        // OPTIMIZATION DISABLED: Auto-preloading causes massive data transfers
        // Categories now load on-demand when user expands them (with pagination)
        // This prevents loading 50+ MB of thumbnails on page load
      }
    } catch (err) {
      console.error("Error loading icon library:", err);
      setError(err instanceof Error ? err.message : "Failed to load icons");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Convert SVG with external image reference to embedded image data
   */
  const embedExternalImage = async (svgContent: string): Promise<string> => {
    // Check if SVG contains external image reference
    const hasExternalImage = svgContent.includes('<image') && svgContent.includes('href=');

    if (!hasExternalImage) {
      return svgContent; // Return as-is if no external image
    }

    // Extract image URL
    const hrefMatch = svgContent.match(/href\s*=\s*["']([^"']+)["']/);
    if (!hrefMatch) {
      return svgContent;
    }

    const imageUrl = hrefMatch[1];

    // If already a data URL, return as-is
    if (imageUrl.startsWith('data:')) {
      return svgContent;
    }

    // Load and convert external image to data URL
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(svgContent); // Fallback to original
            return;
          }

          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');

          // Replace external URL with embedded data URL
          const embeddedSvg = svgContent.replace(imageUrl, dataUrl);
          resolve(embeddedSvg);
        } catch (error) {
          console.error('Failed to embed image:', error);
          resolve(svgContent); // Fallback to original
        }
      };

      img.onerror = () => {
        console.error('Failed to load external image:', imageUrl);
        resolve(svgContent); // Fallback to original
      };

      img.src = imageUrl;
    });
  };

  // AI icon generator is usable if the user has legacy premium access OR any AI
  // generation credits (free grant remaining or purchased balance > 0).
  const canUseAIIcon = hasAccess || (aiBalance ? aiBalance.total_available > 0 : false);

  const handleAIIconHeaderClick = () => {
    if (!canUseAIIcon) {
      setAiIconHeaderPopoverOpen(true);
    } else if (onAIIconGenerate) {
      onAIIconGenerate();
    }
  };

  const handleAIIconCategoryClick = () => {
    if (!canUseAIIcon) {
      setAiIconCategoryPopoverOpen(true);
    } else if (onAIIconGenerate) {
      onAIIconGenerate();
    }
  };

  const handleAIIconEmptyClick = () => {
    if (!canUseAIIcon) {
      setAiIconEmptyPopoverOpen(true);
    } else if (onAIIconGenerate) {
      onAIIconGenerate();
    }
  };

  const handleShareFromHeaderPopover = () => {
    setAiIconHeaderPopoverOpen(false);
    if (onShareClick) {
      onShareClick();
    }
  };

  const handleShareFromCategoryPopover = () => {
    setAiIconCategoryPopoverOpen(false);
    if (onShareClick) {
      onShareClick();
    }
  };

  const handleShareFromEmptyPopover = () => {
    setAiIconEmptyPopoverOpen(false);
    if (onShareClick) {
      onShareClick();
    }
  };

  const handleIconClick = async (icon: Icon) => {
    // Cancel any existing load
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoadingProgress({ iconName: icon.name, progress: 0 });

    try {
      // Check if this is a library icon (from user_assets)
      const isLibraryIcon = myLibraryIcons.some(libIcon => libIcon.id === icon.id);

      if (isLibraryIcon && icon.thumbnail) {
        // Library icons are PNG images - wrap in SVG
        setLoadingProgress(prev => prev ? { ...prev, progress: 50 } : null);

        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${icon.thumbnail}" width="512" height="512"/></svg>`;

        setLoadingProgress(prev => prev ? { ...prev, progress: 100 } : null);

        const event = new CustomEvent("addIconToCanvas", {
          detail: { svgData, iconId: icon.id },
        });
        window.dispatchEvent(event);

        setTimeout(() => setLoadingProgress(null), 500);
        return;
      }

      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (!prev) return null;
          const newProgress = Math.min(prev.progress + 10, 90);
          return { ...prev, progress: newProgress };
        });
      }, 200);

      // Check if aborted
      if (signal.aborted) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        return;
      }

      setLoadingProgress(prev => prev ? { ...prev, progress: 10 } : null);

      // Check cache first (with fallback if import fails)
      let cached = null;
      try {
        const { iconCache } = await import('@/lib/iconCache');
        cached = await iconCache.get(icon.id);
      } catch (cacheError) {
        console.warn('Icon cache unavailable:', cacheError);
        // Continue without cache
      }

      if (signal.aborted) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        return;
      }

      if (cached) {
        clearInterval(progressInterval);
        setLoadingProgress(prev => prev ? { ...prev, progress: 100 } : null);

        // Embed external images if needed
        const svgData = await embedExternalImage(cached.svgContent);

        const event = new CustomEvent("addIconToCanvas", {
          detail: { svgData, iconId: icon.id },
        });
        window.dispatchEvent(event);

        setTimeout(() => setLoadingProgress(null), 500);
        return;
      }

      setLoadingProgress(prev => prev ? { ...prev, progress: 30 } : null);

      // If we already have svg_content, use it
      if (icon.svg_content) {
        if (signal.aborted) {
          clearInterval(progressInterval);
          setLoadingProgress(null);
          return;
        }

        clearInterval(progressInterval);
        setLoadingProgress(prev => prev ? { ...prev, progress: 100 } : null);

        // Embed external images if needed
        const svgData = await embedExternalImage(icon.svg_content);

        const event = new CustomEvent("addIconToCanvas", {
          detail: { svgData, iconId: icon.id },
        });
        window.dispatchEvent(event);

        setTimeout(() => setLoadingProgress(null), 500);
        return;
      }

      setLoadingProgress(prev => prev ? { ...prev, progress: 50 } : null);

      // Otherwise, fetch full svg_content (and canvas_data for group icons) for high-quality canvas rendering
      const { data, error } = await supabase
        .from('icons')
        .select('svg_content, canvas_data')
        .eq('id', icon.id)
        .single();

      if (signal.aborted) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        return;
      }

      if (error) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        toast.error(`Failed to load icon: ${error.message}`);
        console.error('Error loading icon:', error);
        return;
      }
      
      if (!data?.svg_content && !data?.canvas_data) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        toast.error('No content found for this icon');
        return;
      }

      // Group icon — dispatch canvas_data directly, skip SVG processing
      if (data.canvas_data) {
        clearInterval(progressInterval);
        setLoadingProgress(prev => prev ? { ...prev, progress: 100 } : null);

        const event = new CustomEvent("addIconToCanvas", {
          detail: { canvasData: data.canvas_data, iconId: icon.id },
        });
        window.dispatchEvent(event);

        setTimeout(() => setLoadingProgress(null), 500);
        return;
      }

      // Check SVG size and show warnings (but don't block)
      const svgSizeKB = new Blob([data.svg_content]).size / 1024;
      // Warn for large icons but continue loading
      if (svgSizeKB > 1024) {
        toast.warning(`Very large icon (${svgSizeKB.toFixed(0)}KB)`, {
          description: 'This may take longer to load. Processing...'
        });
      } else if (svgSizeKB > 500) {
        toast.info(`Large icon (${svgSizeKB.toFixed(0)}KB)`, {
          description: 'Processing may take a moment...'
        });
      }

      setLoadingProgress(prev => prev ? { ...prev, progress: 80 } : null);

      if (signal.aborted) {
        clearInterval(progressInterval);
        setLoadingProgress(null);
        return;
      }

      clearInterval(progressInterval);
      setLoadingProgress(prev => prev ? { ...prev, progress: 100 } : null);

      // Embed external images if needed
      const svgData = await embedExternalImage(data.svg_content);

      const event = new CustomEvent("addIconToCanvas", {
        detail: { svgData, iconId: icon.id },
      });
      window.dispatchEvent(event);
      
      setTimeout(() => setLoadingProgress(null), 500);
    } catch (error) {
      if (signal.aborted) {
        setLoadingProgress(null);
        toast.info('Icon loading cancelled');
        return;
      }
      
      setLoadingProgress(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load icon: ${errorMessage}`);
      console.error('Error loading icon:', error);
    }
  };

  const handleCancelLoad = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoadingProgress(null);
    toast.info('Icon loading cancelled');
  };

  const onImgLoad = (id: string) => {
    setLoadedMap(prev => ({ ...prev, [id]: true }));
  };

  const onImgError = (id: string) => {
    setLoadedMap(prev => ({ ...prev, [id]: true }));
    setBrokenMap(prev => ({ ...prev, [id]: true }));
  };

  const getCurrentPage = (categoryId: string) => categoryPages[categoryId] || 0;

  const setCurrentPage = (categoryId: string, page: number) => {
    setCategoryPages(prev => ({ ...prev, [categoryId]: page }));
  };

  const getTotalPages = (categoryId: string) => {
    const totalCount = categoryTotalCounts[categoryId] || 0;
    return Math.ceil(totalCount / ICONS_PER_PAGE);
  };

  // Navigate to a specific page
  const goToPage = async (categoryId: string, categoryName: string, page: number) => {
    setCurrentPage(categoryId, page);
    await loadIconsForCategory(categoryId, categoryName, page);
  };

  // Navigate to next page
  const goToNextPage = async (categoryId: string, categoryName: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    if (currentPage < totalPages - 1) {
      await goToPage(categoryId, categoryName, currentPage + 1);
    }
  };

  // Navigate to previous page
  const goToPreviousPage = async (categoryId: string, categoryName: string) => {
    const currentPage = getCurrentPage(categoryId);
    if (currentPage > 0) {
      await goToPage(categoryId, categoryName, currentPage - 1);
    }
  };

  // Check if there is a next page
  const hasNextPage = (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    return currentPage < totalPages - 1;
  };

  // Check if there is a previous page
  const hasPreviousPage = (categoryId: string) => {
    const currentPage = getCurrentPage(categoryId);
    return currentPage > 0;
  };

  // Render pagination skeleton during loading
  const renderPaginationSkeleton = () => {
    return (
      <div className="flex items-center justify-center gap-2 px-2 pb-2 pt-1">
        <Skeleton className="h-7 w-7 rounded" />
        <Skeleton className="h-4 w-[65px] rounded" />
        <Skeleton className="h-7 w-7 rounded" />
      </div>
    );
  };

  // Render pagination controls for a category
  const renderPaginationControls = (categoryId: string, categoryName: string) => {
    const currentPage = getCurrentPage(categoryId);
    const totalPages = getTotalPages(categoryId);
    const totalCount = categoryTotalCounts[categoryId] || 0;

    // Don't show pagination if there's only one page or no icons
    if (totalPages <= 1 || totalCount === 0) {
      return null;
    }

    const isLoading = loadingCategories[categoryId];

    return (
      <div
        className="flex items-center justify-center gap-2 px-2 pb-2 pt-1"
        data-testid={IconLibraryTestIds.PAGINATION_CONTROLS}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPreviousPage(categoryId, categoryName)}
          disabled={!hasPreviousPage(categoryId) || isLoading}
          className="h-7 w-7 p-0"
          data-testid={IconLibraryTestIds.PAGINATION_PREVIOUS}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span
          className="text-xs text-foreground font-medium px-2 min-w-[65px] text-center"
          data-testid={IconLibraryTestIds.PAGINATION_INDICATOR}
        >
          {currentPage + 1} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToNextPage(categoryId, categoryName)}
          disabled={!hasNextPage(categoryId) || isLoading}
          className="h-7 w-7 p-0"
          data-testid={IconLibraryTestIds.PAGINATION_NEXT}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const isGroupIcon = (icon: Icon) => {
    if (!icon.tags) return false;
    const tags = Array.isArray(icon.tags) ? icon.tags : [];
    return tags.includes("group-icon");
  };

  const renderIconButton = (icon: Icon) => {
    const hasThumbnail = !!icon.thumbnail;
    const isBroken = !!brokenMap[icon.id];
    const isGroup = isGroupIcon(icon);

    // Progressive loading: Show thumbnail first (low-res), then full SVG (high-res)
    const thumbnailLoaded = !!thumbnailLoadedMap[icon.id];
    const fullSvgLoaded = !!fullSvgLoadedMap[icon.id];

    // Determine thumbnail source (for progressive loading)
    let thumbSrc = "";
    let fullSvgSrc = "";

    if (!isBroken) {
      if (hasThumbnail) {
        if (isUrl(icon.thumbnail!)) {
          thumbSrc = icon.thumbnail!;
        } else {
          const safeSvg = sanitizeSvg(icon.thumbnail!);
          thumbSrc = svgToDataUrl(safeSvg);
        }
      }

      // Full SVG for high-quality display (loaded after thumbnail)
      if (icon.svg_content) {
        const safeSvg = sanitizeSvg(icon.svg_content);
        fullSvgSrc = svgToDataUrl(safeSvg);
      }
    }

    const isLoaded = thumbnailLoaded || fullSvgLoaded;

    return (
      <HoverCard key={icon.id} openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            onClick={() => handleIconClick(icon)}
            className="w-full aspect-square border-2 border-border/40 rounded overflow-hidden p-2 bg-background
                       bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)]
                       bg-[length:10px_10px]
                       hover:bg-accent/40 hover:border-primary/60
                       hover:shadow-md
                       transition-all hover:scale-[1.08]
                       relative"
            title={icon.name}
            data-testid={IconLibraryTestIds.ICON_ITEM}
          >
          {!hasThumbnail || isBroken ? (
            <img
              src={noPreview}
              alt={`${icon.name} preview unavailable`}
              loading="lazy"
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              {!isLoaded && (
                <Skeleton className="absolute inset-2 rounded animate-pulse" />
              )}

              {/* Progressive Loading: Thumbnail (blurred) → Full SVG (sharp) */}
              {thumbSrc && (
                <img
                  src={thumbSrc}
                  alt={icon.name}
                  loading="lazy"
                  onLoad={() => setThumbnailLoadedMap(prev => ({ ...prev, [icon.id]: true }))}
                  onError={() => onImgError(icon.id)}
                  className={`w-full h-full object-contain absolute inset-0 transition-all duration-300
                             ${thumbnailLoaded ? "opacity-100" : "opacity-0"}
                             ${fullSvgLoaded ? "opacity-0 blur-sm scale-105" : "blur-[0.5px]"}`}
                  style={{ imageRendering: "auto" }}
                />
              )}

              {/* Full quality SVG - loads after thumbnail */}
              {fullSvgSrc && thumbnailLoaded && (
                <img
                  src={fullSvgSrc}
                  alt={icon.name}
                  loading="lazy"
                  onLoad={() => {
                    setFullSvgLoadedMap(prev => ({ ...prev, [icon.id]: true }));
                    setLoadedMap(prev => ({ ...prev, [icon.id]: true }));
                  }}
                  onError={() => onImgError(icon.id)}
                  className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-500
                             ${fullSvgLoaded ? "opacity-100" : "opacity-0"}`}
                  style={{ imageRendering: "pixelated" }}
                />
              )}

              {/* Fallback: If no full SVG, just use thumbnail */}
              {!fullSvgSrc && thumbSrc && (
                <img
                  src={thumbSrc}
                  alt={icon.name}
                  loading="lazy"
                  onLoad={() => {
                    setThumbnailLoadedMap(prev => ({ ...prev, [icon.id]: true }));
                    setLoadedMap(prev => ({ ...prev, [icon.id]: true }));
                  }}
                  onError={() => onImgError(icon.id)}
                  className={`w-full h-full object-contain transition-opacity duration-200
                             ${thumbnailLoaded ? "opacity-100" : "opacity-0"}`}
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </>
          )}
          {isGroup && (
            <div className="absolute bottom-1 left-1 bg-primary/90 text-primary-foreground rounded px-1 py-0.5 flex items-center gap-0.5 shadow-sm" title="Group Icon — ungroupable on canvas">
              <Layers className="h-2.5 w-2.5" />
              <span className="text-[8px] font-semibold leading-none">GROUP</span>
            </div>
          )}
        </button>
        </HoverCardTrigger>

        {/* Hover Preview Tooltip */}
        {hasThumbnail && !isBroken && (
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-36 p-3 bg-popover border-2 border-border rounded-lg shadow-lg z-[9999] bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)] bg-[length:10px_10px]"
          >
            <div className="w-full h-32 mb-2">
              <img
                src={fullSvgSrc || thumbSrc}
                alt={icon.name}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[10px] text-center text-foreground truncate font-medium">{icon.name}</p>
            {isGroup && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <Layers className="h-3 w-3 text-primary" />
                <span className="text-[9px] text-primary font-medium">Group — ungroupable</span>
              </div>
            )}
          </HoverCardContent>
        )}
      </HoverCard>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-t-0" data-onboarding="icon-library" data-testid={IconLibraryTestIds.LIBRARY_PANEL}>
      {/* Content - hidden when collapsed */}
      {!isCollapsed && (
        <>
          <div className="p-4 border-b border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Icons</h3>
              {onAIIconGenerate && (
                !canUseAIIcon ? (
                  <PremiumFeaturesPopover
                    open={aiIconHeaderPopoverOpen}
                    onOpenChange={setAiIconHeaderPopoverOpen}
                    onShareClick={handleShareFromHeaderPopover}
                    featureType="ai-icon"
                    side="right"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAIIconHeaderClick}
                      className="h-8 gap-1.5 opacity-50 cursor-pointer border-primary"
                      data-testid={IconLibraryTestIds.AI_GENERATE_BUTTON}
                    >
                      <Sparkles className="h-4 w-4 mr-1 text-primary" />
                      AI Icon
                    </Button>
                  </PremiumFeaturesPopover>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAIIconHeaderClick}
                    className="border-primary"
                    data-testid={IconLibraryTestIds.AI_GENERATE_BUTTON}
                  >
                    <Sparkles className="h-4 w-4 mr-1 text-primary" />
                    AI Icon
                  </Button>
                )
              )}
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                className={`flex-1 h-8 text-xs rounded-md transition-all flex items-center justify-center gap-1 font-medium ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('all')}
              >
                <FolderOpen className="h-3 w-3" />
                All
              </button>
              <button
                className={`flex-1 h-8 text-xs rounded-md transition-all flex items-center justify-center gap-1 font-medium ${
                  viewMode === 'community'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('community')}
              >
                <Users className="h-3 w-3" />
                Community
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search icons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
                data-testid={IconLibraryTestIds.SEARCH_INPUT}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-accent rounded-sm transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          
          {loading && (
            <div className="px-3 py-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 20 }).map((_, idx) => (
                      <Skeleton key={idx} className="aspect-square rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {error}
                <div className="mt-2 text-xs">Auth state: {authState}</div>
              </AlertDescription>
            </Alert>
          )}
          
          {!loading && searchQuery && (
            <ScrollArea type="always" className="flex-1 min-h-0 px-3 pr-1">
              <div className="py-3">
                <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
                  {isSearching ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                      <span>Searching <span className="font-medium text-foreground">"{searchQuery.trim()}"</span>…</span>
                    </>
                  ) : searchResults.length === 0 ? (
                    "No icons found"
                  ) : (
                    `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                  )}
                </div>

                {/* Skeleton placeholder grid while the search is in flight
                    so the user sees the area populate with shimmering tiles
                    instead of an empty panel. */}
                {isSearching && (
                  <div className="grid grid-cols-4 gap-1.5 mb-2 animate-in fade-in duration-200">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="aspect-square rounded-md bg-gradient-to-br from-violet-200/50 to-fuchsia-200/40"
                      />
                    ))}
                  </div>
                )}

                {/* AI generate CTA — pinned to the top of every search so the
                    user can choose to create a custom icon even when results
                    exist but don't match. The failed query becomes the AI
                    prompt. Hidden if AI credits are exhausted (still shown
                    with a muted "earn more" link). */}
                {!isSearching && onAIIconGenerate && (aiUsage || aiBalance) && (
                  <div
                    className="mb-3 rounded-2xl p-3 border border-violet-300/40 animate-in fade-in slide-in-from-top-1 duration-300"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(244,114,182,0.18) 50%, rgba(96,165,250,0.18) 100%)',
                      boxShadow:
                        '0 6px 22px -8px rgba(167,139,250,0.35), inset 0 1px 0 0 rgba(255,255,255,0.6)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30">
                        <Wand2 className="h-4 w-4 text-white" strokeWidth={2.25} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          Can't find what you need?
                        </h4>
                        <p className="text-[11px] text-slate-700 mt-0.5 leading-snug truncate">
                          AI can create{' '}
                          <span className="font-semibold text-violet-700">
                            "{searchQuery.trim()}"
                          </span>
                          .
                        </p>
                      </div>
                    </div>

                    {aiUsage?.isAdmin || !aiBalance || aiBalance.total_available > 0 ? (
                      <>
                        <Button
                          onClick={() => onAIIconGenerate?.(searchQuery.trim())}
                          className="w-full mt-2.5 h-8 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-semibold text-xs shadow-md shadow-violet-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          Generate with AI
                        </Button>
                        <p className="mt-1.5 text-[10px] text-slate-600 text-center font-medium">
                          {aiUsage?.isAdmin
                            ? 'Unlimited credits'
                            : aiBalance
                              ? `${aiBalance.total_available} AI credits available${aiBalance.purchased > 0 ? ` (${aiBalance.grant_remaining} free · ${aiBalance.purchased} purchased)` : ''}`
                              : 'AI credits available'}
                        </p>
                      </>
                    ) : (
                      <>
                        <Button
                          disabled
                          className="w-full mt-2.5 h-8 bg-slate-200 text-slate-500 font-semibold text-xs cursor-not-allowed"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                          No AI credits left
                        </Button>
                        <button
                          type="button"
                          onClick={onShareClick}
                          className="block w-full mt-1.5 text-[10px] text-violet-700 hover:text-violet-900 text-center font-semibold underline-offset-2 hover:underline"
                        >
                          Earn more by sharing your projects →
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                  {searchResults.map((icon) => renderIconButton(icon))}
                </div>
              </div>
            </ScrollArea>
          )}

          {!loading && !searchQuery && viewMode === 'community' && (
            <ScrollArea type="always" className="flex-1 min-h-0 px-3 pr-1">
              <div className="space-y-2 py-3">
                {/* My Shared Icons Category */}
                {currentUserId && myIcons.length > 0 && (
                  <Accordion
                    type="multiple"
                    className="w-full space-y-2"
                    value={openAccordions}
                    onValueChange={setOpenAccordions}
                  >
                    <AccordionItem
                      value="my-shared-icons"
                      className="border-2 border-blue-500/40 rounded-lg overflow-hidden bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-blue-500/10"
                    >
                      <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2">
                            <Pin className="h-4 w-4 fill-blue-500 text-blue-500" />
                            <span className="text-sm font-bold text-foreground">
                              My Shared Icons
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-normal">
                            {myIcons.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                        <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                          {myIcons.map((icon, index) => (
                            <div
                              key={icon.id}
                              className="animate-fade-in"
                              style={{ animationDelay: `${index * 20}ms` }}
                            >
                              {renderIconButton(icon)}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {/* Community Icons Category */}
                <Accordion
                  type="multiple"
                  className="w-full space-y-2"
                  value={openAccordions}
                  onValueChange={setOpenAccordions}
                >
                  <AccordionItem
                    value="community-icons"
                    className="border-2 border-purple-500/40 rounded-lg overflow-hidden bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-purple-500/10"
                  >
                    <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-bold text-foreground">
                            Community Icons
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-normal">
                          {communityAIIcons.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                      {loadingCommunityIcons ? (
                        <div className="grid grid-cols-4 gap-1.5">
                          {Array.from({ length: 20 }).map((_, idx) => (
                            <Skeleton key={idx} className="aspect-square rounded" />
                          ))}
                        </div>
                      ) : communityAIIcons.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">
                            No community icons yet
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Icons submitted for review will appear here once approved
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                          {communityAIIcons.map((icon, index) => (
                            <div
                              key={icon.id}
                              className="animate-fade-in"
                              style={{ animationDelay: `${index * 20}ms` }}
                            >
                              {renderIconButton(icon)}
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          )}

          {!loading && !searchQuery && viewMode === 'all' && (
            <ScrollArea type="always" className="flex-1 min-h-0 px-3 pr-1">
              <div className="space-y-2 py-3">
                {/* My Icons Category (from library) */}
                {currentUserId && myLibraryIcons.length > 0 && (
                  <Accordion
                    type="multiple"
                    className="w-full space-y-2"
                    value={openAccordions}
                    onValueChange={setOpenAccordions}
                  >
                    <AccordionItem
                      value="my-library-icons"
                      className="border-2 border-blue-500/40 rounded-lg overflow-hidden bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-blue-500/10"
                    >
                      <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2">
                            <Pin className="h-4 w-4 fill-blue-500 text-blue-500" />
                            <span className="text-sm font-bold text-foreground">
                              My Icons
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-normal">
                            {myLibraryIcons.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                        {loadingMyLibraryIcons ? (
                          <div className="grid grid-cols-4 gap-1.5">
                            {Array.from({ length: 20 }).map((_, idx) => (
                              <Skeleton key={idx} className="aspect-square rounded" />
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                            {myLibraryIcons.map((icon, index) => (
                              <div
                                key={icon.id}
                                className="animate-fade-in"
                                style={{ animationDelay: `${index * 20}ms` }}
                              >
                                {renderIconButton(icon)}
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {/* BioSketch Category */}
                {biosketchCategory && (
                  <Accordion
                    type="multiple"
                    className="w-full space-y-2"
                    value={openAccordions}
                    onValueChange={(values) => {
                      setOpenAccordions(values);
                      // Load icons for biosketch if opened
                      if (values.includes(biosketchCategory.id) && !iconsByCategory[biosketchCategory.id]) {
                        categoryAnalytics.recordAccess(biosketchCategory.id);
                        loadIconsForCategory(biosketchCategory.id, biosketchCategory.name);
                      }
                    }}
                  >
                    <AccordionItem
                      value={biosketchCategory.id}
                      className="border-2 border-purple-500/40 rounded-lg overflow-hidden bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-purple-500/10"
                    >
                      <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(biosketchCategory.id);
                              }}
                              className="hover:text-purple-600 transition-colors cursor-pointer"
                              title={isPinned(biosketchCategory.id) ? "Unpin category" : "Pin category"}
                            >
                              <Pin className={cn(
                                "h-4 w-4",
                                isPinned(biosketchCategory.id)
                                  ? "fill-purple-500 text-purple-500"
                                  : "text-purple-500"
                              )} />
                            </div>
                            <span className="text-sm font-bold text-foreground">
                              {biosketchCategory.name}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-normal">
                            {iconsByCategory[biosketchCategory.id] && openAccordions.includes(biosketchCategory.id)
                              ? iconsByCategory[biosketchCategory.id].length
                              : ''}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                        {loadingCategories[biosketchCategory.id] ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-1.5">
                              {Array.from({ length: 20 }).map((_, idx) => (
                                <Skeleton key={idx} className="aspect-square rounded" />
                              ))}
                            </div>
                            {renderPaginationSkeleton()}
                          </div>
                        ) : (iconsByCategory[biosketchCategory.id] || []).length === 0 ? (
                          <div className="text-center py-4 text-xs text-muted-foreground">
                            No icons in this category
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                              {(iconsByCategory[biosketchCategory.id] || []).map((icon, index) => (
                                <div
                                  key={icon.id}
                                  className="animate-fade-in"
                                  style={{ animationDelay: `${index * 20}ms` }}
                                >
                                  {renderIconButton(icon)}
                                </div>
                              ))}
                            </div>

                            {renderPaginationControls(biosketchCategory.id, biosketchCategory.name)}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {/* Pinned Categories Section */}
                {pinnedCategories.length > 0 && (
                  <>
                    <div className="px-2 mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      📌 Pinned
                    </div>
                    <Accordion
                      type="multiple"
                      className="w-full space-y-2"
                      value={openAccordions}
                      onValueChange={(values) => {
                        setOpenAccordions(values);
                        // Load icons for newly opened categories
                        values.forEach(categoryId => {
                          const category = categories.find(c => c.id === categoryId);
                          if (category && !iconsByCategory[categoryId]) {
                            // Track category access for analytics
                            categoryAnalytics.recordAccess(categoryId);
                            loadIconsForCategory(categoryId, category.name);
                          }
                        });
                      }}
                    >
                      {pinnedCategories.map((category) => {
                        const categoryIcons = iconsByCategory[category.id] || [];

                        return (
                          <AccordionItem
                            key={category.id}
                            value={category.id}
                            className="border border-yellow-500/20 rounded-lg overflow-hidden bg-yellow-500/5 backdrop-blur-sm"
                          >
                            <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(category.id);
                                    }}
                                    className="hover:text-yellow-600 transition-colors cursor-pointer"
                                    title="Unpin category"
                                  >
                                    <Pin className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                  </div>
                                  <span className="text-sm font-medium text-foreground">
                                    {category.name}
                                  </span>
                                </div>
                  <span className="text-xs text-muted-foreground font-normal">
                    {iconsByCategory[category.id] && openAccordions.includes(category.id)
                      ? categoryIcons.length
                      : ''
                    }
                  </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                              {loadingCategories[category.id] ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {Array.from({ length: 20 }).map((_, idx) => (
                                      <Skeleton key={idx} className="aspect-square rounded" />
                                    ))}
                                  </div>
                                  {renderPaginationSkeleton()}
                                </div>
                              ) : categoryIcons.length === 0 ? (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                  No icons in this category
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                                    {categoryIcons.map((icon, index) => (
                                      <div
                                        key={icon.id}
                                        className="animate-fade-in"
                                        style={{ animationDelay: `${index * 20}ms` }}
                                      >
                                        {renderIconButton(icon)}
                                      </div>
                                    ))}
                                  </div>

                                  {renderPaginationControls(category.id, category.name)}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </>
                )}

                {/* Unpinned Categories Section */}
                <Accordion 
                  type="multiple" 
                  className="w-full space-y-2"
                  value={openAccordions}
                  onValueChange={(values) => {
                    setOpenAccordions(values);
                    // Load icons for newly opened categories
                    values.forEach(categoryId => {
                      const category = categories.find(c => c.id === categoryId);
                      if (category && !iconsByCategory[categoryId]) {
                        // Track category access for analytics
                        categoryAnalytics.recordAccess(categoryId);
                        loadIconsForCategory(categoryId, category.name);
                      }
                    });
                  }}
                >
                  {unpinnedCategories.map((category) => {
                    const categoryIcons = iconsByCategory[category.id] || [];

                    // Special styling for AI Icons category
                    const isAIIconsCategory = category.id === 'ai-icons';

                    return (
                      <AccordionItem
                        key={category.id}
                        value={category.id}
                        className={cn(
                          "rounded-lg overflow-hidden animate-fade-in",
                          isAIIconsCategory
                            ? "border-2 border-purple-500/40 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-purple-500/10"
                            : "border border-border/40 bg-card/50 backdrop-blur-sm"
                        )}
                      >
                        <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-2">
                            <div className="flex items-center gap-2">
                              {isAIIconsCategory ? (
                                <Sparkles className="h-4 w-4 text-purple-500" />
                              ) : (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(category.id);
                                  }}
                                  className="hover:text-yellow-500 transition-colors cursor-pointer"
                                  title="Pin category"
                                >
                                  <Pin className="h-4 w-4" />
                                </div>
                              )}
                              <span className={cn("text-sm font-medium text-foreground/80", isAIIconsCategory && "font-bold")}>
                                {category.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-normal">
                                {iconsByCategory[category.id] && openAccordions.includes(category.id)
                                  ? `${categoryIcons.length} icon${categoryIcons.length !== 1 ? 's' : ''}`
                                  : ''
                                }
                              </span>
                              {isAIIconsCategory && onAIIconGenerate && (
                                !canUseAIIcon ? (
                                  <PremiumFeaturesPopover
                                    open={aiIconCategoryPopoverOpen}
                                    onOpenChange={setAiIconCategoryPopoverOpen}
                                    onShareClick={handleShareFromCategoryPopover}
                                    featureType="ai-icon"
                                    side="right"
                                  >
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs opacity-50 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAIIconCategoryClick();
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Generate
                                    </Button>
                                  </PremiumFeaturesPopover>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAIIconGenerate();
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Generate
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 pt-1 overflow-visible">
                          {loadingCategories[category.id] ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-4 gap-1.5">
                                {Array.from({ length: 20 }).map((_, idx) => (
                                  <Skeleton key={idx} className="aspect-square rounded" />
                                ))}
                              </div>
                              {renderPaginationSkeleton()}
                            </div>
                          ) : categoryIcons.length === 0 ? (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                              {isAIIconsCategory ? (
                                <div className="space-y-2">
                                  <p>No AI-generated icons yet</p>
                                  {onAIIconGenerate && (
                                    !canUseAIIcon ? (
                                      <PremiumFeaturesPopover
                                        open={aiIconEmptyPopoverOpen}
                                        onOpenChange={setAiIconEmptyPopoverOpen}
                                        onShareClick={handleShareFromEmptyPopover}
                                        featureType="ai-icon"
                                        side="right"
                                      >
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={handleAIIconEmptyClick}
                                          className="mt-2 opacity-50 cursor-pointer"
                                        >
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          Generate your first AI icon
                                        </Button>
                                      </PremiumFeaturesPopover>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={onAIIconGenerate}
                                        className="mt-2"
                                      >
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        Generate your first AI icon
                                      </Button>
                                    )
                                  )}
                                </div>
                              ) : (
                                'No icons in this category'
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-4 gap-1.5 overflow-visible">
                                {categoryIcons.map((icon, index) => (
                                  <div
                                    key={icon.id}
                                    className="animate-fade-in"
                                    style={{ animationDelay: `${index * 20}ms` }}
                                  >
                                    {renderIconButton(icon)}
                                  </div>
                                ))}
                              </div>

                              {renderPaginationControls(category.id, category.name)}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
                
                {categories.length === 0 && (
                  <div className="text-center py-8 px-4">
                    <p className="text-muted-foreground text-sm">
                      No categories yet. Add categories from the admin panel.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </>
      )}
      
      {/* Loading progress indicator */}
      {loadingProgress && (
        <LoadingProgress
          iconName={loadingProgress.iconName}
          progress={loadingProgress.progress}
          onCancel={handleCancelLoad}
        />
      )}
    </div>
  );
};
