import { UserMenu } from "@/components/auth/UserMenu";
import { PresenceAvatars } from "@/components/canvas/PresenceAvatars";
import { RemoteCursors } from "@/components/canvas/RemoteCursors";
import { LockBanner } from "@/components/canvas/LockBanner";
import { CommentPin } from "@/components/canvas/CommentPin";
import { CommentThread } from "@/components/canvas/CommentThread";
import { usePresence } from "@/hooks/usePresence";
import { useProjectLock } from "@/hooks/useProjectLock";
import { useCanvasSync } from "@/hooks/useCanvasSync";
import { AIFigureGenerator } from "@/components/canvas/AIFigureGenerator";
import { AIIconCustomizer } from "@/components/canvas/AIIconCustomizer";
import { AIIconGenerator } from "@/components/canvas/AIIconGenerator";
import { AIDiagramGenerator } from "@/components/canvas/AIDiagramGenerator";
import { RecolorDialog } from "@/components/canvas/RecolorDialog";
import { DraggableAIGuide } from "@/components/canvas/DraggableAIGuide";
import { ReferenceImageOverlay } from "@/components/canvas/ReferenceImageOverlay";
import { PdbViewerDialog } from "@/components/canvas/PdbViewerDialog";
import { AlignmentGuides } from "@/components/canvas/AlignmentGuides";
import { CanvasRulers } from "@/components/canvas/CanvasRulers";
import { BottomBar } from "@/components/canvas/BottomBar";
import { CanvasContextMenu } from "@/components/canvas/CanvasContextMenu";
import { CommandPalette } from "@/components/canvas/CommandPalette";
import { CommunityTemplatesGallery } from "@/components/canvas/CommunityTemplatesGallery";
import { TemplatesGallery } from "@/components/canvas/TemplatesGallery";
import { ContextualToolbar } from "@/components/canvas/ContextualToolbar";
import { CropTool } from "@/components/canvas/CropTool";
import { CustomCurvedLineDialog } from "@/components/canvas/CustomCurvedLineDialog";
import { CustomOrthogonalLineDialog } from "@/components/canvas/CustomOrthogonalLineDialog";
import { DimensionLabels } from "@/components/canvas/DimensionLabels";
import { ExportDialog } from "@/components/canvas/ExportDialog";
import { FabricCanvas } from "@/components/canvas/FabricCanvas";
import { IconLibrary } from "@/components/canvas/IconLibrary";
import { KeyboardShortcutsDialog } from "@/components/canvas/KeyboardShortcutsDialog";
import { LayersPanel } from "@/components/canvas/LayersPanel";
import { MenuBar } from "@/components/canvas/MenuBar";
import { MobileWarningDialog } from "@/components/canvas/MobileWarningDialog";
import { NewProjectTemplateModal } from "@/components/canvas/NewProjectTemplateModal";
import { PanelLabelTool } from "@/components/canvas/PanelLabelTool";
import { PowerPointGenerator } from "@/components/canvas/PowerPointGenerator";
import { ProjectPickerDialog } from "@/components/canvas/ProjectPickerDialog";
import { PropertiesPanel } from "@/components/canvas/PropertiesPanel";
import { SaveUploadHandler } from "@/components/canvas/SaveUploadHandler";
import { ScaleBarTool } from "@/components/canvas/ScaleBarTool";
import { SpacingGuides } from "@/components/canvas/SpacingGuides";
import { StyleTransferDialog } from "@/components/canvas/StyleTransferDialog";
import { Toolbar } from "@/components/canvas/Toolbar";
import { ToolRatingWidget } from "@/components/canvas/ToolRatingWidget";
import { SmartSuggestions } from "@/components/canvas/SmartSuggestions";
import { TopToolbar } from "@/components/canvas/TopToolbar";
import { TemplatesBrowser } from "@/components/canvas/TemplatesBrowser";
import { UserAssetsLibrary } from "@/components/canvas/UserAssetsLibrary";
import { SuggestIconDialog } from "@/components/community/SuggestIconDialog";
import { ReportBugDialog } from "@/components/community/ReportBugDialog";
import { VersionHistory } from "@/components/canvas/VersionHistory";
import { SaveGroupIconDialog } from "@/components/canvas/SaveGroupIconDialog";
import { SaveLinePresetDialog } from "@/components/canvas/SaveLinePresetDialog";
import { ShareProjectDialog } from "@/components/projects/ShareProjectDialog";
import { CollaborateDialog } from "@/components/collaboration/CollaborateDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { CanvasEditorTestIds, IconLibraryTestIds, TemplatesBrowserTestIds } from "@/lib/test-ids";
import { CanvasProvider, useCanvas } from "@/contexts/CanvasContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQueryClient } from "@tanstack/react-query";
import { FabricImage, Group } from "fabric";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Loader2,
  Lock,
  LockOpen,
  MessagesSquare,
  Play,
  Save,
  Bug,
  Lightbulb,
  Sparkles,
  X,
  Presentation,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCanvasAnalytics } from "@/hooks/useCanvasAnalytics";
import { useFileActions } from "@/hooks/useFileActions";
import { useAppMenuEvents } from "@/hooks/useAppMenuEvents";
import { useUnsavedWarning } from "@/hooks/useUnsavedWarning";
import { useAutosave } from "@/hooks/useAutosave";
import { useAutosaveRestore } from "@/hooks/useAutosaveRestore";

/**
 * Positions a CommentThread dialog near its comment pin, clamped to the scroll viewport.
 * Uses a ref + useLayoutEffect to measure the actual rendered size before clamping.
 */
