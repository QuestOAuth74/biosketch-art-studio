import { useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, Rect, Circle, Line, Textbox, Polygon, Ellipse, loadSVGFromString, util, Group, Path, PencilBrush, Control, FabricObject, Gradient, Pattern, Point, Shadow } from "fabric";
import { EraserBrush } from "@erase2d/fabric";
import { toast } from "sonner";
import { useCanvas } from "@/contexts/CanvasContext";
import { useGridAndRulerStore } from "@/stores/gridAndRulerStore";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import { drawAllLineGradients } from "@/lib/lineGradientRenderer";
import { loadAllFonts, getCanvasFontFamily, getBaseFontName, debugTextObject, fixInvisibleText, normalizeCanvasTextFonts, normalizeEditingTextFont } from "@/lib/fontLoader";
import { createConnector } from "@/lib/connectorSystem";
import { createSVGArrowMarker } from "@/lib/advancedLineSystem";
import { ArrowMarkerType, RoutingStyle } from "@/types/connector";
import { EnhancedBezierTool } from "@/lib/enhancedBezierTool";
import { CustomPolygonTool } from "@/lib/customPolygonTool";
import { setupIntersectionRendering } from "@/lib/lineIntersectionCanvasRenderer";
import { StraightLineTool } from "@/lib/straightLineTool";
import { OrthogonalLineTool } from "@/lib/orthogonalLineTool";
import { CurvedLineTool } from "@/lib/curvedLineTool";
import { MembraneBrushTool } from "@/lib/membraneBrushTool";
import { MembranePathTool } from "@/lib/membranePathTool";
import { TripleMembranePathTool } from "@/lib/tripleMembranePathTool";
import { DNAHelixTool } from "@/lib/dnaHelixTool";
import { ChartTool, isChart } from "@/lib/chartTool";
import { BezierEditMode } from "@/lib/bezierEditMode";
import { CurvedLineEditMode } from "@/lib/curvedLineEditMode";
import { StraightLineEditMode } from "@/lib/straightLineEditMode";
import { OrthogonalLineEditMode } from "@/lib/orthogonalLineEditMode";
import { calculateArcPath } from "@/lib/advancedLineSystem";
import { ConnectorVisualFeedback } from "@/lib/connectorVisualFeedback";
import { loadImageWithCORS } from "@/lib/utils";
import { ObjectCullingManager, createThrottledCuller } from "@/lib/objectCulling";
import { calculateObjectComplexity, applyComplexityOptimizations, shouldSimplifyControls } from "@/lib/objectComplexity";
import { isTextBox, handleTextBoxResize, getTextBoxTextElement } from "@/lib/textBoxTool";
import { createNumberedCallout, getNextCalloutNumber, registerCallout, renumberCallouts, createOrUpdateLegend, isCallout } from "@/lib/numberedCalloutTool";
import { LeaderLineTool } from "@/lib/leaderLineTool";
import { BracketTool } from "@/lib/bracketTool";
import { useMembraneSettings } from "@/hooks/useMembraneSettings";
import {
  useEscapeEditMode,
  useCursorManagement,
  useContextMenuPrevention,
  useReadOnlyEnforcement,
  useGridRendering,
  useBackgroundGradient,
  useConnectionPointVisibility,
  usePenTool,
  usePolygonTool,
  useStraightLineTool,
  useLeaderLineTool,
  useBracketTool,
  useOrthogonalLineTool,
  useCurvedLineTool,
  useFreeformLineTool,
  useEraserTool,
  useMembraneBrushTool,
  useMembraneIconPreload,
  useMembranePathTool,
  useTripleMembraneTool,
  useDnaHelixTool,
  useChartTool,
  useTableTool,
  useErasableObjects,
  useImageInsertionTool,
  useExitEditModeOnToolChange,
  useDeselectOnLineTool,
  useDisableInteractionInEditMode,
  useCanvasZoom,
  useSyncVersionListener,
} from "@/hooks/canvas";
import { supabase } from "@/integrations/supabase/client";
import { ConnectionPointManager } from "@/lib/connectionPointManager";
import { ConnectionSyncManager } from "@/lib/connectionSyncManager";
import { removeEndpointMarkers, updateEndpointMarkers } from "@/lib/lineEndpointRenderer";

// Default shape styling constants
const DEFAULT_SHAPE_FILL = 'rgba(96, 165, 250, 0.55)';   // Blue-400 at 55% — good contrast with white text
const DEFAULT_SHAPE_STROKE = '#64748b';                    // Slate-500 — strong border definition

// Sanitize SVG namespace issues before parsing with Fabric.js
/**
 * Awaits decoding of all nested image elements inside a Fabric group/object.
 * Without this, groups containing <image> SVG elements render blank because
 * the image pixels haven't loaded when Fabric caches the group.
 */
const awaitNestedImageDecode = async (obj: any): Promise<void> => {
  const promises: Promise<void>[] = [];

  const collectImages = (o: any) => {
    if ((o.type === 'image' || o.type === 'Image') && o._element) {
      const el = o._element as HTMLImageElement;
      if (el.decode) {
        promises.push(
          el.decode().catch(() => {
            // Image decode failed — object will render as blank but won't block others
          })
        );
      }
    }
    if (o._objects) {
      for (const child of o._objects) {
        collectImages(child);
      }
    }
  };

  collectImages(obj);
  if (promises.length > 0) {
    await Promise.all(promises);
    // Force cache invalidation after all images decode
    obj.dirty = true;
    if (obj._objects) {
      for (const child of obj._objects) {
        if ((child.type === 'image' || child.type === 'Image') && child._element) {
          child.dirty = true;
        }
      }
    }
  }
};

const sanitizeSVGNamespaces = (svgContent: string): string => {
  let sanitized = svgContent
    // Replace <ns0:svg> and other namespace prefixes with <svg>
    .replace(/<ns\d+:svg/g, '<svg')
    .replace(/<\/ns\d+:svg>/g, '</svg>')
    // Replace xmlns:ns0="..." with xmlns="..."
    .replace(/xmlns:ns\d+=/g, 'xmlns=')
    // Replace <ns0:element> with <element> for any SVG element
    .replace(/<(\/?)ns\d+:(\w+)/g, '<$1$2')
    // Remove any remaining ns0: references in attributes
    .replace(/ns\d+:/g, '');
  
  // Ensure proper xmlns attribute exists
  if (!sanitized.includes('xmlns="http://www.w3.org/2000/svg"')) {
    sanitized = sanitized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  return sanitized;
};

/**
 * Extract the data URL of an embedded raster image from an SVG string.
 * Returns the data URL if found, or null if the SVG is a true vector.
 */
const extractEmbeddedRasterUrl = (svgContent: string): string | null => {
  // Match <image> with href or xlink:href pointing to a data URL
  const match = svgContent.match(/<image[\s\S]*?(?:xlink:)?href\s*=\s*"(data:image\/[^"]+)"/i);
  return match ? match[1] : null;
};

/**
 * Inline CSS <style> class rules as attributes on SVG elements.
 * Fabric.js does not reliably apply CSS class-based fills from <style> blocks,
 * causing icons to render as flat silhouettes. This converts:
 *   <style>.cls-1 { fill: #8b5f3c; stroke: #000; }</style>
 *   <path class="cls-1" d="..."/>
 * Into:
 *   <path class="cls-1" fill="#8b5f3c" stroke="#000" d="..."/>
 */
const inlineSVGStyles = (svgContent: string): string => {
  // Extract all <style> blocks
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(svgContent)) !== null) {
    styleBlocks.push(match[1]);
  }

  if (styleBlocks.length === 0) return svgContent;

  // Parse CSS rules: .className { prop: value; ... }
  const classStyles: Record<string, Record<string, string>> = {};
  const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  for (const block of styleBlocks) {
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(block)) !== null) {
      const className = ruleMatch[1];
      const propsStr = ruleMatch[2];
      const props: Record<string, string> = {};

      // Parse individual CSS properties
      const propRegex = /([\w-]+)\s*:\s*([^;]+)/g;
      let propMatch;
      while ((propMatch = propRegex.exec(propsStr)) !== null) {
        props[propMatch[1].trim()] = propMatch[2].trim();
      }
      classStyles[className] = props;
    }
  }

  if (Object.keys(classStyles).length === 0) return svgContent;

  // SVG-relevant CSS properties that map directly to SVG attributes
  const svgAttrProps = new Set([
    'fill', 'stroke', 'stroke-width', 'stroke-miterlimit',
    'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
    'stroke-dashoffset', 'stroke-opacity', 'fill-opacity',
    'opacity', 'fill-rule', 'clip-rule',
  ]);

  // Apply class styles as inline attributes on elements with class="..."
  let result = svgContent.replace(
    /(<\w+)([^>]*?\bclass="([^"]*)"[^>]*)(\/?>)/gi,
    (fullMatch, tagOpen, attrs, classNames, tagClose) => {
      const classes = classNames.split(/\s+/);
      const inlineProps: Record<string, string> = {};

      for (const cls of classes) {
        const styles = classStyles[cls];
        if (!styles) continue;
        for (const [prop, val] of Object.entries(styles)) {
          if (svgAttrProps.has(prop)) {
            // Only apply if the element doesn't already have this attribute inline
            const attrRegex = new RegExp(`\\b${prop}\\s*=`, 'i');
            if (!attrRegex.test(attrs)) {
              inlineProps[prop] = val;
            }
          }
        }
      }

      if (Object.keys(inlineProps).length === 0) return fullMatch;

      const inlineStr = Object.entries(inlineProps)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');

      return `${tagOpen} ${inlineStr}${attrs}${tagClose}`;
    }
  );

  return result;
};

interface FabricCanvasProps {
  activeTool: string;
  onShapeCreated?: () => void;
  onToolChange?: (tool: string) => void;
  /** Called with fabric canvas coordinates on every mouse:move event. */
  onCursorMove?: (x: number, y: number) => void;
  /** When true, canvas editing is blocked regardless of isReadOnly context value. */
  isLockedForEditing?: boolean;
  /** Called when user clicks canvas in comment mode. Receives canvas coords + raw screen coords. */
  onCommentClick?: (canvasX: number, canvasY: number, screenX: number, screenY: number) => void;
  /** Called whenever the fabric viewport transform changes (zoom/pan). Used for pin repositioning. */
  onViewportChange?: (vpt: number[]) => void;
}

