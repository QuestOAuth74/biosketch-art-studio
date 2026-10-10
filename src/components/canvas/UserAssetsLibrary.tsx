import { useState, useEffect } from 'react';
import { Search, Trash2, MoreVertical, FolderOpen, Share2, Users, Upload } from 'lucide-react';
import { useUserAssets, UserAsset } from '@/hooks/useUserAssets';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AssetUploadDialog } from './AssetUploadDialog';

interface UserAssetsLibraryProps {
  onAssetSelect: (assetId: string, svgContent: string) => void;
}

export function UserAssetsLibrary({ onAssetSelect }: UserAssetsLibraryProps) {
  const {
    assets,
    sharedAssets,
    loading,
    storageUsage,
    storageLimit,
    deleteAsset,
    updateAsset,
    fetchAssets,
    fetchSharedAssets,
    shareAsset,
    unshareAsset,
    downloadAssetContent,
    getAssetUrl
  } = useUserAssets();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [fileType, setFileType] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'my-assets' | 'community'>('my-assets');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<{ id: string; name: string } | null>(null);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadCurrentUser();
  }, []);

  // Get the current asset list based on view mode
  const currentAssets = viewMode === 'my-assets' ? assets : sharedAssets;

  // Filter assets
  const filteredAssets = currentAssets.filter(asset => {
    const matchesSearch = search === '' || 
      asset.original_name.toLowerCase().includes(search.toLowerCase()) ||
      asset.file_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = category === 'all' || asset.category === category;
    const matchesType = fileType === 'all' || asset.file_type === fileType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  // Only show categories and file types that exist in the current view
  const categories = ['all', ...Array.from(new Set(currentAssets.map(a => a.category)))];
  const fileTypes = ['all', ...Array.from(new Set(currentAssets.map(a => a.file_type)))];

  // Pagination calculations
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  const handleAssetClick = async (asset: any) => {
    const content = await downloadAssetContent(asset);
    if (content) {
      onAssetSelect(asset.id, content);
    }
  };

  const handleDelete = (asset: UserAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssetToDelete({ id: asset.id, name: asset.original_name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (assetToDelete) {
      await deleteAsset(assetToDelete.id);
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  const handleShare = async (assetId: string, isShared: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isShared) {
      await unshareAsset(assetId);
    } else {
      await shareAsset(assetId);
    }
  };

  useEffect(() => {
    if (viewMode === 'community') {
      fetchSharedAssets();
    }
    // Reset filters when switching views to avoid showing "no results" for categories that don't exist in that view
    setCategory('all');
    setFileType('all');
    setSearch('');
    setCurrentPage(1);
  }, [viewMode]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, fileType]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageType = (fileType: string) => {
    return ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType.toLowerCase());
  };

  // Synchronous URL getter for thumbnails
  const getAssetThumbnailUrl = (asset: UserAsset): string => {
    const { data } = supabase.storage
      .from('user-assets')
      .getPublicUrl(asset.storage_path);
    return data.publicUrl;
  };

  return (
    <div className="flex flex-col h-full bg-white border-t-0">
      <div className="p-4 border-b border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">My Assets</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUploadDialogOpen(true)}
            data-testid="user-assets-upload-button"
            className="border-primary"
          >
            <Upload className="h-4 w-4 mr-1 text-primary" />
            Upload
          </Button>
        </div>

        {/* Storage usage indicator */}
        <div className="space-y-1" data-testid="storage-usage-indicator">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Storage</span>
            <span>{formatFileSize(storageUsage)} / {formatFileSize(storageLimit)}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                storageUsage / storageLimit > 0.95
                  ? 'bg-red-500'
                  : storageUsage / storageLimit > 0.8
                  ? 'bg-yellow-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((storageUsage / storageLimit) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            className={`flex-1 h-8 text-xs rounded-md transition-all flex items-center justify-center gap-1 font-medium ${
              viewMode === 'my-assets'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setViewMode('my-assets')}
          >
            <FolderOpen className="h-3 w-3" />
            My Files
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
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {fileTypes.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {type.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search || category !== 'all' || fileType !== 'all'
                  ? 'No assets found'
                  : 'No assets yet'}
              </p>
              {!search && category === 'all' && fileType === 'all' && viewMode === 'my-assets' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload your first asset
                </Button>
              )}
              {viewMode === 'community' && currentAssets.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No assets have been shared by the community yet
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {paginatedAssets.map((asset) => (
                <HoverCard key={asset.id} openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div
                      className="group relative aspect-square rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
                      onClick={() => handleAssetClick(asset)}
                      data-testid="user-asset-item"
                    >
                      {/* Thumbnail preview */}
                      <div className="absolute inset-0 flex items-center justify-center p-1">
                        {isImageType(asset.file_type) ? (
                          <img
                            src={getAssetThumbnailUrl(asset)}
                            alt={asset.original_name}
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-xs font-mono text-muted-foreground uppercase">
                            {asset.file_type}
                          </div>
                        )}
                      </div>

                      {/* Shared badge */}
                      {viewMode === 'my-assets' && asset.is_shared && (
                        <div className="absolute top-0.5 right-0.5 bg-primary/10 rounded-full p-0.5">
                          <Share2 className="h-2.5 w-2.5 text-primary" />
                        </div>
                      )}

                      {/* Action menu overlay on hover */}
                      {/* Only show menu if in my-assets view OR if asset belongs to current user */}
                      {(viewMode === 'my-assets' || asset.user_id === currentUserId) && (
                        <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0 bg-white/90 hover:bg-white shadow-sm" data-testid="user-asset-menu-trigger">
                                <MoreVertical className="h-2.5 w-2.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={(e) => handleShare(asset.id, asset.is_shared, e)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                {asset.is_shared ? 'Unshare' : 'Share'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={(e) => handleDelete(asset, e)} data-testid="user-asset-delete-menuitem">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </HoverCardTrigger>

                  {/* Hover Preview */}
                  {isImageType(asset.file_type) && (
                    <HoverCardContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="w-36 p-3 bg-popover border-2 border-border rounded-lg shadow-lg z-[9999] bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)] bg-[length:10px_10px]"
                    >
                      <div className="w-full h-32 mb-2">
                        <img
                          src={getAssetThumbnailUrl(asset)}
                          alt={asset.original_name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-[10px] text-center text-foreground truncate font-medium">
                        {asset.original_name}
                      </p>
                      <p className="text-[9px] text-center text-muted-foreground mt-1">
                        {formatFileSize(asset.file_size)}
                      </p>
                    </HoverCardContent>
                  )}
                </HoverCard>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {filteredAssets.length > ITEMS_PER_PAGE && (
        <div className="p-3 border-t border-slate-200/80 space-y-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1;
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <PaginationEllipsis key={pageNum} />;
                }
                return null;
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          
          <p className="text-xs text-center text-muted-foreground">
            {startIndex + 1}-{Math.min(endIndex, filteredAssets.length)} of {filteredAssets.length}
          </p>
        </div>
      )}

      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={() => fetchAssets()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="user-asset-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.name}"? This will remove the image from all projects using it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="user-asset-delete-confirm">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