const CommentThreadPositioner = ({
  pinX,
  pinY,
  containerRef,
  children,
}: {
  pinX: number;
  pinY: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: pinX + 28, top: pinY });

  useEffect(() => {
    const el = dialogRef.current;
    const containerEl = containerRef.current;
    if (!el || !containerEl) return;

    const dialogW = el.offsetWidth;
    const dialogH = el.offsetHeight;
    const pinOffset = 28;
    const pad = 8;

    const scrollViewport = containerEl.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!scrollViewport) {
      setPos({ left: pinX + pinOffset, top: pinY });
      return;
    }

    const vr = scrollViewport.getBoundingClientRect();
    const cr = containerEl.getBoundingClientRect();
    const visLeft = vr.left - cr.left;
    const visTop = vr.top - cr.top;
    const visRight = visLeft + vr.width;
    const visBottom = visTop + vr.height;

    let left = pinX + pinOffset;
    let top = pinY;

    // If dialog overflows right, flip to the left of the pin
    if (left + dialogW > visRight - pad) {
      left = pinX - dialogW - pinOffset;
    }
    // Clamp horizontally
    left = Math.max(visLeft + pad, Math.min(left, visRight - dialogW - pad));
    // Clamp vertically
    top = Math.max(visTop + pad, Math.min(top, visBottom - dialogH - pad));

    setPos({ left, top });
  }, [pinX, pinY, containerRef]);

  return (
    <div
      ref={dialogRef}
      className="absolute"
      style={{ left: pos.left, top: pos.top, zIndex: 200 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

const CanvasContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const { setCanvasMode } = useTheme();
  const [activeTool, setActiveTool] = useState<string>("select");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [selectedIconCategory, setSelectedIconCategory] = useState<string>("");
  const [isIconLibraryCollapsed, setIsIconLibraryCollapsed] = useState(false);
  const [isPropertiesPanelCollapsed, setIsPropertiesPanelCollapsed] =
    useState(false);
  const [leftSidebarTab, setLeftSidebarTab] = useState<"icons" | "assets" | "templates">(
    "icons"
  );
  const [rightSidebarTab, setRightSidebarTab] = useState<
    "properties" | "layers"
  >("properties");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
  const [aiIconGeneratorOpen, setAiIconGeneratorOpen] = useState(false);
  // Failed icon-library searches forward their query into the AI generator
  // as the initial prompt — so the user lands on a prefilled form.
  const [aiIconInitialPrompt, setAiIconInitialPrompt] = useState<string | undefined>(undefined);
  const [aiDiagramOpen, setAiDiagramOpen] = useState(false);
  const [aiIconCustomizerOpen, setAiIconCustomizerOpen] = useState(false);
  const [recolorOpen, setRecolorOpen] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ src: string; size: 'small' | 'medium' | 'large' } | null>(null);
  const [pdbViewerOpen, setPdbViewerOpen] = useState(false);
  const [powerpointOpen, setPowerpointOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [shareDialogProject, setShareDialogProject] = useState<any>(null);
  const [collaborateDialogOpen, setCollaborateDialogOpen] = useState(false);
  const [styleTransferOpen, setStyleTransferOpen] = useState(false);
  const [customOrthogonalDialogOpen, setCustomOrthogonalDialogOpen] =
    useState(false);
  const [customCurvedDialogOpen, setCustomCurvedDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [builtInTemplatesOpen, setBuiltInTemplatesOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const newProjectModalShownRef = useRef(false);
  const [panelLabelToolOpen, setPanelLabelToolOpen] = useState(false);
  const [scaleBarToolOpen, setScaleBarToolOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [hasHiddenObjects, setHasHiddenObjects] = useState(false);
  const [helpVideoOpen, setHelpVideoOpen] = useState(false);
  const [suggestIconOpen, setSuggestIconOpen] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [saveGroupIconOpen, setSaveGroupIconOpen] = useState(false);
  const [saveLinePresetOpen, setSaveLinePresetOpen] = useState(false);
  const [linePresetJson, setLinePresetJson] = useState<Record<string, any> | null>(null);
  // Collaboration state
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [newCommentPos, setNewCommentPos] = useState<{ canvasX: number; canvasY: number } | null>(null);
  const [newCommentScreenPos, setNewCommentScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showComments, setShowComments] = useState(true);
  // Incremented whenever the fabric viewport transform changes → triggers pin reposition
  const [canvasViewportVersion, setCanvasViewportVersion] = useState(0);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [canvasComments, setCanvasComments] = useState<any[]>([]);
  // Maps comment id → reply count at the time it was read
  const [readCommentCounts, setReadCommentCounts] = useState<Map<string, number>>(new Map());
  const { user, isAdmin } = useAuth();

  const {
    canvas,
    selectedObject,
    undo,
    redo,
    cut,
    copy,
    paste,
    deleteSelected,
    selectAll,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    groupSelected,
    ungroupSelected,
    flipHorizontal,
    flipVertical,
    projectName,
    setProjectName,
    saveStatus,
    saveProject,
    loadProject,
    togglePin,
    cropMode,
    setCropMode,
    cropImage,
    isImageEditMode,
    exitImageEditMode,
    isBezierEditMode,
    exitBezierEditMode,
    isCurvedLineEditMode,
    exitCurvedLineEditMode,
    isStraightLineEditMode,
    exitStraightLineEditMode,
    nudgeObject,
    exportDialogOpen,
    setExportDialogOpen,
    exportAsPNG,
    exportAsPNGTransparent,
    exportAsJPG,
    exportAsSVG,
    exportAsPDF,
    exportAsPPTX,
    cleanExport,
    canvasDimensions,
    checkForRecovery,
    recoverCanvas,
    duplicateSelected,
    pasteInPlace,
    deselectAll,
    toggleLockSelected,
    hideSelected,
    showAllHidden,
    rotateSelected,
    duplicateBelow,
    loadTemplate,
    importProjectToCanvas,
    isReadOnly,
    setIsReadOnly,
    isLoadingProject,
    iconLoadingProgress,
    loadSharedProject,
    currentProjectId: contextProjectId,
    isMembraneEditMode,
    zoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    saveState,
  } = useCanvas();

  const fileActions = useFileActions();
  useAppMenuEvents();
  useUnsavedWarning();
  useAutosave();
  useAutosaveRestore();

  // Analytics tracking
  const { trackCanvasClick: trackClick } = useCanvasAnalytics(activeTool);

  // Track canvas clicks for heatmap (only real clicks, not drags/pans)
  useEffect(() => {
    if (!canvas) return;
    let downPos: { x: number; y: number } | null = null;

    const handleMouseDown = (e: any) => {
      const pointer = canvas.getPointer(e.e);
      if (pointer) downPos = { x: pointer.x, y: pointer.y };
    };

    const handleMouseUp = (e: any) => {
      if (!downPos || !canvasDimensions) { downPos = null; return; }
      const pointer = canvas.getPointer(e.e);
      if (!pointer) { downPos = null; return; }

      // Only track if mouse didn't move much (not a drag/pan)
      const dx = pointer.x - downPos.x;
      const dy = pointer.y - downPos.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        // Only track clicks within the canvas bounds
        const { width, height } = canvasDimensions;
        if (pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height) {
          trackClick(pointer.x, pointer.y, width, height, activeTool);
        }
      }
      downPos = null;
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:up", handleMouseUp);
    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [canvas, activeTool, canvasDimensions, trackClick]);

  // State for showing "Saved" confirmation
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);

  // Query client for invalidating cache
  const queryClient = useQueryClient();

  // ─── Collaboration hooks ─────────────────────────────────
  // Note: useCanvasSync is imported lazily to avoid fabric.js dependency at module level
  const isAdminObserver = !!(isAdmin && projectOwnerId && user?.id && user.id !== projectOwnerId);
  const { presentUsers, myColor, broadcastCursor } = usePresence(
    contextProjectId ?? null,
    user?.id,
    user?.user_metadata?.full_name ?? user?.email ?? null,
    user?.user_metadata?.avatar_url ?? null,
    isAdminObserver,
  );

  // Determine user role for locking (owner vs collaborator)
  const userRole = projectOwnerId && user?.id
    ? (user.id === projectOwnerId ? 'owner' : 'member')
    : null;

  const { isLocked, lockInfo, canManageLock, lockProject, unlockProject } = useProjectLock(
    contextProjectId ?? null,
    user?.id,
    userRole,
  );

  // Wire canvas sync (real-time broadcast of canvas operations to collaborators)
  useCanvasSync(contextProjectId ?? null, canvas, user?.id, { isLocked });

  // True when the project is locked by someone else — this user cannot edit.
  const isLockedForUser = isLocked && !canManageLock;

  // Force the select tool whenever the canvas becomes locked for this user.
  useEffect(() => {
    if (isLockedForUser) setActiveTool('select');
  }, [isLockedForUser]);

  // Ref for the canvas wrapper div — used by RemoteCursors to compute cursor offset
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch project owner when project loads
  useEffect(() => {
    if (!contextProjectId) return;
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase
        .from('canvas_projects')
        .select('user_id')
        .eq('id', contextProjectId)
        .single()
        .then(({ data }) => { if (data) setProjectOwnerId(data.user_id); });
    });
  }, [contextProjectId]);

  // Fetch comments for current project
  useEffect(() => {
    if (!contextProjectId) return;
    import('@/integrations/supabase/client').then(({ supabase }) => {
      const fetchComments = async () => {
        const { data } = await supabase
          .from('canvas_comments')
          .select('id, canvas_x, canvas_y, content, resolved, author_id, created_at')
          .eq('project_id', contextProjectId)
          .is('parent_id', null);

        if (data) {
          // Fetch reply counts
          const ids = data.map((c: any) => c.id);
          const { data: replies } = await supabase
            .from('canvas_comments')
            .select('parent_id')
            .in('parent_id', ids);
          const countMap = new Map<string, number>();
          replies?.forEach((r: any) => {
            countMap.set(r.parent_id, (countMap.get(r.parent_id) ?? 0) + 1);
          });
          // Fetch author names
          const authorIds = [...new Set(data.map((c: any) => c.author_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', authorIds);
          const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);

          setCanvasComments(data.map((c: any) => ({
            ...c,
            replyCount: countMap.get(c.id) ?? 0,
            authorName: (profileMap.get(c.author_id) as any)?.full_name ?? 'Unknown',
          })));
        }
      };
      fetchComments();

      const channel = supabase
        .channel(`canvas-comments-overlay:${contextProjectId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'canvas_comments',
          filter: `project_id=eq.${contextProjectId}`,
        }, () => fetchComments())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [contextProjectId]);

  // Mark comment as read when selected (store current reply count)
  useEffect(() => {
    if (selectedCommentId) {
      const comment = canvasComments.find((c: any) => c.id === selectedCommentId);
      const count = comment?.replyCount ?? 0;
      setReadCommentCounts((prev) => {
        if (prev.get(selectedCommentId) === count) return prev;
        const next = new Map(prev);
        next.set(selectedCommentId, count);
        return next;
      });
    }
  }, [selectedCommentId, canvasComments]);

  // Pin AI reference image onto the canvas (default 40% opacity, user-adjustable via Properties panel)
  const handlePinReferenceToCanvas = useCallback(async (imageDataUrl: string) => {
    if (!canvas) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load reference image'));
        img.src = imageDataUrl;
      });

      const fabricImage = new FabricImage(img, {
        left: (canvas.width || 0) / 2,
        top: (canvas.height || 0) / 2,
        originX: 'center',
        originY: 'center',
        opacity: 0.4, // Default — user can change via Properties panel opacity slider
        lockRotation: true,
        selectable: true,
        evented: true,
      });

      // Scale to fit ~60% of canvas
      const maxW = (canvas.width || 0) * 0.6;
      const maxH = (canvas.height || 0) * 0.6;
      const scale = Math.min(maxW / fabricImage.width!, maxH / fabricImage.height!, 1);
      fabricImage.scale(scale);

      // Mark as reference guide for serialization and properties panel
      (fabricImage as any).isReferenceGuide = true;

      canvas.add(fabricImage);
      canvas.sendObjectToBack(fabricImage);
      canvas.requestRenderAll();

      toast.success('Reference image pinned — drag and drop icons to match the guide');
    } catch (err) {
      console.error('Failed to pin reference image:', err);
      toast.error('Failed to pin reference image');
    }
  }, [canvas]);

  // Handler functions for premium features
  const handleShareClick = () => setProjectPickerOpen(true);
  const handleCollaborateClick = () => setCollaborateDialogOpen(true);

  const handleProjectSelect = (project: any) => {
    setProjectPickerOpen(false);
    setShareDialogProject(project);
  };

  const handleShareDialogClose = () => setShareDialogProject(null);

  // Line preset: place a copy on canvas
  const handleLinePresetSelect = useCallback(async (preset: any) => {
    if (!canvas) return;
    try {
      const json = preset.fabric_json;
      const { util } = await import('fabric');
      const { restoreObjectCustomProps } = await import("@/lib/canvasPostProcessing");

      const [obj] = await new Promise<any[]>((resolve, reject) => {
        try {
          const maybe = (util as any).enlivenObjects([json], (objects: any[]) => resolve(objects));
          if (maybe && typeof (maybe as any).then === 'function') {
            (maybe as Promise<any[]>).then(resolve).catch(reject);
          }
        } catch (e) { reject(e); }
      });

      if (!obj) return;

      // Restore custom properties recursively
      const restoreRecursive = (o: any, d: any) => {
        restoreObjectCustomProps(o, d);
        if (o.type === 'group' && o._objects && d.objects) {
          o._objects.forEach((child: any, i: number) => {
            if (d.objects[i]) restoreRecursive(child, d.objects[i]);
          });
        }
      };
      restoreRecursive(obj, json);

      // Force strokeUniform on all stroked objects so lines don't thicken when scaled
      const forceStrokeUniform = (o: any) => {
        if (o.stroke != null) {
          o.set({ strokeUniform: true });
        }
        if (o.type === 'group' && o._objects) {
          o._objects.forEach(forceStrokeUniform);
        }
      };
      forceStrokeUniform(obj);

      // Place at center of viewport
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const cx = (canvas.width! / 2 - vpt[4]) / vpt[0];
      const cy = (canvas.height! / 2 - vpt[5]) / vpt[3];
      obj.set({ left: cx - (obj.width || 50) / 2, top: cy - (obj.height || 50) / 2 });
      obj.setCoords();

      canvas.add(obj);
      canvas.setActiveObject(obj);

      // Reapply endpoint markers from saved marker types so inhibitors, arrows
      // etc. follow the actual path tangent (especially for arc/curved presets)
      const startType = (obj as any).startMarkerType || 'none';
      const endType = (obj as any).endMarkerType || 'none';
      if (startType !== 'none' || endType !== 'none') {
        // Saved curved line presets are Path objects without curvedLineControlPoint
        // and without isArcPath, which causes calculateLineTangentAngles to fall
        // through to a straight-line fallback. Force isArcPath on any Path object
        // with markers so the path-sampling tangent code runs and the inhibitor
        // bar / arrow gets the correct perpendicular orientation.
        if ((obj as any).type === 'path' && (obj as any).path) {
          (obj as any).isArcPath = true;
        }
        const { applyEndpointMarkers, attachMarkerSyncForLine } = await import('@/lib/lineEndpointRenderer');
        applyEndpointMarkers(canvas, obj, startType, endType);
        attachMarkerSyncForLine(canvas, obj);
      }

      // Trigger marker sync so endpoints render immediately
      canvas.fire('object:modified', { target: obj });
      obj.fire('modified');
      canvas.requestRenderAll();
      saveState();
    } catch (e) {
      console.error("Failed to place line preset:", e);
    }
  }, [canvas, saveState]);

  // Line preset: save selected object as preset (admin)
  const handleSaveAsLinePreset = useCallback(() => {
    if (!canvas || !selectedObject) return;
    const props = [
      'id', 'name', 'iconId', 'isLibraryIcon',
      'isCurvedLine', 'isStraightLine', 'isOrthogonalLine', 'isBezierPath', 'isFreeformLine',
      'bezierPoints', 'worldBezierPoints', 'isClosed', 'curveSmoothing',
      'startMarkerType', 'endMarkerType', 'startMarker', 'endMarker',
      'intersectionBehavior', 'gradientConfig', 'lineGradientConfig',
      'isBracket', 'bracketType', 'bracketDirection',
      'isLeaderLine', 'leaderLineConfig',
      'strokeDashArray', 'cornerStyle',
    ];
    const json = selectedObject.toObject(props);

    // Generate a thumbnail capturing the object with its markers
    let thumbnail: string | undefined;
    try {
      const bound = selectedObject.getBoundingRect();
      const pad = 8;
      thumbnail = canvas.toDataURL({
        left: bound.left - pad,
        top: bound.top - pad,
        width: bound.width + pad * 2,
        height: bound.height + pad * 2,
        format: 'png',
        multiplier: 1,
      } as any);
    } catch (e) {
      console.warn("Failed to generate line preset thumbnail:", e);
    }

    setLinePresetJson({ ...json, _thumbnail: thumbnail });
    setSaveLinePresetOpen(true);
  }, [canvas, selectedObject]);

  // Show "Saved" for 3 seconds after save completes
  useEffect(() => {
    if (saveStatus === "saved") {
      setShowSavedConfirmation(true);
      const timer = setTimeout(() => {
        setShowSavedConfirmation(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSavedConfirmation(false);
    }
  }, [saveStatus]);

  // Enable canvas workspace theme when component mounts
  useEffect(() => {
    setCanvasMode(true);
    return () => setCanvasMode(false);
  }, [setCanvasMode]);

  // Disable vertical scrolling on body while on canvas route
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Track clipboard status via copy/cut actions
  useEffect(() => {
    const handleCopy = () => setHasClipboard(true);
    const handleCut = () => setHasClipboard(true);

    // Listen for clipboard operations
    window.addEventListener("clipboardData", handleCopy);

    return () => {
      window.removeEventListener("clipboardData", handleCopy);
    };
  }, []);

  // Check for hidden objects
  useEffect(() => {
    if (!canvas) return;

    const checkHidden = () => {
      const objects = canvas.getObjects();
      const hasHidden = objects.some((obj) => obj.visible === false);
      setHasHiddenObjects(hasHidden);
    };

    checkHidden();
    canvas.on("object:added", checkHidden);
    canvas.on("object:removed", checkHidden);
    canvas.on("object:modified", checkHidden);

    return () => {
      canvas.off("object:added", checkHidden);
      canvas.off("object:removed", checkHidden);
      canvas.off("object:modified", checkHidden);
    };
  }, [canvas]);

  // Track last loaded project to prevent duplicate loads
  const lastLoadedProjectRef = useRef<string | null>(null);

  // Load project from URL parameter (either /canvas?project=id or /canvas/:id)
  // Or load shared project from /shared/:id
  useEffect(() => {
    const projectId = id || searchParams.get("project");
    const isSharedRoute = location.pathname.startsWith("/shared/");

    // Only load if we have a project ID, canvas is ready, and we haven't already loaded this project
    if (projectId && canvas && lastLoadedProjectRef.current !== projectId) {
      lastLoadedProjectRef.current = projectId;

      if (isSharedRoute) {
        loadSharedProject(projectId);
      } else {
        loadProject(projectId);
      }
      setCurrentProjectId(projectId);
    }
  }, [
    id,
    searchParams,
    canvas,
    loadProject,
    loadSharedProject,
    location.pathname,
  ]);


  // Import SVG from any tool via sessionStorage
  useEffect(() => {
    if (!canvas) return;

    const toolImports = [
      { key: 'pedigree_svg_import', label: 'Pedigree', scale: 0.8 },
      { key: 'smiles_svg_import', label: 'Molecular structure', scale: 0.6 },
      { key: 'latex_svg_import', label: 'LaTeX equation', scale: 0.6 },
      { key: 'heatmap_svg_import', label: 'Heatmap', scale: 0.7 },
      { key: 'phylo_svg_import', label: 'Phylogenetic tree', scale: 0.7 },
      { key: 'gantt_svg_import', label: 'Gantt chart', scale: 0.8 },
      { key: 'gel_svg_import', label: 'Gel electrophoresis', scale: 0.6 },
      { key: 'volcano_svg_import', label: 'Volcano plot', scale: 0.7 },
      { key: 'codon_svg_import', label: 'Codon wheel', scale: 0.6 },
      { key: 'boxwhisker_svg_import', label: 'Box & whisker plot', scale: 0.7 },
      { key: 'barchart_svg_import', label: 'Bar chart', scale: 0.7 },
      { key: 'violin_svg_import', label: 'Violin plot', scale: 0.7 },
      { key: 'corrmatrix_svg_import', label: 'Correlation matrix', scale: 0.7 },
      { key: 'forest_svg_import', label: 'Forest plot', scale: 0.7 },
      { key: 'roc_svg_import', label: 'ROC curve', scale: 0.7 },
      { key: 'venn_svg_import', label: 'Venn diagram', scale: 0.7 },
      { key: 'sankey_svg_import', label: 'Sankey diagram', scale: 0.7 },
      { key: 'chart_studio_svg_import', label: 'Chart Studio chart', scale: 0.7 },
      { key: 'ai_illustrator_svg_import', label: 'AI illustration', scale: 0.5 },
      { key: 'scientific_illustrator_svg_import', label: 'Scientific illustration', scale: 0.7 },
    ];

    const found = toolImports.find(t => sessionStorage.getItem(t.key));
    if (!found) return;

    const svgData = sessionStorage.getItem(found.key)!;
    sessionStorage.removeItem(found.key);
    newProjectModalShownRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const fabric = await import('fabric');
        const { loadSVGFromString, util } = fabric;
        console.log(`[SVG import] ${found.label}: SVG length = ${svgData.length} chars, first 200:`, svgData.substring(0, 200));
        // Posters carry a data-poster="1" marker on the SVG root — that signals
        // we should add each parsed element to the canvas as its own object
        // (title, sections, bullets, captions, figures) instead of wrapping
        // them all in one fabric.Group. That's what makes double-click-to-edit
        // work immediately, matching the editable PPT export.
        const isPoster = /<svg\b[^>]*\bdata-poster\s*=\s*(["'])1\1/i.test(svgData);
        const { objects, options } = await loadSVGFromString(svgData);
        console.log(`[SVG import] ${found.label}: parsed ${objects?.length || 0} objects, isPoster=${isPoster}`, objects?.slice(0, 3));
        if (objects && objects.length > 0) {
          if (isPoster) {
            // ── Poster path: no top-level group. Rebuild <text> as IText so
            // double-click opens the text for typing (Fabric parses <text>
            // into static FabricText by default). Then compute the poster's
            // bounding box from the union of the parsed objects and scale +
            // translate each into place before adding independently.
            const { IText } = fabric as any;
            const items = (objects as any[]).map((o) => {
              if (o.type !== 'text') return o;
              return new IText(o.text || '', {
                left: o.left, top: o.top, originX: o.originX, originY: o.originY,
                fontSize: o.fontSize, fontFamily: o.fontFamily, fontWeight: o.fontWeight,
                fontStyle: o.fontStyle, fill: o.fill, textAlign: o.textAlign,
                angle: o.angle, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity,
                charSpacing: o.charSpacing, stroke: o.stroke, strokeWidth: o.strokeWidth,
                paintFirst: o.paintFirst,
              });
            });

            const bboxes = items
              .map((o: any) => (typeof o.getBoundingRect === 'function' ? o.getBoundingRect(true, true) : null))
              .filter(Boolean) as { left: number; top: number; width: number; height: number }[];
            const minX = Math.min(...bboxes.map((b) => b.left));
            const minY = Math.min(...bboxes.map((b) => b.top));
            const maxX = Math.max(...bboxes.map((b) => b.left + b.width));
            const maxY = Math.max(...bboxes.map((b) => b.top + b.height));
            const contentW = Math.max(1, maxX - minX);
            const contentH = Math.max(1, maxY - minY);
            const maxW = (canvas.width || 1200) * found.scale;
            const maxH = (canvas.height || 800) * found.scale;
            const scale = Math.min(maxW / contentW, maxH / contentH, 1);
            const targetLeft = (canvas.width || 1200) / 2 - (contentW * scale) / 2;
            const targetTop = (canvas.height || 800) / 2 - (contentH * scale) / 2;
            for (const o of items as any[]) {
              const currentLeft = (o.left ?? 0) - minX;
              const currentTop = (o.top ?? 0) - minY;
              o.set({
                left: targetLeft + currentLeft * scale,
                top: targetTop + currentTop * scale,
                scaleX: (o.scaleX ?? 1) * scale,
                scaleY: (o.scaleY ?? 1) * scale,
              });
              o.setCoords?.();
              canvas.add(o);
            }
            canvas.requestRenderAll();
            saveState();
            toast.success('Poster imported — every element is editable', {
              description: 'Double-click any title, header, bullet, or caption to retype it.',
              duration: 6000,
            });
          } else {
            // ── Standard (grouped) path — everything else keeps the original behavior.
            const group = util.groupSVGElements(objects, options);
            console.log(`[SVG import] ${found.label}: grouped, type = ${(group as any).type}, w = ${group.width}, h = ${group.height}`);
            const maxW = (canvas.width || 1200) * found.scale;
            const maxH = (canvas.height || 800) * found.scale;
            const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
            group.scale(scale);
            group.set({
              left: (canvas.width || 1200) / 2 - ((group.width || 0) * scale) / 2,
              top: (canvas.height || 800) / 2 - ((group.height || 0) * scale) / 2,
              lockUniScaling: true,
            });
            // For AI illustrator structured diagrams (flowchart/protocol/timeline) we WANT
            // the user to be able to ungroup → edit individual nodes/arrows. Don't lock.
            if (found.key !== 'ai_illustrator_svg_import') {
              group.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
            }
            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.requestRenderAll();
            saveState();
            toast.success(`${found.label} imported to canvas`);
          }
        } else {
          console.error(`[SVG import] ${found.label}: parsed 0 objects — Fabric could not parse the SVG`);
          toast.error(`${found.label} parsed but contained no shapes`);
        }
      } catch (err) {
        console.error(`Failed to import ${found.label} SVG:`, err);
        toast.error(`Failed to import ${found.label}`);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [canvas]);

  // Show new project template modal when opening canvas without a project
  // Skip if coming from admin template editor, pedigree, or SMILES import
  useEffect(() => {
    if (!canvas) return;
    if (newProjectModalShownRef.current) return;
    if (sessionStorage.getItem('admin_edit_template')) return;
    // Skip modal if any tool SVG import is pending
    const importKeys = ['pedigree_svg_import', 'smiles_svg_import', 'latex_svg_import', 'heatmap_svg_import', 'phylo_svg_import', 'gantt_svg_import', 'gel_svg_import', 'volcano_svg_import', 'codon_svg_import', 'boxwhisker_svg_import', 'barchart_svg_import', 'violin_svg_import', 'corrmatrix_svg_import', 'forest_svg_import', 'roc_svg_import', 'venn_svg_import', 'sankey_svg_import', 'chart_studio_svg_import', 'ai_illustrator_svg_import', 'scientific_illustrator_svg_import'];
    if (importKeys.some(k => sessionStorage.getItem(k))) return;
    const projectId = id || searchParams.get("project");
    if (!projectId && user) {
      newProjectModalShownRef.current = true;
      setNewProjectModalOpen(true);
    }
  }, [canvas, id, searchParams, user]);

  // Import PNG from Chart Studio
  useEffect(() => {
    if (!canvas) return;
    const pngData = sessionStorage.getItem("chartStudio_pngImport");
    if (!pngData) return;
    const pngW = Number(sessionStorage.getItem("chartStudio_pngWidth") || 740);
    const pngH = Number(sessionStorage.getItem("chartStudio_pngHeight") || 520);
    sessionStorage.removeItem("chartStudio_pngImport");
    sessionStorage.removeItem("chartStudio_pngWidth");
    sessionStorage.removeItem("chartStudio_pngHeight");
    const timer = setTimeout(async () => {
      try {
        const { FabricImage } = await import('fabric');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const fabricImg = new FabricImage(img);
          const maxW = (canvas.width || 1200) * 0.7;
          const maxH = (canvas.height || 800) * 0.7;
          const scale = Math.min(maxW / (fabricImg.width || pngW), maxH / (fabricImg.height || pngH), 1);
          fabricImg.scale(scale);
          fabricImg.set({
            left: (canvas.width || 1200) / 2 - ((fabricImg.width || pngW) * scale) / 2,
            top: (canvas.height || 800) / 2 - ((fabricImg.height || pngH) * scale) / 2,
          });
          canvas.add(fabricImg);
          canvas.setActiveObject(fabricImg);
          canvas.requestRenderAll();
          saveState();
          toast.success("Chart Studio graph imported to canvas");
        };
        img.src = pngData;
      } catch (err) {
        console.error("Failed to import Chart Studio PNG:", err);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [canvas, saveState]);

  // Admin template editing state
  const [adminTemplateId, setAdminTemplateId] = useState<string | null>(
    () => sessionStorage.getItem('admin_edit_template_id')
  );
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load admin template from sessionStorage if present
  useEffect(() => {
    if (!canvas) return;
    const templateJson = sessionStorage.getItem('admin_edit_template');
    if (!templateJson) return;

    sessionStorage.removeItem('admin_edit_template');
    newProjectModalShownRef.current = true;

    const timer = setTimeout(() => {
      try {
        const template = JSON.parse(templateJson);
        if (template?.canvasData) {
          loadTemplate(template);
        }
      } catch (e) {
        console.error('Failed to load admin template:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [canvas]);

  // Save canvas state back to the admin template in the database
  const saveAdminTemplate = async () => {
    if (!canvas || !adminTemplateId) return;
    setIsSavingTemplate(true);
    try {
      const json = canvas.toJSON();
      const canvasData = { ...json, background: json.background || '#ffffff' };

      const { error } = await supabase
        .from('built_in_templates')
        .update({ canvas_data: canvasData })
        .eq('id', adminTemplateId);

      if (error) throw error;

      toast.success('Template updated!');
      sessionStorage.removeItem('admin_edit_template_id');
      setAdminTemplateId(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Check for recovery on load
  useEffect(() => {
    if (!canvas) return;

    // Don't offer recovery when loading a specific project from URL
    const projectId = id || searchParams.get("project");
    if (projectId) {
      // Clear any stale recovery data when loading explicit project
      localStorage.removeItem("canvas_recovery");
      return;
    }

    const recovery = checkForRecovery();
    if (recovery) {
      toast.info(
        `Found unsaved work from ${recovery.ageMinutes} minute${
          recovery.ageMinutes !== 1 ? "s" : ""
        } ago`,
        {
          duration: 10000,
          action: {
            label: "Recover",
            onClick: () => recoverCanvas(recovery.data),
          },
        }
      );
    }
  }, [canvas, checkForRecovery, recoverCanvas, searchParams]);

  const handleExport = () => {
    toast("Export functionality will save your SVG file");
  };

  const handleShapeSelect = (shape: string) => {
    if (shape === "orthogonal-line-custom") {
      setCustomOrthogonalDialogOpen(true);
    } else if (shape === "curved-line-custom") {
      setCustomCurvedDialogOpen(true);
    } else {
      setActiveTool(shape);
      toast.success(`Selected ${shape}`);
    }
  };

  const handleCustomOrthogonalLine = (
    startMarker: string,
    endMarker: string
  ) => {
    setActiveTool(`orthogonal-line-custom-${startMarker}-${endMarker}`);
    toast.success(
      `Custom orthogonal line selected: ${startMarker} → ${endMarker}`
    );
  };

  const handleCustomCurvedLine = (startMarker: string, endMarker: string) => {
    setActiveTool(`curved-line-custom-${startMarker}-${endMarker}`);
    toast.success(`Custom curved line selected: ${startMarker} → ${endMarker}`);
  };

  const handleShapeCreated = useCallback(() => {
    setActiveTool("select");
  }, []);

  // Called by FabricCanvas whenever its viewport transform changes (zoom/pan)
  const handleViewportChange = useCallback(() => {
    setCanvasViewportVersion(v => v + 1);
  }, []);

  // Convert a fabric canvas coordinate to an absolute pixel position within canvasContainerRef.
  // Uses getBoundingClientRect so the result is scroll-invariant (both elements move together).
  const computePinScreenPos = (canvasX: number, canvasY: number): { x: number; y: number } => {
    const fc = (window as any).fabricCanvas;
    const vpt: number[] = fc?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const canvasEl = fc?.getElement?.() as HTMLCanvasElement | undefined;
    const containerEl = canvasContainerRef.current;
    if (!canvasEl || !containerEl) return { x: canvasX, y: canvasY };
    const cr = canvasEl.getBoundingClientRect();
    const wr = containerEl.getBoundingClientRect();
    return {
      x: canvasX * vpt[0] + vpt[4] + cr.left - wr.left,
      y: canvasY * vpt[3] + vpt[5] + cr.top - wr.top,
    };
  };

  // Handle canvas click in comment mode — show inline textarea at click position
  const handleCommentClick = useCallback((canvasX: number, canvasY: number, screenX: number, screenY: number) => {
    setNewCommentPos({ canvasX, canvasY });
    setNewCommentScreenPos({ x: screenX, y: screenY });
    setNewCommentText('');
  }, []);

  // Submit new comment to database
  const handleSubmitComment = useCallback(async () => {
    if (!newCommentPos || !newCommentText.trim() || !user || !contextProjectId) return;
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: comment, error } = await supabase
      .from('canvas_comments')
      .insert({
        project_id: contextProjectId,
        author_id: user.id,
        content: newCommentText.trim(),
        canvas_x: newCommentPos.canvasX,
        canvas_y: newCommentPos.canvasY,
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to add comment');
    } else if (comment) {
      supabase.functions.invoke('send-comment-notification', {
        body: { commentId: comment.id, projectId: contextProjectId, isReply: false },
      });
    }
    setNewCommentPos(null);
    setNewCommentScreenPos(null);
    setNewCommentText('');
    setActiveTool('select');
  }, [newCommentPos, newCommentText, user, contextProjectId]);

  // Persist comment pin position after drag
  const handleCommentDragEnd = useCallback(async (id: string, newX: number, newY: number) => {
    const { error } = await supabase
      .from('canvas_comments')
      .update({ canvas_x: newX, canvas_y: newY })
      .eq('id', id);

    if (error) {
      console.error('Failed to update comment position:', error);
      toast.error('Failed to move comment');
    }
  }, []);

  const startEditingName = () => {
    setTempName(projectName);
    setIsEditingName(true);
  };

  const saveName = () => {
    const trimmedName = tempName.trim();
    if (trimmedName.length === 0) {
      toast.error("Canvas name cannot be empty");
      setTempName(projectName);
      setIsEditingName(false);
      return;
    }
    if (trimmedName.length > 100) {
      toast.error("Canvas name must be less than 100 characters");
      return;
    }
    setProjectName(trimmedName);
    setIsEditingName(false);
    toast.success("Canvas renamed");
  };

  const cancelEditing = () => {
    setTempName(projectName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleExportImage = (
    format: "png" | "png-transparent" | "jpg" | "svg" | "pdf" | "pptx",
    dpi: 150 | 300 | 600,
    selectionOnly?: boolean,
    pdfOptions?: { cmykMode?: boolean }
  ) => {
    if (format === "png") {
      exportAsPNG(dpi, selectionOnly);
    } else if (format === "png-transparent") {
      exportAsPNGTransparent(dpi, selectionOnly);
    } else if (format === "jpg") {
      exportAsJPG(dpi, selectionOnly);
    } else if (format === "svg") {
      exportAsSVG(selectionOnly);
    } else if (format === "pdf") {
      exportAsPDF(dpi, selectionOnly, pdfOptions);
    } else if (format === "pptx") {
      exportAsPPTX(dpi, selectionOnly);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    // Disable all keyboard shortcuts in read-only / locked / loading mode
    if (isReadOnly || isLockedForUser || isLoadingProject) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Check if user is editing text - either canvas text OR HTML inputs
      const activeObject = canvas?.getActiveObject();
      const isEditingCanvasText =
        activeObject &&
        (activeObject.type === "textbox" ||
          activeObject.type === "i-text" ||
          activeObject.type === "text") &&
        (activeObject as any).isEditing;

      // Check if focus is on any HTML input element
      const activeElement = document.activeElement;
      const isEditingHTMLInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.getAttribute("contenteditable") === "true");

      const isEditingText = isEditingCanvasText || isEditingHTMLInput;

      // Command Palette (Cmd/Ctrl+K)
      if (modifier && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Show shortcuts dialog with ?
      if (e.key === "?" && !modifier && !isEditingText) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Number keys for tool switching (1-9)
      if (!isEditingText && !modifier && /^[1-9]$/.test(e.key)) {
        const toolMap: Record<string, string> = {
          "1": "select",
          "2": "text",
          "3": "rectangle",
          "4": "circle",
          "5": "straight-line",
          "6": "arrow",
          "7": "pen",
          "8": "image",
          "9": "eraser",
        };

        // C key for comment tool
        if (e.key === "c" && !modifier && !isEditingText) {
          e.preventDefault();
          setActiveTool("comment");
          toast.success("Comment mode — click on canvas to add a comment", { duration: 2000 });
          return;
        }

        const tool = toolMap[e.key];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
          toast.success(`Switched to ${tool} tool`, { duration: 1000 });
        }
        return;
      }

      // Tab key for cycling through objects
      if (e.key === "Tab" && !isEditingText) {
        e.preventDefault();

        const allObjects =
          canvas
            ?.getObjects()
            .filter(
              (obj) =>
                obj.selectable !== false &&
                !(obj as any).isGridLine &&
                !(obj as any).isRuler
            ) || [];

        if (allObjects.length === 0) return;

        const currentIndex = selectedObject
          ? allObjects.indexOf(selectedObject)
          : -1;
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + allObjects.length) % allObjects.length
          : (currentIndex + 1) % allObjects.length;

        const nextObject = allObjects[nextIndex];
        canvas?.setActiveObject(nextObject);
        canvas?.requestRenderAll();

        toast.success(`Selected: ${nextObject.type}`, { duration: 800 });
        return;
      }

      // Clean Export (Cmd/Ctrl + E)
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        cleanExport();
        return;
      }

      // Save Project (Cmd/Ctrl + S)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        fileActions.saveProject();
        return;
      }

      // Zoom In (Cmd/Ctrl + = or +)
      if (modifier && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
        return;
      }

      // Zoom Out (Cmd/Ctrl + -)
      if (modifier && e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }

      // Zoom to Fit (Cmd/Ctrl + 0)
      if (modifier && e.key === "0") {
        e.preventDefault();
        zoomToFit();
        return;
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }

      // Duplicate (Cmd/Ctrl + D)
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
        setActiveTool("select");
      }

      // Paste in place (Cmd/Ctrl + Shift + V)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "v") {
        e.preventDefault();
        pasteInPlace();
        setActiveTool("select");
      }

      // Deselect all (Cmd/Ctrl + Shift + A)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "a") {
        e.preventDefault();
        deselectAll();
      }

      // Lock/Unlock (Cmd/Ctrl + Shift + L)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "l") {
        e.preventDefault();
        toggleLockSelected();
      }

      // Hide selected (H)
      if (
        e.key === "h" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditingText
      ) {
        e.preventDefault();
        hideSelected();
      }

      // Flip horizontal (Shift + H)
      if (
        e.key === "H" &&
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !isEditingText
      ) {
        e.preventDefault();
        flipHorizontal();
      }

      // Flip vertical (Shift + V)
      if (
        e.key === "V" &&
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !isEditingText
      ) {
        e.preventDefault();
        flipVertical();
      }

      // Version History (Cmd/Ctrl + H)
      if ((e.metaKey || e.ctrlKey) && e.key === "h" && !e.shiftKey) {
        e.preventDefault();
        setVersionHistoryOpen(true);
        return;
      }

      // Show all hidden (Cmd/Ctrl + Shift + H)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "h") {
        e.preventDefault();
        showAllHidden();
      }

      // Rotate 90° clockwise (Cmd/Ctrl + R)
      if ((e.metaKey || e.ctrlKey) && e.key === "r" && !e.shiftKey) {
        e.preventDefault();
        rotateSelected(90);
      }

      // Rotate 90° counter-clockwise (Cmd/Ctrl + Shift + R)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "r") {
        e.preventDefault();
        rotateSelected(-90);
      }

      // Duplicate and arrange below (Cmd/Ctrl + =)
      if ((e.metaKey || e.ctrlKey) && e.key === "=") {
        e.preventDefault();
        duplicateBelow();
      }

      // Cut/Copy/Paste. After any clipboard action, snap back to the
      // select tool so the next canvas click manipulates the result
      // instead of drawing a new shape (matches Figma/Illustrator UX).
      if (modifier && e.key === "x") {
        e.preventDefault();
        cut();
        setActiveTool("select");
      } else if (modifier && e.key === "c") {
        e.preventDefault();
        copy();
        setActiveTool("select");
      } else if (modifier && e.key === "v") {
        // Allow native paste when editing text
        if (!isEditingText) {
          e.preventDefault();
          paste();
          setActiveTool("select");
        }
      } else if (modifier && e.key === "a") {
        e.preventDefault();
        selectAll();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !modifier &&
        !isEditingText
      ) {
        // Only delete the object if not currently editing text
        e.preventDefault();
        deleteSelected();
      } else if (modifier && e.shiftKey && e.key === "]") {
        e.preventDefault();
        bringToFront();
      } else if (modifier && !e.shiftKey && e.key === "]") {
        e.preventDefault();
        bringForward();
      } else if (modifier && !e.shiftKey && e.key === "[") {
        e.preventDefault();
        sendBackward();
      } else if (modifier && e.shiftKey && e.key === "[") {
        e.preventDefault();
        sendToBack();
      } else if (modifier && e.key === "l") {
        e.preventDefault();
        togglePin();
      } else if (modifier && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
      } else if (modifier && e.shiftKey && e.key === "G") {
        e.preventDefault();
        ungroupSelected();
      } else if (!modifier && e.key.toLowerCase() === "l" && !isEditingText) {
        e.preventDefault();
        setActiveTool("straight-line");
        toast.info("Straight line tool activated");
      } else if (!modifier && e.key.toLowerCase() === "c" && !isEditingText) {
        e.preventDefault();
        const activeObject = canvas?.getActiveObject();
        if (activeObject && activeObject.type !== 'activeSelection') {
          setCropMode('rectangle'); // Default to rectangle mode
          toast.info("Crop mode activated");
        }
      } else if (e.key === "Escape" && cropMode !== 'none') {
        e.preventDefault();
        setCropMode('none');
        toast.info("Crop mode cancelled");
      } else if (e.key === "Escape" && isImageEditMode) {
        e.preventDefault();
        e.stopPropagation();
        exitImageEditMode();
      } else if (e.key === "Enter" && isBezierEditMode && !isEditingText) {
        e.preventDefault();
        exitBezierEditMode();
        toast.success("Bezier edit complete");
      } else if (e.key === "Enter" && isCurvedLineEditMode && !isEditingText) {
        e.preventDefault();
        exitCurvedLineEditMode();
        toast.success("Curved line edit complete");
      } else if (e.key === "Enter" && isStraightLineEditMode && !isEditingText) {
        e.preventDefault();
        exitStraightLineEditMode();
        toast.success("Straight line edit complete");
      } else if (e.key === "Enter" && cropMode && !isEditingText) {
        e.preventDefault();
        // Crop will be applied via CropTool's Apply button
      } else if (e.shiftKey && !modifier && !isEditingText) {
        // Shift+Arrow nudging for precise object movement
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeObject("up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeObject("down");
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeObject("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeObject("right");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isReadOnly,
    isLockedForUser,
    isLoadingProject,
    canvas,
    selectedObject,
    undo,
    redo,
    cut,
    copy,
    paste,
    selectAll,
    deleteSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    groupSelected,
    ungroupSelected,
    togglePin,
    cropMode,
    setCropMode,
    isImageEditMode,
    exitImageEditMode,
    isBezierEditMode,
    exitBezierEditMode,
    isCurvedLineEditMode,
    exitCurvedLineEditMode,
    isStraightLineEditMode,
    exitStraightLineEditMode,
    nudgeObject,
    duplicateSelected,
    pasteInPlace,
    deselectAll,
    toggleLockSelected,
    hideSelected,
    showAllHidden,
    rotateSelected,
    duplicateBelow,
    zoomIn,
    zoomOut,
    zoomToFit,
  ]);

  // Ctrl+Scroll / Pinch-to-zoom on trackpad
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl+scroll or pinch gesture (ctrlKey is set for pinch on trackpads)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else if (e.deltaY > 0) {
          zoomOut();
        }
      }
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollContainer.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  return (
    <>
      <style>{`
        @keyframes canvas-ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .canvas-ticker {
          animation: canvas-ticker-scroll 25s linear infinite;
        }
        .canvas-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col relative">
        {/* Subtle dot pattern background */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        {/* Mobile Warning Dialog */}
        <MobileWarningDialog />

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={showShortcuts}
          onOpenChange={setShowShortcuts}
        />

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onToolChange={setActiveTool}
        />

        {/* Community Templates Gallery */}
        <CommunityTemplatesGallery
          open={templatesDialogOpen}
          onOpenChange={setTemplatesDialogOpen}
          onSelectTemplate={(projectId) => navigate(`/canvas/${projectId}`)}
          onBlankCanvas={() => setTemplatesDialogOpen(false)}
        />

        {/* Built-in Templates Gallery */}
        <TemplatesGallery
          open={builtInTemplatesOpen}
          onOpenChange={setBuiltInTemplatesOpen}
          onSelectTemplate={(template) => {
            loadTemplate(template);
            setBuiltInTemplatesOpen(false);
          }}
          onBlankCanvas={() => setBuiltInTemplatesOpen(false)}
        />

        {/* New Project Template Modal */}
        <NewProjectTemplateModal
          open={newProjectModalOpen}
          onOpenChange={setNewProjectModalOpen}
          onSelectTemplate={(newProjectId) => navigate(`/canvas/${newProjectId}`)}
          onBlankCanvas={() => setNewProjectModalOpen(false)}
          userId={user?.id}
        />

        {/* Version History */}
        <VersionHistory
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          projectId={contextProjectId}
          onVersionRestored={() => {
            // Reload the project after restoration
            if (contextProjectId) {
              loadProject(contextProjectId);
            }
          }}
        />

        {/* Save Upload Handler */}
        <SaveUploadHandler />

        {/* AI Figure Generator */}
        <AIFigureGenerator
          canvas={canvas}
          open={aiGeneratorOpen}
          onOpenChange={setAiGeneratorOpen}
        />

        {/* AI Diagram Generator */}
        <AIDiagramGenerator
          open={aiDiagramOpen}
          onClose={() => setAiDiagramOpen(false)}
          canvas={canvas}
        />

        {/* Recolor (no-AI) dialog */}
        <RecolorDialog
          open={recolorOpen}
          onClose={() => setRecolorOpen(false)}
          canvas={canvas}
        />

        {/* PDB Structure Viewer */}
        <PdbViewerDialog
          canvas={canvas}
          open={pdbViewerOpen}
          onOpenChange={setPdbViewerOpen}
        />

        {/* AI Icon Generator */}
        <AIIconGenerator
          open={aiIconGeneratorOpen}
          onOpenChange={(open) => {
            setAiIconGeneratorOpen(open);
            if (!open) setAiIconInitialPrompt(undefined);
          }}
          initialPrompt={aiIconInitialPrompt}
          onIconGenerated={() => {
            // Refresh icon library if needed
            toast.success("Icon added to library!");
          }}
        />

        {/* AI Icon Customizer (right-click → Customize with AI) */}
        <AIIconCustomizer
          open={aiIconCustomizerOpen}
          onOpenChange={setAiIconCustomizerOpen}
          targetObject={selectedObject}
        />

        {/* Save Group Icon Dialog */}
        <SaveGroupIconDialog
          open={saveGroupIconOpen}
          onOpenChange={setSaveGroupIconOpen}
          canvas={canvas}
          selectedObject={selectedObject}
        />

        {/* Save Line Preset Dialog */}
        <SaveLinePresetDialog
          open={saveLinePresetOpen}
          onOpenChange={setSaveLinePresetOpen}
          fabricJson={linePresetJson}
        />

        {/* PowerPoint Generator */}
        <PowerPointGenerator
          open={powerpointOpen}
          onOpenChange={setPowerpointOpen}
        />

        {/* Project Picker Dialog */}
        <ProjectPickerDialog
          open={projectPickerOpen}
          onOpenChange={setProjectPickerOpen}
          onProjectSelect={handleProjectSelect}
          currentProjectId={currentProjectId}
        />

        {/* Share Project Dialog */}
        {shareDialogProject && (
          <ShareProjectDialog
            project={shareDialogProject}
            isOpen={!!shareDialogProject}
            onClose={handleShareDialogClose}
            onUpdate={async () => {
              // Invalidate feature access cache to update progress
              queryClient.invalidateQueries({ queryKey: ["feature-access"] });
              // Check if project is now pending approval and lock canvas
              if (contextProjectId) {
                const { data: proj } = await supabase
                  .from('canvas_projects')
                  .select('approval_status, is_public')
                  .eq('id', contextProjectId)
                  .single();
                if (proj?.is_public && proj?.approval_status === 'pending') {
                  setIsReadOnly(true);
                  if (canvas) {
                    canvas.getObjects().forEach(obj => {
                      obj.set({
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        hasBorders: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockRotation: true,
                        lockScalingX: true,
                        lockScalingY: true,
                      });
                    });
                    canvas.selection = false;
                    canvas.requestRenderAll();
                  }
                  toast.info("Canvas is now locked while pending admin review");
                }
              }
            }}
          />
        )}

        {/* Collaborate Dialog */}
        {collaborateDialogOpen && contextProjectId && (
          <CollaborateDialog
            project={{ id: contextProjectId, name: projectName }}
            isOpen={collaborateDialogOpen}
            onClose={() => setCollaborateDialogOpen(false)}
          />
        )}

        {/* Style Transfer Dialog */}
        <StyleTransferDialog
          open={styleTransferOpen}
          onOpenChange={setStyleTransferOpen}
        />

        {/* Panel Label Tool */}
        <PanelLabelTool
          open={panelLabelToolOpen}
          onOpenChange={setPanelLabelToolOpen}
        />

        {/* Scale Bar Tool */}
        <ScaleBarTool
          open={scaleBarToolOpen}
          onOpenChange={setScaleBarToolOpen}
        />

        {/* Export Dialog */}
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExport={handleExportImage}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
          hasSelection={!!selectedObject}
        />

        {/* Custom Orthogonal Line Dialog */}
        <CustomOrthogonalLineDialog
          open={customOrthogonalDialogOpen}
          onOpenChange={setCustomOrthogonalDialogOpen}
          onConfirm={handleCustomOrthogonalLine}
        />

        {/* Custom Curved Line Dialog */}
        <CustomCurvedLineDialog
          open={customCurvedDialogOpen}
          onOpenChange={setCustomCurvedDialogOpen}
          onConfirm={handleCustomCurvedLine}
        />

        {/* Crop Tool */}
        {cropMode !== 'none' &&
          canvas &&
          (() => {
            // Check selectedObject first, fallback to canvas active object
            const objectToEdit = selectedObject || canvas.getActiveObject();

            if (!objectToEdit || objectToEdit.type === 'activeSelection') return null;

            return (
              <CropTool
                canvas={canvas}
                selectedObject={objectToEdit}
                cropMode={cropMode}
                onApply={cropImage}
                onCancel={() => setCropMode('none')}
              />
            );
          })()}

        {/* Image Edit Mode controls are now in the sidebar (ImageMaskPanel) */}

        {/* Top Header with Menu */}
        <header className="bg-card/80 backdrop-blur-sm border-b border-border/50 shadow-sm">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODgyOTg3LCJleHAiOjIwNzYyNDI5ODd9.Z1uz-_XoJro6NP3bm6Ehexf5wAqUMfg03lRo73WPr1g"
                alt="BioSketch"
                className="h-7 object-contain"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/")}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={isLoadingProject}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back to Projects</TooltipContent>
              </Tooltip>
              {isEditingName ? (
                <Input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={saveName}
                  autoFocus
                  className="h-7 text-sm font-medium max-w-[200px]"
                  maxLength={100}
                  disabled={isLoadingProject}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={startEditingName}
                    className="text-sm font-medium text-foreground hover:bg-muted px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    title="Click to rename"
                    disabled={isLoadingProject}
                  >
                    {projectName}
                  </button>
                  {isReadOnly && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Only
                    </Badge>
                  )}
                  {isLoadingProject && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1" />

<div className="flex items-center gap-1.5">
              {/* Presence Avatars */}
              {contextProjectId && presentUsers.length > 0 && (
                <PresenceAvatars users={presentUsers} />
              )}
{/* Comments visibility toggle */}
              {contextProjectId && !isReadOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-colors ${
                        showComments
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setShowComments(v => !v)}
                      data-testid={CanvasEditorTestIds.COMMENT_SIDEBAR_TOGGLE}
                    >
                      <MessagesSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showComments ? 'Hide comments' : 'Show comments'}
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Lock toggle — managers only */}
              {contextProjectId && canManageLock && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-colors ${
                        isLocked
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={isLocked ? unlockProject : lockProject}
                      data-testid={isLocked ? CanvasEditorTestIds.UNLOCK_BUTTON : CanvasEditorTestIds.LOCK_BUTTON}
                    >
                      {isLocked
                        ? <Lock className="h-4 w-4" />
                        : <LockOpen className="h-4 w-4" />
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isLocked ? 'Unlock project (allow editing)' : 'Lock project (disable collaborator edits)'}
                  </TooltipContent>
                </Tooltip>
              )}
              {!isReadOnly && (
                <div className={isLoadingProject ? "pointer-events-none opacity-50" : ""}>
                  <MenuBar
                    onTemplatesClick={() => setBuiltInTemplatesOpen(true)}
                    onVersionHistoryClick={() => setVersionHistoryOpen(true)}
                    onScaleBarClick={() => setScaleBarToolOpen(true)}
                    onStyleTransferClick={() => setStyleTransferOpen(true)}
                  />
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowShortcuts(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={isLoadingProject}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Shortcuts (?)</TooltipContent>
              </Tooltip>
              {!isReadOnly && isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAiGeneratorOpen(true)}
                  className="h-8 text-muted-foreground hover:text-foreground"
                  disabled={isLoadingProject}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  AI
                </Button>
              )}
              {/* Save Template button — only shown when editing admin template */}
              {adminTemplateId && (
                <Button
                  onClick={saveAdminTemplate}
                  disabled={isSavingTemplate}
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSavingTemplate ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Save Template</>
                  )}
                </Button>
              )}
              {!isReadOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => navigate('/canvas')}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Switch to Simple Editor
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Switch to simplified editor</TooltipContent>
                </Tooltip>
              )}
              {!isReadOnly && (
                <Button
                  onClick={() => fileActions.saveProject()}
                  disabled={saveStatus === "saving" || showSavedConfirmation || isLoadingProject}
                  size="sm"
                  className={`h-8 w-[5.33rem] bg-primary hover:bg-primary/90`}
                  data-action="save"
                  data-testid={CanvasEditorTestIds.SAVE_BUTTON}
                >
                  {isLoadingProject ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading
                    </>
                  ) : saveStatus === "saving" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving
                    </>
                  ) : showSavedConfirmation ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              )}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Lock Banner — only shown to users who did NOT lock the project */}
        {isLocked && lockInfo && lockInfo.lockedBy !== user?.id && (
          <LockBanner
            lockInfo={lockInfo}
            canManageLock={canManageLock}
            onUnlock={unlockProject}
          />
        )}

        {/* Top Toolbar - Hidden in read-only mode */}
        {!isReadOnly && (
          <div className={isLoadingProject ? "pointer-events-none opacity-50" : ""}>
            <TopToolbar
              onExport={handleExport}
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onAIIconClick={() => setAiIconGeneratorOpen(true)}
              onAIDiagramClick={() => setAiDiagramOpen(true)}
              onPowerPointClick={() => setPowerpointOpen(true)}
              onShareClick={handleShareClick}
              onCollaborateClick={handleCollaborateClick}
              hasProject={!!contextProjectId}
              onCommandPaletteToggle={() => setCommandPaletteOpen(prev => !prev)}
              onLinePresetSelect={handleLinePresetSelect}
            />
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 min-h-0 flex flex-row">
          {/* Left Sidebar - Icon Categories & Assets */}
          {!isReadOnly && (
            <div
              className={`min-h-0 flex-shrink-0 ${isLoadingProject || isLockedForUser ? "pointer-events-none opacity-40 select-none" : ""}`}
              style={{ width: isIconLibraryCollapsed ? "48px" : "280px" }}
            >
              <div
                className={`bg-card/60 backdrop-blur-sm border-r border-border/40 flex flex-col overflow-hidden min-h-0 h-full transition-all duration-200`}
              >
                {isIconLibraryCollapsed ? (
                  <div
                    data-testid={IconLibraryTestIds.LIBRARY_TOGGLE}
                    className="p-2 flex flex-col items-center gap-4 cursor-pointer h-full"
                    onClick={() => setIsIconLibraryCollapsed(false)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-white text-primary hover:text-primary/80 hover:bg-white/90 hover:scale-105 transition-all duration-200 pointer-events-none"
                    >
                      <ChevronRight
                        className="h-5 w-5"
                        strokeWidth={4}
                      />
                    </Button>
                    {/* Vertical label when collapsed */}
                    <span
                      className="text-lg font-bold text-primary writing-mode-vertical transform rotate-180"
                      style={{ writingMode: "vertical-rl" }}
                      dangerouslySetInnerHTML={{
                        __html: "Icons&nbsp;&nbsp;&amp;&nbsp;&nbsp;Assets",
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="pl-2 pt-1 pb-0 bg-muted flex items-center justify-between gap-2">
                      <Button
                        data-testid={IconLibraryTestIds.LIBRARY_TOGGLE}
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsIconLibraryCollapsed(true)}
                        className="h-8 w-8 bg-white text-primary hover:text-primary/80 hover:bg-white/90 hover:scale-105 transition-all duration-200"
                      >
                        <ChevronLeft
                          className="h-4 w-4"
                          strokeWidth={3}
                        />
                      </Button>
                      <Tabs
                        value={leftSidebarTab}
                        onValueChange={(v) =>
                          setLeftSidebarTab(v as "icons" | "assets" | "templates")
                        }
                        className="flex-1"
                      >
                        <TabsList className="h-auto !bg-muted p-0 pb-0 gap-1 flex justify-start border-0 items-end">
                          <TabsTrigger
                            value="icons"
                            className="text-sm font-semibold text-primary !bg-muted !border-0 data-[state=active]:!bg-white data-[state=active]:text-primary transition-all duration-200 rounded-t-lg rounded-b-none px-3 py-2 !shadow-none -mb-px "
                            data-testid={IconLibraryTestIds.ICONS_TAB}
                          >
                            Icons
                          </TabsTrigger>
                          <TabsTrigger
                            value="templates"
                            className="text-sm font-semibold text-primary !bg-muted !border-0 data-[state=active]:!bg-white data-[state=active]:text-primary transition-all duration-200 rounded-t-lg rounded-b-none px-3 py-2 !shadow-none -mb-px"
                            data-testid={TemplatesBrowserTestIds.PANEL + '-tab'}
                          >
                            Templates
                          </TabsTrigger>
                          <TabsTrigger
                            value="assets"
                            className="text-sm font-semibold text-primary !bg-muted !border-0 data-[state=active]:!bg-white data-[state=active]:text-primary transition-all duration-200 rounded-t-lg rounded-b-none px-3 py-2 !shadow-none -mb-px"
                            data-testid={IconLibraryTestIds.ASSETS_TAB}
                          >
                            Assets
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {leftSidebarTab === "icons" ? (
                        <IconLibrary
                          selectedCategory={selectedIconCategory}
                          onCategoryChange={setSelectedIconCategory}
                          isCollapsed={false}
                          onToggleCollapse={() => {}}
                        />
                      ) : leftSidebarTab === "assets" ? (
                        <UserAssetsLibrary
                          onAssetSelect={async (assetId, content) => {
                            window.dispatchEvent(
                              new CustomEvent("addAssetToCanvas", {
                                detail: { content, assetId },
                              })
                            );
                          }}
                        />
                      ) : (
                        <TemplatesBrowser
                          onImport={importProjectToCanvas}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Middle Section - Toolbar + Canvas */}
          <div className="flex-1 min-h-0 min-w-0">
            <div className="flex h-full min-h-0">
              {/* Vertical Toolbar */}
              {!isReadOnly && (
                <div className={isLoadingProject ? "pointer-events-none opacity-50" : ""}>
                  <Toolbar
                    activeTool={activeTool}
                    onToolChange={setActiveTool}
                    isLocked={isLockedForUser}
                    onPdbOpen={() => setPdbViewerOpen(true)}
                  />
                </div>
              )}

              {/* Canvas */}
              <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
              <div ref={scrollAreaRef} className={`h-full w-full absolute inset-0 bg-muted/20 overflow-auto ${isLoadingProject ? "pointer-events-none" : ""}`}>
                {/* Comment Thread popover — rendered inside canvasContainerRef below */}
                {/* canvasContainerRef is `relative` so pins can be `absolute` inside it,
                    tracking the fabric canvas element position + viewport transform. */}
                <div
                  ref={canvasContainerRef}
                  className={`relative min-h-full min-w-full flex items-center justify-center p-6 ${isLoadingProject ? "opacity-50" : ""}`}
                  onMouseDown={() => {
                    // Close the comment thread dialog when clicking on the canvas area
                    if (selectedCommentId) setSelectedCommentId(null);
                  }}
                >
                  {/* Comment Pins — positioned relative to this container using the fabric
                      viewport transform, so they stay anchored to canvas coordinates. */}
                  {showComments && contextProjectId && canvasComments.map((c: any) => {
                    if (c.canvas_x == null || c.canvas_y == null) return null;
                    const pos = computePinScreenPos(c.canvas_x, c.canvas_y);
                    return (
                      <CommentPin
                        key={`${c.id}-${canvasViewportVersion}`}
                        comment={{ id: c.id, canvas_x: c.canvas_x, canvas_y: c.canvas_y, content: c.content, resolved: c.resolved, replyCount: c.replyCount, authorName: c.authorName }}
                        screenX={pos.x}
                        screenY={pos.y}
                        isActive={selectedCommentId === c.id}
                        isRead={readCommentCounts.has(c.id) && c.replyCount <= (readCommentCounts.get(c.id) ?? 0)}
                        onClick={() => setSelectedCommentId(c.id)}
                        onDrag={(id, newX, newY) => {
                          setCanvasComments((prev: any[]) =>
                            prev.map((p: any) => p.id === id ? { ...p, canvas_x: newX, canvas_y: newY } : p)
                          );
                        }}
                        onDragEnd={handleCommentDragEnd}
                      />
                    );
                  })}
                  {/* Comment Thread popover — positioned at the selected comment's pin location,
                      clamped to remain fully visible within the scroll viewport */}
                  {selectedCommentId && contextProjectId && projectOwnerId && (() => {
                    const comment = canvasComments.find((c: any) => c.id === selectedCommentId);
                    if (!comment || comment.canvas_x == null || comment.canvas_y == null) return null;
                    const pinPos = computePinScreenPos(comment.canvas_x, comment.canvas_y);

                    return (
                      <CommentThreadPositioner
                        pinX={pinPos.x}
                        pinY={pinPos.y}
                        containerRef={canvasContainerRef}
                      >
                        <CommentThread
                          topLevelCommentId={selectedCommentId}
                          projectId={contextProjectId}
                          projectOwnerId={projectOwnerId}
                          onClose={() => setSelectedCommentId(null)}
                          onThreadDeleted={(id) => {
                            setCanvasComments((prev: any[]) => prev.filter((c: any) => c.id !== id));
                            setSelectedCommentId(null);
                          }}
                          onCommentNotification={async (commentId, isReply) => {
                            const { supabase } = await import('@/integrations/supabase/client');
                            supabase.functions.invoke('send-comment-notification', {
                              body: { commentId, projectId: contextProjectId, isReply },
                            });
                          }}
                        />
                      </CommentThreadPositioner>
                    );
                  })()}
                  <CanvasContextMenu
                    selectedObject={selectedObject}
                    hasClipboard={hasClipboard}
                    canUndo={true}
                    canRedo={true}
                    hasHiddenObjects={hasHiddenObjects}
                    onCopy={() => {
                      copy();
                      setHasClipboard(true);
                      setActiveTool("select");
                    }}
                    onCut={() => {
                      cut();
                      setHasClipboard(true);
                      setActiveTool("select");
                    }}
                    onPaste={() => {
                      paste();
                      setActiveTool("select");
                    }}
                    onDuplicate={() => {
                      duplicateSelected();
                      setActiveTool("select");
                    }}
                    onDelete={deleteSelected}
                    onLock={toggleLockSelected}
                    onHide={hideSelected}
                    onBringToFront={bringToFront}
                    onBringForward={bringForward}
                    onSendBackward={sendBackward}
                    onSendToBack={sendToBack}
                    onGroup={groupSelected}
                    onUngroup={ungroupSelected}
                    onSelectAll={selectAll}
                    onUndo={undo}
                    onRedo={redo}
                    onShowAllHidden={showAllHidden}
                    onOpenProperties={() => {
                      setIsPropertiesPanelCollapsed(false);
                      setRightSidebarTab("properties");
                    }}
                    onCustomizeWithAI={() => setAiIconCustomizerOpen(true)}
                    onRecolor={() => setRecolorOpen(true)}
                    onRemixWithAI={() => {
                      if (!canvas) return;
                      const obj = canvas.getActiveObject();
                      if (!obj) return;
                      // Rasterize the selected object (or group) to a data URL.
                      // toDataURL on a fabric object renders just that object.
                      try {
                        const dataUrl = (obj as any).toDataURL?.({ format: 'png', multiplier: 2 });
                        if (!dataUrl) {
                          toast({ title: 'Could not capture icon for remix' });
                          return;
                        }
                        sessionStorage.setItem('ai_icon_remix_source', dataUrl);
                        setAiIconGeneratorOpen(true);
                      } catch (e) {
                        console.error('Remix capture failed', e);
                        toast({ title: 'Could not capture icon for remix' });
                      }
                    }}
                    onSaveAsGroupIcon={() => setSaveGroupIconOpen(true)}
                    onSaveAsLinePreset={isAdmin ? handleSaveAsLinePreset : undefined}
                  >
                    <FabricCanvas
                      activeTool={activeTool}
                      onShapeCreated={handleShapeCreated}
                      onToolChange={setActiveTool}
                      onCursorMove={broadcastCursor}
                      isLockedForEditing={isLocked && !canManageLock}
                      onCommentClick={handleCommentClick}
                      onViewportChange={handleViewportChange}
                    />
                  </CanvasContextMenu>
                </div>

                {/* Loading Spinner */}
                {isLoadingProject && (
                  <div className="absolute inset-0 flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      {iconLoadingProgress && (
                        <Card className="p-4 min-w-[280px] shadow-lg">
                          <div className="flex flex-col items-center gap-3">
                            <div className="text-sm text-muted-foreground font-medium">
                              Loading icons ({iconLoadingProgress.current} / {iconLoadingProgress.total})
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${(iconLoadingProgress.current / iconLoadingProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                <AlignmentGuides />
                <SpacingGuides />
                <DimensionLabels />
                {/* Remote cursors overlay — shows other users' cursor positions */}
                <RemoteCursors
                  users={presentUsers}
                  canvasContainerRef={canvasContainerRef}
                  viewportVersion={canvasViewportVersion}
                  projectId={contextProjectId ?? null}
                  myUserId={user?.id}
                />
              </div>
              <CanvasRulers
                zoom={zoom}
                canvasWidth={canvasDimensions.width}
                canvasHeight={canvasDimensions.height}
                scrollContainerRef={scrollAreaRef}
              />
              </div>
            </div>
          </div>

          {!isReadOnly && (
            <div
              className={`min-h-0 flex-shrink-0 ${isLoadingProject ? "pointer-events-none opacity-50" : ""}`}
              style={{ width: isPropertiesPanelCollapsed ? "48px" : "300px" }}
            >
              <div
                className={`bg-card/60 backdrop-blur-sm border-l border-border/40 flex flex-col overflow-hidden min-h-0 h-full`}
              >
                {isPropertiesPanelCollapsed ? (
                  <div
                    className="p-2 flex flex-col items-center gap-4 cursor-pointer h-full"
                    onClick={() => setIsPropertiesPanelCollapsed(false)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-white text-primary hover:text-primary/80 hover:bg-white/90 hover:scale-105 transition-all duration-200 pointer-events-none"
                    >
                      <ChevronLeft
                        className="h-5 w-5"
                        strokeWidth={4}
                      />
                    </Button>
                    {/* Vertical label when collapsed */}
                    <span
                      className="text-lg font-bold text-primary"
                      style={{ writingMode: "vertical-rl" }}
                      dangerouslySetInnerHTML={{
                        __html: "Properties&nbsp;&nbsp;&amp;&nbsp;&nbsp;Layers",
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="pr-2 pt-1 pb-0 bg-muted flex items-center justify-between gap-2">
                      <Tabs
                        value={rightSidebarTab}
                        onValueChange={(v) =>
                          setRightSidebarTab(v as "properties" | "layers")
                        }
                        className="flex-1"
                      >
                        <TabsList className="h-auto !bg-muted p-0 pb-0 gap-1 flex justify-start border-0 items-end">
                          <TabsTrigger
                            value="properties"
                            className="text-sm font-semibold text-primary !bg-muted !border-0 data-[state=active]:!bg-white data-[state=active]:text-primary transition-all duration-200 rounded-t-lg rounded-b-none px-4 py-2 !shadow-none -mb-px"
                          >
                            Properties
                          </TabsTrigger>
                          <TabsTrigger
                            value="layers"
                            className="text-sm font-semibold text-primary !bg-muted !border-0 data-[state=active]:!bg-white data-[state=active]:text-primary transition-all duration-200 rounded-t-lg rounded-b-none px-4 py-2 !shadow-none -mb-px"
                          >
                            Layers
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPropertiesPanelCollapsed(true)}
                        className="h-8 w-8 bg-white text-primary hover:text-primary/80 hover:bg-white/90 hover:scale-105 transition-all duration-200"
                      >
                        <ChevronRight
                          className="h-4 w-4"
                          strokeWidth={3}
                        />
                      </Button>
                    </div>
                    <div
                      className={`flex-1 overflow-hidden${isLockedForUser ? ' pointer-events-none opacity-50 select-none' : ''}`}
                      data-panel="properties"
                    >
                      {rightSidebarTab === "properties" ? (
                        <PropertiesPanel
                          isCollapsed={false}
                          onToggleCollapse={() => {}}
                          activeTool={activeTool}
                          projectId={contextProjectId ?? undefined}
                          projectOwnerId={projectOwnerId ?? undefined}
                          onSelectComment={(id) => setSelectedCommentId(id)}
                          showComments={showComments}
                          onToggleComments={() => setShowComments(v => !v)}
                          selectedCommentId={selectedCommentId}
                        />
                      ) : (
                        <LayersPanel />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Bottom Bar */}
        {!isReadOnly && (
          <div className={isLoadingProject ? "pointer-events-none opacity-50" : ""}>
            <BottomBar
              activeTool={activeTool}
              hasSelection={!!selectedObject}
            />
          </div>
        )}

        {/* Rating Widget */}
        <ToolRatingWidget />

        {/* Smart Suggestions Assistant */}
        <SmartSuggestions />

        {/* Feeling Stuck? Help Video Dialog */}
        <Dialog open={helpVideoOpen} onOpenChange={setHelpVideoOpen}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="text-lg font-serif">Feeling Stuck? Watch This Guide</DialogTitle>
            </DialogHeader>
            <div className="p-4 pt-2">
              <div className="rounded-xl overflow-hidden border border-border/50">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  {helpVideoOpen && (
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src="https://www.youtube.com/embed/rETbE0cX0e8?autoplay=1"
                      title="BioSketch Key Features Guide"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suggest Icon Dialog */}
        <SuggestIconDialog open={suggestIconOpen} onOpenChange={setSuggestIconOpen} />
        <ReportBugDialog open={reportBugOpen} onOpenChange={setReportBugOpen} />

        {/* Reference Image Overlay — draggable guide on canvas */}
        {referenceImage && (
          <ReferenceImageOverlay
            src={referenceImage.src}
            initialSize={referenceImage.size}
            onClose={() => setReferenceImage(null)}
          />
        )}

        {/* Contextual Toolbar - Appears when object is selected */}
        {!isReadOnly && <ContextualToolbar />}

        {/* AI Reference Guide - draggable floating panel */}
        {!isReadOnly && (
          <DraggableAIGuide
            onUseAsGuide={(src, size) => setReferenceImage({ src, size })}
            onPinToCanvas={handlePinReferenceToCanvas}
          />
        )}



        {/* Inline comment draft — appears at click position in comment mode */}
        {newCommentPos && newCommentScreenPos && (
          <div
            className="fixed z-[300] bg-background border border-border rounded-xl shadow-xl w-72 p-3 flex flex-col gap-2"
            style={{ left: Math.min(newCommentScreenPos.x, window.innerWidth - 300), top: Math.min(newCommentScreenPos.y + 12, window.innerHeight - 200) }}
          >
            <Textarea
              placeholder="Add a comment… (Ctrl+Enter to submit)"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setNewCommentPos(null); setNewCommentScreenPos(null); setNewCommentText(''); setActiveTool('select'); }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment();
              }}
              className="text-xs min-h-[72px] resize-none"
              autoFocus
              maxLength={2000}
              data-testid="comment-draft-input"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setNewCommentPos(null); setNewCommentScreenPos(null); setNewCommentText(''); setActiveTool('select'); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!newCommentText.trim()}
                data-testid="comment-draft-submit"
              >
                Comment
              </Button>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

interface CanvasProps {
  readOnly?: boolean;
}

const Canvas = ({ readOnly = false }: CanvasProps) => {
  return (
    <CanvasProvider initialReadOnly={readOnly}>
      <TooltipProvider>
        <CanvasContent />
      </TooltipProvider>
    </CanvasProvider>
  );
};

export default Canvas;
