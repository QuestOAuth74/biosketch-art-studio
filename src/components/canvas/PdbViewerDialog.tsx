import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { loadImageWithCORS } from "@/lib/utils";

const MOLSTAR_VERSION = "4.5.0";
const MOLSTAR_JS_URL = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS_URL = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;
const VIEWER_CONTAINER_ID = "pdb-molstar-viewer";

interface PdbViewerDialogProps {
  canvas: FabricCanvas | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  identifier: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MolstarViewer = any;

// Load molstar JS and CSS from CDN
let molstarLoaded = false;
let molstarLoadPromise: Promise<void> | null = null;

function loadMolstarCDN(): Promise<void> {
  if (molstarLoaded && (window as any).molstar) return Promise.resolve();
  if (molstarLoadPromise) return molstarLoadPromise;

  molstarLoadPromise = new Promise<void>((resolve, reject) => {
    // Load CSS
    if (!document.querySelector(`link[href*="molstar"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MOLSTAR_CSS_URL;
      document.head.appendChild(link);
    }

    // Load JS
    if ((window as any).molstar) {
      molstarLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = MOLSTAR_JS_URL;
    script.onload = () => {
      molstarLoaded = true;
      resolve();
    };
    script.onerror = () => {
      molstarLoadPromise = null;
      reject(new Error("Failed to load Mol* from CDN"));
    };
    document.head.appendChild(script);
  });

  return molstarLoadPromise;
}

function isPdbId(input: string): boolean {
  const trimmed = input.trim();
  return /^[0-9][a-zA-Z0-9]{3}$/.test(trimmed);
}

export const PdbViewerDialog = ({ canvas, open, onOpenChange }: PdbViewerDialogProps) => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [structureTitle, setStructureTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [loadedPdbId, setLoadedPdbId] = useState("");
  const [transparentBg, setTransparentBg] = useState(true);
  const viewerRef = useRef<MolstarViewer>(null);
  const mountedRef = useRef(true);

  // Initialize Mol* viewer when dialog opens
  useEffect(() => {
    if (!open) return;

    mountedRef.current = true;
    let viewer: MolstarViewer = null;

    const init = async () => {
      // Wait for container to be in DOM
      await new Promise(r => setTimeout(r, 100));
      const container = document.getElementById(VIEWER_CONTAINER_ID);
      if (!container || !mountedRef.current) return;

      try {
        await loadMolstarCDN();
        if (!mountedRef.current) return;

        const molstar = (window as any).molstar;
        if (!molstar?.Viewer) {
          throw new Error("Mol* Viewer class not found");
        }

        viewer = await molstar.Viewer.create(VIEWER_CONTAINER_ID, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          collapseLeftPanel: true,
          collapseRightPanel: true,
          viewportShowControls: false,
          viewportShowSettings: false,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          viewportShowTrajectoryControls: false,
          viewportShowExpand: false,
          viewportShowReset: false,
          pdbProvider: "rcsb",
          canvas3d: { preserveDrawingBuffer: true },
          renderer: { backgroundColor: 0x000000, transparentBackground: true },
        });

        if (!mountedRef.current) {
          try { viewer.plugin.dispose(); } catch {}
          return;
        }

        viewerRef.current = viewer;
        setViewerReady(true);
      } catch (err) {
        console.error("Mol* init failed:", err);
        toast.error("Failed to load 3D viewer");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (viewerRef.current) {
        try { viewerRef.current.plugin.dispose(); } catch {}
        viewerRef.current = null;
      }
      setViewerReady(false);
      setLoadedPdbId("");
      setStructureTitle("");
      setSearchResults([]);
      setQuery("");
    };
  }, [open]);

  // Update transparent background when toggle changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    try {
      const plugin = viewer.plugin;
      const renderer = plugin.canvas3d?.props?.renderer;
      if (renderer !== undefined) {
        plugin.canvas3d.setProps({
          renderer: { ...renderer, transparentBackground: transparentBg },
        });
      }
    } catch (err) {
      console.warn("Could not update transparency:", err);
    }
  }, [transparentBg, viewerReady]);

  // Fetch metadata from RCSB GraphQL
  const fetchTitle = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await fetch("https://data.rcsb.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{ entry(entry_id: "${id}") { struct { title } } }`,
        }),
      });
      const json = await res.json();
      return json?.data?.entry?.struct?.title || null;
    } catch {
      return null;
    }
  }, []);

  // Load structure by PDB ID
  const loadStructure = useCallback(async (id: string) => {
    const viewer = viewerRef.current;
    if (!viewer || !id.trim()) return;

    const cleanId = id.trim().toUpperCase();
    setIsLoading(true);
    setStructureTitle("");
    setSearchResults([]);

    try {
      // Fetch title
      const title = await fetchTitle(cleanId);
      if (!title) {
        toast.error(`PDB entry "${cleanId}" not found`);
        setIsLoading(false);
        return;
      }
      setStructureTitle(title);

      // Clear previous structure and load new one
      await viewer.loadPdb(cleanId);
      setLoadedPdbId(cleanId);
    } catch (err) {
      console.error("Failed to load structure:", err);
      toast.error(`Failed to load structure ${cleanId}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTitle]);

  // Search proteins via RCSB Search API
  const searchProteins = useCallback(async (text: string) => {
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(
          JSON.stringify({
            query: {
              type: "terminal",
              service: "full_text",
              parameters: { value: text.trim() },
            },
            return_type: "entry",
            request_options: {
              paginate: { start: 0, rows: 10 },
            },
          })
        )}`,
      );

      if (!res.ok) {
        throw new Error(`Search returned ${res.status}`);
      }

      const data = await res.json();
      const results: SearchResult[] = (data.result_set || []).map((r: any) => ({
        identifier: r.identifier,
      }));
      setSearchResults(results);

      if (results.length === 0) {
        toast.info("No results found");
      }
    } catch (err) {
      console.error("Search failed:", err);
      toast.error("Search failed. Try a PDB ID instead.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Unified submit: if it looks like a PDB ID, load directly; otherwise search
  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isPdbId(trimmed)) {
      loadStructure(trimmed);
    } else {
      searchProteins(trimmed);
    }
  }, [query, loadStructure, searchProteins]);

  // Screenshot and add to canvas
  const addToCanvas = useCallback(async () => {
    if (!canvas || !viewerRef.current) return;

    const plugin = viewerRef.current.plugin;

    setIsCapturing(true);
    try {
      let dataUri: string | null = null;

      // Ensure renderer transparency is applied
      if (plugin.canvas3d) {
        const renderer = plugin.canvas3d.props?.renderer;
        if (renderer !== undefined) {
          plugin.canvas3d.setProps({
            renderer: { ...renderer, transparentBackground: transparentBg },
          });
        }
      }

      // Method 1: Molstar viewport screenshot helper
      // Must set transparent on the helper's behaviors BEFORE calling getImageDataUri()
      // (getImageDataUri takes no parameters — it reads from behaviors.values)
      const screenshotHelper = plugin.helpers?.viewportScreenshot;
      if (screenshotHelper) {
        try {
          if (screenshotHelper.behaviors?.values) {
            const currentValues = screenshotHelper.behaviors.values.value ?? {};
            screenshotHelper.behaviors.values.next({
              ...currentValues,
              transparent: transparentBg,
            });
          }
          dataUri = await screenshotHelper.getImageDataUri();
        } catch (err) {
          console.warn("viewportScreenshot.getImageDataUri failed:", err);
        }
      }

      // Method 2: Direct WebGL canvas capture
      if (!dataUri) {
        const glCanvas = document.querySelector(`#${VIEWER_CONTAINER_ID} canvas`) as HTMLCanvasElement | null;
        if (glCanvas) {
          plugin.canvas3d?.commit(true);
          dataUri = glCanvas.toDataURL("image/png");
        }
      }

      if (!dataUri) {
        toast.error("Could not capture the 3D view");
        return;
      }

      const img = await loadImageWithCORS(dataUri);
      const fabricImage = new FabricImage(img, {
        left: (canvas.width || 0) / 2,
        top: (canvas.height || 0) / 2,
        originX: "center",
        originY: "center",
      });

      const maxW = (canvas.width || 0) * 0.6;
      const maxH = (canvas.height || 0) * 0.6;
      const scale = Math.min(maxW / fabricImage.width!, maxH / fabricImage.height!, 1);
      fabricImage.scale(scale);

      (fabricImage as any).customType = "pdb-structure";
      (fabricImage as any).pdbId = loadedPdbId;
      (fabricImage as any).pdbTitle = structureTitle;

      canvas.add(fabricImage);
      canvas.setActiveObject(fabricImage);
      canvas.requestRenderAll();

      onOpenChange(false);
      toast.success("Protein structure added to canvas");
    } catch (err) {
      console.error("Capture failed:", err);
      toast.error("Failed to add structure to canvas");
    } finally {
      setIsCapturing(false);
    }
  }, [canvas, loadedPdbId, structureTitle, transparentBg, onOpenChange]);

  const busy = isLoading || isSearching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDB Structure Viewer</DialogTitle>
          <DialogDescription>
            Enter a PDB ID (e.g. 7BV2) or search by name (e.g. hemoglobin) to load a 3D structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Unified search / ID input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="PDB ID or protein name (e.g., 7BV2, hemoglobin, insulin)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                className="pl-9"
                autoFocus
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!query.trim() || busy || !viewerReady}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isPdbId(query.trim()) ? "Load" : "Search"}
            </Button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
              {searchResults.map((result) => (
                <button
                  key={result.identifier}
                  onClick={() => {
                    setQuery(result.identifier);
                    loadStructure(result.identifier);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-mono"
                >
                  {result.identifier}
                </button>
              ))}
            </div>
          )}

          {/* Structure title */}
          {structureTitle && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              <span className="font-semibold text-foreground">{loadedPdbId}</span>
              {" — "}
              {structureTitle}
            </p>
          )}

          {/* Mol* viewer container */}
          <div
            className="relative w-full border rounded-md overflow-hidden"
            style={{
              height: 450,
              background: transparentBg
                ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%) 0 0 / 20px 20px'
                : '#000000',
            }}
          >
            <div
              id={VIEWER_CONTAINER_ID}
              style={{ width: "100%", height: "100%", position: "relative" }}
            />
            {!viewerReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-10">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading 3D viewer...
              </div>
            )}
            {isLoading && viewerReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white z-10">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading structure...
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="pdb-transparent-bg"
                checked={transparentBg}
                onCheckedChange={setTransparentBg}
              />
              <Label htmlFor="pdb-transparent-bg" className="text-sm cursor-pointer">
                Transparent background
              </Label>
            </div>
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={addToCanvas}
              disabled={!loadedPdbId || isCapturing}
            >
              {isCapturing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add to Canvas
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
