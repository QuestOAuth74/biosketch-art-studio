import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Trash2, RefreshCw, Eye, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeSVG } from "@/lib/utils";

interface IconIssue {
  id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
  issues: string[];
  duplicate_of?: string;
  thumbnail_size?: number;
}

interface ScanMetadata {
  total_issues: number;
  current_page: number;
  total_pages: number;
  batch_size: number;
  category: string;
  scan_type: string;
}

export const IconSanitizer = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [scanType, setScanType] = useState<"defective" | "duplicates" | "all">("all");
  const [icons, setIcons] = useState<IconIssue[]>([]);
  const [metadata, setMetadata] = useState<ScanMetadata | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [iconToDelete, setIconToDelete] = useState<string | null>(null);
  const [viewSvgDialog, setViewSvgDialog] = useState<{ open: boolean; svg: string; name: string }>({ open: false, svg: "", name: "" });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("icon_categories")
      .select("name")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    setCategories(data?.map(c => c.name) || []);
  };

  const scanIcons = async (page: number = 1) => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-icons", {
        body: {
          category: selectedCategory,
          page,
          batch_size: 20,
          scan_type: scanType,
        },
      });

      if (error) throw error;

      setIcons(data.icons);
      setMetadata(data.metadata);

      toast({
        title: "Scan Complete",
        description: `Found ${data.metadata.total_issues} issue(s)`,
      });
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan icons",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const deleteIcon = async (iconId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("icons")
        .delete()
        .eq("id", iconId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Icon deleted successfully",
      });

      // Refresh current page
      if (metadata) {
        await scanIcons(metadata.current_page);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete icon",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setDeleteDialogOpen(false);
      setIconToDelete(null);
    }
  };

  const regenerateThumbnail = async (iconId: string, svgContent: string) => {
    setIsProcessing(true);
    try {
      // Simple thumbnail generation - create optimized SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const svgElement = doc.querySelector("svg");

      if (!svgElement) {
        throw new Error("Invalid SVG content");
      }

      // Ensure viewBox
      if (!svgElement.hasAttribute("viewBox")) {
        const width = svgElement.getAttribute("width") || "100";
        const height = svgElement.getAttribute("height") || "100";
        svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }

      // Remove unnecessary attributes
      svgElement.removeAttribute("width");
      svgElement.removeAttribute("height");

      const optimizedSvg = new XMLSerializer().serializeToString(svgElement);

      const { error } = await supabase
        .from("icons")
        .update({ thumbnail: optimizedSvg })
        .eq("id", iconId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Thumbnail regenerated successfully",
      });

      // Refresh current page
      if (metadata) {
        await scanIcons(metadata.current_page);
      }
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate thumbnail",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const markAsReviewed = async (iconId: string) => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("icon_review_status")
        .insert({
          icon_id: iconId,
          reviewed_by: user.id,
          ignore_reason: "Reviewed by admin - acceptable",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Icon marked as reviewed",
      });

      // Refresh current page
      if (metadata) {
        await scanIcons(metadata.current_page);
      }
    } catch (error: any) {
      console.error("Mark reviewed error:", error);
      toast({
        title: "Failed to Mark as Reviewed",
        description: error.message || "Failed to mark icon as reviewed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const batchDelete = async () => {
    if (!icons.length) return;

    setIsProcessing(true);
    try {
      const iconIds = icons.map(i => i.id);
      const { error } = await supabase
        .from("icons")
        .delete()
        .in("id", iconIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${iconIds.length} icons`,
      });

      // Refresh
      await scanIcons(1);
    } catch (error: any) {
      console.error("Batch delete error:", error);
      toast({
        title: "Batch Delete Failed",
        description: error.message || "Failed to delete icons",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviousPage = () => {
    if (metadata && metadata.current_page > 1) {
      scanIcons(metadata.current_page - 1);
    }
  };

  const handleNextPage = () => {
    if (metadata && metadata.current_page < metadata.total_pages) {
      scanIcons(metadata.current_page + 1);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Icon Sanitizer</CardTitle>
          <CardDescription>
            Scan for defective and duplicate icons in batches of 20
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Scan Type</label>
              <Select value={scanType} onValueChange={(value: any) => setScanType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Issues</SelectItem>
                  <SelectItem value="defective">Defective Only</SelectItem>
                  <SelectItem value="duplicates">Duplicates Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={() => scanIcons(1)} disabled={isScanning}>
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  "Start Scan"
                )}
              </Button>
            </div>
          </div>

          {metadata && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {metadata.total_issues} issue(s) found
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Page {metadata.current_page} of {metadata.total_pages}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={metadata.current_page === 1 || isScanning}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={metadata.current_page === metadata.total_pages || isScanning}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {icons.length > 0 && (
            <>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={batchDelete}
                  disabled={isProcessing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All in Batch
                </Button>
              </div>

              <Separator />

              <ScrollArea className="h-[600px] w-full">
                <div className="space-y-4">
                  {icons.map((icon) => (
                    <Card key={icon.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-24 h-24 bg-muted rounded flex items-center justify-center">
                            {icon.thumbnail ? (
                              // Check if thumbnail is PNG data URL or SVG
                              icon.thumbnail.startsWith('data:image/png') ? (
                                <img
                                  src={icon.thumbnail}
                                  alt={icon.name}
                                  className="w-20 h-20 object-contain"
                                />
                              ) : (
                                <div
                                  dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.thumbnail) }}
                                  className="w-20 h-20"
                                />
                              )
                            ) : (
                              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1">
                            <h4 className="font-semibold">{icon.name}</h4>
                            <p className="text-sm text-muted-foreground">{icon.category}</p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              {icon.issues.map((issue, idx) => (
                                <Badge key={idx} variant="destructive">
                                  {issue}
                                </Badge>
                              ))}
                            </div>

                            {icon.duplicate_of && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Duplicate of: {icon.duplicate_of.substring(0, 8)}...
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewSvgDialog({ open: true, svg: icon.svg_content, name: icon.name })}
                              disabled={isProcessing}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => regenerateThumbnail(icon.id, icon.svg_content)}
                              disabled={isProcessing}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsReviewed(icon.id)}
                              disabled={isProcessing}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIconToDelete(icon.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={isProcessing}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {!isScanning && icons.length === 0 && metadata && (
            <div className="text-center py-8 text-muted-foreground">
              No issues found. Your icons are clean! ✨
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Icon?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the icon from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => iconToDelete && deleteIcon(iconToDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={viewSvgDialog.open} onOpenChange={(open) => setViewSvgDialog({ ...viewSvgDialog, open })}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{viewSvgDialog.name}</AlertDialogTitle>
          </AlertDialogHeader>
          <ScrollArea className="h-[400px] w-full">
            <pre className="text-xs bg-muted p-4 rounded">
              {viewSvgDialog.svg}
            </pre>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};