export const FabricCanvas = ({ activeTool, onShapeCreated, onToolChange, onCursorMove, isLockedForEditing, onCommentClick, onViewportChange }: FabricCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings: membraneSettings } = useMembraneSettings();
  // defaultMembraneIconSVGRef is now returned by useMembraneIconPreload hook

  const [penToolState, setPenToolState] = useState<{
    isDrawing: boolean;
    points: Array<{ x: number; y: number }>;
    tempMarkers: Circle[];
    tempLines: Line[];
  }>({
    isDrawing: false,
    points: [],
    tempMarkers: [],
    tempLines: [],
  });
  
  const [connectorState, setConnectorState] = useState<{
    isDrawing: boolean;
    startX: number | null;
    startY: number | null;
  }>({
    isDrawing: false,
    startX: null,
    startY: null,
  });


  const [isDuplicating, setIsDuplicating] = useState(false);
  const clonedObjectRef = useRef<FabricObject | null>(null);
  const originalOpacityMapRef = useRef<Map<any, number>>(new Map());
  const activeDragRef = useRef<{
    isMultiObject: boolean;
    startTime: number;
  } | null>(null);

  // Helper functions for main-thread SVG processing (fallback when Web Worker fails)
  const calculateSVGComplexityMainThread = (svgContent: string): number => {
    let score = 0;
    score += (svgContent.match(/<path/g) || []).length * 5;
    score += (svgContent.match(/<polygon/g) || []).length * 3;
    score += (svgContent.match(/<circle/g) || []).length * 1;
    score += (svgContent.match(/<rect/g) || []).length * 1;
    score += (svgContent.match(/<text/g) || []).length * 2;
    score += (svgContent.match(/transform=/g) || []).length * 2;
    score += (svgContent.match(/filter=/g) || []).length * 10;
    return score;
  };

  const simplifySVGMainThread = (svgContent: string): string => {
    // Find all IDs that are referenced by url() - these must be preserved
    const referencedIds = new Set<string>();
    const urlMatches = svgContent.matchAll(/url\(#([^)]+)\)/g);
    for (const match of urlMatches) {
      referencedIds.add(match[1]);
    }

    // Only remove IDs that are not referenced
    let simplified = svgContent;
    if (referencedIds.size > 0) {
      // Keep IDs that are referenced (for gradients, filters, masks, etc.)
      simplified = simplified.replace(/id="([^"]*)"/g, (match, id) => {
        return referencedIds.has(id) ? match : '';
      });
    } else {
      // No references found, safe to remove all IDs
      simplified = simplified.replace(/id="[^"]*"/g, '');
    }

    return simplified
      // Note: CSS classes are preserved - they often define fill colors
      .replace(/style="[^"]*opacity:\s*0[^"]*"/g, 'style="display:none"')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Refs to expose current prop values inside the once-registered main useEffect handlers
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  const onCommentClickRef = useRef(onCommentClick);
  useEffect(() => { onCommentClickRef.current = onCommentClick; }, [onCommentClick]);
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);

  const bezierToolRef = useRef<EnhancedBezierTool | null>(null);
  const customPolygonToolRef = useRef<CustomPolygonTool | null>(null);
  const straightLineToolRef = useRef<StraightLineTool | null>(null);
  const orthogonalLineToolRef = useRef<OrthogonalLineTool | null>(null);
  const curvedLineToolRef = useRef<CurvedLineTool | null>(null);
  const membraneBrushToolRef = useRef<MembraneBrushTool | null>(null);
  const membranePathToolRef = useRef<any>(null);
  const tripleMembraneToolRef = useRef<TripleMembranePathTool | null>(null);
  const dnaHelixToolRef = useRef<DNAHelixTool | null>(null);
  const connectorFeedbackRef = useRef<ConnectorVisualFeedback | null>(null);
  const leaderLineToolRef = useRef<LeaderLineTool | null>(null);
  const bracketToolRef = useRef<BracketTool | null>(null);

  // Smart connector managers
  const connectionPointManagerRef = useRef<ConnectionPointManager | null>(null);
  const connectionSyncManagerRef = useRef<ConnectionSyncManager | null>(null);
  const lastConnectionPointUpdateRef = useRef<number>(0);

  // Object culling manager for viewport-based performance optimization
  const cullingManagerRef = useRef<ObjectCullingManager>(new ObjectCullingManager());
  const throttledCullRef = useRef<(() => void) | null>(null);

  // Grid and ruler state from zustand store
  const gridEnabled = useGridAndRulerStore((state) => state.gridEnabled);
  const gridPattern = useGridAndRulerStore((state) => state.gridPattern);
  const gridSize = useGridAndRulerStore((state) => state.gridSize);

  // Counter bumped when a real-time sync replaces the canvas, so
  // grid/ruler useEffects re-run and recreate their overlay objects.
  // syncVersion now managed by useSyncVersionListener hook

  const {
    canvas,
    setCanvas,
    setSelectedObject,
    firstSelectedObjectRef,
    backgroundColor,
    backgroundGradient,
    gradientStartColor,
    gradientEndColor,
    gradientType,
    gradientAngle,
    gradientCenterX,
    gradientCenterY,
    gradientRadius,
    canvasDimensions,
    canvasLoadVersion,
    zoom,
    textFont,
    textAlign,
    textUnderline,
    textOverline,
    textBold,
    textItalic,
    saveState,
    saveTransformDelta,
    isPerformingHistoryOperationRef,
    isBezierEditMode,
    setIsBezierEditMode,
    bezierEditModeRef,
    editingBezierPath,
    setEditingBezierPath,
    exitBezierEditMode,
    isCurvedLineEditMode,
    setIsCurvedLineEditMode,
    curvedLineEditModeRef,
    editingCurvedLine,
    setEditingCurvedLine,
    exitCurvedLineEditMode,
    isStraightLineEditMode,
    setIsStraightLineEditMode,
    straightLineEditModeRef,
    editingStraightLine,
    setEditingStraightLine,
    exitStraightLineEditMode,
    isOrthogonalLineEditMode,
    setIsOrthogonalLineEditMode,
    orthogonalLineEditModeRef,
    editingOrthogonalLine,
    setEditingOrthogonalLine,
    exitOrthogonalLineEditMode,
    isImageEditMode,
    exitImageEditMode,
    isMembraneEditMode,
    setIsMembraneEditMode,
    membraneEditModeRef,
    editingMembrane,
    setEditingMembrane,
    exitMembraneEditMode,
    isReadOnly,
    smartConnectorsEnabled,
    autoPathfindingEnabled,
    lineSnapThreshold,
  } = useCanvas();

  // Effective read-only: context isReadOnly OR the project is locked for this user
  const effectiveReadOnly = isReadOnly || (isLockedForEditing ?? false);
  // Ref so stale-closure handlers (registered once in a large useEffect) always
  // read the current lock state without needing to be in every dep array.
  const effectiveReadOnlyRef = useRef(effectiveReadOnly);
  useEffect(() => { effectiveReadOnlyRef.current = effectiveReadOnly; }, [effectiveReadOnly]);
  const saveTransformDeltaRef = useRef(saveTransformDelta);
  useEffect(() => { saveTransformDeltaRef.current = saveTransformDelta; }, [saveTransformDelta]);

  // Keyboard handler for Escape key in edit mode (extracted to hook)
  useEscapeEditMode({
    isBezierEditMode, exitBezierEditMode,
    isCurvedLineEditMode, exitCurvedLineEditMode,
    isStraightLineEditMode, exitStraightLineEditMode,
    isOrthogonalLineEditMode, exitOrthogonalLineEditMode,
    isImageEditMode, exitImageEditMode,
    isMembraneEditMode, exitMembraneEditMode,
  });

  // Exit edit mode on tool change (extracted to hook)
  useExitEditModeOnToolChange({
    activeTool,
    isBezierEditMode, exitBezierEditMode,
    isCurvedLineEditMode, exitCurvedLineEditMode,
    isStraightLineEditMode, exitStraightLineEditMode,
    isOrthogonalLineEditMode, exitOrthogonalLineEditMode,
    isImageEditMode, exitImageEditMode,
  });

  // Connection point visibility (extracted to hook)
  useConnectionPointVisibility(
    canvas, connectionPointManagerRef, activeTool, smartConnectorsEnabled,
    isStraightLineEditMode, isCurvedLineEditMode, isOrthogonalLineEditMode, isBezierEditMode
  );

  // Deselect on line tool activation (extracted to hook)
  useDeselectOnLineTool(canvas, activeTool);

  // Disable interaction in line edit mode (extracted to hook)
  useDisableInteractionInEditMode(canvas, isStraightLineEditMode, isCurvedLineEditMode, isOrthogonalLineEditMode, isBezierEditMode);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Track canvas reference and disposal state for proper cleanup
    let fabricCanvas: Canvas | null = null;
    let isDisposed = false;
    
    // Event handler references for cleanup
    let handleAddIcon: ((event: CustomEvent) => Promise<void>) | null = null;
    let handleAddAsset: ((event: CustomEvent) => Promise<void>) | null = null;
    let forceReleaseHandler: (() => void) | null = null;

    const initCanvas = async () => {
      // Load fonts before initializing canvas
      await loadAllFonts();
      
      // Check if component unmounted during async font loading
      if (isDisposed) return;
      
      // Set global control styles on FabricObject prototype (BioRender-style blue theme)
      FabricObject.prototype.cornerColor = '#3B82F6';        // Blue-500 corners
      FabricObject.prototype.cornerStrokeColor = '#ffffff';
      FabricObject.prototype.cornerStyle = 'rect';           // Use rect for grip-style rendering
      FabricObject.prototype.cornerSize = 12;                // Slightly larger for grip handles
      FabricObject.prototype.transparentCorners = false;
      FabricObject.prototype.borderColor = '#3B82F6';        // Blue selection border
      FabricObject.prototype.borderScaleFactor = 1.5;        // Thinner border
      FabricObject.prototype.borderDashArray = [6, 4];       // Dashed border for better visibility
      FabricObject.prototype.padding = 4;
      (FabricObject.prototype as any).hasRotatingPoint = true;        // Enable rotation handle globally
      (FabricObject.prototype as any).rotatingPointOffset = 45;       // Distance above object
      (FabricObject.prototype as any).hasControls = true;             // Ensure controls are visible

      // Custom arrow corner control renderer (diagonal resize arrows)
      const renderArrowCorner = (direction: 'nwse' | 'nesw') => (
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        _styleOverride: any,
        _fabricObject: any
      ) => {
        const size = 16;
        
        ctx.save();
        ctx.translate(left, top);
        
        // Draw circular background with shadow
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowOffsetY = 1;
        
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'hsl(215 20% 75%)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Reset shadow for arrow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Rotate based on direction (nwse = ↖↘, nesw = ↗↙)
        ctx.rotate(direction === 'nwse' ? -Math.PI / 4 : Math.PI / 4);
        
        // Draw double-headed arrow
        ctx.strokeStyle = 'hsl(215 15% 40%)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const arrowLength = 5;
        const headSize = 2.5;
        
        // Arrow line
        ctx.beginPath();
        ctx.moveTo(-arrowLength, 0);
        ctx.lineTo(arrowLength, 0);
        ctx.stroke();
        
        // Left arrow head
        ctx.beginPath();
        ctx.moveTo(-arrowLength + headSize, -headSize);
        ctx.lineTo(-arrowLength, 0);
        ctx.lineTo(-arrowLength + headSize, headSize);
        ctx.stroke();
        
        // Right arrow head
        ctx.beginPath();
        ctx.moveTo(arrowLength - headSize, -headSize);
        ctx.lineTo(arrowLength, 0);
        ctx.lineTo(arrowLength - headSize, headSize);
        ctx.stroke();
        
        ctx.restore();
      };

      // Custom arrow edge control renderer (horizontal or vertical resize arrows)
      const renderArrowEdge = (isHorizontal: boolean) => (
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        _styleOverride: any,
        _fabricObject: any
      ) => {
        const width = isHorizontal ? 22 : 14;
        const height = isHorizontal ? 14 : 22;
        
        ctx.save();
        ctx.translate(left, top);
        
        // Draw pill-shaped background with shadow
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowOffsetY = 1;
        
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'hsl(215 20% 75%)';
        ctx.lineWidth = 1;
        
        // Pill shape (rounded rectangle with large radius)
        const radius = Math.min(width, height) / 2;
        ctx.beginPath();
        ctx.moveTo(-width/2 + radius, -height/2);
        ctx.lineTo(width/2 - radius, -height/2);
        ctx.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + radius);
        ctx.lineTo(width/2, height/2 - radius);
        ctx.quadraticCurveTo(width/2, height/2, width/2 - radius, height/2);
        ctx.lineTo(-width/2 + radius, height/2);
        ctx.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - radius);
        ctx.lineTo(-width/2, -height/2 + radius);
        ctx.quadraticCurveTo(-width/2, -height/2, -width/2 + radius, -height/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Reset shadow for arrow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Rotate 90° for vertical edges
        if (!isHorizontal) {
          ctx.rotate(Math.PI / 2);
        }
        
        // Draw double-headed arrow (↔ or ↕)
        ctx.strokeStyle = 'hsl(215 15% 40%)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const arrowLength = 6;
        const headSize = 2.5;
        
        // Arrow line
        ctx.beginPath();
        ctx.moveTo(-arrowLength, 0);
        ctx.lineTo(arrowLength, 0);
        ctx.stroke();
        
        // Left arrow head
        ctx.beginPath();
        ctx.moveTo(-arrowLength + headSize, -headSize);
        ctx.lineTo(-arrowLength, 0);
        ctx.lineTo(-arrowLength + headSize, headSize);
        ctx.stroke();
        
        // Right arrow head
        ctx.beginPath();
        ctx.moveTo(arrowLength - headSize, -headSize);
        ctx.lineTo(arrowLength, 0);
        ctx.lineTo(arrowLength - headSize, headSize);
        ctx.stroke();
        
        ctx.restore();
      };

      // Apply custom grip renderers to default controls (with safety check)
      const defaultControls = FabricObject.prototype.controls;
      
      if (defaultControls) {
        // Corner controls with diagonal arrows (tl/br = nwse, tr/bl = nesw)
        if (defaultControls.tl) defaultControls.tl.render = renderArrowCorner('nwse');
        if (defaultControls.br) defaultControls.br.render = renderArrowCorner('nwse');
        if (defaultControls.tr) defaultControls.tr.render = renderArrowCorner('nesw');
        if (defaultControls.bl) defaultControls.bl.render = renderArrowCorner('nesw');
        
        // Edge controls with directional arrows (horizontal: mt, mb; vertical: ml, mr)
        if (defaultControls.mt) defaultControls.mt.render = renderArrowEdge(true);
        if (defaultControls.mb) defaultControls.mb.render = renderArrowEdge(true);
        if (defaultControls.ml) defaultControls.ml.render = renderArrowEdge(false);
        if (defaultControls.mr) defaultControls.mr.render = renderArrowEdge(false);
      }

      fabricCanvas = new Canvas(canvasRef.current!, {
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        backgroundColor: backgroundColor,
        controlsAboveOverlay: true,
        centeredScaling: false,
        centeredRotation: true,
        selection: !effectiveReadOnly, // Disable multi-select in read-only mode
        renderOnAddRemove: false, // Batch renders — call requestRenderAll() manually
        skipOffscreen: true, // Skip rendering objects outside viewport
      });

      // Configure read-only mode
      if (effectiveReadOnly) {
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.hoverCursor = 'default';
        fabricCanvas.moveCursor = 'default';
      }

      // Expose canvas to window for e2e testing
      if (typeof window !== 'undefined') {
        (window as any).fabricCanvas = fabricCanvas;
      }

      // Setup bridge mode rendering for line intersections
      setupIntersectionRendering(fabricCanvas);

      // Initialize smart connector managers
      connectionPointManagerRef.current = new ConnectionPointManager(fabricCanvas);
      connectionSyncManagerRef.current = new ConnectionSyncManager(fabricCanvas);

      // Expose connectionSyncManager on canvas for CanvasContext to use
      (fabricCanvas as any).connectionSyncManager = connectionSyncManagerRef.current;

      // Check again after canvas creation
      if (isDisposed) {
        fabricCanvas.dispose();
        return;
      }

    // Apply control styling to all objects added to canvas (grip-style handles)
    fabricCanvas.on('object:added', (e) => {
      if (e.target) {
        const targetData = e.target as any;

        // Skip grid and ruler objects - they should never have controls or be selectable
        if (targetData.isGridLine || targetData.isRuler) {
          return;
        }

        e.target.set({
          cornerColor: '#3B82F6',
          cornerStrokeColor: '#ffffff',
          cornerStyle: 'rect',
          cornerSize: 12,
          transparentCorners: false,
          borderColor: '#3B82F6',
          borderScaleFactor: 1.5,
          borderDashArray: [6, 4],
          padding: 4,
          hasControls: true,
          hasRotatingPoint: true,
        });

        // Apply custom arrow renderers to this object's controls
        if (e.target.controls) {
          if (e.target.controls.tl) e.target.controls.tl.render = renderArrowCorner('nwse');
          if (e.target.controls.br) e.target.controls.br.render = renderArrowCorner('nwse');
          if (e.target.controls.tr) e.target.controls.tr.render = renderArrowCorner('nesw');
          if (e.target.controls.bl) e.target.controls.bl.render = renderArrowCorner('nesw');
          if (e.target.controls.mt) e.target.controls.mt.render = renderArrowEdge(true);
          if (e.target.controls.mb) e.target.controls.mb.render = renderArrowEdge(true);
          if (e.target.controls.ml) e.target.controls.ml.render = renderArrowEdge(false);
          if (e.target.controls.mr) e.target.controls.mr.render = renderArrowEdge(false);
        }
        
        // Normalize fonts for text objects using helper
        if (e.target.type === "textbox" || e.target.type === "text") {
          const textObj = e.target as any;
          const base = getBaseFontName(textObj.fontFamily);
          textObj.fontFamily = getCanvasFontFamily(base);
        }
        
        // Also normalize text in groups using helper
        if (e.target.type === "group" && (e.target as any).getObjects) {
          (e.target as any).getObjects().forEach((child: any) => {
            if (child.type === "textbox" || child.type === "text") {
              const base = getBaseFontName(child.fontFamily);
              child.fontFamily = getCanvasFontFamily(base);
            }
          });
        }

        // Snap to grid if enabled (for all user-created objects)
        // Get current snap settings from canvas context via window
        const currentSnapToGrid = (window as any).canvasContext?.snapToGrid || false;
        const currentGridSize = (window as any).canvasContext?.gridSize || 20;
        if (currentSnapToGrid && !(e.target as any).isGridLine && !(e.target as any).isRuler) {
          const snappedLeft = Math.round((e.target.left || 0) / currentGridSize) * currentGridSize;
          const snappedTop = Math.round((e.target.top || 0) / currentGridSize) * currentGridSize;
          e.target.set({
            left: snappedLeft,
            top: snappedTop,
          });
          e.target.setCoords();
        }

        // Disable interaction with newly added objects if in line edit mode
        const isInLineEditMode = isStraightLineEditMode || isCurvedLineEditMode ||
                                 isOrthogonalLineEditMode || isBezierEditMode;
        const isUIElement = targetData.isAnchorHandle || targetData.isConnectionPoint ||
                           targetData.isControlHandle || targetData.isHandleLine ||
                           targetData.isTemp;

        if (isInLineEditMode && !isUIElement) {
          e.target.set({
            selectable: false,
            evented: false,
          });
        }

        // Save state for autosave (excludes UI elements like guides, handles, etc.)
        const isUIElementForSave = (targetData.isControlHandle || targetData.isHandleLine || targetData.isGuideLine);
        if (!isUIElementForSave && saveState) {
          // Use throttled version to avoid excessive saves during bulk operations
          setTimeout(() => saveState(), 0);
        }
      }
    });

    // Custom rotation control rendering (BioRender-style hand grab icon with hover glow)
    const renderRotationControl = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _styleOverride: any,
      fabricObject: any
    ) => {
      const size = 28;
      const isSelected = fabricObject.canvas?.getActiveObject() === fabricObject;
      const isRotating = (fabricObject as any).isRotating;
      
      // Enhanced glow when rotating or selected
      const glowIntensity = isRotating ? 16 : (isSelected ? 10 : 0);
      const opacity = isSelected ? 1.0 : 0.85;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(left, top);
      
      // Draw outer glow effect when selected (subtle blue glow)
      if (glowIntensity > 0) {
        ctx.shadowBlur = glowIntensity;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)'; // Blue glow
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw glow circle (slightly larger)
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, size / 2 + 3, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }
      
      // Reset and add subtle drop shadow for depth
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowOffsetY = 2;
      ctx.shadowOffsetX = 0;
      
      // Draw circular background (BioRender blue theme)
      ctx.fillStyle = isRotating ? '#2563EB' : '#3B82F6'; // Darker when rotating
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Reset shadow for icon drawing
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw hand/grab icon (simplified hand with fingers)
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Palm base (rounded rectangle)
      ctx.beginPath();
      ctx.moveTo(-4, 1);
      ctx.lineTo(-4, 5);
      ctx.quadraticCurveTo(-4, 6, -3, 6);
      ctx.lineTo(3, 6);
      ctx.quadraticCurveTo(4, 6, 4, 5);
      ctx.lineTo(4, 1);
      ctx.stroke();
      
      // Four fingers (vertical lines going up)
      const fingerX = [-3, -1, 1, 3];
      const fingerHeight = [-5, -6, -6, -5];
      fingerX.forEach((x, i) => {
        ctx.beginPath();
        ctx.moveTo(x, 1);
        ctx.lineTo(x, fingerHeight[i]);
        ctx.stroke();
      });
      
      // Thumb (angled to the left)
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(-6, 1);
      ctx.lineTo(-6, -1);
      ctx.stroke();
      
      ctx.restore();
      
      // Draw rotation angle label if object is being rotated
      if ((fabricObject as any).isRotating) {
        ctx.save();
        
        // Position label above the rotation handle
        const labelY = top - 25;
        
        // Normalize angle to 0-360 range
        let normalizedAngle = Math.round(fabricObject.angle || 0) % 360;
        if (normalizedAngle < 0) normalizedAngle += 360;
        
        const angleText = `${normalizedAngle}°`;
        
        // Measure text for background sizing
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        const textMetrics = ctx.measureText(angleText);
        const textWidth = textMetrics.width;
        const textHeight = 14;
        
        const padding = 6;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = textHeight + padding * 2;
        
        // Draw background with shadow
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#1a1a1a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        
        const cornerRadius = 4;
        const bgX = left - bgWidth / 2;
        const bgY = labelY - bgHeight / 2;
        
        ctx.beginPath();
        ctx.moveTo(bgX + cornerRadius, bgY);
        ctx.lineTo(bgX + bgWidth - cornerRadius, bgY);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + cornerRadius);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight - cornerRadius);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - cornerRadius, bgY + bgHeight);
        ctx.lineTo(bgX + cornerRadius, bgY + bgHeight);
        ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - cornerRadius);
        ctx.lineTo(bgX, bgY + cornerRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + cornerRadius, bgY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Reset shadow for text
        ctx.shadowBlur = 0;
        
        // Draw angle text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(angleText, left, labelY);
        
        ctx.restore();
      }
    };

    // Rotation action handler
    const rotationHandler = (eventData: MouseEvent, transform: any, x: number, y: number) => {
      const target = transform.target;
      const ex = x - target.getCenterPoint().x;
      const ey = y - target.getCenterPoint().y;
      const angle = Math.atan2(ey, ex) * (180 / Math.PI) - 90;

      target.angle = angle;
      (target as any).isRotating = true;
      target.canvas?.requestRenderAll();
      return true;
    };

    // Track when rotation ends to hide angle label
    fabricCanvas.on('mouse:up', () => {
      const activeObj = fabricCanvas?.getActiveObject();
      if (activeObj && (activeObj as any).isRotating) {
        (activeObj as any).isRotating = false;
        fabricCanvas?.requestRenderAll();
      }
    });

    // ── Hover highlight: show outline when mouse hovers over objects ──
    let hoveredObject: FabricObject | null = null;

    fabricCanvas.on('mouse:over', (e) => {
      const target = e.target;
      if (!target) return;
      const td = target as any;
      // Skip non-interactive objects
      if (td.isGridLine || td.isRuler || td.isMembraneIcon || !target.selectable || !target.evented) return;
      // Skip if already selected
      const active = fabricCanvas.getActiveObject();
      if (active === target) return;
      if (active && active.type === 'activeSelection' && (active as any)._objects?.includes(target)) return;

      hoveredObject = target;
      fabricCanvas.requestRenderAll();
    });

    fabricCanvas.on('mouse:out', (e) => {
      if (e.target && e.target === hoveredObject) {
        hoveredObject = null;
        fabricCanvas.requestRenderAll();
      }
    });

    // Clear hover when object becomes selected
    fabricCanvas.on('selection:created', () => {
      if (hoveredObject) {
        hoveredObject = null;
        fabricCanvas.requestRenderAll();
      }
    });
    fabricCanvas.on('selection:updated', () => {
      if (hoveredObject) {
        hoveredObject = null;
        fabricCanvas.requestRenderAll();
      }
    });

    // Create the Chemix-style rotation control
    const mtrControl = new Control({
      x: 0,
      y: -0.5,
      offsetY: -45,
      cursorStyle: 'grab',
      actionHandler: rotationHandler,
      actionName: 'rotate',
      render: renderRotationControl,
      withConnection: true,
      mouseDownHandler: () => {
        fabricCanvas?.setCursor('grabbing');
        return true;
      },
      mouseUpHandler: () => {
        fabricCanvas?.setCursor('grab');
        return true;
      },
    });

    // Apply custom rotation control to FabricObject prototype safely
    if (!FabricObject.prototype.controls) {
      FabricObject.prototype.controls = {};
    }
    
    FabricObject.prototype.controls.mtr = mtrControl;

    // Ensure all major object types share the same Chemix-style rotation control
    const rotationTargetClasses: any[] = [
      Rect,
      Circle,
      Ellipse,
      Polygon,
      Line,
      Path,
      Group,
      FabricImage,
      Textbox,
    ];

    rotationTargetClasses.forEach((Ctor) => {
      if (Ctor && Ctor.prototype) {
        if (!Ctor.prototype.controls) {
          Ctor.prototype.controls = {};
        }
        Ctor.prototype.controls.mtr = mtrControl;
      }
    });

    fabricCanvas.isDrawingMode = false;
    
    // Initialize connector visual feedback
    connectorFeedbackRef.current = new ConnectorVisualFeedback(fabricCanvas);
    
    // Initialize object culling manager
    cullingManagerRef.current.setCanvas(fabricCanvas);
    throttledCullRef.current = createThrottledCuller(cullingManagerRef.current, 100);
    
    // Culling is handled by the consolidated after:render handler below
    
    // Apply control styles to any existing objects on canvas (grip-style handles)
    fabricCanvas.getObjects().forEach((obj) => {
      const objData = obj as any;

      // Skip grid and ruler objects - they should never have controls
      if (objData.isGridLine || objData.isRuler) {
        return;
      }

      obj.set({
        cornerColor: '#3B82F6',
        cornerStrokeColor: '#ffffff',
        cornerStyle: 'rect',
        cornerSize: 12,
        transparentCorners: false,
        borderColor: '#3B82F6',
        borderDashArray: [6, 4],
      });
      // Apply custom arrow renderers to existing objects
      if (obj.controls) {
        if (obj.controls.tl) obj.controls.tl.render = renderArrowCorner('nwse');
        if (obj.controls.br) obj.controls.br.render = renderArrowCorner('nwse');
        if (obj.controls.tr) obj.controls.tr.render = renderArrowCorner('nesw');
        if (obj.controls.bl) obj.controls.bl.render = renderArrowCorner('nesw');
        if (obj.controls.mt) obj.controls.mt.render = renderArrowEdge(true);
        if (obj.controls.mb) obj.controls.mb.render = renderArrowEdge(true);
        if (obj.controls.ml) obj.controls.ml.render = renderArrowEdge(false);
        if (obj.controls.mr) obj.controls.mr.render = renderArrowEdge(false);
      }
    });
    fabricCanvas.requestRenderAll();
    
    // Set canvas to context only if not disposed
    if (!isDisposed) {
      setCanvas(fabricCanvas);
    }
    
    // Normalize all existing text objects with font stacks for special character support
    normalizeCanvasTextFonts(fabricCanvas);

    // Helper function to ensure Chemix rotation control is always present
    const ensureChemixRotationControl = (obj: FabricObject | any) => {
      if (!obj.controls) obj.controls = {};
      if (!obj.controls.mtr) {
        obj.controls.mtr = mtrControl;
      }
      obj.hasRotatingPoint = true;
      obj.hasControls = true;
      obj.rotatingPointOffset = 45;
      obj.setCoords();
    };

    // Apply rotation control to all existing objects
    fabricCanvas.getObjects().forEach((obj: FabricObject) => {
      const customObj = obj as any;
      if (!customObj.isControlHandle && !customObj.isHandleLine && !customObj.isGuideLine) {
        ensureChemixRotationControl(obj);
      }
    });
    fabricCanvas.requestRenderAll();

    // Helper function to manage curved line control handle visibility
    // Handles are only shown when in edit mode, not on selection
    const manageCurvedLineHandles = (selectedObj: FabricObject | null) => {
      // Manage handles for ALL curved lines on the canvas
      let hiddenCount = 0;
      let shownCount = 0;
      fabricCanvas?.getObjects().forEach((obj) => {
        if ((obj as any).isCurvedLine) {
          const curveData = obj as any;

          // If in edit mode: ensure handles are visible and interactive
          if (curveData.isEditMode) {
            if (curveData.controlHandle) {
              curveData.controlHandle.set({
                visible: true,
                selectable: true,
                evented: true,
              });
              shownCount++;
            }
            if (curveData.handleLines) {
              curveData.handleLines.forEach((line: any) => {
                line.set({
                  visible: true,
                  selectable: false,
                  evented: false,
                  hasControls: false,
                  hasBorders: false,
                });
              });
            }
          } else {
            // If NOT in edit mode: hide handles
            if (curveData.controlHandle) {
              curveData.controlHandle.set({
                visible: false,
                selectable: false,
                evented: false,
              });
              hiddenCount++;
            }
            if (curveData.handleLines) {
              curveData.handleLines.forEach((line: any) => {
                line.set({
                  visible: false,
                  selectable: false,
                  evented: false,
                });
              });
            }
          }
        }
      });

      fabricCanvas?.requestRenderAll();
    };

    const manageStraightLineHandles = (selectedObj: FabricObject | null) => {
      // Manage handles for ALL straight lines on the canvas.
      // Control handles and guide lines (used for curve adjustment) are always kept hidden
      // from the user. Straight line edit mode uses its own endpoint anchor handles
      // (created by StraightLineEditMode.activate()), not the curve control handle.
      fabricCanvas?.getObjects().forEach((obj) => {
        if ((obj as any).isStraightLine) {
          const lineData = obj as any;

          // Always keep control handle and guide lines hidden
          if (lineData.controlHandle) {
            lineData.controlHandle.set({
              visible: false,
              selectable: false,
              evented: false,
            });
          }
          if (lineData.handleLines) {
            lineData.handleLines.forEach((line: any) => {
              line.set({
                visible: false,
                selectable: false,
                evented: false,
              });
            });
          }
        }
      });

      fabricCanvas?.requestRenderAll();
    };

    const manageOrthogonalLineHandles = (selectedObj: FabricObject | null) => {
      // Manage handles for ALL orthogonal lines on the canvas
      let shownCount = 0;
      let hiddenCount = 0;
      fabricCanvas?.getObjects().forEach((obj) => {
        if ((obj as any).isOrthogonalLine) {
          const lineData = obj as any;

          // If in edit mode: ensure handles are visible and interactive
          if (lineData.isEditMode && lineData.anchorHandles) {
            lineData.anchorHandles.forEach((handle: any) => {
              handle.set({
                visible: true,
                selectable: true,
                evented: true,
                hasControls: false,
                hasBorders: false,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
                lockSkewingX: true,
                lockSkewingY: true,
                hoverCursor: 'move',
              });
              handle.setControlsVisibility({
                tl: false,
                tr: false,
                br: false,
                bl: false,
                ml: false,
                mt: false,
                mr: false,
                mb: false,
                mtr: false,
              });
              shownCount++;
            });
          } else if (lineData.anchorHandles) {
            // If NOT in edit mode: hide handles
            lineData.anchorHandles.forEach((handle: any) => {
              handle.set({
                visible: false,
                selectable: false,
                evented: false,
              });
              hiddenCount++;
            });
          }
        }
      });

      fabricCanvas?.requestRenderAll();
    };

    // Dynamic group shadow — only visible while the group is selected
    const GROUP_SHADOW = new Shadow({
      color: 'rgba(59, 130, 246, 0.25)',
      blur: 12,
      offsetX: 0,
      offsetY: 0,
    });
    let lastShadowedGroup: FabricObject | null = null;

    const applyGroupShadow = (selected: FabricObject | null) => {
      // Remove shadow from previously shadowed group
      if (lastShadowedGroup && lastShadowedGroup !== selected) {
        lastShadowedGroup.set({ shadow: null });
        delete (lastShadowedGroup as any)._selectionShadow;
        lastShadowedGroup = null;
      }
      // Apply shadow only to user-created groups (not library icons which are also Fabric Groups)
      if (selected && selected.type === 'group' && (selected as any).isUserGroup) {
        selected.set({ shadow: GROUP_SHADOW });
        (selected as any)._selectionShadow = true;
        lastShadowedGroup = selected;
      }
    };

    // Track selected objects with debug and auto-fix for invisible text
    fabricCanvas.on('selection:created', (e) => {
      // Prevent selection of grid lines and rulers
      if (e.selected && e.selected.some((obj: any) => obj.isGridLine || obj.isRuler)) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        return;
      }

      // Prevent selection of individual membrane icons
      if (e.selected && e.selected.some((obj: any) => obj.isMembraneIcon)) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        toast.info("Edit membrane as a whole, not individual icons");
        return;
      }

      const rawSelected = e.selected?.[0] || null;
      let uiSelected: FabricObject | null = rawSelected;

      // If a control handle or guide line is selected, map to parent curved line for the UI
      if (rawSelected && ((rawSelected as any).isControlHandle || (rawSelected as any).isHandleLine)) {
        const parentCurve = fabricCanvas?.getObjects().find(obj => {
          const curveData = obj as any;
          return curveData.isCurvedLine &&
                 (curveData.controlHandle === rawSelected ||
                  curveData.handleLines?.includes(rawSelected));
        }) as FabricObject | undefined;

        if (parentCurve) {
          uiSelected = parentCurve;
        } else {
          // Check for straight line parent
          const parentLine = fabricCanvas?.getObjects().find(obj => {
            const lineData = obj as any;
            return lineData.isStraightLine &&
                   (lineData.controlHandle === rawSelected ||
                    lineData.handleLines?.includes(rawSelected));
          }) as FabricObject | undefined;

          uiSelected = parentLine ?? null;
        }
      }

      // Track first selected object for match width/height operations
      firstSelectedObjectRef.current = rawSelected;

      // Debug selection details
      if (uiSelected) {
        // Ensure rotation control is present
        ensureChemixRotationControl(uiSelected);
      }

      // UI uses uiSelected (parent curve/line for handles)
      setSelectedObject(uiSelected);
      applyGroupShadow(fabricCanvas.getActiveObject() ?? null);
      manageCurvedLineHandles(uiSelected);
      manageStraightLineHandles(uiSelected);
      manageOrthogonalLineHandles(uiSelected);

      // Debug text object properties
      debugTextObject(uiSelected, "Selection Created");

      // Auto-fix invisible text
      if (uiSelected && fixInvisibleText(uiSelected, fabricCanvas!)) {
        toast.info("Fixed invisible text (reset opacity/fill)");
      }
    });

    fabricCanvas.on('selection:updated', (e) => {
      // Prevent selection of grid lines and rulers
      if (e.selected && e.selected.some((obj: any) => obj.isGridLine || obj.isRuler)) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        return;
      }

      // Prevent selection of individual membrane icons
      if (e.selected && e.selected.some((obj: any) => obj.isMembraneIcon)) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        toast.info("Edit membrane as a whole, not individual icons");
        return;
      }

      const rawSelected = e.selected?.[0] || null;
      let uiSelected: FabricObject | null = rawSelected;

      // If a control handle or guide line is selected, map to parent curved line for the UI
      if (rawSelected && ((rawSelected as any).isControlHandle || (rawSelected as any).isHandleLine)) {
        const parentCurve = fabricCanvas?.getObjects().find(obj => {
          const curveData = obj as any;
          return curveData.isCurvedLine &&
                 (curveData.controlHandle === rawSelected ||
                  curveData.handleLines?.includes(rawSelected));
        }) as FabricObject | undefined;

        if (parentCurve) {
          uiSelected = parentCurve;
        } else {
          // Check for straight line parent
          const parentLine = fabricCanvas?.getObjects().find(obj => {
            const lineData = obj as any;
            return lineData.isStraightLine &&
                   (lineData.controlHandle === rawSelected ||
                    lineData.handleLines?.includes(rawSelected));
          }) as FabricObject | undefined;

          uiSelected = parentLine ?? null;
        }
      }

      // Debug selection details
      if (uiSelected) {
        // Ensure rotation control is present
        ensureChemixRotationControl(uiSelected);
        fabricCanvas?.requestRenderAll();
      }

      // UI uses uiSelected (parent curve/line for handles)
      setSelectedObject(uiSelected);
      applyGroupShadow(fabricCanvas.getActiveObject() ?? null);
      manageCurvedLineHandles(uiSelected);
      manageStraightLineHandles(uiSelected);
      manageOrthogonalLineHandles(uiSelected);

      // Debug text object properties
      debugTextObject(uiSelected, "Selection Updated");
      
      // Auto-fix invisible text
      if (uiSelected && fixInvisibleText(uiSelected, fabricCanvas!)) {
        toast.info("Fixed invisible text (reset opacity/fill)");
      }
    });
    
    // Track the last selected object before selection is cleared
    let lastSelectedObject: any = null;
    fabricCanvas.on('selection:created', (e) => {
      // Ignore grid lines and rulers
      if (e.selected?.[0] && !((e.selected[0] as any).isGridLine || (e.selected[0] as any).isRuler)) {
        lastSelectedObject = e.selected[0];
      }
    });
    fabricCanvas.on('selection:updated', (e) => {
      // Ignore grid lines and rulers
      if (e.selected?.[0] && !((e.selected[0] as any).isGridLine || (e.selected[0] as any).isRuler)) {
        lastSelectedObject = e.selected[0];
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      setSelectedObject(null);
      applyGroupShadow(null);
      manageCurvedLineHandles(null);
      manageStraightLineHandles(null);
      manageOrthogonalLineHandles(null);

      // Clear first selected object tracking
      firstSelectedObjectRef.current = null;

      // Exit edit mode when selection is cleared, UNLESS we just cleared an anchor/control handle
      // (which happens when clicking between anchor points)
      if (isBezierEditMode) {
        const wasEditModeHandle = lastSelectedObject?.isAnchorHandle || lastSelectedObject?.isControlHandle;
        if (!wasEditModeHandle) {
          exitBezierEditMode();
        }
      }

      lastSelectedObject = null;
    });

    // Normalize fonts when text editing starts
    fabricCanvas.on('text:editing:entered', (e: any) => {
      if (e.target) {
        normalizeEditingTextFont(e.target);
        fabricCanvas?.requestRenderAll();
      }
    });

    // Normalize fonts when text content changes (safety net)
    fabricCanvas.on('text:changed', (e: any) => {
      const target = e.target;
      if (target && (target.type === 'textbox' || target.type === 'text')) {
        normalizeEditingTextFont(target);
        target.dirty = true;
        fabricCanvas?.requestRenderAll();
      }
    });

    // Finalize fonts and layout when exiting edit mode
    fabricCanvas.on('text:editing:exited', (e: any) => {
      const target = e.target;
      if (target && (target.type === 'textbox' || target.type === 'text')) {
        normalizeEditingTextFont(target);
        if (typeof target.initDimensions === 'function') {
          target.initDimensions();
        }

        // Update callout label if editing a legend entry
        if ((target as any).calloutId) {
          const calloutId = (target as any).calloutId;
          const newLabel = target.text || '';

          // Update the callout's label
          const registry = (fabricCanvas as any).calloutRegistry as Map<string, any> | undefined;
          if (registry) {
            const entry = registry.get(calloutId);
            if (entry && entry.group) {
              (entry.group as any).calloutLabel = newLabel;
            }
          }

          // Rebuild legend to reflect changes
          createOrUpdateLegend(fabricCanvas);
        }
        if (typeof target.setCoords === 'function') {
          target.setCoords();
        }
        target.dirty = true;
        fabricCanvas?.requestRenderAll();
      }
    });

    // Comment tool — fire onCommentClick with canvas + screen coordinates.
    // Uses refs so the handler always reads the current activeTool/callback
    // even though this listener is registered only once at mount.
    fabricCanvas.on('mouse:down', (e) => {
      if (activeToolRef.current === 'comment' && onCommentClickRef.current && e.pointer) {
        onCommentClickRef.current(e.pointer.x, e.pointer.y, (e.e as MouseEvent).clientX, (e.e as MouseEvent).clientY);
      }
    });

    // Viewport change detection is handled by the consolidated after:render handler below
    let _lastVptStr = '';

    // Alt+Drag duplication handlers
    fabricCanvas.on('mouse:down', async (e) => {
      const activeObject = fabricCanvas?.getActiveObject();

      if (e.e.altKey && activeObject && activeTool === 'select') {
        e.e.preventDefault();
        
        try {
          const cloned = await activeObject.clone();
          cloned.set({
            left: (activeObject.left || 0) + 10,
            top: (activeObject.top || 0) + 10,
            evented: true,
          });
          cloned.setCoords();
          // Preserve library icon metadata so clones get reference-based
          // save/reload (fresh SVG re-parse) instead of raw Group JSON
          // serialization which produces distorted path rendering on reload.
          const src = activeObject as any;
          if (src.iconId) (cloned as any).iconId = src.iconId;
          if (src.isLibraryIcon) (cloned as any).isLibraryIcon = true;
          if (src.iconToneColor) (cloned as any).iconToneColor = src.iconToneColor;
          if (src.iconToneIntensity !== undefined) (cloned as any).iconToneIntensity = src.iconToneIntensity;
          if (src.iconToneHue !== undefined) (cloned as any).iconToneHue = src.iconToneHue;
          if (src.originalColors) (cloned as any).originalColors = new Map(src.originalColors);

          // Wait for nested image elements to decode before rendering
          await awaitNestedImageDecode(cloned);

          fabricCanvas?.add(cloned);
          fabricCanvas?.setActiveObject(cloned);
          clonedObjectRef.current = cloned;
          setIsDuplicating(true);
          fabricCanvas?.requestRenderAll();
        } catch (error) {
          console.error('Failed to clone object:', error);
        }
      }
    });

    fabricCanvas.on('mouse:up', () => {
      if (isDuplicating) {
        setIsDuplicating(false);
        clonedObjectRef.current = null;
        toast.success("Object duplicated", { duration: 1000, className: 'animate-fade-in' });
      }
    });

    // Handle text box resize - track scaling state to avoid feedback loops
    let isScalingTextBox = false;

    fabricCanvas.on('object:scaling', (e) => {
      if (e.target && isTextBox(e.target)) {
        isScalingTextBox = true;
      }
      // Sync endpoint markers for line objects (throttled during continuous transforms)
      syncMarkersThrottled(e.target);
    });

    fabricCanvas.on('object:rotating', (e) => {
      // Sync endpoint markers for line objects (throttled during continuous transforms)
      syncMarkersThrottled(e.target);
    });

    fabricCanvas.on('mouse:up', () => {
      if (isScalingTextBox) {
        const obj = fabricCanvas?.getActiveObject();
        if (obj && isTextBox(obj)) {
          handleTextBoxResize(obj);
          fabricCanvas?.requestRenderAll();
        }
        isScalingTextBox = false;
      }
    });

    // Helper function to handle image placeholder file selection
    const handleImagePlaceholderClick = (placeholderObj: FabricObject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      // Track if file was selected to prevent premature removal
      let fileSelected = false;
      
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        fileSelected = true;

        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            
            // Load image with CORS handling
            const imgElement = await loadImageWithCORS(dataUrl);
            
            // Get placeholder bounds and position
            const placeholderLeft = placeholderObj.left || 0;
            const placeholderTop = placeholderObj.top || 0;
            const placeholderWidth = placeholderObj.getScaledWidth();
            const placeholderHeight = placeholderObj.getScaledHeight();
            
            // Create new FabricImage
            const fabricImage = new FabricImage(imgElement, {
              left: placeholderLeft,
              top: placeholderTop,
              scaleX: placeholderWidth / imgElement.width,
              scaleY: placeholderHeight / imgElement.height,
              crossOrigin: 'anonymous',
            });
            
            // Remove placeholder and add image only after successful load
            fabricCanvas?.remove(placeholderObj);
            fabricCanvas?.add(fabricImage);
            fabricCanvas?.setActiveObject(fabricImage);
            fabricCanvas?.requestRenderAll();
            
            toast.success("Image added successfully!");
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error("Error loading image:", error);
          toast.error("Failed to load image");
        }
      };
      
      // Handle cancel - keep placeholder intact
      input.addEventListener('cancel', () => {
        // File picker was cancelled, placeholder stays
      });
      
      input.click();
    };

    // Handle single-click on selected image placeholder (click again to add image)
    let lastPlaceholderClickTime = 0;
    let lastClickedPlaceholder: FabricObject | null = null;
    
    fabricCanvas.on('mouse:down', (e) => {
      const obj = e.target;
      
      // Check if clicking on an image placeholder
      if (obj && (obj as any).isImagePlaceholder) {
        const now = Date.now();
        
        // If same placeholder clicked within 400ms, treat as double-click
        if (lastClickedPlaceholder === obj && now - lastPlaceholderClickTime < 400) {
          handleImagePlaceholderClick(obj);
          lastClickedPlaceholder = null;
          lastPlaceholderClickTime = 0;
          return;
        }
        
        // First click - just select it and record
        lastClickedPlaceholder = obj;
        lastPlaceholderClickTime = now;
      } else {
        // Clicked elsewhere, reset
        lastClickedPlaceholder = null;
        lastPlaceholderClickTime = 0;
      }
    });

    // Handle double-click for image placeholders, text box editing, and bezier paths
    fabricCanvas.on('mouse:dblclick', (e) => {
      const obj = e.target;

      // Check if ANY edit mode is currently active (check both state AND refs for immediate feedback)
      const isInAnyEditMode =
        isBezierEditMode ||
        isCurvedLineEditMode ||
        isStraightLineEditMode ||
        isOrthogonalLineEditMode ||
        isMembraneEditMode ||
        isImageEditMode ||
        bezierEditModeRef.current?.isActive?.() ||
        curvedLineEditModeRef.current?.isActive?.() ||
        straightLineEditModeRef.current?.isActive?.() ||
        orthogonalLineEditModeRef.current?.isActive?.() ||
        membraneEditModeRef.current?.isActive?.();

      // If already in any edit mode, double-clicking the canvas background exits edit mode
      if (isInAnyEditMode) {
        if (!obj) {
          // Double-clicked on empty canvas - exit whichever edit mode is active
          // NOTE: For bezier and membrane edit modes, double-click is also used to add
          // anchor points. Fabric.js may not resolve the path as the target (e.target
          // is null) even when clicking near it. Let BezierEditMode's handler run first
          // (synchronously, after this handler). It sets lastDblClickHandled=true if it
          // added a point. We check that flag after a microtask to decide whether to exit.
          if (isBezierEditMode || bezierEditModeRef.current?.isActive?.()) {
            if (bezierEditModeRef.current) bezierEditModeRef.current.lastDblClickHandled = false;
            Promise.resolve().then(() => {
              if (!bezierEditModeRef.current?.lastDblClickHandled) exitBezierEditMode();
            });
          } else if (isMembraneEditMode || membraneEditModeRef.current?.isActive?.()) {
            const pathEditMode = (membraneEditModeRef.current as any)?.pathEditMode;
            if (pathEditMode) pathEditMode.lastDblClickHandled = false;
            Promise.resolve().then(() => {
              if (!pathEditMode?.lastDblClickHandled) exitMembraneEditMode();
            });
          } else if (isCurvedLineEditMode || curvedLineEditModeRef.current?.isActive?.()) {
            exitCurvedLineEditMode();
          } else if (isStraightLineEditMode || straightLineEditModeRef.current?.isActive?.()) {
            exitStraightLineEditMode();
          } else if (isOrthogonalLineEditMode || orthogonalLineEditModeRef.current?.isActive?.()) {
            exitOrthogonalLineEditMode();
          } else if (isImageEditMode) {
            exitImageEditMode();
          }
        }
        return;
      }

      // Check edit mode states
      const isAlreadyInBezierEditMode = isBezierEditMode || !!bezierEditModeRef.current?.path;
      const isAlreadyInMembraneEditMode = isMembraneEditMode || !!membraneEditModeRef.current?.isActive?.();

      // Handle DNA helix double-click - enter path edit mode
      if (obj && (obj as any).isDNAHelix && !isMembraneEditMode) {
        saveState();

        import('@/lib/dnaHelixEditMode').then(async ({ DNAHelixEditMode }) => {
          membraneEditModeRef.current = new DNAHelixEditMode(fabricCanvas, undefined, saveState);
          await membraneEditModeRef.current.activate(obj as any);
          setIsMembraneEditMode(true);
          setEditingMembrane(obj);
          toast.info("DNA helix edit mode. Drag anchors to reshape spine.");
        });
        return;
      }

      // Handle triple membrane double-click - enter path edit mode
      // Check BEFORE regular membranes since triple membranes also have isRasterizedMembrane
      if (obj && (obj as any).isTripleMembrane && !isMembraneEditMode) {
        saveState();

        import('@/lib/tripleMembraneEditMode').then(async ({ TripleMembraneEditMode }) => {
          // Store in the same ref - TripleMembraneEditMode has the same interface
          membraneEditModeRef.current = new TripleMembraneEditMode(fabricCanvas, undefined, saveState);
          await membraneEditModeRef.current.activate(obj as any);
          setIsMembraneEditMode(true);
          setEditingMembrane(obj);
          toast.info("Triple membrane edit mode. Double-click path to add points, drag anchors to reshape.");
        });
        return;
      }

      // Handle membrane shape double-click - enter edit mode
      // IMPORTANT: Check this BEFORE isBezierPath since membranes also store bezier points
      // Check for both vector membranes (isMembraneShape) and rasterized membranes (isRasterizedMembrane)
      if (obj && ((obj as any).isMembraneShape || (obj as any).isRasterizedMembrane) && !(obj as any).isTripleMembrane && !isMembraneEditMode) {
        saveState();

        // Dynamically import MembraneEditMode
        import('@/lib/membraneEditMode').then(async ({ MembraneEditMode }) => {
          // Always create a fresh MembraneEditMode — the ref may hold a stale
          // TripleMembraneEditMode or DNAHelixEditMode from a previous session
          membraneEditModeRef.current = new MembraneEditMode(fabricCanvas, undefined, saveState);

          await membraneEditModeRef.current.activate(obj as any);
          setIsMembraneEditMode(true);
          setEditingMembrane(obj);
          toast.info("Membrane edit mode active. Edit path or icons.");
        });
        return;
      }

      // Handle bezier path double-click - enter edit mode (unless already in edit mode)
      if (obj && (obj as any).isBezierPath) {
        // If in membrane edit mode, let the membrane's BezierEditMode handle the double-click
        // The virtual path has excludeFromExport=true to distinguish it from regular bezier paths
        if (isAlreadyInMembraneEditMode) {
          // Let the membrane edit mode's BezierEditMode handler process this for adding anchor points
          return;
        }
        if (isAlreadyInBezierEditMode) {
          // Let the bezierEditMode handler process this for adding anchor points
          return;
        }
        // Create or reuse BezierEditMode with saveState callback (uses ref, no stale closures)
        if (!bezierEditModeRef.current) {
          bezierEditModeRef.current = new BezierEditMode(fabricCanvas, undefined, saveState);
        }
        bezierEditModeRef.current.activate(obj as any);
        // Restore original stroke so the line is visible during edit mode
        if ((obj as any).gradientConfig) {
          // Line presets from the DB carry gradientConfig but no gradientOriginalStroke,
          // so the stroke restore below would be skipped and the line would vanish during
          // edit mode (_gradientHidden also disables the overlay). Seed a fallback from
          // the first gradient stop so the line stays visible; persisting it here also
          // lets the exit path (which guards on gradientOriginalStroke) re-hide the
          // stroke correctly when the user leaves edit mode.
          if (!(obj as any).gradientOriginalStroke) {
            (obj as any).gradientOriginalStroke =
              (obj as any).gradientConfig?.stops?.[0]?.color ?? '#000000';
          }
          const pathChild = (obj as any).mainPath
            ?? (obj as any)._objects?.find((c: any) => c.type === 'path' || c.type === 'line')
            ?? obj;
          (pathChild as any).set('stroke', (obj as any).gradientOriginalStroke);
        }
        (obj as any)._gradientHidden = true;
        setIsBezierEditMode(true);
        setEditingBezierPath(obj);
        toast.info("Edit mode active. Double-click path to add points, drag anchors to reshape.");
        return;
      }

      // Handle curved line double-click - enter edit mode (unless already in edit mode)
      if (obj && (obj as any).isCurvedLine && !isCurvedLineEditMode) {
        // Create or reuse CurvedLineEditMode with saveState callback
        if (!curvedLineEditModeRef.current) {
          curvedLineEditModeRef.current = new CurvedLineEditMode(fabricCanvas, saveState);
        }
        curvedLineEditModeRef.current.activate(obj as any);
        // Restore original stroke so the line is visible during edit mode
        if ((obj as any).gradientConfig) {
          // Line presets from the DB carry gradientConfig but no gradientOriginalStroke,
          // so the stroke restore below would be skipped and the line would vanish during
          // edit mode (_gradientHidden also disables the overlay). Seed a fallback from
          // the first gradient stop so the line stays visible; persisting it here also
          // lets the exit path (which guards on gradientOriginalStroke) re-hide the
          // stroke correctly when the user leaves edit mode.
          if (!(obj as any).gradientOriginalStroke) {
            (obj as any).gradientOriginalStroke =
              (obj as any).gradientConfig?.stops?.[0]?.color ?? '#000000';
          }
          const pathChild = (obj as any).mainPath
            ?? (obj as any)._objects?.find((c: any) => c.type === 'path' || c.type === 'line')
            ?? obj;
          (pathChild as any).set('stroke', (obj as any).gradientOriginalStroke);
        }
        (obj as any)._gradientHidden = true;
        setIsCurvedLineEditMode(true);
        setEditingCurvedLine(obj);
        // Force handle visibility update
        manageCurvedLineHandles(obj);
        toast.info("Edit mode active. Drag control point to adjust curve.");
        return;
      }

      // Handle straight line double-click - enter edit mode (unless already in edit mode)
      if (obj && (obj as any).isStraightLine && !isStraightLineEditMode) {
        // Create or reuse StraightLineEditMode with saveState callback
        if (!straightLineEditModeRef.current) {
          straightLineEditModeRef.current = new StraightLineEditMode(fabricCanvas, saveState);
        }
        straightLineEditModeRef.current.activate(obj as any);
        // Restore original stroke so the line is visible during edit mode
        if ((obj as any).gradientConfig) {
          // Line presets from the DB carry gradientConfig but no gradientOriginalStroke,
          // so the stroke restore below would be skipped and the line would vanish during
          // edit mode (_gradientHidden also disables the overlay). Seed a fallback from
          // the first gradient stop so the line stays visible; persisting it here also
          // lets the exit path (which guards on gradientOriginalStroke) re-hide the
          // stroke correctly when the user leaves edit mode.
          if (!(obj as any).gradientOriginalStroke) {
            (obj as any).gradientOriginalStroke =
              (obj as any).gradientConfig?.stops?.[0]?.color ?? '#000000';
          }
          const pathChild = (obj as any).mainPath
            ?? (obj as any)._objects?.find((c: any) => c.type === 'path' || c.type === 'line')
            ?? obj;
          (pathChild as any).set('stroke', (obj as any).gradientOriginalStroke);
        }
        (obj as any)._gradientHidden = true;
        setIsStraightLineEditMode(true);
        setEditingStraightLine(obj);
        // Force handle visibility update
        manageStraightLineHandles(obj);
        toast.info("Edit mode active. Drag control point to adjust curve.");
        return;
      }

      // Handle orthogonal line double-click - enter edit mode (unless already in edit mode)
      if (obj && (obj as any).isOrthogonalLine && !isOrthogonalLineEditMode) {
        // Create or reuse OrthogonalLineEditMode with saveState callback
        if (!orthogonalLineEditModeRef.current) {
          orthogonalLineEditModeRef.current = new OrthogonalLineEditMode(fabricCanvas, saveState);
        }
        orthogonalLineEditModeRef.current.activate(obj as any);
        // Restore original stroke so the line is visible during edit mode
        if ((obj as any).gradientConfig) {
          // Line presets from the DB carry gradientConfig but no gradientOriginalStroke,
          // so the stroke restore below would be skipped and the line would vanish during
          // edit mode (_gradientHidden also disables the overlay). Seed a fallback from
          // the first gradient stop so the line stays visible; persisting it here also
          // lets the exit path (which guards on gradientOriginalStroke) re-hide the
          // stroke correctly when the user leaves edit mode.
          if (!(obj as any).gradientOriginalStroke) {
            (obj as any).gradientOriginalStroke =
              (obj as any).gradientConfig?.stops?.[0]?.color ?? '#000000';
          }
          const pathChild = (obj as any).mainPath
            ?? (obj as any)._objects?.find((c: any) => c.type === 'path' || c.type === 'line')
            ?? obj;
          (pathChild as any).set('stroke', (obj as any).gradientOriginalStroke);
        }
        (obj as any)._gradientHidden = true;
        setIsOrthogonalLineEditMode(true);
        setEditingOrthogonalLine(obj);
        // Note: activate() already makes handles visible and calls renderAll()
        // No need to call manageOrthogonalLineHandles here
        toast.info("Edit mode active. Drag waypoints to adjust path.");
        return;
      }

      // Handle generic shape double-click — convert to bezier path and enter edit mode
      // Synchronous type check first to avoid blocking other handlers
      if (obj && !isBezierEditMode && !bezierEditModeRef.current?.isActive?.() &&
          (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' ||
           obj.type === 'polygon' || obj.type === 'triangle') &&
          !(obj as any).isBezierPath && !(obj as any).isMembraneShape &&
          !(obj as any).isRasterizedMembrane && !(obj as any).isTripleMembrane &&
          !(obj as any).isDNAHelix && !(obj as any).excludeFromExport &&
          !(obj as any).isImagePlaceholder && !(obj as any).group &&
          (obj as any).customType !== 'table' && (obj as any).customType !== 'chart') {
        import('@/lib/shapeToBezierPath').then(({ isEditableShape, convertShapeToBezierPath }) => {
          if (!isEditableShape(obj)) return;
          saveState();
          const bezierPath = convertShapeToBezierPath(obj, fabricCanvas);
          if (bezierPath) {
            if (!bezierEditModeRef.current) {
              bezierEditModeRef.current = new BezierEditMode(fabricCanvas, undefined, saveState);
            }
            bezierEditModeRef.current.activate(bezierPath as any);
            setIsBezierEditMode(true);
            setEditingBezierPath(bezierPath);
            toast.info("Shape converted to editable path. Drag anchors to reshape.");
          }
        });
        return;
      }

      // Handle image placeholder double-click - open file picker
      if (obj && (obj as any).isImagePlaceholder) {
        handleImagePlaceholderClick(obj);
        return;
      }

      // Handle table cell editing — always use coordinate math to find the cell
      if (obj && (obj as any).customType === 'table') {
        const cfg = (obj as any).tableConfig;
        if (!cfg) return;

        // Transform click point into the group's local coordinate space
        const pointer = fabricCanvas.getScenePoint(e.e);
        const groupMatrix = obj.calcTransformMatrix();
        const inv = util.invertTransform(groupMatrix);
        const local = util.transformPoint(new Point(pointer.x, pointer.y), inv);

        // In local coords, group center is (0,0). Objects were placed at
        // (0..totalW, titleH..titleH+tableH) then the group shifted them
        // so the center is at (totalW/2, totalH/2). So local (0,0) maps
        // to the center of the table.
        const totalW = cfg.cols * cfg.cellWidth;
        const titleH = cfg.title ? 28 : 0;
        const totalH = cfg.rows * cfg.cellHeight + titleH;

        const tableX = local.x + totalW / 2;
        const tableY = local.y + totalH / 2;

        const col = Math.floor(tableX / cfg.cellWidth);
        const row = Math.floor((tableY - titleH) / cfg.cellHeight);

        if (row >= 0 && row < cfg.rows && col >= 0 && col < cfg.cols) {
          const children = (obj as any)._objects || obj.getObjects();
          const cellTarget = children.find((o: any) =>
            o.isTableCell && o.cellRow === row && o.cellCol === col
          );

          if (cellTarget) {
            const tableGroup = obj;
            fabricCanvas.setActiveObject(cellTarget);
            (cellTarget as any).enterEditing();
            fabricCanvas.requestRenderAll();

            const onExit = () => {
              cellTarget.off('editing:exited', onExit);
              const r = (cellTarget as any).cellRow as number;
              const c = (cellTarget as any).cellCol as number;
              const tc = (tableGroup as any).tableConfig;
              if (tc?.cellData?.[r]) {
                tc.cellData[r][c] = cellTarget.text || '';
              }
              fabricCanvas.setActiveObject(tableGroup);
              fabricCanvas.requestRenderAll();
              saveState();
            };
            cellTarget.on('editing:exited', onExit);
          }
        }
        return;
      }

      // Handle legend label editing
      if (obj && (obj as any).isLegendLabel && obj.type === 'textbox') {
        (obj as any).enterEditing();
        (obj as any).selectAll?.();
        fabricCanvas?.requestRenderAll();
        return;
      }

      // Handle text box editing
      if (obj && isTextBox(obj)) {
        const textElement = getTextBoxTextElement(obj);
        if (textElement) {
          fabricCanvas?.setActiveObject(textElement);
          textElement.enterEditing();
          textElement.selectAll();
          fabricCanvas?.requestRenderAll();
        }
      }
    });

    // Track drag state to prevent intermediate saves
    let isDragging = false;

    // Store original opacity before transformations to preserve user settings
    fabricCanvas.on('mouse:down', (e) => {
      if (e.target && !originalOpacityMapRef.current.has(e.target)) {
        originalOpacityMapRef.current.set(e.target, e.target.opacity || 1);
      }
      // Mark that we're potentially starting a drag
      if (e.target && !((e.target as any).isGridLine || (e.target as any).isRuler)) {
        isDragging = true;
      }
    });

    // Track multi-object drag operations
    fabricCanvas.on('mouse:down', (e) => {
      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj && activeObj.type === 'activeSelection') {
        activeDragRef.current = {
          isMultiObject: true,
          startTime: Date.now()
        };
        // Set global flag to block history saves during drag
        (window as any).isDraggingObject = true;
      }
    });

    // Canvas-level marker sync — robust fallback that works regardless of
    // whether object-level sync handlers are attached (handles undo/redo,
    // group/ungroup, and ActiveSelection moves).
    // Computes fresh world-space endpoints from path geometry + transform matrix,
    // bypassing stored coordinates which may be stale.
    const syncMarkersForObject = (obj: any) => {
      if (!obj || (!obj.startMarker && !obj.endMarker)) return;
      if (!obj.path || obj.path.length < 2) return;

      const pathData = obj.path;
      const pathOffset = obj.pathOffset || { x: 0, y: 0 };
      const matrix = obj.calcTransformMatrix();

      // Extract first and last points from path data
      const firstCmd = pathData[0];
      const lastCmd = pathData[pathData.length - 1];
      const localStart = {
        x: firstCmd[1] - pathOffset.x,
        y: firstCmd[2] - pathOffset.y,
      };
      const localEnd = {
        x: lastCmd[lastCmd.length - 2] - pathOffset.x,
        y: lastCmd[lastCmd.length - 1] - pathOffset.y,
      };

      const worldStart = util.transformPoint(new Point(localStart.x, localStart.y), matrix);
      const worldEnd = util.transformPoint(new Point(localEnd.x, localEnd.y), matrix);

      // Also update stored coordinates so other sync functions stay consistent
      if (obj.isStraightLine) {
        obj.straightLineStart = { x: worldStart.x, y: worldStart.y };
        obj.straightLineEnd = { x: worldEnd.x, y: worldEnd.y };
      } else if (obj.isCurvedLine) {
        obj.curvedLineStart = { x: worldStart.x, y: worldStart.y };
        obj.curvedLineEnd = { x: worldEnd.x, y: worldEnd.y };
      }

      if (obj.startMarker) {
        obj.startMarker.set({ left: worldStart.x, top: worldStart.y });
        obj.startMarker.setCoords();
      }
      if (obj.endMarker) {
        obj.endMarker.set({ left: worldEnd.x, top: worldEnd.y });
        obj.endMarker.setCoords();
      }
    };

    // Recursively collect all lines with markers from a container
    const collectLinesRecursive = (container: any): any[] => {
      const result: any[] = [];
      if (!container || typeof container.getObjects !== 'function') return result;
      container.getObjects().forEach((child: any) => {
        if (child.startMarker || child.endMarker) result.push(child);
        if (child.type === 'group') result.push(...collectLinesRecursive(child));
      });
      return result;
    };

    const syncMarkersForTarget = (target: any) => {
      if (!target) return;
      // Direct line object
      syncMarkersForObject(target);
      // ActiveSelection or Group: sync markers for all contained lines (recursively)
      if ((target.type === 'activeSelection' || target.type === 'group') &&
          typeof target.getObjects === 'function') {
        collectLinesRecursive(target).forEach((line: any) => syncMarkersForObject(line));
      }
    };

    // Throttled version for continuous transforms (moving/scaling/rotating).
    // Batches marker sync to at most once per animation frame.
    let _markerSyncRafId: number | null = null;
    let _markerSyncTarget: any = null;
    const syncMarkersThrottled = (target: any) => {
      _markerSyncTarget = target;
      if (_markerSyncRafId === null) {
        _markerSyncRafId = requestAnimationFrame(() => {
          _markerSyncRafId = null;
          if (_markerSyncTarget) {
            syncMarkersForTarget(_markerSyncTarget);
            _markerSyncTarget = null;
          }
        });
      }
    };

    // Add drag feedback and snap-to-grid
    fabricCanvas.on('object:moving', (e) => {
      if (e.target) {
        // Mark that we're dragging - prevents history saves during drag
        if (!activeDragRef.current) {
          activeDragRef.current = { isMultiObject: false };
          // Set global flag to block history saves during drag
          (window as any).isDraggingObject = true;
        }

        e.target.set({ opacity: 0.85 }); // Slightly transparent while dragging

        // Snap to grid if enabled - access current values from canvas context
        const currentSnapToGrid = (window as any).canvasContext?.snapToGrid || false;
        const currentGridSize = (window as any).canvasContext?.gridSize || 20;

        if (currentSnapToGrid) {
          const snappedLeft = Math.round((e.target.left || 0) / currentGridSize) * currentGridSize;
          const snappedTop = Math.round((e.target.top || 0) / currentGridSize) * currentGridSize;
          e.target.set({
            left: snappedLeft,
            top: snappedTop,
          });
          e.target.setCoords(); // Update coordinates for proper rendering
        }

        // Update connection points for this object if connection point manager is active
        if (connectionPointManagerRef.current?.active) {
          connectionPointManagerRef.current.updateForObject(e.target);
        }

        // Update any lines attached to this object
        // Skip if this is a programmatic update to prevent infinite loops
        if (connectionSyncManagerRef.current && !(e.target as any)._skipTransformSync) {
          connectionSyncManagerRef.current.updateAttachedLines(e.target);
        }

        // Sync endpoint markers for line objects (throttled during drag)
        syncMarkersThrottled(e.target);
      }
    });

    fabricCanvas.on('object:modified', (e) => {
      // Clear drag flag - drag is complete
      isDragging = false;

      if (e.target) {
        // Restore original opacity instead of hardcoding to 1
        const originalOpacity = originalOpacityMapRef.current.get(e.target);
        if (originalOpacity !== undefined) {
          e.target.set({ opacity: originalOpacity });
          originalOpacityMapRef.current.delete(e.target);
        }

        // Fix rounded rectangle corner distortion after resize
        const transformAction = (e as any).transform?.action;
        const isScaleAction = transformAction && ['scale', 'scaleX', 'scaleY'].includes(transformAction);
        if (isScaleAction) {
          if (e.target.type === 'rect' && (e.target as any).rx > 0) {
            // Standalone rounded rect
            const rect = e.target as any;
            const newWidth = rect.width * rect.scaleX;
            const newHeight = rect.height * rect.scaleY;
            rect.set({
              width: newWidth,
              height: newHeight,
              scaleX: 1,
              scaleY: 1,
            });
            rect.setCoords();
          } else if (e.target.type === 'group' && !isChart(e.target)) {
            // Special resize for colored-text-box groups (rounded rect + textbox)
            // so the rect grows AND the textbox reflows at the new width.
            // Detecting "has a rounded rect" alone catches library icons whose
            // SVG happens to contain a rounded rect child — those should scale
            // normally as a group, not have only their rect children width-
            // multiplied (which distorts the icon because paths/circles don't
            // honor width/height the same way rects do).
            const group = e.target as any;
            const objects = group.getObjects?.() || [];
            const roundedRect = objects.find((obj: any) => obj.type === 'rect' && obj.rx > 0);
            const hasTextChild = objects.some((obj: any) => obj.type === 'textbox' || obj.type === 'i-text');
            const isIconOrComposite = group.isLibraryIcon || group.isMembraneShape ||
              group.isTripleMembrane || group.isDNAHelix || group.isUserGroup;
            if (roundedRect && hasTextChild && !isIconOrComposite) {
              const groupScaleX = group.scaleX;
              const groupScaleY = group.scaleY;
              const newGroupWidth = group.width * groupScaleX;
              const newGroupHeight = group.height * groupScaleY;
              // Resize each child proportionally instead of scaling the group
              for (const obj of objects) {
                obj.set({
                  width: obj.width * groupScaleX,
                  height: obj.height * groupScaleY,
                  scaleX: 1,
                  scaleY: 1,
                });
                obj.setCoords();
              }
              group.set({
                width: newGroupWidth,
                height: newGroupHeight,
                scaleX: 1,
                scaleY: 1,
              });
              group.setCoords();
            }
          }
        }

        // Flush any pending throttled marker sync and do a final exact sync
        if (_markerSyncRafId !== null) {
          cancelAnimationFrame(_markerSyncRafId);
          _markerSyncRafId = null;
          _markerSyncTarget = null;
        }
        syncMarkersForTarget(e.target);

        // Update any lines attached to this object (final update after modification complete)
        // Skip if this is a programmatic update to prevent infinite loops
        if (connectionSyncManagerRef.current && !(e.target as any)._skipTransformSync) {
          connectionSyncManagerRef.current.updateAttachedLines(e.target);
        }

        // Update endpoint markers if this is a line object
        const targetData = e.target as any;
        if (targetData.startMarkerType || targetData.endMarkerType) {
          // Check if this is a line type that can have markers
          if (targetData.isStraightLine || targetData.isCurvedLine ||
              targetData.isOrthogonalLine || targetData.isBezierPath || targetData.isArcPath) {
            updateEndpointMarkers(
              fabricCanvas,
              e.target,
              targetData.startMarkerType || 'none',
              targetData.endMarkerType || 'none'
            );
          }
        }

        fabricCanvas?.requestRenderAll();

        // Log all relevant properties for debugging
        // Don't save state for edit mode handles OR objects being edited
        const isEditModeHandle = (e.target as any).excludeFromExport ||
                                  (e.target as any).isAnchorHandle ||
                                  (e.target as any).isControlHandle;

        const isObjectBeingEdited = (e.target as any).isEditMode === true;

        if (isEditModeHandle) {
          return;
        }

        if (isObjectBeingEdited) {
          return;
        }

        // Auto re-render charts after scaling so they redraw at the new dimensions
        // instead of just stretching the SVG. Similar to triple membrane regeneration.
        if (isChart(e.target) &&
            (e as any).transform?.action &&
            ['scale', 'scaleX', 'scaleY'].includes((e as any).transform.action)) {
          if (activeDragRef.current) {
            activeDragRef.current = null;
            (window as any).isDraggingObject = false;
          }
          const chartGroup = e.target as any;
          const chartConfig = chartGroup.chartConfig;
          if (chartConfig) {
            const newWidth = Math.round(chartGroup.width * chartGroup.scaleX);
            const newHeight = Math.round(chartGroup.height * chartGroup.scaleY);
            (async () => {
              try {
                await ChartTool.updateChart(chartGroup, fabricCanvas, chartConfig);
                // The new chart preserves scaleX/scaleY from the old one,
                // but we want actual re-render at new dimensions, so reset scale.
                const newChart = fabricCanvas.getActiveObject() as any;
                if (newChart && isChart(newChart)) {
                  const svgString = await (await import('@/lib/chartRenderer')).renderPlotlyChartToSVG(chartConfig, newWidth, newHeight);
                  const { objects, options } = await (await import('fabric')).loadSVGFromString(svgString);
                  if (objects && objects.length > 0) {
                    const { util } = await import('fabric');
                    const freshGroup = util.groupSVGElements(objects, options);
                    freshGroup.set({
                      left: newChart.left,
                      top: newChart.top,
                      width: newWidth,
                      height: newHeight,
                      angle: newChart.angle || 0,
                      scaleX: 1,
                      scaleY: 1,
                      originX: newChart.originX,
                      originY: newChart.originY,
                      selectable: true,
                      hasControls: true,
                      hasBorders: true,
                      lockScalingFlip: true,
                    });
                    (freshGroup as any).customType = 'chart';
                    (freshGroup as any).chartConfig = chartConfig;

                    const idx = fabricCanvas.getObjects().indexOf(newChart);
                    fabricCanvas.remove(newChart);
                    fabricCanvas.add(freshGroup);
                    if (idx >= 0) {
                      fabricCanvas.moveObjectTo(freshGroup, idx);
                    }
                    fabricCanvas.setActiveObject(freshGroup);
                    fabricCanvas.requestRenderAll();
                  }
                }
                saveState();
              } catch (err) {
                console.error('Failed to re-render chart after scaling:', err);
                saveState();
              }
            })();
            return;
          }
        }

        // Auto-regenerate triple membranes after scaling to maintain constant band width.
        // When the user resizes (scales) a triple membrane, the raster image stretches the
        // bands. Regenerating rebuilds the bands at the configured pixel width on the new shape.
        if (targetData.isTripleMembrane &&
            (e as any).transform?.action &&
            ['scale', 'scaleX', 'scaleY'].includes((e as any).transform.action)) {
          // Clear drag state before async work
          if (activeDragRef.current) {
            activeDragRef.current = null;
            (window as any).isDraggingObject = false;
          }
          (async () => {
            try {
              await TripleMembranePathTool.regenerate(fabricCanvas, e.target as any);
              fabricCanvas.requestRenderAll();
              saveState();
            } catch (err) {
              console.error('Failed to regenerate triple membrane after scaling:', err);
            }
          })();
          return; // Skip normal saveState — it runs after regeneration above
        }


        // Save state on drop (after drag completes)
        // Try fast-path delta first — skips full canvas serialization for simple transforms
        const modifyAction = (e as any).transform?.action;
        const usedFastPath = e.target && modifyAction
          ? saveTransformDeltaRef.current(e.target, modifyAction)
          : false;

        if (!usedFastPath) {
          // Complex operation or fast path unavailable — full serialization
          if (activeDragRef.current) {
            activeDragRef.current = null;
            (window as any).isDraggingObject = false;
          }
          saveState();
        } else {
          // Fast path succeeded — just clear drag state
          if (activeDragRef.current) {
            activeDragRef.current = null;
            (window as any).isDraggingObject = false;
          }
        }
      }
    });

    // Fallback cleanup if object:modified doesn't fire
    fabricCanvas.on('mouse:up', () => {
      // Clear drag flag - mouse released
      isDragging = false;

      if (activeDragRef.current) {
        // Fallback save if object:modified didn't fire
        setTimeout(() => {
          if (activeDragRef.current) {
            activeDragRef.current = null;
            (window as any).isDraggingObject = false;
            saveState();
          }
        }, 100);
      }
    });

    // Safety net: force-release stuck transforms on freeform paths.
    // PencilBrush-created paths can sometimes retain Fabric.js's internal
    // _currentTransform after mouseup, causing the object to stay attached
    // to the cursor. A raw document-level mouseup listener ensures the
    // transform is always cleared.
    forceReleaseHandler = () => {
      const ct = (fabricCanvas as any)._currentTransform;
      if (ct && ct.target && (ct.target as any).isFreeformLine) {
        // Finalize position and clear the stuck transform
        ct.target.setCoords();
        (fabricCanvas as any)._currentTransform = null;
        fabricCanvas.requestRenderAll();

        // Clear drag flags
        if (activeDragRef.current) {
          activeDragRef.current = null;
          (window as any).isDraggingObject = false;
        }
        saveState();
      }
    };
    document.addEventListener('mouseup', forceReleaseHandler);

    // Track the last selected callout to detect when it's deselected
    let lastSelectedCallout: any = null;
    let legendUpdateTimeout: NodeJS.Timeout | null = null;

    // Debounced legend update function
    const scheduleLegendUpdate = () => {
      if (legendUpdateTimeout) {
        clearTimeout(legendUpdateTimeout);
      }
      legendUpdateTimeout = setTimeout(() => {
        createOrUpdateLegend(fabricCanvas);
        legendUpdateTimeout = null;
      }, 100);
    };

    fabricCanvas.on('selection:created', (e) => {
      // Ignore grid lines and rulers
      if (e.selected && e.selected[0] && !((e.selected[0] as any).isGridLine || (e.selected[0] as any).isRuler) && isCallout(e.selected[0])) {
        lastSelectedCallout = e.selected[0];
      }
    });

    fabricCanvas.on('selection:updated', (e) => {
      // When selection changes from a callout, update legend
      if (lastSelectedCallout && isCallout(lastSelectedCallout)) {
        scheduleLegendUpdate();
      }

      // Ignore grid lines and rulers
      if (e.selected && e.selected[0] && !((e.selected[0] as any).isGridLine || (e.selected[0] as any).isRuler) && isCallout(e.selected[0])) {
        lastSelectedCallout = e.selected[0];
      } else {
        lastSelectedCallout = null;
      }
    });

    fabricCanvas.on('selection:cleared', (e) => {
      // When a callout is deselected, update legend to reflect any style changes
      if (lastSelectedCallout && isCallout(lastSelectedCallout)) {
        scheduleLegendUpdate();
        lastSelectedCallout = null;
      }
    });

    // Listen for any changes to callout objects
    fabricCanvas.on('object:modified', (e) => {
      if (e.target && isCallout(e.target)) {
        scheduleLegendUpdate();
      }
    });

    // === Consolidated after:render handler ===
    // All post-render work in a single listener to avoid multiple event dispatch overhead.
    // Helper: draw padlock at a bounding rect position
    const drawPadlock = (ctx: CanvasRenderingContext2D, bound: { left: number; top: number; width: number; height: number }, locked: boolean) => {
      const iconSize = 14;
      const padding = 5;
      const x = bound.left + bound.width - iconSize - padding;
      const y = bound.top + padding;
      const cx = x + iconSize / 2;
      const cy = y + iconSize / 2;

      ctx.save();

      // Background circle
      ctx.beginPath();
      ctx.arc(cx, cy, iconSize / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = locked ? 'rgba(59, 130, 246, 0.85)' : 'rgba(107, 114, 128, 0.7)';
      ctx.fill();

      // Icon styling
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (locked) {
        // Closed shackle (full U arch)
        ctx.beginPath();
        ctx.arc(cx, cy - 1.5, 2.6, Math.PI, 0, false);
        ctx.stroke();
      } else {
        // Open shackle (left side lifts up)
        ctx.beginPath();
        ctx.moveTo(cx - 2.6, cy - 1.5);
        ctx.lineTo(cx - 2.6, cy - 4.5);
        ctx.arc(cx, cy - 4.5, 2.6, Math.PI, 0, false);
        ctx.lineTo(cx + 2.6, cy - 1.5);
        ctx.stroke();
      }

      // Lock body
      const bw = 7;
      const bh = 5.5;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, cy + 0.5, bw, bh, 1.2);
      ctx.fill();

      ctx.restore();
    };

    fabricCanvas.on('after:render', (e: any) => {
      // NOTE: Culling removed from after:render to fix invisible objects bug.
      // Culling now only runs on explicit pan/zoom via useCanvasZoom hook.
      // Running it here caused race conditions with save/export visibility changes.

      // Viewport change detection
      const vpt = fabricCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const vptStr = vpt.join(',');
      if (vptStr !== _lastVptStr) {
        _lastVptStr = vptStr;
        onViewportChangeRef.current?.(vpt as number[]);
      }

      // 3. Legend update for selected callout (already debounced)
      if (lastSelectedCallout && isCallout(lastSelectedCallout)) {
        scheduleLegendUpdate();
      }

      // 4 & 5. Single pass over all objects for gradients + padlocks
      // Use the event ctx so gradients draw on the correct canvas during exports
      const allObjects = fabricCanvas.getObjects();
      drawAllLineGradients(fabricCanvas, allObjects, e?.ctx);

      const ctx = fabricCanvas.getContext();
      const activeObj = fabricCanvas.getActiveObject();

      if (activeObj && activeObj.type !== 'activeSelection') {
        const objData = activeObj as any;
        if (!objData.isGridLine && !objData.isRuler) {
          const pinned = objData.pinned || false;
          drawPadlock(ctx, activeObj.getBoundingRect(), pinned);
        }
      }

      // Draw hover highlight outline
      if (hoveredObject && hoveredObject.canvas) {
        // Don't draw if object is now selected
        const currentActive = fabricCanvas.getActiveObject();
        if (currentActive !== hoveredObject &&
            !(currentActive && currentActive.type === 'activeSelection' && (currentActive as any)._objects?.includes(hoveredObject))) {
          const bound = hoveredObject.getBoundingRect();
          const pad = 4;
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue-500 at 50% opacity
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(
            bound.left - pad,
            bound.top - pad,
            bound.width + pad * 2,
            bound.height + pad * 2
          );
          ctx.restore();
        }
      }
    });

    // Clean up opacity map when objects are removed to prevent memory leaks
    fabricCanvas.on('object:removed', (e) => {
      if (e.target) {
        originalOpacityMapRef.current.delete(e.target);

        const targetData = e.target as any;

        // Skip all side effects during undo/redo restore to avoid
        // mutating the canvas while it is being reconstructed.
        if (!isPerformingHistoryOperationRef.current) {
          // Remove endpoint markers if a line is deleted
          if (targetData.isStraightLine || targetData.isCurvedLine || targetData.isOrthogonalLine || targetData.isBezierPath || targetData.isArcPath) {
            removeEndpointMarkers(fabricCanvas, e.target);
          }

          // Remove orphaned edit-mode handles (control handles, guide lines,
          // anchor handles) that were added as separate canvas objects.
          // Without this, deleting a line leaves ghost green dots/lines.
          if (targetData.isCurvedLine || targetData.isStraightLine || targetData.isOrthogonalLine || targetData.isBezierPath || targetData.isArcPath) {
            const handleObjects: any[] = [];
            if (targetData.controlHandle) handleObjects.push(targetData.controlHandle);
            if (targetData.handleLines) {
              for (const hl of targetData.handleLines) {
                if (hl) handleObjects.push(hl);
              }
            }
            if (targetData.startAnchorHandle) handleObjects.push(targetData.startAnchorHandle);
            if (targetData.endAnchorHandle) handleObjects.push(targetData.endAnchorHandle);
            for (const h of handleObjects) {
              if (fabricCanvas.contains(h)) {
                fabricCanvas.remove(h);
              }
            }
          }

          // Renumber callouts if a callout was deleted
          if (isCallout(e.target)) {
            const registry = (fabricCanvas as any).calloutRegistry as Map<string, any> | undefined;
            if (registry) {
              const calloutId = targetData.calloutId;
              registry.delete(calloutId);
              renumberCallouts(fabricCanvas);
              createOrUpdateLegend(fabricCanvas);
            }
          }
        }

        // Save state for undo/redo after object removal.
        // Skip for: grid/ruler, drag operations, transient/derived objects,
        // and during undo/redo restore operations.
        const isTransient = targetData.isGridLine || targetData.isRuler ||
          targetData.isEndpointMarker || targetData.isControlHandle ||
          targetData.isHandleLine || targetData.isAnchorHandle ||
          targetData.isGuideLine || targetData.excludeFromExport ||
          targetData.isConnectionPoint || targetData.isPortIndicator || targetData.isFeedback;

        if (!isTransient && !isDragging) {
          saveState();
        }
      }
    });

    fabricCanvas.on('mouse:move', (e) => {
      // Broadcast cursor position to other collaborators
      if (onCursorMove && e.pointer) {
        onCursorMove(e.pointer.x, e.pointer.y);
      }

      // Update connection point reference for distance-based filtering
      // Throttle to max 10 updates per second (100ms) for performance
      const isLineTool = activeTool.startsWith('straight-line') ||
                         activeTool.startsWith('curved-line') ||
                         activeTool.startsWith('orthogonal-line') ||
                         activeTool === 'bezier';

      if (isLineTool && connectionPointManagerRef.current?.active && e.pointer) {
        const now = Date.now();
        if (now - lastConnectionPointUpdateRef.current > 100) {
          connectionPointManagerRef.current.setReferencePoint(e.pointer.x, e.pointer.y);
          connectionPointManagerRef.current.refresh();
          lastConnectionPointUpdateRef.current = now;
        }
      }

      if (activeTool === 'select') {
        const activeObj = fabricCanvas?.getActiveObject();

        // Check if hovering over rotation control
        if (activeObj && (activeObj as any).__corner === 'mtr') {
          const isRotating = (activeObj as any).isRotating;
          fabricCanvas?.setCursor(isRotating ? 'grabbing' : 'grab');
          return;
        }

        // Alt key for copy cursor
        if (e.e.altKey && activeObj) {
          fabricCanvas?.setCursor('copy');
        }
      }
    });


    // Helper: load an embedded raster data URL as a FabricImage on the canvas
    const addRasterIconToCanvas = async (imgDataUrl: string, iconId?: string) => {
      const fabricImg = await FabricImage.fromURL(imgDataUrl);
      const maxW = (fabricCanvas?.width || 0) * 0.6;
      const maxH = (fabricCanvas?.height || 0) * 0.6;
      const scale = Math.min(maxW / (fabricImg.width || 1), maxH / (fabricImg.height || 1), 1);
      fabricImg.scale(scale);
      fabricImg.set({
        left: (fabricCanvas?.width || 0) / 2 - (fabricImg.width || 0) * scale / 2,
        top: (fabricCanvas?.height || 0) / 2 - (fabricImg.height || 0) * scale / 2,
      });
      if (iconId) {
        (fabricImg as any).iconId = iconId;
        (fabricImg as any).isLibraryIcon = true;
      }
      fabricCanvas?.add(fabricImg);
      fabricCanvas?.setActiveObject(fabricImg);
      fabricCanvas?.requestRenderAll();
    };

    // Listen for custom event to add icons to canvas
    handleAddIcon = async (event: CustomEvent) => {
      const { svgData, iconId, canvasData } = event.detail;

      try {
        // Group icon — deserialize the entire group object preserving relative positions
        if (canvasData && canvasData.groupObject) {
          const groupJSON = canvasData.groupObject;

          // Reconstruct any libraryIcon references nested inside the group
          const reconstructNestedIcons = async (objects: any[]) => {
            for (const objData of objects) {
              // Recurse into nested groups
              if (objData.objects) {
                await reconstructNestedIcons(objData.objects);
              }
              if (objData.type === 'libraryIcon' && objData.iconId) {
                try {
                  const { data: iconData } = await supabase
                    .from('icons')
                    .select('svg_content')
                    .eq('id', objData.iconId)
                    .single();

                  if (iconData?.svg_content) {
                    const svgResult = await loadSVGFromString(iconData.svg_content);
                    const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);
                    const originalType = objData.originalType || 'Group';
                    const normalizedType = originalType.toLowerCase();

                    if (normalizedType === 'group') {
                      objData.objects = tempGroup.toObject().objects;
                      objData.type = originalType;
                    } else if (normalizedType === 'path' && tempGroup._objects?.[0]) {
                      objData.path = tempGroup._objects[0].toObject().path;
                      objData.type = originalType;
                    } else if (normalizedType === 'image') {
                      const src = (tempGroup.type === 'image' || tempGroup.type === 'Image')
                        ? tempGroup.toObject().src
                        : tempGroup._objects?.[0]?.toObject()?.src;
                      if (src) {
                        objData.src = src;
                        objData.crossOrigin = 'anonymous';
                        objData.type = originalType;
                      } else {
                        objData.objects = tempGroup.toObject().objects;
                        objData.type = 'Group';
                      }
                    } else {
                      objData.objects = tempGroup.toObject().objects;
                      objData.type = 'Group';
                    }
                  }
                } catch (e) {
                  console.error(`Failed to reconstruct nested icon ${objData.iconId}:`, e);
                }
              }
            }
          };

          if (groupJSON.objects) {
            await reconstructNestedIcons(groupJSON.objects);
          }

          // Enliven the whole group as a single object — preserves relative positions
          // In Fabric v6, enlivenObjects returns a Promise directly
          let enlivened: any[];
          try {
            enlivened = await (util as any).enlivenObjects([groupJSON]);
          } catch (enlivenError) {
            console.error('[GroupIcon] Failed to enliven group:', enlivenError);
            console.error('[GroupIcon] Group JSON child types:', groupJSON.objects?.map((o: any) => o.type));
            toast.error('Failed to load group icon');
            return;
          }

          if (enlivened.length === 0) {
            toast.error("Failed to load group icon");
            return;
          }

          const group = enlivened[0];

          // Restore custom properties on all children recursively.
          // enlivenObjects reconstructs standard Fabric properties but ignores
          // custom ones (line types, marker types, etc.). restoreObjectCustomProps
          // copies them from the raw serialised data onto the live objects.
          try {
            const { restoreObjectCustomProps } = await import('@/lib/canvasPostProcessing');
            const restoreChildrenRecursive = (liveObjects: any[], rawDataArray: any[]) => {
              if (!liveObjects || !rawDataArray) return;
              for (let i = 0; i < liveObjects.length && i < rawDataArray.length; i++) {
                try {
                  restoreObjectCustomProps(liveObjects[i], rawDataArray[i]);
                } catch (e) {
                  console.warn('[GroupIcon] Failed to restore props on child', i, e);
                }
                // Recurse into nested groups
                if (liveObjects[i]._objects && rawDataArray[i].objects) {
                  restoreChildrenRecursive(liveObjects[i]._objects, rawDataArray[i].objects);
                }
              }
            };
            if (group._objects && groupJSON.objects) {
              restoreChildrenRecursive(group._objects, groupJSON.objects);
            }
          } catch (e) {
            console.warn('[GroupIcon] Failed to restore custom properties:', e);
          }

          // Scale to fit within 60% of canvas area
          const maxW = (fabricCanvas?.width || 0) * 0.6;
          const maxH = (fabricCanvas?.height || 0) * 0.6;
          const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
          group.scale(scale);

          group.set({
            left: (fabricCanvas?.width || 0) / 2 - (group.width || 0) * scale / 2,
            top: (fabricCanvas?.height || 0) / 2 - (group.height || 0) * scale / 2,
          });

          // Mark as user group so it can be ungrouped
          (group as any).isUserGroup = true;

          // Wait for nested image elements to decode before rendering
          await awaitNestedImageDecode(group);

          fabricCanvas?.add(group);
          fabricCanvas?.setActiveObject(group);

          // Recreate endpoint markers for any lines inside the group.
          // Markers are separate top-level canvas objects, not group children.
          // Wrapped in try/catch to not block group placement if marker creation fails.
          try {
          const { applyEndpointMarkers } = await import('@/lib/lineEndpointRenderer');
          const collectLinesRecursive = (container: any): any[] => {
            const result: any[] = [];
            if (!container?._objects) return result;
            for (const child of container._objects) {
              if (child.startMarkerType || child.endMarkerType) {
                result.push(child);
              }
              if (child.type === 'group' && child._objects) {
                result.push(...collectLinesRecursive(child));
              }
            }
            return result;
          };

          const linesWithMarkers = collectLinesRecursive(group);
          if (linesWithMarkers.length > 0 && fabricCanvas) {
            // Create markers for each line
            for (const lineChild of linesWithMarkers) {
              const startType = lineChild.startMarkerType || 'none';
              const endType = lineChild.endMarkerType || 'none';
              if (startType !== 'none' || endType !== 'none') {
                applyEndpointMarkers(fabricCanvas, lineChild, startType, endType);
              }
            }

            // Attach sync handler so markers move with the group
            const syncGroupLineMarkers = () => {
              for (const lineChild of collectLinesRecursive(group)) {
                if (!lineChild.startMarker && !lineChild.endMarker) continue;
                const worldMatrix = lineChild.calcTransformMatrix();
                const pathData = lineChild.path;
                if (!pathData || pathData.length < 2) continue;
                const pathOffset = lineChild.pathOffset || { x: 0, y: 0 };
                const firstCmd = pathData[0];
                const lastCmd = pathData[pathData.length - 1];
                const localStart = { x: firstCmd[1] - pathOffset.x, y: firstCmd[2] - pathOffset.y };
                const localEnd = { x: lastCmd[lastCmd.length - 2] - pathOffset.x, y: lastCmd[lastCmd.length - 1] - pathOffset.y };
                const worldStart = util.transformPoint(new Point(localStart.x, localStart.y), worldMatrix);
                const worldEnd = util.transformPoint(new Point(localEnd.x, localEnd.y), worldMatrix);
                let startAngle: number, endAngle: number;
                if (pathData.length > 2) {
                  const secondCmd = pathData[1];
                  const ls = { x: (secondCmd[1] || secondCmd[secondCmd.length - 2]) - pathOffset.x, y: (secondCmd[2] || secondCmd[secondCmd.length - 1]) - pathOffset.y };
                  const ws = util.transformPoint(new Point(ls.x, ls.y), worldMatrix);
                  startAngle = Math.atan2(worldStart.y - ws.y, worldStart.x - ws.x) * 180 / Math.PI;
                  const slCmd = pathData[pathData.length - 2];
                  const le = { x: (slCmd[slCmd.length - 2] || firstCmd[1]) - pathOffset.x, y: (slCmd[slCmd.length - 1] || firstCmd[2]) - pathOffset.y };
                  const we = util.transformPoint(new Point(le.x, le.y), worldMatrix);
                  endAngle = Math.atan2(worldEnd.y - we.y, worldEnd.x - we.x) * 180 / Math.PI;
                } else {
                  startAngle = Math.atan2(worldStart.y - worldEnd.y, worldStart.x - worldEnd.x) * 180 / Math.PI;
                  endAngle = Math.atan2(worldEnd.y - worldStart.y, worldEnd.x - worldStart.x) * 180 / Math.PI;
                }
                if (lineChild.startMarker) {
                  lineChild.startMarker.set({ left: worldStart.x, top: worldStart.y, angle: startAngle });
                  lineChild.startMarker.setCoords();
                }
                if (lineChild.endMarker) {
                  lineChild.endMarker.set({ left: worldEnd.x, top: worldEnd.y, angle: endAngle });
                  lineChild.endMarker.setCoords();
                }
              }
              fabricCanvas?.requestRenderAll();
            };
            group.on('moving', syncGroupLineMarkers);
            group.on('rotating', syncGroupLineMarkers);
            group.on('scaling', syncGroupLineMarkers);
            group.on('modified', syncGroupLineMarkers);
            (group as any)._groupMarkerSync = syncGroupLineMarkers;
          }
          } catch (e) {
            console.warn('[GroupIcon] Failed to recreate endpoint markers:', e);
          }

          // Regenerate rasterized membranes/helixes inside the group.
          // Always regenerate from stored bezier points + options — the saved
          // src may be a stale placeholder (DNA helices use a 1x1 PNG).
          try {
            const collectRasterized = (container: any): { obj: any; parent: any }[] => {
              const result: { obj: any; parent: any }[] = [];
              if (!container?._objects) return result;
              for (const child of container._objects) {
                if (child.isRasterizedMembrane || child.isTripleMembrane || child.isDNAHelix || child.isRasterizedHelix) {
                  result.push({ obj: child, parent: container });
                }
                if (child.type === 'group' && child._objects) {
                  result.push(...collectRasterized(child));
                }
              }
              return result;
            };
            const rasterizedChildren = collectRasterized(group);
            for (const { obj: rObj, parent: parentGroup } of rasterizedChildren) {
              // Helper to replace a child in its parent group
              const replaceChild = (rasterized: any, rObj: any) => {
                const idx = parentGroup._objects.indexOf(rObj);
                if (idx >= 0) {
                  rasterized.set({ left: rObj.left, top: rObj.top, scaleX: rObj.scaleX, scaleY: rObj.scaleY, angle: rObj.angle });
                  parentGroup._objects[idx] = rasterized;
                  rasterized._set('group', parentGroup);
                  rasterized._set('canvas', fabricCanvas);
                }
              };

              if (rObj.isTripleMembrane && rObj.worldBezierPoints && rObj.tripleMembraneOptions) {
                const { TripleMembranePathTool } = await import('@/lib/tripleMembranePathTool');
                const tool = new TripleMembranePathTool(fabricCanvas!, rObj.tripleMembraneOptions);
                const bands = tool.generateBands(rObj.worldBezierPoints, rObj.isClosed);
                const { Group: FabricGroup } = await import('fabric');
                const grp = new FabricGroup(bands);
                // Copy metadata so rasterizeMembrane can embed it in the output image
                (grp as any).isTripleMembrane = true;
                (grp as any).tripleMembraneOptions = rObj.tripleMembraneOptions;
                (grp as any).bezierPoints = rObj.bezierPoints;
                (grp as any).worldBezierPoints = rObj.worldBezierPoints;
                (grp as any).isClosed = rObj.isClosed;
                (grp as any).id = rObj.id;
                const rasterized = await TripleMembranePathTool.rasterizeMembrane(grp);
                replaceChild(rasterized, rObj);
              } else if (rObj.isDNAHelix && rObj.worldBezierPoints && rObj.dnaHelixOptions) {
                const { DNAHelixTool } = await import('@/lib/dnaHelixTool');
                const tool = new DNAHelixTool(fabricCanvas!, rObj.dnaHelixOptions);
                const helixPaths = tool.generateHelix(rObj.worldBezierPoints, rObj.isClosed);
                const { Group: FabricGroup } = await import('fabric');
                const grp = new FabricGroup(helixPaths);
                // Copy metadata so rasterizeHelix can embed it in the output image
                (grp as any).isDNAHelix = true;
                (grp as any).dnaHelixOptions = rObj.dnaHelixOptions;
                (grp as any).bezierPoints = rObj.bezierPoints;
                (grp as any).worldBezierPoints = rObj.worldBezierPoints;
                (grp as any).isClosed = rObj.isClosed;
                (grp as any).id = rObj.id;
                const rasterized = await DNAHelixTool.rasterizeHelix(grp);
                replaceChild(rasterized, rObj);
              } else if (rObj.isRasterizedMembrane && rObj.worldBezierPoints && rObj.membraneOptions) {
                const { MembranePathTool } = await import('@/lib/membranePathTool');
                // regenerateIconsVector copies metadata from rObj (oldMembrane) onto the new group
                const vectorGroup = await MembranePathTool.regenerateIconsVector(
                  fabricCanvas!,
                  rObj,
                  rObj.worldBezierPoints
                );
                const rasterized = await MembranePathTool.rasterizeMembrane(vectorGroup);
                replaceChild(rasterized, rObj);
              }
            }
            if (rasterizedChildren.length > 0) {
              group.dirty = true;
            }
          } catch (e) {
            console.warn('[GroupIcon] Failed to regenerate rasterized objects:', e);
          }

          fabricCanvas?.requestRenderAll();

          // One-time notice about ungrouping
          const noticeKey = 'biosketch_group_icon_notice_shown';
          if (!localStorage.getItem(noticeKey)) {
            localStorage.setItem(noticeKey, '1');
            toast.info("This is a group icon", {
              description: "Right-click and select \"Ungroup\" to edit individual components like lines, icons, membranes, and more.",
              duration: 8000,
            });
          } else {
            toast.success("Group icon added to canvas");
          }
          return;
        }

        const startTime = performance.now();

        // Import iconCache (with fallback if import fails)
        let iconCache = null;
        let cached = null;
        try {
          const iconCacheModule = await import('@/lib/iconCache');
          iconCache = iconCacheModule.iconCache;
          cached = iconId ? await iconCache.get(iconId) : null;
        } catch (cacheError) {
          console.warn('Icon cache unavailable:', cacheError);
          // Continue without cache
        }
        
        if (cached) {
          // Inline CSS styles for cached SVGs too (older cache may have un-inlined SVGs)
          const cachedInlined = inlineSVGStyles(cached.svgContent);

          // Check if cached SVG is an embedded raster — load as FabricImage directly
          const cachedRasterUrl = extractEmbeddedRasterUrl(cachedInlined);
          if (cachedRasterUrl) {
            await addRasterIconToCanvas(cachedRasterUrl, iconId);
            toast.success("Icon added to canvas (cached)");
            return;
          }

          // Deserialize cached Fabric object
          const parsePromise = loadSVGFromString(cachedInlined);
          const { objects, options } = await parsePromise;
          const group = util.groupSVGElements(objects, options);

          // Calculate complexity and apply optimizations
          const complexity = calculateObjectComplexity(group);
          if (shouldSimplifyControls(complexity)) {
            applyComplexityOptimizations(group, complexity);
          }

          // Scale and position
          const maxW = (fabricCanvas?.width || 0) * 0.6;
          const maxH = (fabricCanvas?.height || 0) * 0.6;
          const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
          group.scale(scale);
          group.set({
            left: (fabricCanvas?.width || 0) / 2 - (group.width || 0) * scale / 2,
            top: (fabricCanvas?.height || 0) / 2 - (group.height || 0) * scale / 2,
          });

          // Mark as library icon for reference-based saving
          if (iconId) {
            (group as any).iconId = iconId;
            (group as any).isLibraryIcon = true;
          }

          // Wait for nested image elements to decode before rendering
          await awaitNestedImageDecode(group);

          fabricCanvas?.add(group);
          fabricCanvas?.setActiveObject(group);
          fabricCanvas?.requestRenderAll();
          toast.success("Icon added to canvas (cached)");
          return;
        }
        
        // Process SVG with Web Worker, fallback to main thread if worker fails
        let processedSVG = svgData;
        let complexity = 0;
        
        try {
          // Attempt Web Worker processing
          const worker = new Worker(new URL('@/lib/svgWorker.ts', import.meta.url), { type: 'module' });
          
          const workerResult = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
              worker.terminate();
              reject(new Error('Worker timeout'));
            }, 10000);
            
            worker.onmessage = (e) => {
              clearTimeout(timeout);
              worker.terminate();
              resolve(e.data);
            };
            
            worker.onerror = (err) => {
              clearTimeout(timeout);
              worker.terminate();
              reject(err);
            };
            
            worker.postMessage({ type: 'parse', svgContent: svgData, id: iconId || 'temp' });
          });
          
          // Show any warnings from worker (but continue loading)
          if (workerResult.data?.warnings?.length > 0) {
            workerResult.data.warnings.forEach((warning: string) => {
              toast.warning(warning, {
                description: 'Icon will still load, but performance may be affected.',
                duration: 5000
              });
            });
          }
          
          processedSVG = workerResult.data.svgContent;
          complexity = workerResult.data.complexity;
        } catch (workerError) {
          // FALLBACK: Process on main thread if worker fails
          console.warn('Web Worker failed, falling back to main thread:', workerError);
          
          // Calculate complexity on main thread
          complexity = calculateSVGComplexityMainThread(svgData);
          
          // Apply simplification for complex SVGs
          if (complexity > 500 || svgData.length > 512 * 1024) {
            processedSVG = simplifySVGMainThread(svgData);
          }
        }
        
        // Sanitize SVG before parsing to fix namespace issues
        const sanitizedSVG = sanitizeSVGNamespaces(processedSVG);

        // Inline CSS <style> class rules as SVG attributes — Fabric.js doesn't
        // reliably apply class-based fills, causing flat-color silhouettes.
        const inlinedSVG = inlineSVGStyles(sanitizedSVG);

        // Detect SVGs that contain an embedded PNG/raster <image> — Fabric.js
        // fails to render these correctly via loadSVGFromString, producing flat
        // single-color silhouettes. Load as a direct FabricImage instead.
        const embeddedRasterUrl = extractEmbeddedRasterUrl(inlinedSVG);
        if (embeddedRasterUrl) {
          await addRasterIconToCanvas(embeddedRasterUrl, iconId);
          toast.success("Icon added to canvas");
          return;
        }

        // Parse sanitized SVG string with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('SVG parsing timeout')), 15000);
        });

        const parsePromise = loadSVGFromString(inlinedSVG);
        const { objects, options } = await Promise.race([parsePromise, timeoutPromise]) as Awaited<ReturnType<typeof loadSVGFromString>>;

        const parseTime = performance.now() - startTime;
        const group = util.groupSVGElements(objects, options);
        
        // Calculate object complexity and apply optimizations
        const objectComplexity = calculateObjectComplexity(group);
        if (shouldSimplifyControls(objectComplexity)) {
          applyComplexityOptimizations(group, objectComplexity);
          toast.info(`Complex icon (${objectComplexity.totalObjects} objects)`, {
            description: 'Simplified controls applied for better performance'
          });
        }
        
        // Cache the parsed icon (only svgContent — parsedData is not used by
        // the cached path and calling toObject() before nested images decode
        // would store incomplete data)
        if (iconId && iconCache) {
          iconCache.set({
            id: iconId,
            svgContent: inlinedSVG,
            parsedData: null,
            timestamp: Date.now(),
            complexity: complexity,
            accessCount: 0,
            lastAccessTime: Date.now()
          });
        }
        
        // Scale to fit within 60% of canvas area
        const maxW = (fabricCanvas?.width || 0) * 0.6;
        const maxH = (fabricCanvas?.height || 0) * 0.6;
        const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
        group.scale(scale);

        // Center on canvas and mark as library icon
        group.set({
          left: (fabricCanvas?.width || 0) / 2 - (group.width || 0) * scale / 2,
          top: (fabricCanvas?.height || 0) / 2 - (group.height || 0) * scale / 2,
        });

        // Mark as library icon for reference-based saving
        if (iconId) {
          (group as any).iconId = iconId;
          (group as any).isLibraryIcon = true;
        }

        // Wait for nested image elements to decode before rendering
        await awaitNestedImageDecode(group);

        fabricCanvas?.add(group);
        fabricCanvas?.setActiveObject(group);
        fabricCanvas?.requestRenderAll();
        toast.success("Icon added to canvas");
      } catch (error) {
        console.error("Error adding icon:", error);
        if (svgData) {
          console.error("SVG content preview:", svgData.substring(0, 500));
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('timeout')) {
          toast.error("Icon is too large to process. Please try a simpler icon.");
        } else if (errorMessage.toLowerCase().includes('namespace') || errorMessage.toLowerCase().includes('parse')) {
          toast.error("Invalid SVG format. The icon may have formatting issues.");
        } else {
          toast.error(`Failed to add icon: ${errorMessage}`);
        }
      }
    };

    window.addEventListener("addIconToCanvas", handleAddIcon as EventListener);

    // Handle adding asset from library
    handleAddAsset = async (event: CustomEvent) => {
      const { content, assetId } = event.detail;
      if (!fabricCanvas || !content) return;

      try {
        toast("Loading asset...");
        
        // Try to parse as SVG first
        if (content.trim().startsWith('<svg') || content.includes('xmlns="http://www.w3.org/2000/svg"')) {
          // Sanitize SVG before parsing
          const sanitizedContent = sanitizeSVGNamespaces(content);
          const { objects, options } = await loadSVGFromString(sanitizedContent);
          const group = util.groupSVGElements(objects, options);
          
          const maxW = (fabricCanvas.width || 0) * 0.6;
          const maxH = (fabricCanvas.height || 0) * 0.6;
          const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
          group.scale(scale);
          
          group.set({
            left: (fabricCanvas.width || 0) / 2 - (group.width || 0) * scale / 2,
            top: (fabricCanvas.height || 0) / 2 - (group.height || 0) * scale / 2,
          });
          
          // Mark with asset reference for asset-by-reference saving
          if (assetId) {
            (group as any).assetId = assetId;
            (group as any).isUserAsset = true;
          }

          // Wait for nested image elements to decode before rendering
          await awaitNestedImageDecode(group);

          fabricCanvas.add(group);
          fabricCanvas.setActiveObject(group);
          fabricCanvas.requestRenderAll();
          toast.success("Asset added to canvas");
        } else {
          // Handle as data URL image with CORS support
          try {
            const img = await loadImageWithCORS(content);
            const fabricImage = new FabricImage(img, {
              left: (fabricCanvas.width || 0) / 2,
              top: (fabricCanvas.height || 0) / 2,
              originX: "center",
              originY: "center",
            });

            const maxW = (fabricCanvas.width || 0) * 0.6;
            const maxH = (fabricCanvas.height || 0) * 0.6;
            const scale = Math.min(maxW / fabricImage.width!, maxH / fabricImage.height!, 1);
            fabricImage.scale(scale);

            // Mark with asset reference for asset-by-reference saving
            if (assetId) {
              (fabricImage as any).assetId = assetId;
              (fabricImage as any).isUserAsset = true;
            }

            fabricCanvas.add(fabricImage);
            fabricCanvas.setActiveObject(fabricImage);
            fabricCanvas.requestRenderAll();
            toast.success("Asset added to canvas");
          } catch (error) {
            console.error("Failed to load image:", error);
            toast.error("Failed to load image asset");
          }
        }
      } catch (error) {
        console.error("Error adding asset:", error);
        toast.error("Failed to add asset to canvas");
      }
    };

    window.addEventListener("addAssetToCanvas", handleAddAsset as EventListener);
    };

    initCanvas();
    
    // Cleanup returned DIRECTLY from useEffect, not from async function
    return () => {
      isDisposed = true;
      if (handleAddIcon) {
        window.removeEventListener("addIconToCanvas", handleAddIcon as EventListener);
      }
      if (handleAddAsset) {
        window.removeEventListener("addAssetToCanvas", handleAddAsset as EventListener);
      }
      if (forceReleaseHandler) {
        document.removeEventListener('mouseup', forceReleaseHandler);
      }
      setCanvas(null);
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Context menu prevention (extracted to hook)
  useContextMenuPrevention(canvasRef);

  // Canvas zoom & dimensions (extracted to hook)
  useCanvasZoom(canvas, zoom, canvasDimensions, throttledCullRef);

  // Background color/gradient (extracted to hook)
  useBackgroundGradient(
    canvas, backgroundColor, backgroundGradient,
    gradientStartColor, gradientEndColor, gradientType,
    gradientAngle, gradientCenterX, gradientCenterY, gradientRadius
  );

  // Sync version listener (extracted to hook)
  const syncVersion = useSyncVersionListener(canvas);

  // Grid rendering + ruler cleanup (extracted to hook)
  useGridRendering(canvas, gridEnabled, gridPattern, gridSize, zoom, canvasLoadVersion, syncVersion);

  // Freeform line drawing (extracted to hook)
  useFreeformLineTool(canvas, activeTool, effectiveReadOnly, onShapeCreated, saveState);

  // Read-only / lock enforcement (extracted to hook)
  useReadOnlyEnforcement(canvas, effectiveReadOnly);

  // Erasable objects (extracted to hook)
  useErasableObjects(canvas);

  // Eraser tool (extracted to hook)
  useEraserTool(canvas, activeTool, saveState, effectiveReadOnly);

  // Image insertion tool (extracted to hook)
  useImageInsertionTool(canvas, activeTool, onShapeCreated, saveState);

  // Pen tool (extracted to hook)
  usePenTool(canvas, activeTool, onShapeCreated, onToolChange, saveState, smartConnectorsEnabled, autoPathfindingEnabled, connectionSyncManagerRef);

  // Polygon tool (extracted to hook)
  usePolygonTool(canvas, activeTool, onShapeCreated, saveState);

  // Straight line tool (extracted to hook)
  useStraightLineTool(canvas, activeTool, onShapeCreated, onToolChange, saveState, smartConnectorsEnabled, lineSnapThreshold, connectionSyncManagerRef);

  // Leader line tool (extracted to hook)
  useLeaderLineTool(canvas, activeTool, onToolChange, saveState);

  // Bracket tool (extracted to hook)
  useBracketTool(canvas, activeTool, onToolChange, saveState);

  // Orthogonal line tool (extracted to hook)
  useOrthogonalLineTool(canvas, activeTool, onShapeCreated, onToolChange, saveState, smartConnectorsEnabled, autoPathfindingEnabled, connectionSyncManagerRef);

  // Curved line tool (extracted to hook)
  useCurvedLineTool(canvas, activeTool, onShapeCreated, onToolChange, saveState, smartConnectorsEnabled, lineSnapThreshold, connectionSyncManagerRef);

  // Membrane & biology tools (extracted to hooks)
  useMembraneBrushTool(canvas, activeTool, onShapeCreated, onToolChange);
  const defaultMembraneIconSVGRef = useMembraneIconPreload(membraneSettings);
  useMembranePathTool(canvas, activeTool, onShapeCreated, onToolChange, saveState, membraneSettings, defaultMembraneIconSVGRef);
  useTripleMembraneTool(canvas, activeTool, onShapeCreated, onToolChange, saveState);
  useDnaHelixTool(canvas, activeTool, onShapeCreated, onToolChange, saveState);
  useChartTool(canvas, activeTool, onToolChange, saveState);
  useTableTool(canvas, activeTool, onToolChange, saveState);

  // Cursor management (extracted to hook)
  useCursorManagement(canvas, activeTool, effectiveReadOnly);

  // Handle shape creation on click
  useEffect(() => {
    if (!canvas) return;

    const handleCanvasClick = (e: any) => {
      if (effectiveReadOnlyRef.current) return;
      // Read activeTool through the ref so a setActiveTool('select')
      // dispatched in the same React tick as the click (e.g. immediately
      // after a clipboard action) takes effect synchronously, instead
      // of waiting for this effect to re-register with the new closure.
      const t = activeToolRef.current;
      if (t === "select" || t === "freeform-line" || t === "pen" || t === "eraser" || t === "image" || t === "comment" || t.startsWith('straight-line') || t.startsWith('orthogonal-line') || t.startsWith('curved-line') || t.startsWith('membrane-brush') || t === 'membrane-path' || t === 'triple-membrane' || t === 'dna-helix' || t === 'chart' || t === 'table' || t === 'leader-line' || t === 'bracket') return;

      const pointer = canvas.getPointer(e.e);
      
      // Handle shapes with text
      if (activeTool.endsWith('-with-text')) {
        let bgShape;
        let textWidth = 100;
        let labelText = "Text";
        let isColoredTextBox = false;
        let boxFill = DEFAULT_SHAPE_FILL;
        let boxStroke = DEFAULT_SHAPE_STROKE;
        let textColor = "#1e293b";

        switch (activeTool) {
          case "blue-box-with-text": {
            boxFill = 'rgba(219, 234, 254, 0.9)';
            boxStroke = '#3b82f6';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "emerald-box-with-text": {
            boxFill = 'rgba(209, 250, 229, 0.9)';
            boxStroke = '#10b981';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "amber-box-with-text": {
            boxFill = 'rgba(254, 243, 199, 0.9)';
            boxStroke = '#f59e0b';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "red-box-with-text": {
            boxFill = 'rgba(254, 226, 226, 0.9)';
            boxStroke = '#ef4444';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "violet-box-with-text": {
            boxFill = 'rgba(237, 233, 254, 0.9)';
            boxStroke = '#8b5cf6';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "pink-box-with-text": {
            boxFill = 'rgba(252, 231, 243, 0.9)';
            boxStroke = '#ec4899';
            isColoredTextBox = true;
            bgShape = new Rect({ width: 220, height: 120, rx: 12, ry: 12, fill: boxFill, stroke: boxStroke, strokeWidth: 2, strokeUniform: true, originX: 'center', originY: 'center' });
            textWidth = 190;
            break;
          }

          case "protein-with-text": {
            bgShape = new Rect({
              width: 120,
              height: 80,
              rx: 10,
              ry: 10,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 100;
            labelText = "Protein";
            break;
          }

          case "enzyme-with-text": {
            bgShape = new Circle({
              radius: 50,
              scaleX: 1.4,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 100;
            labelText = "Enzyme";
            break;
          }

          case "receptor-with-text": {
            bgShape = new Rect({
              width: 70,
              height: 120,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 55;
            labelText = "Receptor";
            break;
          }

          case "rna-with-text": {
            bgShape = new Rect({
              width: 100,
              height: 60,
              rx: 8,
              ry: 8,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 80;
            labelText = "RNA";
            break;
          }

          case "dna-with-text": {
            bgShape = new Rect({
              width: 100,
              height: 70,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 80;
            labelText = "DNA";
            break;
          }

          case "camp-with-text": {
            bgShape = new Circle({
              radius: 40,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 60;
            labelText = "cAMP";
            break;
          }

          case "atp-with-text": {
            bgShape = new Circle({
              radius: 40,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 60;
            labelText = "ATP";
            break;
          }

          case "kinase-with-text": {
            bgShape = new Rect({
              width: 150,
              height: 80,
              rx: 10,
              ry: 10,
              fill: DEFAULT_SHAPE_FILL,
              stroke: DEFAULT_SHAPE_STROKE,
              strokeWidth: 2,
              strokeUniform: true,
              originX: 'center',
              originY: 'center',
            });
            textWidth = 130;
            labelText = "Protein Kinase";
            break;
          }
        }
        
        if (bgShape) {
          let group;

          if (isColoredTextBox) {
            // Colored text box: bold heading + smaller body
            const heading = new Textbox("Heading", {
              fontSize: 17,
              fontWeight: 'bold',
              fill: textColor,
              textAlign: "center",
              originX: 'center',
              originY: 'center',
              top: -22,
              width: textWidth,
              fontFamily: getCanvasFontFamily(textFont),
              selectable: true,
              evented: true,
              hoverCursor: 'text',
            });
            (heading as any).listType = 'none';

            const body = new Textbox("Description text here", {
              fontSize: 13,
              fill: '#475569',
              textAlign: "center",
              originX: 'center',
              originY: 'center',
              top: 14,
              width: textWidth,
              fontFamily: getCanvasFontFamily(textFont),
              selectable: true,
              evented: true,
              hoverCursor: 'text',
            });
            (body as any).listType = 'none';

            group = new Group([bgShape, heading, body], {
              left: pointer.x,
              top: pointer.y,
              originX: 'center',
              originY: 'center',
              subTargetCheck: true,
              objectCaching: false,
            });
          } else {
            // Single-label shape (bio entities)
            const shapeText = new Textbox(labelText, {
              fontSize: 18,
              fill: "#ffffff",
              textAlign: "center",
              originX: 'center',
              originY: 'center',
              width: textWidth,
              fontFamily: getCanvasFontFamily(textFont),
              selectable: true,
              evented: true,
              hoverCursor: 'text',
            });
            (shapeText as any).listType = 'none';

            group = new Group([bgShape, shapeText], {
              left: pointer.x,
              top: pointer.y,
              originX: 'center',
              originY: 'center',
              subTargetCheck: true,
              objectCaching: false,
            });
          }

          canvas.add(group);
          canvas.setActiveObject(group);
          canvas.requestRenderAll();
          if (onShapeCreated) onShapeCreated();
          saveState();
          toast.success("Shape with text created! Double-click to edit text.");
        }
        return;
      }

      // Handle connector tools
      if (activeTool.startsWith('connector-') || activeTool.startsWith('line-')) {
        if (!connectorState.isDrawing) {
          // Start drawing
          setConnectorState({
            isDrawing: true,
            startX: pointer.x,
            startY: pointer.y,
          });
          toast.info("Click to set end point");
          return;
        } else {
          // Finish drawing
          const getConnectorProps = () => {
            let startMarker: ArrowMarkerType = 'none';
            let endMarker: ArrowMarkerType = 'arrow';
            let routingStyle: RoutingStyle = 'straight';

            if (activeTool === 'connector-curved') routingStyle = 'curved';
            else if (activeTool === 'connector-orthogonal') routingStyle = 'orthogonal';
            else if (activeTool === 'line-double-arrow') startMarker = 'arrow';
            else if (activeTool === 'line-plain') endMarker = 'none';
            else if (activeTool === 'line-circle-arrow') startMarker = 'circle';
            else if (activeTool === 'line-diamond') {
              startMarker = 'diamond';
              endMarker = 'none';
            }

            return { startMarker, endMarker, routingStyle };
          };

          const props = getConnectorProps();
          createConnector(canvas, {
            startX: connectorState.startX!,
            startY: connectorState.startY!,
            endX: pointer.x,
            endY: pointer.y,
            ...props,
            strokeColor: '#000000',
            strokeWidth: 2,
          });

          setConnectorState({
            isDrawing: false,
            startX: null,
            startY: null,
          });

          canvas.requestRenderAll();
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
          toast.success("Connector created!");
          return;
        }
      }

      // Numbered Callout - single click placement
      if (activeTool === "numbered-callout") {
        const number = getNextCalloutNumber(canvas);
        const callout = createNumberedCallout({
          number,
          left: pointer.x - 15,
          top: pointer.y - 15,
        });
        canvas.add(callout);
        registerCallout(canvas, callout);
        createOrUpdateLegend(canvas);
        if (onShapeCreated) onShapeCreated();
        // Save state for undo/redo
        saveState();
        toast.success(`Callout ${number} added`);
        return;
      }

      if (activeTool === "text") {
        const textDecoration = [];
        if (textUnderline) textDecoration.push('underline');
        if (textOverline) textDecoration.push('overline');
        
        const text = new Textbox("Type here", {
          left: pointer.x,
          top: pointer.y,
          width: 200,
          fontSize: 24,
          fontFamily: getCanvasFontFamily(textFont),
          textAlign: textAlign as any,
          underline: textUnderline,
          overline: textOverline,
          fontWeight: textBold ? 'bold' : 'normal',
          fontStyle: textItalic ? 'italic' : 'normal',
          fill: "#000000",
        });
        (text as any).listType = 'none';
        canvas.add(text);
        canvas.setActiveObject(text);
        // Immediately enter editing so user can type
        if ((text as any).enterEditing) {
          (text as any).enterEditing();
          if ((text as any).selectAll) {
            (text as any).selectAll();
          }
        }
        canvas.requestRenderAll();
        if (onShapeCreated) onShapeCreated();
        // Save state for undo/redo
        saveState();
        return;
      }
      
      switch (activeTool) {
        case "rectangle":
        case "square":
          const rect = new Rect({
            left: pointer.x - 50,
            top: pointer.y - 50,
            width: activeTool === "square" ? 100 : 120,
            height: 100,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(rect);
          canvas.setActiveObject(rect);
          break;

        case "rounded-rect":
          const roundedRect = new Rect({
            left: pointer.x - 60,
            top: pointer.y - 40,
            width: 120,
            height: 80,
            rx: 10,
            ry: 10,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(roundedRect);
          canvas.setActiveObject(roundedRect);
          break;
          
        case "circle":
        case "ellipse":
          const circle = new Circle({
            left: pointer.x - 50,
            top: pointer.y - 50,
            radius: 50,
            scaleX: activeTool === "ellipse" ? 1.4 : 1,
            scaleY: 1,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(circle);
          canvas.setActiveObject(circle);
          break;

        case "rhombus":
          const rhombus = new Polygon([
            { x: pointer.x, y: pointer.y - 50 },
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x, y: pointer.y + 50 },
            { x: pointer.x - 50, y: pointer.y },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(rhombus);
          canvas.setActiveObject(rhombus);
          break;

        case "parallelogram":
          const parallelogram = new Polygon([
            { x: pointer.x - 40, y: pointer.y - 40 },
            { x: pointer.x + 60, y: pointer.y - 40 },
            { x: pointer.x + 40, y: pointer.y + 40 },
            { x: pointer.x - 60, y: pointer.y + 40 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(parallelogram);
          canvas.setActiveObject(parallelogram);
          break;

        case "trapezoid":
          const trapezoid = new Polygon([
            { x: pointer.x - 30, y: pointer.y - 40 },
            { x: pointer.x + 30, y: pointer.y - 40 },
            { x: pointer.x + 50, y: pointer.y + 40 },
            { x: pointer.x - 50, y: pointer.y + 40 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(trapezoid);
          canvas.setActiveObject(trapezoid);
          break;

        case "pentagon":
          const pentagonPoints = [];
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            pentagonPoints.push({
              x: pointer.x + 50 * Math.cos(angle),
              y: pointer.y + 50 * Math.sin(angle),
            });
          }
          const pentagon = new Polygon(pentagonPoints, {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(pentagon);
          canvas.setActiveObject(pentagon);
          break;

        case "hexagon":
          const hexagonPoints = [];
          for (let i = 0; i < 6; i++) {
            const angle = (i * 2 * Math.PI) / 6;
            hexagonPoints.push({
              x: pointer.x + 50 * Math.cos(angle),
              y: pointer.y + 50 * Math.sin(angle),
            });
          }
          const hexagon = new Polygon(hexagonPoints, {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(hexagon);
          canvas.setActiveObject(hexagon);
          break;

        case "octagon":
          const octagonPoints = [];
          for (let i = 0; i < 8; i++) {
            const angle = (i * 2 * Math.PI) / 8;
            octagonPoints.push({
              x: pointer.x + 50 * Math.cos(angle),
              y: pointer.y + 50 * Math.sin(angle),
            });
          }
          const octagon = new Polygon(octagonPoints, {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(octagon);
          canvas.setActiveObject(octagon);
          break;
          
        case "zoom-callout-dotted": {
          // Create small circle (source/highlight area)
          const circle = new Circle({
            left: pointer.x - 20,
            top: pointer.y - 20,
            radius: 20,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            strokeUniform: true,
          });

          // Create rectangle (detail/magnified area)
          const rect = new Rect({
            left: pointer.x + 80,
            top: pointer.y - 60,
            width: 160,
            height: 120,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            strokeUniform: true,
          });

          // Calculate connection points - simple straight lines
          const circleRight = pointer.x + 20;
          const circleTopY = pointer.y - 14;
          const circleBottomY = pointer.y + 14;

          const rectLeft = pointer.x + 80;
          const rectTopY = pointer.y - 60;
          const rectBottomY = pointer.y + 60;

          // Create simple dotted connector lines (straight from circle to rectangle)
          const line1 = new Line(
            [circleRight, circleTopY, rectLeft, rectTopY],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          const line2 = new Line(
            [circleRight, circleBottomY, rectLeft, rectBottomY],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          // Group all elements together
          const calloutGroup = new Group([circle, line1, line2, rect], {
            left: pointer.x - 20,
            top: pointer.y - 60,
            selectable: true,
          });

          canvas.add(calloutGroup);
          canvas.setActiveObject(calloutGroup);
          break;
        }

        case "zoom-callout-trapezoid": {
          // Create small circle (source/highlight area)
          const circle = new Circle({
            left: pointer.x - 20,
            top: pointer.y - 20,
            radius: 20,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            strokeUniform: true,
          });

          // Create convergence square (the funnel point)
          const convergenceX = pointer.x + 50;
          const convergenceY = pointer.y;
          const convergenceSize = 8;
          
          const convergenceSquare = new Rect({
            left: convergenceX - convergenceSize / 2,
            top: convergenceY - convergenceSize / 2,
            width: convergenceSize,
            height: convergenceSize,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 1,
            strokeUniform: true,
          });

          // Create rectangle (detail/magnified area)
          const rect = new Rect({
            left: pointer.x + 100,
            top: pointer.y - 80,
            width: 180,
            height: 160,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            strokeUniform: true,
          });

          // Calculate connection points for funnel effect
          const circleRight = pointer.x + 20;
          const circleTopY = pointer.y - 14;
          const circleBottomY = pointer.y + 14;

          const convergenceTop = convergenceY - convergenceSize / 2;
          const convergenceBottom = convergenceY + convergenceSize / 2;

          const rectLeft = pointer.x + 100;
          const rectTopY = pointer.y - 80;
          const rectBottomY = pointer.y + 80;

          // Create 4 dotted lines for trapezoid funnel effect
          // Lines from circle to convergence square (narrowing)
          const line1 = new Line(
            [circleRight, circleTopY, convergenceX - convergenceSize / 2, convergenceTop],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          const line2 = new Line(
            [circleRight, circleBottomY, convergenceX - convergenceSize / 2, convergenceBottom],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          // Lines from convergence square to rectangle (widening)
          const line3 = new Line(
            [convergenceX + convergenceSize / 2, convergenceTop, rectLeft, rectTopY],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          const line4 = new Line(
            [convergenceX + convergenceSize / 2, convergenceBottom, rectLeft, rectBottomY],
            {
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeDashArray: [6, 6],
              strokeUniform: true,
              selectable: false,
              evented: false,
            }
          );

          // Group all elements together
          const calloutGroup = new Group([circle, line1, line2, convergenceSquare, line3, line4, rect], {
            left: pointer.x - 20,
            top: pointer.y - 80,
            selectable: true,
          });

          canvas.add(calloutGroup);
          canvas.setActiveObject(calloutGroup);
          break;
        }
        
        case "star":
          const starPoints = [];
          const outerRadius = 50;
          const innerRadius = 25;
          for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            starPoints.push({
              x: pointer.x + radius * Math.cos(angle),
              y: pointer.y + radius * Math.sin(angle),
            });
          }
          const star = new Polygon(starPoints, {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(star);
          canvas.setActiveObject(star);
          break;

        case "triangle":
        case "right-triangle":
          const trianglePoints = activeTool === "right-triangle"
            ? [
                { x: pointer.x - 50, y: pointer.y - 50 },
                { x: pointer.x + 50, y: pointer.y + 50 },
                { x: pointer.x - 50, y: pointer.y + 50 },
              ]
            : [
                { x: pointer.x, y: pointer.y - 50 },
                { x: pointer.x + 50, y: pointer.y + 50 },
                { x: pointer.x - 50, y: pointer.y + 50 },
              ];
          const triangle = new Polygon(trianglePoints, {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(triangle);
          canvas.setActiveObject(triangle);
          break;

        case "arrow-right":
          const arrow = new Polygon([
            { x: pointer.x - 50, y: pointer.y - 15 },
            { x: pointer.x + 30, y: pointer.y - 15 },
            { x: pointer.x + 30, y: pointer.y - 25 },
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x + 30, y: pointer.y + 25 },
            { x: pointer.x + 30, y: pointer.y + 15 },
            { x: pointer.x - 50, y: pointer.y + 15 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(arrow);
          canvas.setActiveObject(arrow);
          break;

        case "arrow-left":
          const arrowLeft = new Polygon([
            { x: pointer.x + 50, y: pointer.y - 15 },
            { x: pointer.x - 30, y: pointer.y - 15 },
            { x: pointer.x - 30, y: pointer.y - 25 },
            { x: pointer.x - 50, y: pointer.y },
            { x: pointer.x - 30, y: pointer.y + 25 },
            { x: pointer.x - 30, y: pointer.y + 15 },
            { x: pointer.x + 50, y: pointer.y + 15 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(arrowLeft);
          canvas.setActiveObject(arrowLeft);
          break;

        case "arrow-up":
          const arrowUp = new Polygon([
            { x: pointer.x - 15, y: pointer.y + 50 },
            { x: pointer.x - 15, y: pointer.y - 30 },
            { x: pointer.x - 25, y: pointer.y - 30 },
            { x: pointer.x, y: pointer.y - 50 },
            { x: pointer.x + 25, y: pointer.y - 30 },
            { x: pointer.x + 15, y: pointer.y - 30 },
            { x: pointer.x + 15, y: pointer.y + 50 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(arrowUp);
          canvas.setActiveObject(arrowUp);
          break;

        case "arrow-down":
          const arrowDown = new Polygon([
            { x: pointer.x - 15, y: pointer.y - 50 },
            { x: pointer.x - 15, y: pointer.y + 30 },
            { x: pointer.x - 25, y: pointer.y + 30 },
            { x: pointer.x, y: pointer.y + 50 },
            { x: pointer.x + 25, y: pointer.y + 30 },
            { x: pointer.x + 15, y: pointer.y + 30 },
            { x: pointer.x + 15, y: pointer.y - 50 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(arrowDown);
          canvas.setActiveObject(arrowDown);
          break;

        case "arrow-double-h":
          const doubleArrowH = new Polygon([
            { x: pointer.x - 50, y: pointer.y },
            { x: pointer.x - 30, y: pointer.y - 20 },
            { x: pointer.x - 30, y: pointer.y - 10 },
            { x: pointer.x + 30, y: pointer.y - 10 },
            { x: pointer.x + 30, y: pointer.y - 20 },
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x + 30, y: pointer.y + 20 },
            { x: pointer.x + 30, y: pointer.y + 10 },
            { x: pointer.x - 30, y: pointer.y + 10 },
            { x: pointer.x - 30, y: pointer.y + 20 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(doubleArrowH);
          canvas.setActiveObject(doubleArrowH);
          break;

        case "arrow-thick":
          const thickArrow = new Polygon([
            { x: pointer.x - 50, y: pointer.y - 20 },
            { x: pointer.x + 20, y: pointer.y - 20 },
            { x: pointer.x + 20, y: pointer.y - 35 },
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x + 20, y: pointer.y + 35 },
            { x: pointer.x + 20, y: pointer.y + 20 },
            { x: pointer.x - 50, y: pointer.y + 20 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(thickArrow);
          canvas.setActiveObject(thickArrow);
          break;

        case "process":
          const process = new Rect({
            left: pointer.x - 60,
            top: pointer.y - 40,
            width: 120,
            height: 80,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(process);
          canvas.setActiveObject(process);
          break;

        case "decision":
          const decision = new Polygon([
            { x: pointer.x, y: pointer.y - 50 },
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x, y: pointer.y + 50 },
            { x: pointer.x - 50, y: pointer.y },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(decision);
          canvas.setActiveObject(decision);
          break;

        case "data":
          const data = new Polygon([
            { x: pointer.x - 40, y: pointer.y - 40 },
            { x: pointer.x + 50, y: pointer.y - 40 },
            { x: pointer.x + 40, y: pointer.y + 40 },
            { x: pointer.x - 50, y: pointer.y + 40 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(data);
          canvas.setActiveObject(data);
          break;

        case "terminator":
          const terminator = new Rect({
            left: pointer.x - 60,
            top: pointer.y - 30,
            width: 120,
            height: 60,
            rx: 30,
            ry: 30,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(terminator);
          canvas.setActiveObject(terminator);
          break;

        case "document":
          const documentShape = new Polygon([
            { x: pointer.x - 40, y: pointer.y - 50 },
            { x: pointer.x + 40, y: pointer.y - 50 },
            { x: pointer.x + 50, y: pointer.y - 40 },
            { x: pointer.x + 50, y: pointer.y + 50 },
            { x: pointer.x - 50, y: pointer.y + 50 },
          ], {
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(documentShape);
          canvas.setActiveObject(documentShape);
          break;

        case "database":
          // Database with cylinder shape - use stacked ellipses
          const dbTop = new Ellipse({
            left: pointer.x - 40,
            top: pointer.y - 40,
            rx: 40,
            ry: 10,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          const dbBody = new Rect({
            left: pointer.x - 40,
            top: pointer.y - 30,
            width: 80,
            height: 70,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(dbBody, dbTop);
          canvas.setActiveObject(dbTop);
          break;

        case "callout":
        case "cloud":
        case "heart":
        case "cross":
          // For complex paths, use simple geometric approximations
          const simpleShape = new Rect({
            left: pointer.x - 50,
            top: pointer.y - 50,
            width: 100,
            height: 100,
            fill: DEFAULT_SHAPE_FILL,
            stroke: DEFAULT_SHAPE_STROKE,
            strokeWidth: 2,
            strokeUniform: true,
          });
          canvas.add(simpleShape);
          canvas.setActiveObject(simpleShape);
          break;
          
        case "line":
          const line = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
          });
          canvas.add(line);
          canvas.setActiveObject(line);
          break;

        case "line-arrow-right": {
          const lineArrowRight = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
          });
          const arrowHeadRight = new Polygon([
            { x: pointer.x + 100, y: pointer.y },
            { x: pointer.x + 90, y: pointer.y - 6 },
            { x: pointer.x + 90, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const groupArrowRight = new Group([lineArrowRight, arrowHeadRight], {
            selectable: true,
          });
          canvas.add(groupArrowRight);
          canvas.setActiveObject(groupArrowRight);
          break;
        }

        case "line-arrow-left": {
          const lineArrowLeft = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
          });
          const arrowHeadLeft = new Polygon([
            { x: pointer.x, y: pointer.y },
            { x: pointer.x + 10, y: pointer.y - 6 },
            { x: pointer.x + 10, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const groupArrowLeft = new Group([lineArrowLeft, arrowHeadLeft], {
            selectable: true,
          });
          canvas.add(groupArrowLeft);
          canvas.setActiveObject(groupArrowLeft);
          break;
        }

        case "line-arrow-both": {
          const lineArrowBoth = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
          });
          const arrowHeadBothLeft = new Polygon([
            { x: pointer.x, y: pointer.y },
            { x: pointer.x + 10, y: pointer.y - 6 },
            { x: pointer.x + 10, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHeadBothRight = new Polygon([
            { x: pointer.x + 100, y: pointer.y },
            { x: pointer.x + 90, y: pointer.y - 6 },
            { x: pointer.x + 90, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const groupArrowBoth = new Group([lineArrowBoth, arrowHeadBothLeft, arrowHeadBothRight], {
            selectable: true,
          });
          canvas.add(groupArrowBoth);
          canvas.setActiveObject(groupArrowBoth);
          break;
        }

        case "dashed-line": {
          const dashedLine = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
            strokeDashArray: [5, 5],
          });
          canvas.add(dashedLine);
          canvas.setActiveObject(dashedLine);
          break;
        }

        case "dashed-line-arrow": {
          const dashedLineArrow = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
            stroke: "#000000",
            strokeWidth: 2,
            strokeDashArray: [5, 5],
          });
          const dashedArrowHead = new Polygon([
            { x: pointer.x + 100, y: pointer.y },
            { x: pointer.x + 90, y: pointer.y - 6 },
            { x: pointer.x + 90, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const groupDashedArrow = new Group([dashedLineArrow, dashedArrowHead], {
            selectable: true,
          });
          canvas.add(groupDashedArrow);
          canvas.setActiveObject(groupDashedArrow);
          break;
        }

        case "arc-quarter": {
          const aqR = 60;
          const aqArc = new Path(
            `M 0 ${aqR} A ${aqR} ${aqR} 0 0 1 ${aqR} 0`,
            { left: pointer.x, top: pointer.y, stroke: "#000000", strokeWidth: 2, fill: null, selectable: true, strokeUniform: true }
          );
          (aqArc as any).isArcPath = true;
          (aqArc as any).arcType = 'quarter';
          // sweep=1 means clockwise; start angle=180° (bottom), end angle=90° (right)
          (aqArc as any).arcStartAngleDeg = 180;
          (aqArc as any).arcEndAngleDeg = 90;
          (aqArc as any).arcSweepCW = true;
          canvas.add(aqArc);
          canvas.setActiveObject(aqArc);
          break;
        }

        case "arc-half": {
          const ahR = 40;
          const ahArc = new Path(
            `M ${ahR} 0 A ${ahR} ${ahR} 0 0 0 ${ahR} ${ahR * 2}`,
            { left: pointer.x, top: pointer.y, stroke: "#000000", strokeWidth: 2, fill: null, selectable: true, strokeUniform: true }
          );
          (ahArc as any).isArcPath = true;
          (ahArc as any).arcType = 'half';
          // sweep=0 means counter-clockwise; start at top (270°), end at bottom (90°)
          (ahArc as any).arcStartAngleDeg = 270;
          (ahArc as any).arcEndAngleDeg = 90;
          (ahArc as any).arcSweepCW = false;
          canvas.add(ahArc);
          canvas.setActiveObject(ahArc);
          break;
        }

        case "arc-three-quarter": {
          const atR = 40;
          const atArc = new Path(
            `M ${atR * 2} ${atR} A ${atR} ${atR} 0 1 0 ${atR} 0`,
            { left: pointer.x, top: pointer.y, stroke: "#000000", strokeWidth: 2, fill: null, selectable: true, strokeUniform: true }
          );
          (atArc as any).isArcPath = true;
          (atArc as any).arcType = 'three-quarter';
          // In screen coords (Y-down): start at right (0°), end at top (-90° = 270°)
          // SVG sweep-flag=0 with Y-down = visually clockwise
          (atArc as any).arcStartAngleDeg = 0;
          (atArc as any).arcEndAngleDeg = -90;
          (atArc as any).arcSweepCW = true;
          canvas.add(atArc);
          canvas.setActiveObject(atArc);
          break;
        }

        case "paren-left": {
          const height = 80;
          const width = 30;
          const parenLeft = new Path(
            `M ${pointer.x + width} ${pointer.y} Q ${pointer.x} ${pointer.y + height/2} ${pointer.x + width} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(parenLeft);
          canvas.setActiveObject(parenLeft);
          break;
        }

        case "paren-right": {
          const height = 80;
          const width = 30;
          const parenRight = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + width} ${pointer.y + height/2} ${pointer.x} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(parenRight);
          canvas.setActiveObject(parenRight);
          break;
        }

        case "paren-top": {
          const width = 80;
          const height = 30;
          const parenTop = new Path(
            `M ${pointer.x} ${pointer.y + height} Q ${pointer.x + width/2} ${pointer.y} ${pointer.x + width} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(parenTop);
          canvas.setActiveObject(parenTop);
          break;
        }

        case "paren-bottom": {
          const width = 80;
          const height = 30;
          const parenBottom = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + width/2} ${pointer.y + height} ${pointer.x + width} ${pointer.y}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(parenBottom);
          canvas.setActiveObject(parenBottom);
          break;
        }

        case "bracket-left": {
          const height = 80;
          const width = 20;
          const bracketLeft = new Path(
            `M ${pointer.x + width} ${pointer.y} L ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + height} L ${pointer.x + width} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(bracketLeft);
          canvas.setActiveObject(bracketLeft);
          break;
        }

        case "bracket-right": {
          const height = 80;
          const width = 20;
          const bracketRight = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x + width} ${pointer.y} L ${pointer.x + width} ${pointer.y + height} L ${pointer.x} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(bracketRight);
          canvas.setActiveObject(bracketRight);
          break;
        }

        case "bracket-top": {
          const width = 80;
          const height = 20;
          const bracketTop = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x + width} ${pointer.y} M ${pointer.x + width/2} ${pointer.y} L ${pointer.x + width/2} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(bracketTop);
          canvas.setActiveObject(bracketTop);
          break;
        }

        case "bracket-bottom": {
          const width = 80;
          const height = 20;
          const bracketBottom = new Path(
            `M ${pointer.x + width/2} ${pointer.y} L ${pointer.x + width/2} ${pointer.y + height} M ${pointer.x} ${pointer.y + height} L ${pointer.x + width} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          canvas.add(bracketBottom);
          canvas.setActiveObject(bracketBottom);
          break;
        }

        case "paren-left-arrow": {
          const height = 80;
          const width = 30;
          const parenLeftArrow = new Path(
            `M ${pointer.x + width} ${pointer.y} Q ${pointer.x} ${pointer.y + height/2} ${pointer.x + width} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          
          const arrowSize = 8;
          const arrowAngle = Math.PI / 4;
          const arrow = new Path(
            `M ${pointer.x + width} ${pointer.y + height} L ${pointer.x + width - arrowSize * Math.cos(arrowAngle)} ${pointer.y + height - arrowSize * Math.sin(arrowAngle)} M ${pointer.x + width} ${pointer.y + height} L ${pointer.x + width + arrowSize * Math.cos(arrowAngle)} ${pointer.y + height - arrowSize * Math.sin(arrowAngle)}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: false,
            }
          );
          
          const group = new Group([parenLeftArrow, arrow], {
            selectable: true,
          });
          canvas.add(group);
          canvas.setActiveObject(group);
          break;
        }

        case "paren-right-arrow": {
          const height = 80;
          const width = 30;
          const parenRightArrow = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + width} ${pointer.y + height/2} ${pointer.x} ${pointer.y + height}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: true,
              strokeUniform: true,
            }
          );
          
          const arrowSize = 8;
          const arrowAngle = Math.PI / 4;
          const arrow = new Path(
            `M ${pointer.x} ${pointer.y + height} L ${pointer.x - arrowSize * Math.cos(arrowAngle)} ${pointer.y + height - arrowSize * Math.sin(arrowAngle)} M ${pointer.x} ${pointer.y + height} L ${pointer.x + arrowSize * Math.cos(arrowAngle)} ${pointer.y + height - arrowSize * Math.sin(arrowAngle)}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              selectable: false,
            }
          );
          
          const group = new Group([parenRightArrow, arrow], {
            selectable: true,
          });
          canvas.add(group);
          canvas.setActiveObject(group);
          break;
        }

        case "curved-arrow-right": {
          const curvedPathRight = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + 50} ${pointer.y - 40} ${pointer.x + 100} ${pointer.y}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const curvedArrowHeadRight = new Polygon([
            { x: pointer.x + 100, y: pointer.y },
            { x: pointer.x + 90, y: pointer.y - 6 },
            { x: pointer.x + 90, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const curvedGroupRight = new Group([curvedPathRight, curvedArrowHeadRight], {
            selectable: true,
          });
          canvas.add(curvedGroupRight);
          canvas.setActiveObject(curvedGroupRight);
          break;
        }

        case "curved-arrow-left": {
          const curvedPathLeft = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + 50} ${pointer.y + 40} ${pointer.x + 100} ${pointer.y}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const curvedArrowHeadLeft = new Polygon([
            { x: pointer.x + 100, y: pointer.y },
            { x: pointer.x + 90, y: pointer.y - 6 },
            { x: pointer.x + 90, y: pointer.y + 6 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const curvedGroupLeft = new Group([curvedPathLeft, curvedArrowHeadLeft], {
            selectable: true,
          });
          canvas.add(curvedGroupLeft);
          canvas.setActiveObject(curvedGroupLeft);
          break;
        }

        case "curved-arrow-up": {
          const curvedPathUp = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + 40} ${pointer.y - 50} ${pointer.x} ${pointer.y - 100}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const curvedArrowHeadUp = new Polygon([
            { x: pointer.x, y: pointer.y - 100 },
            { x: pointer.x - 6, y: pointer.y - 90 },
            { x: pointer.x + 6, y: pointer.y - 90 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const curvedGroupUp = new Group([curvedPathUp, curvedArrowHeadUp], {
            selectable: true,
          });
          canvas.add(curvedGroupUp);
          canvas.setActiveObject(curvedGroupUp);
          break;
        }

        case "curved-arrow-down": {
          const curvedPathDown = new Path(
            `M ${pointer.x} ${pointer.y} Q ${pointer.x + 40} ${pointer.y + 50} ${pointer.x} ${pointer.y + 100}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const curvedArrowHeadDown = new Polygon([
            { x: pointer.x, y: pointer.y + 100 },
            { x: pointer.x - 6, y: pointer.y + 90 },
            { x: pointer.x + 6, y: pointer.y + 90 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const curvedGroupDown = new Group([curvedPathDown, curvedArrowHeadDown], {
            selectable: true,
          });
          canvas.add(curvedGroupDown);
          canvas.setActiveObject(curvedGroupDown);
          break;
        }

        case "elbow-connector-right": {
          const elbowPathRight = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x + 50} ${pointer.y} L ${pointer.x + 50} ${pointer.y + 50} L ${pointer.x + 100} ${pointer.y + 50}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const elbowArrowRight = new Polygon([
            { x: pointer.x + 100, y: pointer.y + 50 },
            { x: pointer.x + 90, y: pointer.y + 44 },
            { x: pointer.x + 90, y: pointer.y + 56 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const elbowGroupRight = new Group([elbowPathRight, elbowArrowRight], {
            selectable: true,
          });
          canvas.add(elbowGroupRight);
          canvas.setActiveObject(elbowGroupRight);
          break;
        }

        case "elbow-connector-left": {
          const elbowPathLeft = new Path(
            `M ${pointer.x + 100} ${pointer.y} L ${pointer.x + 50} ${pointer.y} L ${pointer.x + 50} ${pointer.y + 50} L ${pointer.x} ${pointer.y + 50}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const elbowArrowLeft = new Polygon([
            { x: pointer.x, y: pointer.y + 50 },
            { x: pointer.x + 10, y: pointer.y + 44 },
            { x: pointer.x + 10, y: pointer.y + 56 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const elbowGroupLeft = new Group([elbowPathLeft, elbowArrowLeft], {
            selectable: true,
          });
          canvas.add(elbowGroupLeft);
          canvas.setActiveObject(elbowGroupLeft);
          break;
        }

        case "elbow-connector-up": {
          const elbowPathUp = new Path(
            `M ${pointer.x} ${pointer.y + 100} L ${pointer.x} ${pointer.y + 50} L ${pointer.x + 50} ${pointer.y + 50} L ${pointer.x + 50} ${pointer.y}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const elbowArrowUp = new Polygon([
            { x: pointer.x + 50, y: pointer.y },
            { x: pointer.x + 44, y: pointer.y + 10 },
            { x: pointer.x + 56, y: pointer.y + 10 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const elbowGroupUp = new Group([elbowPathUp, elbowArrowUp], {
            selectable: true,
          });
          canvas.add(elbowGroupUp);
          canvas.setActiveObject(elbowGroupUp);
          break;
        }

        case "elbow-connector-down": {
          const elbowPathDown = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + 50} L ${pointer.x + 50} ${pointer.y + 50} L ${pointer.x + 50} ${pointer.y + 100}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const elbowArrowDown = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 100 },
            { x: pointer.x + 44, y: pointer.y + 90 },
            { x: pointer.x + 56, y: pointer.y + 90 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const elbowGroupDown = new Group([elbowPathDown, elbowArrowDown], {
            selectable: true,
          });
          canvas.add(elbowGroupDown);
          canvas.setActiveObject(elbowGroupDown);
          break;
        }

        case "y-split-right-curved": {
          const ySplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + 40} M ${pointer.x} ${pointer.y + 40} Q ${pointer.x + 20} ${pointer.y + 50} ${pointer.x + 60} ${pointer.y + 30} M ${pointer.x} ${pointer.y + 40} Q ${pointer.x + 20} ${pointer.y + 50} ${pointer.x + 60} ${pointer.y + 70}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 60, y: pointer.y + 30 },
            { x: pointer.x + 50, y: pointer.y + 27 },
            { x: pointer.x + 50, y: pointer.y + 33 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 60, y: pointer.y + 70 },
            { x: pointer.x + 50, y: pointer.y + 67 },
            { x: pointer.x + 50, y: pointer.y + 73 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const ySplitGroup = new Group([ySplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(ySplitGroup);
          canvas.setActiveObject(ySplitGroup);
          break;
        }

        case "y-split-left-curved": {
          const ySplitPath = new Path(
            `M ${pointer.x + 60} ${pointer.y} L ${pointer.x + 60} ${pointer.y + 40} M ${pointer.x + 60} ${pointer.y + 40} Q ${pointer.x + 40} ${pointer.y + 50} ${pointer.x} ${pointer.y + 30} M ${pointer.x + 60} ${pointer.y + 40} Q ${pointer.x + 40} ${pointer.y + 50} ${pointer.x} ${pointer.y + 70}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x, y: pointer.y + 30 },
            { x: pointer.x + 10, y: pointer.y + 27 },
            { x: pointer.x + 10, y: pointer.y + 33 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x, y: pointer.y + 70 },
            { x: pointer.x + 10, y: pointer.y + 67 },
            { x: pointer.x + 10, y: pointer.y + 73 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const ySplitGroup = new Group([ySplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(ySplitGroup);
          canvas.setActiveObject(ySplitGroup);
          break;
        }

        case "y-split-down-curved": {
          const ySplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x + 50} ${pointer.y} M ${pointer.x + 50} ${pointer.y} Q ${pointer.x + 60} ${pointer.y + 20} ${pointer.x + 30} ${pointer.y + 60} M ${pointer.x + 50} ${pointer.y} Q ${pointer.x + 60} ${pointer.y + 20} ${pointer.x + 80} ${pointer.y + 60}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 30, y: pointer.y + 60 },
            { x: pointer.x + 27, y: pointer.y + 50 },
            { x: pointer.x + 33, y: pointer.y + 50 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 80, y: pointer.y + 60 },
            { x: pointer.x + 77, y: pointer.y + 50 },
            { x: pointer.x + 83, y: pointer.y + 50 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const ySplitGroup = new Group([ySplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(ySplitGroup);
          canvas.setActiveObject(ySplitGroup);
          break;
        }

        case "t-split-right-elbow": {
          const tSplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + 80} M ${pointer.x} ${pointer.y + 20} L ${pointer.x + 60} ${pointer.y + 20} M ${pointer.x} ${pointer.y + 60} L ${pointer.x + 60} ${pointer.y + 60}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 60, y: pointer.y + 20 },
            { x: pointer.x + 50, y: pointer.y + 14 },
            { x: pointer.x + 50, y: pointer.y + 26 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 60, y: pointer.y + 60 },
            { x: pointer.x + 50, y: pointer.y + 54 },
            { x: pointer.x + 50, y: pointer.y + 66 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const tSplitGroup = new Group([tSplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(tSplitGroup);
          canvas.setActiveObject(tSplitGroup);
          break;
        }

        case "t-split-left-elbow": {
          const tSplitPath = new Path(
            `M ${pointer.x + 60} ${pointer.y} L ${pointer.x + 60} ${pointer.y + 80} M ${pointer.x + 60} ${pointer.y + 20} L ${pointer.x} ${pointer.y + 20} M ${pointer.x + 60} ${pointer.y + 60} L ${pointer.x} ${pointer.y + 60}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x, y: pointer.y + 20 },
            { x: pointer.x + 10, y: pointer.y + 14 },
            { x: pointer.x + 10, y: pointer.y + 26 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x, y: pointer.y + 60 },
            { x: pointer.x + 10, y: pointer.y + 54 },
            { x: pointer.x + 10, y: pointer.y + 66 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const tSplitGroup = new Group([tSplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(tSplitGroup);
          canvas.setActiveObject(tSplitGroup);
          break;
        }

        case "t-split-down-elbow": {
          const tSplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x + 80} ${pointer.y} M ${pointer.x + 20} ${pointer.y} L ${pointer.x + 20} ${pointer.y + 60} M ${pointer.x + 60} ${pointer.y} L ${pointer.x + 60} ${pointer.y + 60}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 20, y: pointer.y + 60 },
            { x: pointer.x + 14, y: pointer.y + 50 },
            { x: pointer.x + 26, y: pointer.y + 50 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 60, y: pointer.y + 60 },
            { x: pointer.x + 54, y: pointer.y + 50 },
            { x: pointer.x + 66, y: pointer.y + 50 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const tSplitGroup = new Group([tSplitPath, arrowHead1, arrowHead2], {
            selectable: true,
          });
          canvas.add(tSplitGroup);
          canvas.setActiveObject(tSplitGroup);
          break;
        }

        case "3-way-split-curved": {
          const threeSplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + 40} M ${pointer.x} ${pointer.y + 40} Q ${pointer.x + 10} ${pointer.y + 50} ${pointer.x + 50} ${pointer.y + 40} M ${pointer.x} ${pointer.y + 40} L ${pointer.x + 50} ${pointer.y + 80} M ${pointer.x} ${pointer.y + 40} Q ${pointer.x + 10} ${pointer.y + 50} ${pointer.x + 50} ${pointer.y + 120}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 40 },
            { x: pointer.x + 40, y: pointer.y + 38 },
            { x: pointer.x + 40, y: pointer.y + 42 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 80 },
            { x: pointer.x + 44, y: pointer.y + 70 },
            { x: pointer.x + 56, y: pointer.y + 70 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead3 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 120 },
            { x: pointer.x + 40, y: pointer.y + 118 },
            { x: pointer.x + 40, y: pointer.y + 122 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const threeSplitGroup = new Group([threeSplitPath, arrowHead1, arrowHead2, arrowHead3], {
            selectable: true,
          });
          canvas.add(threeSplitGroup);
          canvas.setActiveObject(threeSplitGroup);
          break;
        }

        case "3-way-split-elbow": {
          const threeSplitPath = new Path(
            `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y + 40} M ${pointer.x} ${pointer.y + 40} L ${pointer.x + 50} ${pointer.y + 40} M ${pointer.x} ${pointer.y + 40} L ${pointer.x + 50} ${pointer.y + 80} M ${pointer.x} ${pointer.y + 40} L ${pointer.x + 50} ${pointer.y + 120}`,
            {
              stroke: "#000000",
              strokeWidth: 2,
              fill: null,
              strokeUniform: true,
            }
          );
          const arrowHead1 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 40 },
            { x: pointer.x + 40, y: pointer.y + 34 },
            { x: pointer.x + 40, y: pointer.y + 46 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead2 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 80 },
            { x: pointer.x + 44, y: pointer.y + 70 },
            { x: pointer.x + 56, y: pointer.y + 70 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const arrowHead3 = new Polygon([
            { x: pointer.x + 50, y: pointer.y + 120 },
            { x: pointer.x + 44, y: pointer.y + 110 },
            { x: pointer.x + 56, y: pointer.y + 110 },
          ], {
            fill: "#000000",
            stroke: "#000000",
            strokeWidth: 0,
          });
          const threeSplitGroup = new Group([threeSplitPath, arrowHead1, arrowHead2, arrowHead3], {
            selectable: true,
          });
          canvas.add(threeSplitGroup);
          canvas.setActiveObject(threeSplitGroup);
          break;
        }

        default:
          // For any unhandled shapes, create a basic rectangle as fallback
          const defaultShape = new Rect({
            left: pointer.x - 40,
            top: pointer.y - 40,
            width: 80,
            height: 80,
            fill: "#3b82f6",
            stroke: "#000000",
            strokeWidth: 2,
          });
          canvas.add(defaultShape);
          canvas.setActiveObject(defaultShape);
        break;
    }

    canvas.requestRenderAll();
    if (onShapeCreated) onShapeCreated();

    // Show anchor point hint for shapes and polygons
    const shapeTools = new Set([
      'rectangle', 'square', 'rounded-rect', 'circle', 'ellipse',
      'rhombus', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon',
      'star', 'triangle', 'right-triangle',
      'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-double-h', 'arrow-thick',
      'process', 'decision', 'data', 'terminator', 'document', 'database',
      'callout', 'cloud', 'heart', 'cross',
    ]);
    if (shapeTools.has(activeTool)) {
      toast('Double-click to view anchor points, double-click again to add new ones for custom shapes', {
        duration: 3000,
        id: 'anchor-hint',
      });
    }

    // Save state for undo/redo after shape creation
    saveState();
    };

    // Double-click handler to edit text inside labeled shape groups
    const handleDblClick = (e: any) => {
      const target = e.target as any;
      if (!target) return;

      // Table groups are handled by the main dblclick handler above — skip here
      if (target.customType === 'table') return;

      if (target.type === 'group') {
        // Check if a specific sub-target (textbox or i-text) was clicked
        const subTarget = e.subTargets?.[0] as any;
        if (subTarget && (subTarget.type === 'textbox' || subTarget.type === 'i-text')) {
          canvas.setActiveObject(subTarget);
          if (subTarget.enterEditing) {
            subTarget.enterEditing();
            subTarget.selectAll?.();
          }
          canvas.requestRenderAll();
          return;
        }
        // Fallback: enter editing on the first textbox in the group
        const textObj = target.getObjects().find((o: any) => o.type === 'textbox');
        if (textObj) {
          canvas.setActiveObject(textObj);
          if ((textObj as any).enterEditing) {
            (textObj as any).enterEditing();
            (textObj as any).selectAll?.();
          }
          canvas.requestRenderAll();
        }
      } else if (target.type === 'textbox' || target.type === 'i-text') {
        (target as any).enterEditing?.();
        canvas.requestRenderAll();
      }
    };

    // Improve hit testing for nested objects
    (canvas as any).targetFindTolerance = 8;
    (canvas as any).subTargetCheck = true;

    // Detach previous handlers
    canvas.off("mouse:down", handleCanvasClick);
    canvas.off("mouse:dblclick", handleDblClick);
    
    // Attach handlers
    if (activeTool !== "select" && activeTool !== "freeform-line" && activeTool !== "pen" && activeTool !== "custom-polygon") {
      canvas.on("mouse:down", handleCanvasClick);
    }
    canvas.on("mouse:dblclick", handleDblClick);

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      canvas.off("mouse:dblclick", handleDblClick);
    };
  }, [canvas, activeTool, textFont, textAlign, textUnderline, textOverline, textBold, textItalic, connectorState.isDrawing, connectorState.startX, connectorState.startY]);

  // Visual feedback for active tool mode
  const isToolActive = activeTool && activeTool !== 'select';
  const toolModeClass = isToolActive 
    ? 'shadow-[0_0_0_2px_hsl(var(--primary)/0.5)] rounded-sm' 
    : '';

  return (
    <div
      className="inline-block"
      data-testid={CanvasEditorTestIds.CANVAS_WRAPPER}
    >
      <div className={`shadow-2xl bg-white transition-shadow duration-200 ${toolModeClass}`} style={{ boxShadow: '0 0 20px rgba(0,0,0,0.1)', willChange: 'box-shadow' }}>
        <div
          style={{
            width: `${(canvasDimensions.width || 1200) * (zoom / 100)}px`,
            height: `${(canvasDimensions.height || 800) * (zoom / 100)}px`,
            position: 'relative',
            display: 'inline-block',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid={CanvasEditorTestIds.CANVAS_ELEMENT}
          />
        </div>
      </div>
    </div>
  );
};
