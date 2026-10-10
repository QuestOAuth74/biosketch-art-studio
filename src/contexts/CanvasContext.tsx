import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo, useRef } from "react";
import { Canvas as FabricCanvas, FabricObject, Rect, Circle, Path, Group, ActiveSelection, util, Gradient, Shadow, FabricImage, Point, Polygon, loadSVGFromString } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { loadAllFonts, getBaseFontName, getCanvasFontFamily, getUsedGoogleFonts } from "@/lib/fontLoader";
import { smoothFabricPath } from "@/lib/pathSmoothing";
import { GradientConfig, ShadowConfig, LineGradientConfig, ImageFilterConfig, DEFAULT_IMAGE_FILTER_CONFIG, CropMode, LineEndpointType, CornerStyle, DEFAULT_LINE_CONNECTION_CONFIG, DEFAULT_LINE_STYLE_CONFIG } from "@/types/effects";
import { applyImageFilters as applyImageFiltersUtil } from "@/lib/imageFilters";
import { throttle, debounce, RenderScheduler } from "@/lib/performanceUtils";
import { safeDownloadDataUrl, reloadCanvasImagesWithCORS } from "@/lib/utils";
import { removeBackground } from "@/lib/backgroundRemoval";
import { HistoryManager } from "@/lib/historyManager";
import { createVersion, isSignificantChange, cleanupVersions } from "@/lib/versionManager";
import { distributeHorizontally as distributeHorizontallyUtil, distributeVertically as distributeVerticallyUtil, matchWidth as matchWidthUtil, matchHeight as matchHeightUtil, type BoundingBox } from "@/lib/alignmentUtils";
import { exitImageEditMode as exitImageEditModeFn } from "@/lib/imageMaskTool";
import { applyCMYKConversion, validateSVGForCMYK, extractColorsFromSVG } from "@/lib/cmykConverter";
import { fromPixels, Unit } from "@/lib/unitConversion";
import { useGridAndRulerStore } from "@/stores/gridAndRulerStore";
import { restoreObjectCustomProps, runPostLoadGlobalSteps } from "@/lib/canvasPostProcessing";
import { bakeLineGradientsForExport } from "@/lib/lineGradientRenderer";
import { applyWatermark, applyWatermarkToSVG } from "@/lib/watermark";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { checkProjectLimit } from "@/lib/projectLimit";

/** Recursively restore custom properties on objects and their group children */
function restorePropsRecursive(objects: any[], dataArray: any[]) {
  // If counts match, index-based matching is safe and fast (the normal case).
  if (objects.length === dataArray.length) {
    dataArray.forEach((objData: any, index: number) => {
      const obj = objects[index];
      if (!obj || !objData) return;
      restoreObjectCustomProps(obj, objData);
      if (obj.type === 'group' && obj._objects && objData.objects) {
        restorePropsRecursive(obj._objects, objData.objects);
      }
    });
    return;
  }

  // Counts differ (Fabric may have dropped unrecognised objects).
  // Build a lookup by identity fingerprint so we don't assign wrong props.
  console.warn(
    `[restorePropsRecursive] Object count mismatch: canvas has ${objects.length}, saved data has ${dataArray.length}. Using identity matching.`
  );

  const fingerprint = (d: any) => {
    const id = d.id || d.iconId || d.assetId || '';
    // Round positions to avoid floating-point drift
    const left = Math.round((d.left ?? 0) * 10);
    const top = Math.round((d.top ?? 0) * 10);
    return `${d.type || d.originalType || ''}|${id}|${left}|${top}`;
  };

  // Map each live object to its best-matching saved data
  const usedIndices = new Set<number>();
  for (const obj of objects) {
    const objFp = fingerprint(obj);
    let bestIdx = -1;

    // First pass: exact fingerprint match
    for (let i = 0; i < dataArray.length; i++) {
      if (usedIndices.has(i)) continue;
      if (fingerprint(dataArray[i]) === objFp) {
        bestIdx = i;
        break;
      }
    }

    if (bestIdx === -1) {
      // Fallback: match by id/iconId only
      for (let i = 0; i < dataArray.length; i++) {
        if (usedIndices.has(i)) continue;
        const d = dataArray[i];
        if (obj.id && d.id && obj.id === d.id) { bestIdx = i; break; }
        if (obj.iconId && d.iconId && obj.iconId === d.iconId) { bestIdx = i; break; }
      }
    }

    if (bestIdx !== -1) {
      usedIndices.add(bestIdx);
      restoreObjectCustomProps(obj, dataArray[bestIdx]);
      if (obj.type === 'group' && obj._objects && dataArray[bestIdx].objects) {
        restorePropsRecursive(obj._objects, dataArray[bestIdx].objects);
      }
    }
  }
}

// All custom Fabric.js properties that must be included when serialising canvas objects
// for saving or real-time collaboration. Add new custom properties here.
export const CANVAS_CUSTOM_PROPS = [
  // Bezier path properties
  'bezierPoints', 'isBezierPath', 'bezierPointsAreLocal',
  // Curved line properties
  'isCurvedLine', 'curvedLineStart', 'curvedLineEnd', 'curvedLineControlPoint',
  'curvedLocalStart', 'curvedLocalEnd', 'curvedLocalControl', 'curvedLineVersion',
  // Straight line properties
  'isStraightLine', 'straightLineStart', 'straightLineEnd', 'straightLineControlPoint', 'straightLineVersion',
  'startMarkerType', 'endMarkerType', 'markerOptions', 'isEndpointMarker', 'lineId',
  // Arc path properties
  'isArcPath', 'arcType', 'arcStartAngleDeg', 'arcEndAngleDeg', 'arcSweepCW', 'arcLargeArc',
  // Orthogonal line properties
  'isOrthogonalLine', 'orthogonalLineWaypoints', 'orthogonalLineLocalWaypoints', 'orthogonalLineLocalPoints', 'isClosed', 'cornerStyle',
  // Pathfinding properties
  'autoPathfindingEnabled', 'manualPathOverride',
  // Image mask properties
  'isMaskedImage', 'maskShape', 'cornerRadius',
  // Image crop properties
  'cropConfig',
  // Connector properties
  'isConnector', 'connectorData', 'startConnection', 'endConnection',
  // Line connection attachments (smart connectors)
  'startAttachment', 'endAttachment',
  // Line intersection properties
  'intersectionBehavior', 'arcRadius', 'gapSize', 'bridgeWidth', 'bridgeColor',
  // Membrane shape properties
  'isMembraneShape', 'membraneOptions', 'bezierPoints', 'worldBezierPoints',
  'isClosed', 'isRasterizedMembrane', 'originalScaleX', 'originalScaleY', 'vectorObjects',
  // Triple membrane properties
  'isTripleMembrane', 'tripleMembraneOptions', 'bezierPoints', 'worldBezierPoints',
  'isClosed', 'isRasterizedMembrane', 'originalScaleX', 'originalScaleY',
  // DNA helix properties
  'isDNAHelix', 'dnaHelixOptions', 'isRasterizedHelix',
  // Chart properties
  'chartConfig',
  // User asset properties (for asset-by-reference saving)
  'assetId', 'isUserAsset', '_fallbackSrc',
  // Image color map properties
  'colorMapConfig', 'originalImageSrc',
  // Icon properties (for reference-based saving)
  'iconId', 'isLibraryIcon', 'originalType',
  // Icon styling properties (tone/tint)
  'iconToneColor', 'iconToneIntensity', 'iconToneHue', 'originalColors',
  // Effects properties
  'shadow',
  // Line gradient config
  'gradientConfig', 'gradientOriginalStroke',
  // Freeform line properties
  'isFreeformLine', 'originalFreeformPoints', 'currentSmoothingStrength',
  'startMarker', 'endMarker', 'lineThickness',
  // Reference guide properties
  'isReferenceGuide',
  // Group properties
  'isUserGroup',
  // Leader line properties (customType === "leader-line")
  'leaderLocalStart', 'leaderLocalEnd', 'labelOffsetX', 'labelOffsetY',
  'leaderLineStart', 'leaderLineEnd',
  // Bracket / bracket-label properties (customType === "bracket-label")
  'bracketOrientation', 'bracketLocalCenter', 'bracketConnectionPoint',
  'labelLocalEdge', 'bracketSize', 'bracketGap',
  // Other custom properties
  'id', 'name', 'data', 'customProp', 'customType',
  // Real-time sync timestamp (per-object Last-Write-Wins merge key)
  '_syncedAt',
];

interface CanvasContextType {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas | null) => void;
  selectedObject: FabricObject | null;
  setSelectedObject: (obj: FabricObject | null) => void;
  firstSelectedObjectRef: React.MutableRefObject<FabricObject | null>;
  zoom: number;
  setZoom: (zoom: number) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  backgroundGradient: boolean;
  setBackgroundGradient: (enabled: boolean) => void;
  gradientStartColor: string;
  setGradientStartColor: (color: string) => void;
  gradientEndColor: string;
  setGradientEndColor: (color: string) => void;
  gradientType: 'linear' | 'radial';
  setGradientType: (type: 'linear' | 'radial') => void;
  gradientAngle: number;
  setGradientAngle: (angle: number) => void;
  gradientCenterX: number;
  setGradientCenterX: (x: number) => void;
  gradientCenterY: number;
  setGradientCenterY: (y: number) => void;
  gradientRadius: number;
  setGradientRadius: (radius: number) => void;
  canvasDimensions: { width: number; height: number };
  setCanvasDimensions: (dimensions: { width: number; height: number }) => void;
  paperSize: string;
  setPaperSize: (sizeId: string) => void;
  canvasLoadVersion: number;
  setCanvasLoadVersion: (fn: (prev: number) => number) => void;
  customDimensions: { width: number; height: number; unit: 'px' | 'in' | 'cm' | 'mm' };
  setCustomDimensions: (dims: { width: number; height: number; unit: 'px' | 'in' | 'cm' | 'mm' }) => void;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  projectOwnerId: string | null;
  projectName: string;
  setProjectName: (name: string) => void;
  isSaving: boolean;
  isLoadingProject: boolean;
  iconLoadingProgress: { current: number; total: number } | null;
  saveProject: (isManualSave?: boolean) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  
  // Canvas operations
  undo: () => void;
  redo: () => void;
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: () => void;
  cancelHistoryTransaction: () => void;
  saveStateWithLabel: (label?: string, eventType?: string) => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  deleteSelected: () => void;
  selectAll: () => void;
  hasClipboardContent: boolean;
  
  // Zoom operations
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetZoom: () => void;
  setCustomZoom: (value: number) => boolean;

  // Alignment operations
  alignLeft: () => void;
  alignCenter: () => void;
  alignRight: () => void;
  alignTop: () => void;
  alignMiddle: () => void;
  alignBottom: () => void;

  // Distribution operations
  distributeHorizontally: () => void;
  distributeVertically: () => void;
  distributionSpacing: number | '';
  setDistributionSpacing: (spacing: number | '') => void;

  // Match dimension operations
  matchWidth: () => void;
  matchHeight: () => void;

  // Flip operations
  flipHorizontal: () => void;
  flipVertical: () => void;
  
  // Layer operations
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  
  // Group operations
  groupSelected: () => void;
  ungroupSelected: () => void;

  // AI: per-object segmentation of raster images — splits into editable layers
  extractObjectsFromImage: () => Promise<{ regionCount: number } | null>;

  // Export operations
  exportAsPNG: (dpi?: 150 | 300 | 600, selectionOnly?: boolean) => void;
  exportAsPNGTransparent: (dpi?: 150 | 300 | 600, selectionOnly?: boolean) => void;
  exportAsJPG: (dpi?: 150 | 300 | 600, selectionOnly?: boolean) => void;
  exportAsSVG: (selectionOnly?: boolean) => void;
  exportAsPDF: (dpi?: 150 | 300 | 600, selectionOnly?: boolean, options?: { cmykMode?: boolean }) => void;
  exportAsPPTX: (dpi?: 150 | 300 | 600, selectionOnly?: boolean) => void;
  cleanExport: () => void;
  
  // Recent colors
  recentColors: string[];
  addToRecentColors: (color: string) => void;
  
  // Export dialog state
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  
  // Text formatting properties
  textFont: string;
  setTextFont: (font: string) => void;
  textAlign: string;
  setTextAlign: (align: string) => void;
  textUnderline: boolean;
  setTextUnderline: (underline: boolean) => void;
  textOverline: boolean;
  setTextOverline: (overline: boolean) => void;
  textBold: boolean;
  setTextBold: (bold: boolean) => void;
  textItalic: boolean;
  setTextItalic: (italic: boolean) => void;
  textListType: 'none' | 'bullet' | 'numbered';
  setTextListType: (type: 'none' | 'bullet' | 'numbered') => void;
  textSubscript: boolean;
  setTextSubscript: (subscript: boolean) => void;
  textSuperscript: boolean;
  setTextSuperscript: (superscript: boolean) => void;
  
  // Pin/Lock operations
  pinObject: () => void;
  unpinObject: () => void;
  togglePin: () => void;
  isPinned: boolean;
  
  // Layer panel operations
  getCanvasObjects: () => FabricObject[];
  selectObjectById: (id: string) => void;
  toggleObjectVisibility: (id: string) => void;
  toggleObjectLock: (id: string) => void;
  reorderObjects: (fromId: string, toId: string) => void;

  // Crop operations
  cropMode: CropMode;
  setCropMode: (mode: CropMode) => void;
  cropImage: (cropData: any) => void;
  resetCrop: () => void;
  
  // Path smoothing
  smoothenPath: (strength: number) => void;
  
  // Nudge operations
  nudgeObject: (direction: 'up' | 'down' | 'left' | 'right', amount?: number) => void;
  
  // History
  saveState: () => void;
  saveTransformDelta: (target: any, action?: string) => boolean;
  isPerformingHistoryOperationRef: React.MutableRefObject<boolean>;
  
  // Flash effect
  flashCanvas: (type?: 'success' | 'info') => void;
  
  // Recovery operations
  recoverCanvas: (recoveryData: any) => void;
  checkForRecovery: () => { data: any; ageMinutes: number } | null;
  
  // Advanced shortcuts
  duplicateSelected: () => void;
  pasteInPlace: () => void;
  deselectAll: () => void;
  toggleLockSelected: () => void;
  hideSelected: () => void;
  showAllHidden: () => void;
  rotateSelected: (degrees: number) => void;
  duplicateBelow: () => void;
  loadTemplate: (template: any) => Promise<void>;
  importProjectToCanvas: (projectId: string, mode: 'replace' | 'overlay') => Promise<void>;
  
  // Gradient operations
  applyGradient: (config: GradientConfig, target: 'fill' | 'stroke') => void;
  clearGradient: (target: 'fill' | 'stroke') => void;
  
  // Shadow operations
  applyShadow: (config: ShadowConfig) => void;
  clearEffects: () => void;

  // Image filter operations
  applyImageFilters: (config: ImageFilterConfig) => void;
  getImageFilters: () => ImageFilterConfig | null;
  clearImageFilters: () => void;

  // Background removal
  removeImageBackground: () => Promise<void>;
  
  // Line gradient operations
  applyLineGradient: (config: any) => void;
  clearLineGradient: () => void;

  // Bezier edit mode
  isBezierEditMode: boolean;
  setIsBezierEditMode: (mode: boolean) => void;
  bezierEditModeRef: any;
  editingBezierPath: FabricObject | null;
  setEditingBezierPath: (path: FabricObject | null) => void;
  exitBezierEditMode: () => void;

  // Curved line edit mode
  isCurvedLineEditMode: boolean;
  setIsCurvedLineEditMode: (mode: boolean) => void;
  curvedLineEditModeRef: any;
  editingCurvedLine: FabricObject | null;
  setEditingCurvedLine: (line: FabricObject | null) => void;
  exitCurvedLineEditMode: () => void;

  // Straight line edit mode
  isStraightLineEditMode: boolean;
  setIsStraightLineEditMode: (mode: boolean) => void;
  straightLineEditModeRef: any;
  editingStraightLine: FabricObject | null;
  setEditingStraightLine: (line: FabricObject | null) => void;
  exitStraightLineEditMode: () => void;

  // Orthogonal line edit mode
  isOrthogonalLineEditMode: boolean;
  setIsOrthogonalLineEditMode: (mode: boolean) => void;
  orthogonalLineEditModeRef: any;
  editingOrthogonalLine: FabricObject | null;
  setEditingOrthogonalLine: (line: FabricObject | null) => void;
  exitOrthogonalLineEditMode: () => void;

  // Leader line edit mode
  isLeaderLineEditMode: boolean;
  setIsLeaderLineEditMode: (mode: boolean) => void;
  leaderLineEditModeRef: any;
  editingLeaderLine: FabricObject | null;
  setEditingLeaderLine: (line: FabricObject | null) => void;
  exitLeaderLineEditMode: () => void;

  // Bracket edit mode
  isBracketEditMode: boolean;
  setIsBracketEditMode: (mode: boolean) => void;
  bracketEditModeRef: any;
  editingBracket: FabricObject | null;
  setEditingBracket: (bracket: FabricObject | null) => void;
  exitBracketEditMode: () => void;

  // Image edit mode (for masked images)
  isImageEditMode: boolean;
  setIsImageEditMode: (mode: boolean) => void;
  imageEditModeRef: any;
  editingMaskedImage: Group | null;
  setEditingMaskedImage: (group: Group | null) => void;
  exitImageEditMode: () => void;

  // Membrane edit mode
  isMembraneEditMode: boolean;
  setIsMembraneEditMode: (mode: boolean) => void;
  membraneEditModeRef: any;
  editingMembrane: FabricObject | null;
  setEditingMembrane: (membrane: FabricObject | null) => void;
  exitMembraneEditMode: () => void;

  // Read-only mode
  isReadOnly: boolean;
  setIsReadOnly: (readOnly: boolean) => void;
  loadSharedProject: (id: string) => Promise<void>;

  // Line connection and styling
  smartConnectorsEnabled: boolean;
  setSmartConnectorsEnabled: (enabled: boolean) => void;
  autoPathfindingEnabled: boolean;
  setAutoPathfindingEnabled: (enabled: boolean) => void;
  lineStyleType: 'straight' | 'curved' | 'orthogonal' | 'bezier';
  setLineStyleType: (type: 'straight' | 'curved' | 'orthogonal' | 'bezier') => void;
  lineStartEndpoint: LineEndpointType;
  setLineStartEndpoint: (type: LineEndpointType) => void;
  lineEndEndpoint: LineEndpointType;
  setLineEndEndpoint: (type: LineEndpointType) => void;
  lineStrokeWidth: number;
  setLineStrokeWidth: (width: number) => void;
  lineDashPattern: 'solid' | 'dashed' | 'dotted' | 'custom';
  setLineDashPattern: (pattern: 'solid' | 'dashed' | 'dotted' | 'custom') => void;
  lineCornerStyle: CornerStyle;
  setLineCornerStyle: (style: CornerStyle) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// (gradient rendering is handled by lineGradientRenderer.ts / after:render)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }
  return context;
};

interface CanvasProviderProps {
  children: ReactNode;
  initialReadOnly?: boolean;
}

export const CanvasProvider = ({ children, initialReadOnly = false }: CanvasProviderProps) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  
  type ClipboardJSON = { type: 'single', object: any } | { type: 'multiple', objects: any[] };
  const [clipboard, setClipboard] = useState<ClipboardJSON | null>(null);

  const [zoom, setZoom] = useState(100);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundGradient, setBackgroundGradient] = useState(false);
  const [gradientStartColor, setGradientStartColor] = useState("#f0f9ff");
  const [gradientEndColor, setGradientEndColor] = useState("#ffffff");
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [gradientAngle, setGradientAngle] = useState(90);
  const [gradientCenterX, setGradientCenterX] = useState(0.5);
  const [gradientCenterY, setGradientCenterY] = useState(0.5);
  const [gradientRadius, setGradientRadius] = useState(100);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });
  const [paperSize, setPaperSize] = useState("custom");
  const [customDimensions, setCustomDimensions] = useState<{ width: number; height: number; unit: 'px' | 'in' | 'cm' | 'mm' }>({
    width: 1200,
    height: 800,
    unit: 'px'
  });
  const [distributionSpacing, setDistributionSpacing] = useState<number | ''>('');
  
  // New differential history manager for better performance
  const historyManager = useRef<HistoryManager>(new HistoryManager(20));
  const [historyStep, setHistoryStep] = useState(0);
  
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Diagram");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [iconLoadingProgress, setIconLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Counter to trigger re-render of rulers/grid after project load
  const [canvasLoadVersion, setCanvasLoadVersion] = useState(0);
  
  // Performance optimization: track if canvas has unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  // Track if we're currently loading a project to prevent auto-save during initialization
  const isLoadingProjectRef = useRef(false);

  // Pause autosave briefly after undo/redo so a bad restore never gets persisted
  // before the user has a chance to notice and redo. See UNDO_AUTOSAVE_PAUSE_MS below.
  const lastUndoRedoTimeRef = useRef<number>(0);

  // Track last activity time for smart auto-save
  const lastActivityTimeRef = useRef(Date.now());

  // Track if the last load had icon reconstruction failures — blocks auto-save to prevent data loss
  const loadHadReconstructionFailuresRef = useRef(false);

  // Render scheduler for batching renders
  const renderScheduler = useRef<RenderScheduler | null>(null);

  // Track first selected object for match width/height operations
  const firstSelectedObjectRef = useRef<FabricObject | null>(null);

  useEffect(() => {
    if (canvas) {
      renderScheduler.current = new RenderScheduler(canvas);
    }
  }, [canvas]);
  
  // Recent colors state (persisted to localStorage)
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const stored = localStorage.getItem('canvas_recent_colors');
    return stored ? JSON.parse(stored) : [];
  });
  
  // Text formatting state
  const [textFont, setTextFont] = useState("Inter");
  const [textAlign, setTextAlign] = useState("left");
  const [textUnderline, setTextUnderline] = useState(false);
  const [textOverline, setTextOverline] = useState(false);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textListType, setTextListType] = useState<'none' | 'bullet' | 'numbered'>('none');
  const [textSubscript, setTextSubscript] = useState(false);
  const [textSuperscript, setTextSuperscript] = useState(false);
  
  // Pin state
  const [isPinned, setIsPinned] = useState(false);
  
  // Crop state
  const [cropMode, setCropMode] = useState<CropMode>('none');

  // Line connection and styling state
  const [smartConnectorsEnabled, setSmartConnectorsEnabled] = useState(DEFAULT_LINE_CONNECTION_CONFIG.smartConnectorsEnabled);
  const [autoPathfindingEnabled, setAutoPathfindingEnabled] = useState(DEFAULT_LINE_CONNECTION_CONFIG.autoPathfindingEnabled);
  const [lineStyleType, setLineStyleType] = useState<'straight' | 'curved' | 'orthogonal' | 'bezier'>(DEFAULT_LINE_STYLE_CONFIG.lineType);
  const [lineStartEndpoint, setLineStartEndpoint] = useState<LineEndpointType>(DEFAULT_LINE_STYLE_CONFIG.startEndpoint);
  const [lineEndEndpoint, setLineEndEndpoint] = useState<LineEndpointType>(DEFAULT_LINE_STYLE_CONFIG.endEndpoint);
  const [lineStrokeWidth, setLineStrokeWidth] = useState(DEFAULT_LINE_STYLE_CONFIG.strokeWidth);
  const [lineDashPattern, setLineDashPattern] = useState<'solid' | 'dashed' | 'dotted' | 'custom'>(DEFAULT_LINE_STYLE_CONFIG.dashPattern);
  const [lineCornerStyle, setLineCornerStyle] = useState<CornerStyle>(DEFAULT_LINE_STYLE_CONFIG.cornerStyle);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Read-only mode state
  const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);

  // Track whether current project is a cloned community project (for watermark logic)
  const [isCommunityClone, setIsCommunityClone] = useState(false);
  const { hasAccess: hasPremiumAccess } = useFeatureAccess();

  // Keep isReadOnly in sync with prop changes
  useEffect(() => {
    setIsReadOnly(initialReadOnly);
  }, [initialReadOnly]);

  // Bezier edit mode state
  const [isBezierEditMode, setIsBezierEditMode] = useState(false);
  const [editingBezierPath, setEditingBezierPath] = useState<FabricObject | null>(null);
  const bezierEditModeRef = useRef<any>(null);

  // Curved line edit mode state
  const [isCurvedLineEditMode, setIsCurvedLineEditMode] = useState(false);
  const [editingCurvedLine, setEditingCurvedLine] = useState<FabricObject | null>(null);
  const curvedLineEditModeRef = useRef<any>(null);

  // Straight line edit mode state
  const [isStraightLineEditMode, setIsStraightLineEditMode] = useState(false);
  const [editingStraightLine, setEditingStraightLine] = useState<FabricObject | null>(null);
  const straightLineEditModeRef = useRef<any>(null);

  // Orthogonal line edit mode state
  const [isOrthogonalLineEditMode, setIsOrthogonalLineEditMode] = useState(false);
  const [editingOrthogonalLine, setEditingOrthogonalLine] = useState<FabricObject | null>(null);
  const orthogonalLineEditModeRef = useRef<any>(null);

  // Image edit mode state (for masked images)
  const [isImageEditMode, setIsImageEditMode] = useState(false);
  const [editingMaskedImage, setEditingMaskedImage] = useState<Group | null>(null);
  const imageEditModeRef = useRef<Group | null>(null);

  // Membrane edit mode state
  const [isMembraneEditMode, setIsMembraneEditMode] = useState(false);
  const [editingMembrane, setEditingMembrane] = useState<FabricObject | null>(null);
  const membraneEditModeRef = useRef<any>(null);

  // History management with differential compression
  // Use ref to avoid stale closures when passed to child components
  const canvasRef = useRef<FabricCanvas | null>(null);
  const isPerformingHistoryOperation = useRef(false);
  const initialStateSaved = useRef(false);

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  const saveState = useCallback((force = false) => {
    const currentCanvas = canvasRef.current;

    // Don't save state during undo/redo operations
    if (isPerformingHistoryOperation.current) {
      return;
    }

    // Don't save state during project load (unless forced)
    if (!force && isLoadingProjectRef.current) {
      return;
    }

    // Don't save state during drag operations
    if ((window as any).isDraggingObject) {
      return;
    }

    if (!currentCanvas) return;

    // Don't save state if any object is in edit mode
    const hasObjectInEditMode = currentCanvas.getObjects().some((obj: any) => obj.isEditMode === true);
    if (hasObjectInEditMode) {
      return;
    }
    historyManager.current.saveState(currentCanvas);
    setHistoryStep(historyManager.current.getCurrentStep());
    setSaveStatus('unsaved');
    setIsDirty(true);
  }, []); // No dependencies - uses ref instead
  
  // Fast-path save for simple transforms — skips full canvas serialization
  const saveTransformDelta = useCallback((target: any, action?: string) => {
    const currentCanvas = canvasRef.current;
    if (!currentCanvas || isPerformingHistoryOperation.current) return false;
    if ((window as any).isDraggingObject) return false;

    const succeeded = historyManager.current.saveTransformDelta(currentCanvas, target, action);
    if (succeeded) {
      setHistoryStep(historyManager.current.getCurrentStep());
      setSaveStatus('unsaved');
      setIsDirty(true);
    }
    return succeeded;
  }, []);

  // Throttled version of saveState for object modifications
  const throttledSaveState = useMemo(
    () => throttle(saveState, 500),
    [saveState]
  );

  const undo = useCallback(async () => {
    if (!canvas) return;

    // If we're in edit mode, reload current state to discard edits instead of going back in history
    const wasInEditMode = isBezierEditMode || isCurvedLineEditMode || isStraightLineEditMode ||
                           isOrthogonalLineEditMode || isImageEditMode || isMembraneEditMode;
    if (wasInEditMode) {

      // Deactivate edit modes to clean up handles properly
      // Pass skipSave=true since we're discarding edits via undo
      if (isBezierEditMode && bezierEditModeRef.current) {

        bezierEditModeRef.current.deactivate(true);
        setIsBezierEditMode(false);
        setEditingBezierPath(null);
      }
      if (isCurvedLineEditMode && curvedLineEditModeRef.current) {

        curvedLineEditModeRef.current.deactivate(true);
        setIsCurvedLineEditMode(false);
        setEditingCurvedLine(null);
      }
      if (isStraightLineEditMode && straightLineEditModeRef.current) {

        straightLineEditModeRef.current.deactivate(true);
        setIsStraightLineEditMode(false);
        setEditingStraightLine(null);
      }
      if (isOrthogonalLineEditMode && orthogonalLineEditModeRef.current) {

        orthogonalLineEditModeRef.current.deactivate(true);
        setIsOrthogonalLineEditMode(false);
        setEditingOrthogonalLine(null);
      }
      if (isImageEditMode) {
        setIsImageEditMode(false);
        setEditingMaskedImage(null);
      }
      if (isMembraneEditMode && membraneEditModeRef.current) {

        const newMembraneGroup = await membraneEditModeRef.current.deactivate();
        setIsMembraneEditMode(false);
        if (newMembraneGroup) {
          setEditingMembrane(newMembraneGroup);
        } else {
          setEditingMembrane(null);
        }
      }

      // Set flag to prevent saveState during restore
      isPerformingHistoryOperation.current = true;

      try {
        // Reload current state to discard in-memory edits without moving back in history
        const currentStep = historyManager.current.getCurrentStep();

        try {
          await historyManager.current.restoreState(canvas, currentStep);
        } catch (err: any) {
          if (err?.message === 'EMPTY_STATE_RESTORE_BLOCKED') {
            toast.error("Edit-mode discard blocked — current history step appears corrupted. Your canvas is safe.");
            return;
          }
          console.error('[EDIT-MODE DISCARD] Unexpected error:', err);
          toast.error(`Discard failed: ${err?.message ?? 'unknown error'}`);
          return;
        }

        // Extra cleanup: Remove any lingering edit mode handles
        const editModeHandles = canvas.getObjects().filter((obj: any) =>
          obj.isAnchorHandle || obj.isControlHandle || obj.isGuideLine || obj.isHandleLine || obj.excludeFromExport
        );

        editModeHandles.forEach(obj => canvas.remove(obj));

        // Clear the refs to prevent stale references
        if (bezierEditModeRef.current) {
          bezierEditModeRef.current.path = null;
        }
        if (curvedLineEditModeRef.current) {
          curvedLineEditModeRef.current.line = null;
        }

        reloadCanvasImagesWithCORS(canvas);
        renderScheduler.current?.scheduleRender();
        setHistoryStep(historyManager.current.getCurrentStep());
      } finally {
        // Always clear the flag
        isPerformingHistoryOperation.current = false;
      }
      return;
    }

    // Not in edit mode - perform normal undo

    // Set flag to prevent saveState during undo
    isPerformingHistoryOperation.current = true;

    // Record undo attempt so autosave pauses even if the restore is blocked —
    // that way a subsequent event-driven save can't race in and persist the
    // wrong state while the user is figuring out what happened.
    lastUndoRedoTimeRef.current = Date.now();

    try {

      let success = false;
      try {
        success = await historyManager.current.undo(canvas);
      } catch (err: any) {
        // Known guard trip → dedicated toast, no further work.
        if (err?.message === 'EMPTY_STATE_RESTORE_BLOCKED') {
          toast.error("Undo blocked — that step would wipe the canvas. Your work is safe.");
          return;
        }
        // Any other throw (corrupted diff base, decompression failure, invalid
        // step) used to become an unhandled promise rejection with no user
        // feedback — the button would just do nothing. Surface it explicitly.
        console.error('[UNDO] Unexpected error:', err);
        toast.error(`Undo failed: ${err?.message ?? 'unknown error'}`);
        return;
      }

      if (success) {

        // Extra cleanup: Remove any lingering edit mode handles
        const editModeHandles = canvas.getObjects().filter((obj: any) =>
          obj.isAnchorHandle || obj.isControlHandle || obj.isGuideLine || obj.isHandleLine || obj.excludeFromExport
        );

        editModeHandles.forEach(obj => canvas.remove(obj));

        // Clear the refs to prevent stale references
        if (bezierEditModeRef.current) {
          bezierEditModeRef.current.path = null;
        }
        if (curvedLineEditModeRef.current) {
          curvedLineEditModeRef.current.line = null;
        }

        // Reconnect composite event handlers (leader-line transform/label sync)
        // BEFORE marker/line reconnects so endpoints attach to fresh composites.
        const { reconnectLeaderLines: _reconnectLeaderUndo } = await import('@/lib/leaderLineTool');
        _reconnectLeaderUndo(canvas);

        // Reconnect endpoint markers and line control handles after undo
        const { reconnectLineMarkers: _reconnectMarkersUndo } = await import('@/lib/lineEndpointRenderer');
        _reconnectMarkersUndo(canvas);
        const { cleanupOrphanHandles: _cleanupUndo, reconnectCurvedLines: _reconnectCurvedUndo } = await import('@/lib/curvedLineTool');
        _cleanupUndo(canvas);
        _reconnectCurvedUndo(canvas);
        const { reconnectStraightLines: _reconnectStraightUndo } = await import('@/lib/straightLineTool');
        _reconnectStraightUndo(canvas);

        reloadCanvasImagesWithCORS(canvas);
        renderScheduler.current?.scheduleRender();
        setHistoryStep(historyManager.current.getCurrentStep());
      }
    } finally {
      // Always clear the flag
      isPerformingHistoryOperation.current = false;
    }
  }, [canvas, isBezierEditMode, isCurvedLineEditMode, isStraightLineEditMode, isOrthogonalLineEditMode, isImageEditMode, isMembraneEditMode]);

  const redo = useCallback(async () => {
    if (!canvas) return;

    // If we're in edit mode, deactivate it first to clean up handles
    const wasInEditMode = isBezierEditMode || isCurvedLineEditMode || isStraightLineEditMode ||
                           isOrthogonalLineEditMode || isImageEditMode || isMembraneEditMode;
    if (wasInEditMode) {
      // Deactivate edit modes to clean up handles properly
      if (isBezierEditMode && bezierEditModeRef.current) {
        bezierEditModeRef.current.deactivate();
        setIsBezierEditMode(false);
        setEditingBezierPath(null);
      }
      if (isCurvedLineEditMode && curvedLineEditModeRef.current) {
        curvedLineEditModeRef.current.deactivate();
        setIsCurvedLineEditMode(false);
        setEditingCurvedLine(null);
      }
      if (isStraightLineEditMode && straightLineEditModeRef.current) {
        straightLineEditModeRef.current.deactivate();
        setIsStraightLineEditMode(false);
        setEditingStraightLine(null);
      }
      if (isOrthogonalLineEditMode && orthogonalLineEditModeRef.current) {
        orthogonalLineEditModeRef.current.deactivate();
        setIsOrthogonalLineEditMode(false);
        setEditingOrthogonalLine(null);
      }
      if (isImageEditMode) {
        setIsImageEditMode(false);
        setEditingMaskedImage(null);
      }
      if (isMembraneEditMode && membraneEditModeRef.current) {
        const newMembraneGroup = await membraneEditModeRef.current.deactivate();
        setIsMembraneEditMode(false);
        if (newMembraneGroup) {
          setEditingMembrane(newMembraneGroup);
        } else {
          setEditingMembrane(null);
        }
      }
    }

    // Set flag to prevent saveState during redo
    isPerformingHistoryOperation.current = true;

    // Record redo attempt so autosave pauses even if the restore is blocked.
    lastUndoRedoTimeRef.current = Date.now();

    try {
      let success = false;
      try {
        success = await historyManager.current.redo(canvas);
      } catch (err: any) {
        // Known guard trip (should not happen for redo anymore, but keep
        // the branch defensively).
        if (err?.message === 'EMPTY_STATE_RESTORE_BLOCKED') {
          toast.error("Redo blocked — that step would wipe the canvas. Your work is safe.");
          return;
        }
        // Surface anything else instead of dropping it on the floor.
        console.error('[REDO] Unexpected error:', err);
        toast.error(`Redo failed: ${err?.message ?? 'unknown error'}`);
        return;
      }

      if (success) {
        // Clear the refs to prevent stale references
        if (bezierEditModeRef.current) {
          bezierEditModeRef.current.path = null;
        }
        if (curvedLineEditModeRef.current) {
          curvedLineEditModeRef.current.line = null;
        }

        // Reconnect composite event handlers (leader-line transform/label sync)
        // BEFORE marker/line reconnects so endpoints attach to fresh composites.
        const { reconnectLeaderLines: _reconnectLeaderRedo } = await import('@/lib/leaderLineTool');
        _reconnectLeaderRedo(canvas);

        // Reconnect endpoint markers and line control handles after redo
        const { reconnectLineMarkers: _reconnectMarkersRedo } = await import('@/lib/lineEndpointRenderer');
        _reconnectMarkersRedo(canvas);
        const { cleanupOrphanHandles: _cleanupRedo, reconnectCurvedLines: _reconnectCurvedRedo } = await import('@/lib/curvedLineTool');
        _cleanupRedo(canvas);
        _reconnectCurvedRedo(canvas);
        const { reconnectStraightLines: _reconnectStraightRedo } = await import('@/lib/straightLineTool');
        _reconnectStraightRedo(canvas);

        reloadCanvasImagesWithCORS(canvas);
        renderScheduler.current?.scheduleRender();
        setHistoryStep(historyManager.current.getCurrentStep());
      }
    } finally {
      // Always clear the flag
      isPerformingHistoryOperation.current = false;
    }
  }, [canvas, isBezierEditMode, isCurvedLineEditMode, isStraightLineEditMode, isOrthogonalLineEditMode, isImageEditMode, isMembraneEditMode]);

  const beginHistoryTransaction = useCallback(() => {
    if (!canvas) return;
    historyManager.current.beginTransaction(canvas);
  }, [canvas]);

  const commitHistoryTransaction = useCallback(() => {
    if (!canvas) return;
    historyManager.current.commitTransaction(canvas);
    setHistoryStep(historyManager.current.getCurrentStep());
    setSaveStatus('unsaved');
    setIsDirty(true);
  }, [canvas]);

  const cancelHistoryTransaction = useCallback(() => {
    if (!canvas) return;
    historyManager.current.cancelTransaction();
    setHistoryStep(historyManager.current.getCurrentStep());
  }, [canvas]);

  const saveStateWithLabel = useCallback((label?: string, eventType?: string) => {
    if (!canvas) return;
    historyManager.current.saveState(canvas, label, eventType);
    setHistoryStep(historyManager.current.getCurrentStep());
    setSaveStatus('unsaved');
    setIsDirty(true);
  }, [canvas]);

  // Clipboard operations
  const cut = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    try {
      if (activeObject.type === 'activeSelection') {
        const selection = activeObject as ActiveSelection;
        const objects = selection.getObjects().filter(obj =>
          !(obj as any).isGridLine && !(obj as any).isRuler
        );
        // Serialize with world transforms — ActiveSelection children
        // have local coords, so we compute world position from the matrix.
        const jsons = objects.map(obj => {
          const json = serializeObject(obj);
          const worldMatrix = obj.calcTransformMatrix();
          const decomposed = util.qrDecompose(worldMatrix);
          // qrDecompose gives the world CENTER point; translate back to
          // the object's actual origin (left/top) for correct serialization.
          const worldCenter = new Point(decomposed.translateX, decomposed.translateY);
          const originPt = obj.translateToOriginPoint(
            worldCenter, obj.originX, obj.originY
          );
          json.left = originPt.x;
          json.top = originPt.y;
          json.angle = decomposed.angle;
          json.scaleX = decomposed.scaleX;
          json.scaleY = decomposed.scaleY;
          json.skewX = decomposed.skewX;
          json.skewY = decomposed.skewY;
          return json;
        });
        setClipboard({ type: 'multiple', objects: jsons });

        // Remove all objects from the selection
        objects.forEach(obj => {
          canvas.remove(obj);
        });
        
        canvas.discardActiveObject();
        toast.success(`${jsons.length} objects cut`);
      } else {
        const json = serializeObject(activeObject);
        setClipboard({ type: 'single', object: json });
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        toast.success('Object cut');
      }
      
      canvas.requestRenderAll();
      saveState();
    } catch (error) {
      console.error('Cut failed:', error);
      toast.error('Failed to cut object');
    }
  }, [canvas, saveState]);

  // Properties to include when serializing objects for copy/paste
  const CLIPBOARD_PROPS = [
    // Custom/meta
    'id','name','data',
    // Geometry/transform
    'left','top','width','height','scaleX','scaleY','angle','flipX','flipY','skewX','skewY','originX','originY',
    // Appearance
    'fill','stroke','strokeWidth','strokeUniform','strokeDashArray','opacity','visible','shadow',
    // Text
    'text','fontFamily','fontSize','fontWeight','fontStyle','textAlign','underline','overline','linethrough','charSpacing','lineHeight','styles',
    // Path/shape specifics
    'rx','ry','radius','path',
    // Image specifics
    'src','crossOrigin','filters',
    // Image masking
    'isMaskedImage','maskShape','isEditingImage','cornerRadius',
    // Image cropping
    'cropConfig',
    // Orthogonal line properties
    'isOrthogonalLine','orthogonalLineWaypoints','orthogonalLineLocalWaypoints','orthogonalLineLocalPoints','isClosed',
    // Pathfinding properties
    'autoPathfindingEnabled','manualPathOverride',
    // Line connection attachments (smart connectors)
    'startAttachment','endAttachment',
    // Endpoint marker identity (prevents connection points from showing on markers)
    'isEndpointMarker','lineId',
    // User asset properties (for asset-by-reference saving)
    'assetId','isUserAsset','colorMapConfig','originalImageSrc',
    // Icon properties (for reference-based saving)
    'iconId','isLibraryIcon','originalType',
    // Icon styling properties (tone/tint)
    'iconToneColor','iconToneIntensity','iconToneHue','originalColors',
    // Membrane shape properties
    'isMembraneShape','membraneOptions','worldBezierPoints','isClosed','isRasterizedMembrane','originalScaleX','originalScaleY','vectorObjects',
    // Triple membrane properties
    'isTripleMembrane','tripleMembraneOptions','bezierPoints',
    // DNA helix properties
    'isDNAHelix','dnaHelixOptions','isRasterizedHelix',
    // Group properties
    'isUserGroup',
    // Misc
    'globalCompositeOperation','clipPath',
    // Line gradient config
    'gradientConfig','gradientOriginalStroke',
    // Freeform line properties
    'isFreeformLine','originalFreeformPoints','currentSmoothingStrength',
    'startMarker','endMarker','lineThickness'
  ];

  // Helper to serialize object to JSON
  const serializeObject = (obj: FabricObject) => obj.toObject(CLIPBOARD_PROPS);

  // Robust wrapper around util.enlivenObjects to support both Promise and callback forms
  const enliven = (jsons: any[]): Promise<FabricObject[]> => {
    return new Promise((resolve, reject) => {
      try {
        const maybe = (util as any).enlivenObjects(jsons, (objects: FabricObject[]) => {
          resolve(objects);
        });
        if (maybe && typeof (maybe as any).then === 'function') {
          (maybe as Promise<FabricObject[]>).then(resolve).catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  };
  // Canvas flash effect for visual feedback
  const flashCanvas = useCallback((type: 'success' | 'info' = 'success') => {
    if (!canvas) return;
    
    const wrapper = (canvas as any).wrapperEl?.parentElement;
    if (!wrapper) return;
    
    const overlay = document.createElement('div');
    overlay.className = `absolute inset-0 pointer-events-none transition-opacity duration-300`;
    overlay.style.backgroundColor = type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)';
    overlay.style.opacity = '1';
    wrapper.style.position = 'relative';
    wrapper.appendChild(overlay);
    
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, 100);
  }, [canvas]);

  const copy = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    try {
      // Use instanceof rather than string match — Fabric 6 sets
      // ActiveSelection.type === 'ActiveSelection' (capital A), so the
      // previous lowercase compare always failed, dropped through to
      // the single-object branch, and serialized the whole selection
      // wrapper. Pasting that wrapper rendered as just a stuck
      // selection rectangle that couldn't be deleted.
      if (activeObject instanceof ActiveSelection) {
        const selection = activeObject;
        const objects = selection.getObjects().filter(obj =>
          !(obj as any).isGridLine && !(obj as any).isRuler
        );
        // Serialize with world transforms — ActiveSelection children
        // have local coords, so we compute world position from the matrix.
        const jsons = objects.map(obj => {
          const json = serializeObject(obj);
          const worldMatrix = obj.calcTransformMatrix();
          const decomposed = util.qrDecompose(worldMatrix);
          const worldCenter = new Point(decomposed.translateX, decomposed.translateY);
          const originPt = obj.translateToOriginPoint(
            worldCenter, obj.originX, obj.originY
          );
          json.left = originPt.x;
          json.top = originPt.y;
          json.angle = decomposed.angle;
          json.scaleX = decomposed.scaleX;
          json.scaleY = decomposed.scaleY;
          json.skewX = decomposed.skewX;
          json.skewY = decomposed.skewY;
          return json;
        });
        setClipboard({ type: 'multiple', objects: jsons });
        flashCanvas('info');
        toast.success(`${jsons.length} objects copied`, { duration: 1000, className: 'animate-fade-in' });
      } else {
        const json = serializeObject(activeObject);
        setClipboard({ type: 'single', object: json });
        flashCanvas('info');
        toast.success('Object copied', { duration: 1000, className: 'animate-fade-in' });
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy object');
    }
  }, [canvas, flashCanvas]);

  const paste = useCallback(async () => {
    if (!canvas || !clipboard) return;

    try {
      // Helper to restore custom props recursively (handles group children)
      const restoreRecursive = (obj: FabricObject, data: any) => {
        restoreObjectCustomProps(obj, data);
        if (obj.type === 'group' && (obj as any)._objects && data.objects) {
          (obj as any)._objects.forEach((child: any, i: number) => {
            if (data.objects[i]) restoreRecursive(child, data.objects[i]);
          });
        }
      };

      if (clipboard.type === 'multiple') {
        const objects = await enliven(clipboard.objects);
        const pasted: FabricObject[] = [];
        objects.forEach((obj, i) => {
          restoreRecursive(obj, clipboard.objects[i]);
          obj.set({
            left: (obj.left || 0) + 10,
            top: (obj.top || 0) + 10,
          });
          obj.setCoords();
          canvas.add(obj);
          pasted.push(obj);
        });

        if (pasted.length > 1) {
          const selection = new ActiveSelection(pasted, { canvas });
          canvas.setActiveObject(selection);
        } else if (pasted.length === 1) {
          canvas.setActiveObject(pasted[0]);
        }

        canvas.requestRenderAll();
        saveState();
        flashCanvas('success');
        toast.success(`${pasted.length} objects pasted`, { duration: 1000, className: 'animate-fade-in' });
      } else if (clipboard.type === 'single') {
        const [obj] = await enliven([clipboard.object]);
        if (!obj) {
          toast.error('Failed to paste object');
          return;
        }
        restoreRecursive(obj, clipboard.object);
        obj.set({
          left: (obj.left || 0) + 10,
          top: (obj.top || 0) + 10,
        });
        obj.setCoords();
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        saveState();
        flashCanvas('success');
        toast.success('Object pasted', { duration: 1000, className: 'animate-fade-in' });
      }
    } catch (error) {
      console.error('Paste failed:', error);
      toast.error('Failed to paste object');
    }
  }, [canvas, clipboard, saveState, flashCanvas]);

  const deleteSelected = useCallback(() => {
    if (!canvas) return;

    // Check if in orthogonal line edit mode with a selected waypoint
    if (isOrthogonalLineEditMode && orthogonalLineEditModeRef.current) {
      const selectedWaypointIndex = orthogonalLineEditModeRef.current.getSelectedWaypointIndex?.();
      if (selectedWaypointIndex !== null && selectedWaypointIndex !== undefined) {
        orthogonalLineEditModeRef.current.deleteWaypoint?.(selectedWaypointIndex);
        return;
      }
    }

    // Check if in straight line edit mode with a selected anchor
    if (isStraightLineEditMode && straightLineEditModeRef.current) {
      // Straight lines only have start/end, no point deletion
      return;
    }

    // Check if in curved line edit mode with a selected anchor
    if (isCurvedLineEditMode && curvedLineEditModeRef.current) {
      // Curved lines only have start/end, no point deletion
      return;
    }

    // Check if in bezier edit mode with a selected anchor
    if (isBezierEditMode && bezierEditModeRef.current) {
      const selectedAnchorId = bezierEditModeRef.current.getSelectedAnchorId?.();
      if (selectedAnchorId) {
        bezierEditModeRef.current.deleteAnchorPoint?.(selectedAnchorId);
        return;
      }
    }

    // Default behavior: delete selected objects
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveState();
    }
  }, [canvas, saveState, isOrthogonalLineEditMode, orthogonalLineEditModeRef, isStraightLineEditMode, straightLineEditModeRef, isCurvedLineEditMode, curvedLineEditModeRef, isBezierEditMode, bezierEditModeRef]);

  const selectAll = useCallback(() => {
    if (!canvas) return;
    const allObjects = canvas.getObjects().filter((obj: any) =>
      obj.selectable !== false && !obj.isGridLine && !obj.isRuler
    );
    if (allObjects.length === 0) return;
    canvas.discardActiveObject();
    const selection = new ActiveSelection(allObjects, { canvas });
    canvas.setActiveObject(selection);
    canvas.requestRenderAll();
  }, [canvas]);

  // Zoom operations
  const zoomIn = useCallback(() => {
    if (!canvas) return;
    const newZoom = Math.min(zoom + 10, 400);
    setZoom(newZoom);
  }, [canvas, zoom]);

  const zoomOut = useCallback(() => {
    if (!canvas) return;
    const newZoom = Math.max(zoom - 10, 10);
    setZoom(newZoom);
  }, [canvas, zoom]);

  const resetZoom = useCallback(() => {
    if (!canvas) return;
    setZoom(100);
  }, [canvas]);

  const setCustomZoom = useCallback((value: number) => {
    if (!canvas || value < 10 || value > 400) return false;
    setZoom(value);
    return true;
  }, [canvas]);

  const zoomToFit = useCallback(() => {
    if (!canvas) return;

    // Get the base canvas dimensions (not affected by zoom)
    const canvasWidth = canvasDimensions.width;
    const canvasHeight = canvasDimensions.height;

    // Find the ScrollArea viewport by traversing up from the canvas element
    const canvasElement = (canvas as any).lowerCanvasEl as HTMLCanvasElement;
    let scrollableContainer = canvasElement?.parentElement;

    // Traverse up to find the scrollable container (ScrollArea viewport)
    while (scrollableContainer && !scrollableContainer.hasAttribute('data-radix-scroll-area-viewport')) {
      scrollableContainer = scrollableContainer.parentElement;
    }

    // Get viewport dimensions
    const viewportWidth = scrollableContainer ? scrollableContainer.clientWidth : 800;
    const viewportHeight = scrollableContainer ? scrollableContainer.clientHeight : 600;

    // Account for the p-6 padding (1.5rem = 24px on each side = 48px total horizontal padding)
    const horizontalPadding = 48; // 24px left + 24px right
    const availableWidth = viewportWidth - horizontalPadding;

    // Calculate zoom to fit width (prevent horizontal scrolling)
    const scale = availableWidth / canvasWidth;

    // Apply zoom (CSS transform handles the visual zoom)
    const newZoom = Math.max(10, Math.min(400, Math.round(scale * 100)));
    setZoom(newZoom);

    toast.success("Fit to screen");
  }, [canvas, canvasDimensions]);

  // Alignment operations
  const alignLeft = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());
    const minLeft = Math.min(...bounds.map(b => b.left));

    // Align each object to the leftmost edge
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const offset = minLeft - objBounds.left;
      obj.set({ left: (obj.left || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  const alignCenter = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());

    // Calculate the center X of all selected objects
    const minLeft = Math.min(...bounds.map(b => b.left));
    const maxRight = Math.max(...bounds.map(b => b.left + b.width));
    const groupCenterX = (minLeft + maxRight) / 2;

    // Align each object to the group center
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const objCenterX = objBounds.left + objBounds.width / 2;
      const offset = groupCenterX - objCenterX;
      obj.set({ left: (obj.left || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  const alignRight = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());
    const maxRight = Math.max(...bounds.map(b => b.left + b.width));

    // Align each object to the rightmost edge
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const objRight = objBounds.left + objBounds.width;
      const offset = maxRight - objRight;
      obj.set({ left: (obj.left || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  const alignTop = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());
    const minTop = Math.min(...bounds.map(b => b.top));

    // Align each object to the topmost edge
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const offset = minTop - objBounds.top;
      obj.set({ top: (obj.top || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  const alignMiddle = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());

    // Calculate the center Y of all selected objects
    const minTop = Math.min(...bounds.map(b => b.top));
    const maxBottom = Math.max(...bounds.map(b => b.top + b.height));
    const groupCenterY = (minTop + maxBottom) / 2;

    // Align each object to the group center
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const objCenterY = objBounds.top + objBounds.height / 2;
      const offset = groupCenterY - objCenterY;
      obj.set({ top: (obj.top || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  const alignBottom = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Get bounding boxes for all objects
    const bounds = activeObjects.map(obj => obj.getBoundingRect());
    const maxBottom = Math.max(...bounds.map(b => b.top + b.height));

    // Align each object to the bottommost edge
    activeObjects.forEach((obj, i) => {
      const objBounds = bounds[i];
      const objBottom = objBounds.top + objBounds.height;
      const offset = maxBottom - objBottom;
      obj.set({ top: (obj.top || 0) + offset });
      obj.setCoords();
    });

    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  // Helper functions for distribution and match operations
  const fabricToBoundingBox = useCallback((fabricObj: FabricObject): BoundingBox => {
    const bounds = fabricObj.getBoundingRect();
    return {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height
    };
  }, []);

  const applyBoundingBoxToFabric = useCallback((fabricObj: FabricObject, bbox: BoundingBox): void => {
    // Get current bounds to calculate offset
    const currentBounds = fabricObj.getBoundingRect();
    const offsetX = (fabricObj.left || 0) - currentBounds.left;
    const offsetY = (fabricObj.top || 0) - currentBounds.top;

    // Apply new position
    fabricObj.set({
      left: bbox.x + offsetX,
      top: bbox.y + offsetY,
    });

    // Apply new dimensions via scaling
    const currentWidth = currentBounds.width;
    const currentHeight = currentBounds.height;

    if (bbox.width !== currentWidth && currentWidth > 0) {
      const scaleX = (fabricObj.scaleX || 1) * (bbox.width / currentWidth);
      fabricObj.set({ scaleX });
    }

    if (bbox.height !== currentHeight && currentHeight > 0) {
      const scaleY = (fabricObj.scaleY || 1) * (bbox.height / currentHeight);
      fabricObj.set({ scaleY });
    }

    fabricObj.setCoords();
  }, []);

  // Distribution operations
  const distributeHorizontally = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length < 3) {
      toast.error('Select at least 3 objects to distribute');
      return;
    }

    const bboxes = activeObjects.map(fabricToBoundingBox);
    const spacing = distributionSpacing === '' ? undefined : distributionSpacing;
    const distributed = distributeHorizontallyUtil(bboxes, spacing);

    activeObjects.forEach((obj, i) => {
      applyBoundingBoxToFabric(obj, distributed[i]);
    });

    canvas.requestRenderAll();
    saveState();

    if (spacing !== undefined) {
      toast.success(`Distributed ${activeObjects.length} objects with ${spacing}px spacing`);
    } else {
      toast.success(`Distributed ${activeObjects.length} objects horizontally`);
    }
  }, [canvas, saveState, fabricToBoundingBox, applyBoundingBoxToFabric, distributionSpacing]);

  const distributeVertically = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length < 3) {
      toast.error('Select at least 3 objects to distribute');
      return;
    }

    const bboxes = activeObjects.map(fabricToBoundingBox);
    const spacing = distributionSpacing === '' ? undefined : distributionSpacing;
    const distributed = distributeVerticallyUtil(bboxes, spacing);

    activeObjects.forEach((obj, i) => {
      applyBoundingBoxToFabric(obj, distributed[i]);
    });

    canvas.requestRenderAll();
    saveState();

    if (spacing !== undefined) {
      toast.success(`Distributed ${activeObjects.length} objects with ${spacing}px spacing`);
    } else {
      toast.success(`Distributed ${activeObjects.length} objects vertically`);
    }
  }, [canvas, saveState, fabricToBoundingBox, applyBoundingBoxToFabric, distributionSpacing]);

  // Match dimension operations
  const matchWidth = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length < 2) {
      toast.error('Select at least 2 objects to match width');
      return;
    }

    // Use first selected object (tracked in ref) as reference
    const referenceObj = firstSelectedObjectRef.current || activeObjects[0];
    const targetWidth = referenceObj.getBoundingRect().width;

    // Filter out the reference object - only modify the others
    const objectsToModify = activeObjects.filter(obj => obj !== referenceObj);

    if (objectsToModify.length === 0) {
      return; // Nothing to modify
    }

    const bboxes = objectsToModify.map(fabricToBoundingBox);
    const matched = matchWidthUtil(bboxes, targetWidth);

    objectsToModify.forEach((obj, i) => {
      applyBoundingBoxToFabric(obj, matched[i]);
    });

    canvas.requestRenderAll();
    saveState();
    toast.success(`Matched width of ${activeObjects.length} objects`);
  }, [canvas, saveState, fabricToBoundingBox, applyBoundingBoxToFabric]);

  const matchHeight = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length < 2) {
      toast.error('Select at least 2 objects to match height');
      return;
    }

    // Use first selected object (tracked in ref) as reference
    const referenceObj = firstSelectedObjectRef.current || activeObjects[0];
    const targetHeight = referenceObj.getBoundingRect().height;

    // Filter out the reference object - only modify the others
    const objectsToModify = activeObjects.filter(obj => obj !== referenceObj);

    if (objectsToModify.length === 0) {
      return; // Nothing to modify
    }

    const bboxes = objectsToModify.map(fabricToBoundingBox);
    const matched = matchHeightUtil(bboxes, targetHeight);

    objectsToModify.forEach((obj, i) => {
      applyBoundingBoxToFabric(obj, matched[i]);
    });

    canvas.requestRenderAll();
    saveState();
    toast.success(`Matched height of ${activeObjects.length} objects`);
  }, [canvas, saveState, fabricToBoundingBox, applyBoundingBoxToFabric]);

  // Flip operations
  const flipHorizontal = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.set({ flipX: !activeObject.flipX });
      canvas.requestRenderAll();
      saveState();
      toast.success("Flipped horizontally");
    }
  }, [canvas, saveState]);

  const flipVertical = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.set({ flipY: !activeObject.flipY });
      canvas.requestRenderAll();
      saveState();
      toast.success("Flipped vertically");
    }
  }, [canvas, saveState]);

  // Layer operations
  const bringToFront = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: activeObject });
      saveState();
      toast.success("Moved to front layer");
    }
  }, [canvas, saveState]);

  const sendToBack = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectToBack(activeObject);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: activeObject });
      saveState();
      toast.success("Moved to back layer");
    }
  }, [canvas, saveState]);

  const bringForward = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: activeObject });
      saveState();
      toast.success("Moved forward one layer");
    }
  }, [canvas, saveState]);

  const sendBackward = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectBackwards(activeObject);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: activeObject });
      saveState();
      toast.success("Moved backward one layer");
    }
  }, [canvas, saveState]);

  // Group operations
  const groupSelected = useCallback(() => {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
      toast.error("No objects selected");
      return;
    }

    // Get all selected objects
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length < 2) {
      toast.error("Select at least 2 objects to group");
      return;
    }

    // Discard the active selection
    canvas.discardActiveObject();

    // Recursively collect all lines with markers from a container (group) tree
    const collectLinesRecursive = (container: any): any[] => {
      const result: any[] = [];
      if (!container || typeof container.getObjects !== 'function') return result;
      container.getObjects().forEach((child: any) => {
        if (child.startMarker || child.endMarker) {
          result.push(child);
        }
        if (child.type === 'group') {
          result.push(...collectLinesRecursive(child));
        }
      });
      return result;
    };

    // Wrap the entire group operation in a history transaction.
    // canvas.remove(obj) fires object:removed which calls saveState() —
    // the transaction suppresses these intermediate saves; commitTransaction
    // at the end saves the final correct state.
    historyManager.current.beginTransaction(canvas);

    // Before removing objects from canvas, preserve endpoint markers.
    // canvas.remove(line) fires object:removed which calls removeEndpointMarkers,
    // destroying markers before the group sync can use them.
    // Also detach old sub-group marker sync handlers (the outer group takes over).
    const preservedMarkers: Array<{ line: any; startMarker: any; endMarker: any }> = [];

    activeObjects.forEach((obj: any) => {
      // For top-level lines: preserve their markers
      if (obj.startMarker || obj.endMarker) {
        preservedMarkers.push({
          line: obj,
          startMarker: obj.startMarker,
          endMarker: obj.endMarker,
        });
        if (obj.startMarker) canvas.remove(obj.startMarker);
        if (obj.endMarker) canvas.remove(obj.endMarker);
        obj.startMarker = null;
        obj.endMarker = null;
      }

      // For sub-groups: detach their old marker sync (outer group will handle it)
      if (obj.type === 'group') {
        if ((obj as any)._groupMarkerSync) {
          obj.off('moving', (obj as any)._groupMarkerSync);
          obj.off('rotating', (obj as any)._groupMarkerSync);
          obj.off('scaling', (obj as any)._groupMarkerSync);
          obj.off('modified', (obj as any)._groupMarkerSync);
          delete (obj as any)._groupMarkerSync;
        }
      }
    });

    // IMPORTANT: Remove objects from canvas BEFORE creating the group.
    // If we create the group first, _enterGroup sets obj.canvas = canvas,
    // but then canvas.remove(obj) calls _onObjectRemoved which clears
    // obj.canvas = undefined. The group children end up with no canvas
    // reference, causing rendering failures (e.g., curved lines vanish).
    activeObjects.forEach((obj: any) => {
      canvas.remove(obj);
    });

    // Create the group from objects that are now off-canvas
    const group = new Group(activeObjects, {
      canvas: canvas,
    });

    // Mark as a user-created group so selection shadow only applies to these,
    // not to library icons which are also Fabric Groups internally.
    (group as any).isUserGroup = true;

    // Sync endpoint markers for ALL lines inside the group (at any nesting depth)
    const syncGroupLineMarkers = () => {
      const allLines = collectLinesRecursive(group);
      allLines.forEach((lineChild: any) => {
        if (!lineChild.startMarker && !lineChild.endMarker) return;

        // calcTransformMatrix() walks up the parent chain in Fabric v6,
        // so it gives the correct world-space matrix regardless of nesting depth
        const worldMatrix = lineChild.calcTransformMatrix();

        // Get line endpoints in local path coords and transform to world
        const pathData = lineChild.path;
        if (!pathData || pathData.length < 2) return;

        const pathOffset = lineChild.pathOffset || { x: 0, y: 0 };
        const firstCmd = pathData[0];
        const lastCmd = pathData[pathData.length - 1];

        const localStart = { x: firstCmd[1] - pathOffset.x, y: firstCmd[2] - pathOffset.y };
        const localEnd = {
          x: lastCmd[lastCmd.length - 2] - pathOffset.x,
          y: lastCmd[lastCmd.length - 1] - pathOffset.y,
        };

        const worldStart = util.transformPoint(new Point(localStart.x, localStart.y), worldMatrix);
        const worldEnd = util.transformPoint(new Point(localEnd.x, localEnd.y), worldMatrix);

        // Calculate angles for marker direction
        let startAngle: number;
        let endAngle: number;

        if (pathData.length > 2) {
          const secondCmd = pathData[1];
          const localSecond = { x: (secondCmd[1] || secondCmd[secondCmd.length - 2]) - pathOffset.x, y: (secondCmd[2] || secondCmd[secondCmd.length - 1]) - pathOffset.y };
          const worldSecond = util.transformPoint(new Point(localSecond.x, localSecond.y), worldMatrix);
          startAngle = Math.atan2(worldStart.y - worldSecond.y, worldStart.x - worldSecond.x) * 180 / Math.PI;

          const secondLastCmd = pathData[pathData.length - 2];
          const localSecondLast = { x: (secondLastCmd[secondLastCmd.length - 2] || firstCmd[1]) - pathOffset.x, y: (secondLastCmd[secondLastCmd.length - 1] || firstCmd[2]) - pathOffset.y };
          const worldSecondLast = util.transformPoint(new Point(localSecondLast.x, localSecondLast.y), worldMatrix);
          endAngle = Math.atan2(worldEnd.y - worldSecondLast.y, worldEnd.x - worldSecondLast.x) * 180 / Math.PI;
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
      });
      canvas.requestRenderAll();
    };

    group.on('moving', syncGroupLineMarkers);
    group.on('rotating', syncGroupLineMarkers);
    group.on('scaling', syncGroupLineMarkers);
    group.on('modified', syncGroupLineMarkers);
    (group as any)._groupMarkerSync = syncGroupLineMarkers;

    // Add the group to canvas
    canvas.add(group);

    // Re-add preserved markers to canvas and restore references on lines
    preservedMarkers.forEach(({ line, startMarker, endMarker }) => {
      if (startMarker) {
        canvas.add(startMarker);
        line.startMarker = startMarker;
      }
      if (endMarker) {
        canvas.add(endMarker);
        line.endMarker = endMarker;
      }
    });

    // Now that markers are back on canvas, run initial sync
    syncGroupLineMarkers();

    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    historyManager.current.commitTransaction(canvas);
    toast.success("Objects grouped");
  }, [canvas, saveState]);

  const ungroupSelected = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();

    if (!activeObject || activeObject.type !== 'group') {
      toast.error("Select a group to ungroup");
      return;
    }

    const group = activeObject as Group;
    const items = group.getObjects().slice();

    // Capture each item's world transform BEFORE breaking the group.
    // calcTransformMatrix() walks up the parent chain while items are still
    // children of the group, giving us the correct world-space matrix.
    const worldTransforms = items.map(item => item.calcTransformMatrix());

    // Wrap the ungroup operation in a history transaction.
    // canvas.remove(group) fires object:removed → saveState(), but at that point
    // the individual objects haven't been re-added yet. Without the transaction,
    // intermediate saves capture incomplete/wrong state.
    historyManager.current.beginTransaction(canvas);

    // Before removing from group, preserve endpoint markers on lines.
    // group.removeAll() fires object:removed which triggers removeEndpointMarkers
    // in FabricCanvas.tsx, destroying markers before we can re-attach them.
    const collectLinesRecursive = (container: any): any[] => {
      const result: any[] = [];
      if (!container || typeof container.getObjects !== 'function') return result;
      container.getObjects().forEach((child: any) => {
        if (child.startMarker || child.endMarker) result.push(child);
        if (child.type === 'group') result.push(...collectLinesRecursive(child));
      });
      return result;
    };

    const allLinesWithMarkers = collectLinesRecursive(group);
    const preservedMarkers: Array<{ line: any; startMarker: any; endMarker: any }> = [];

    allLinesWithMarkers.forEach((lineObj: any) => {
      preservedMarkers.push({
        line: lineObj,
        startMarker: lineObj.startMarker,
        endMarker: lineObj.endMarker,
      });
      // Remove markers from canvas and null refs so removeEndpointMarkers is a no-op
      if (lineObj.startMarker) canvas.remove(lineObj.startMarker);
      if (lineObj.endMarker) canvas.remove(lineObj.endMarker);
      lineObj.startMarker = null;
      lineObj.endMarker = null;
    });

    // Detach group-level marker sync handler
    if ((group as any)._groupMarkerSync) {
      group.off('moving', (group as any)._groupMarkerSync);
      group.off('rotating', (group as any)._groupMarkerSync);
      group.off('scaling', (group as any)._groupMarkerSync);
      group.off('modified', (group as any)._groupMarkerSync);
      delete (group as any)._groupMarkerSync;
    }

    // Remove items from group and destroy group.
    // Use removeAll() which calls _exitGroup internally, but we don't rely
    // on its transform — we apply our own saved world transforms below.
    group.removeAll();
    canvas.remove(group);

    // Re-add items to canvas and apply the saved world transforms explicitly.
    // This avoids displacement caused by Fabric's _exitGroup clearing the
    // group reference before computing the transform matrix.
    const ungroupedObjects: FabricObject[] = [];

    items.forEach((item, i) => {
      util.applyTransformToObject(item, worldTransforms[i]);
      item.setCoords();
      canvas.add(item);
      ungroupedObjects.push(item);
    });

    // Re-add preserved markers to canvas and restore references on lines
    preservedMarkers.forEach(({ line, startMarker, endMarker }) => {
      if (startMarker) {
        canvas.add(startMarker);
        line.startMarker = startMarker;
      }
      if (endMarker) {
        canvas.add(endMarker);
        line.endMarker = endMarker;
      }
    });

    // Re-attach marker sync for ungrouped items
    import('@/lib/lineEndpointRenderer').then(({ attachMarkerSyncForLine }) => {
      ungroupedObjects.forEach((item: any) => {
        // Direct lines: re-attach individual sync
        if (item.startMarker || item.endMarker) {
          attachMarkerSyncForLine(canvas, item);
        }

        // Sub-groups: re-attach group-level marker sync
        if (item.type === 'group') {
          const nestedLines = collectLinesRecursive(item);
          if (nestedLines.length === 0) return;

          const syncSubGroupMarkers = () => {
            nestedLines.forEach((lineChild: any) => {
              if (!lineChild.startMarker && !lineChild.endMarker) return;
              const worldMatrix = lineChild.calcTransformMatrix();
              const pathData = lineChild.path;
              if (!pathData || pathData.length < 2) return;

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
                const localSecond = { x: (secondCmd[1] || secondCmd[secondCmd.length - 2]) - pathOffset.x, y: (secondCmd[2] || secondCmd[secondCmd.length - 1]) - pathOffset.y };
                const worldSecond = util.transformPoint(new Point(localSecond.x, localSecond.y), worldMatrix);
                startAngle = Math.atan2(worldStart.y - worldSecond.y, worldStart.x - worldSecond.x) * 180 / Math.PI;
                const secondLastCmd = pathData[pathData.length - 2];
                const localSecondLast = { x: (secondLastCmd[secondLastCmd.length - 2] || firstCmd[1]) - pathOffset.x, y: (secondLastCmd[secondLastCmd.length - 1] || firstCmd[2]) - pathOffset.y };
                const worldSecondLast = util.transformPoint(new Point(localSecondLast.x, localSecondLast.y), worldMatrix);
                endAngle = Math.atan2(worldEnd.y - worldSecondLast.y, worldEnd.x - worldSecondLast.x) * 180 / Math.PI;
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
            });
            canvas.requestRenderAll();
          };

          item.on('moving', syncSubGroupMarkers);
          item.on('rotating', syncSubGroupMarkers);
          item.on('scaling', syncSubGroupMarkers);
          item.on('modified', syncSubGroupMarkers);
          (item as any)._groupMarkerSync = syncSubGroupMarkers;
          syncSubGroupMarkers();
        }
      });
    });

    // Create an active selection with all ungrouped objects
    if (ungroupedObjects.length > 0) {
      const selection = new ActiveSelection(ungroupedObjects, { canvas });
      canvas.setActiveObject(selection);
    }

    canvas.requestRenderAll();
    historyManager.current.commitTransaction(canvas);
    toast.success("Group ungrouped");
  }, [canvas, saveState]);

  const extractObjectsFromImage = useCallback(async (): Promise<{ regionCount: number } | null> => {
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (!active || active.type !== "image") {
      toast.error("Select an image first");
      return null;
    }
    const { extractAndReplaceImageObjects } = await import("@/lib/imageObjectExtraction");
    return extractAndReplaceImageObjects(canvas, active as any, historyManager.current);
  }, [canvas]);

  // Add to recent colors with localStorage persistence
  const addToRecentColors = useCallback((color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      const updated = [color, ...filtered].slice(0, 8);
      localStorage.setItem('canvas_recent_colors', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Helper: swap canvas.backgroundColor to the user's chosen color/gradient for export,
  // returning a restore function that puts back the original value (e.g. grid Pattern).
  // Uses a ref so memoized callbacks always get current values.
  const bgRef = useRef({ backgroundColor, backgroundGradient, gradientStartColor, gradientEndColor, gradientType, gradientAngle, gradientCenterX, gradientCenterY, gradientRadius });
  bgRef.current = { backgroundColor, backgroundGradient, gradientStartColor, gradientEndColor, gradientType, gradientAngle, gradientCenterX, gradientCenterY, gradientRadius };

  const setExportBackground = useCallback((cvs: FabricCanvas, transparent?: boolean): (() => void) => {
    const saved = cvs.backgroundColor;
    const bg = bgRef.current;

    if (transparent) {
      cvs.backgroundColor = null as any;
    } else if (bg.backgroundGradient) {
      const width = cvs.width || 1200;
      const height = cvs.height || 800;
      let coords: any;
      if (bg.gradientType === 'linear') {
        const angleRad = (bg.gradientAngle - 90) * (Math.PI / 180);
        const diagonal = Math.sqrt(width * width + height * height);
        coords = {
          x1: width / 2 - (Math.cos(angleRad) * diagonal) / 2,
          y1: height / 2 - (Math.sin(angleRad) * diagonal) / 2,
          x2: width / 2 + (Math.cos(angleRad) * diagonal) / 2,
          y2: height / 2 + (Math.sin(angleRad) * diagonal) / 2,
        };
      } else {
        const centerX = width * bg.gradientCenterX;
        const centerY = height * bg.gradientCenterY;
        coords = { x1: centerX, y1: centerY, x2: centerX, y2: centerY, r1: 0, r2: Math.max(width, height) * (bg.gradientRadius / 100) };
      }
      cvs.backgroundColor = new Gradient({
        type: bg.gradientType,
        coords,
        colorStops: [
          { offset: 0, color: bg.gradientStartColor },
          { offset: 1, color: bg.gradientEndColor },
        ],
      });
    } else {
      cvs.backgroundColor = bg.backgroundColor || '#ffffff';
    }

    return () => { cvs.backgroundColor = saved; };
  }, []);

  // Watermark disabled — all downloads are free
  const needsWatermarkRef = useRef(false);
  needsWatermarkRef.current = false;

  // Export operations
  const exportAsPNG = useCallback(async (dpi: 150 | 300 | 600 = 300, selectionOnly: boolean = false) => {
    if (!canvas) return;

    const originalSelection = canvas.getActiveObject();
    const hiddenForSelection: FabricObject[] = [];
    const hidden: FabricObject[] = [];
    let restoreBg = () => {};

    const toastId = toast.loading(`Preparing PNG export at ${dpi} DPI...`);

    try {
      // If exporting selection only, temporarily hide non-selected objects
      if (selectionOnly && originalSelection) {
        canvas.getObjects().forEach((obj) => {
          if (obj !== originalSelection && obj.visible &&
              !(obj as any).isGridLine && !(obj as any).isRuler) {
            hiddenForSelection.push(obj);
            obj.visible = false;
          }
        });
      }

      // Temporarily hide guides, previews, handles, and eraser paths
      let controlHandleCount = 0;
      const originalOpacities: Map<any, number> = new Map();
      canvas.getObjects().forEach((obj) => {
        const o: any = obj as any;
        if (
          o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine || o.isPreviewLine || o.isPortIndicator || o.isFeedback || o.isControlHandle || o.isAnchorHandle || o.isEraserPath || obj.globalCompositeOperation === 'destination-out'
        ) {
          if (o.isControlHandle) {
            controlHandleCount++;
            originalOpacities.set(obj, obj.opacity || 1);
            obj.set({ opacity: 0 });
          } else {
            if (obj.visible) {
              hidden.push(obj);
            }
            obj.visible = false;
          }
        }
      });
      // Replace grid pattern / empty bg with user's chosen background color
      restoreBg = setExportBackground(canvas);
      canvas.requestRenderAll();

      // Calculate multiplier based on DPI (300 is base)
      const multiplier = dpi / 300;

      // Guard against extreme dimensions
      const outW = (canvas.width || 0) * multiplier;
      const outH = (canvas.height || 0) * multiplier;

      // Estimate file size
      const estimatedPixels = outW * outH;
      const estimatedMB = (estimatedPixels * 4) / (1024 * 1024);

      if (estimatedMB > 100) {
        toast.dismiss(toastId);
        toast.error(`Export size too large (${estimatedMB.toFixed(0)}MB). Try a lower DPI or smaller canvas.`);
        return;
      }

      if (outW > 10000 || outH > 10000) {
        toast.dismiss(toastId);
        toast.error('Export dimensions too large. Try a lower DPI setting.');
        return;
      }
      let dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier });
      const filename = selectionOnly ? `selection-${dpi}dpi.png` : `diagram-${dpi}dpi.png`;

      // Apply watermark for community downloads by non-premium users
      if (needsWatermarkRef.current) {
        dataURL = await applyWatermark(dataURL, outW, outH);
      }

      await safeDownloadDataUrl(dataURL, filename);
      toast.dismiss(toastId);
      toast.success(`Exported as PNG at ${dpi} DPI`, { duration: 1500, className: 'animate-fade-in' });
    } catch (err) {
      toast.dismiss(toastId);
      console.error('PNG Export failed:', {
        error: err,
        canvasSize: { width: canvas.width, height: canvas.height },
        dpi,
        multiplier: dpi / 300
      });

      if (err instanceof Error && /tainted|cross-origin/i.test(err.message)) {
        toast.error("Export failed due to a cross-origin image. Re-add the image via upload or a URL with CORS enabled.");
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to export PNG. Try a lower DPI or smaller canvas.');
      }
    } finally {
      // Restore background (grid pattern)
      restoreBg();
      // Restore visibility
      hidden.forEach((o) => (o.visible = true));
      hiddenForSelection.forEach((o) => (o.visible = true));

      // Restore opacity for control handles
      originalOpacities.forEach((opacity, obj) => {
        obj.set({ opacity });
      });

      canvas.requestRenderAll();
    }
  }, [canvas, setExportBackground]);

  const exportAsPNGTransparent = useCallback(async (dpi: 150 | 300 | 600 = 300, selectionOnly: boolean = false) => {
    if (!canvas) return;

    const originalSelection = canvas.getActiveObject();
    const hiddenForSelection: FabricObject[] = [];
    const hidden: FabricObject[] = [];
    let restoreBg = () => {};

    const toastId = toast.loading(`Preparing transparent PNG export at ${dpi} DPI...`);

    try {
      // If exporting selection only, temporarily hide non-selected objects
      if (selectionOnly && originalSelection) {
        canvas.getObjects().forEach((obj) => {
          if (obj !== originalSelection && obj.visible &&
              !(obj as any).isGridLine && !(obj as any).isRuler) {
            hiddenForSelection.push(obj);
            obj.visible = false;
          }
        });
      }

      // Temporarily hide guides, previews, handles, and eraser paths
      const originalOpacities2: Map<any, number> = new Map();
      canvas.getObjects().forEach((obj) => {
        const o: any = obj as any;
        if (o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine || o.isPreviewLine || o.isPortIndicator || o.isFeedback || o.isControlHandle || o.isAnchorHandle || o.isEraserPath) {
          if (o.isControlHandle) {
            originalOpacities2.set(obj, obj.opacity || 1);
            obj.set({ opacity: 0 });
          } else {
            if (obj.visible) {
              hidden.push(obj);
            }
            obj.visible = false;
          }
        }
      });

      // Set transparent background (removes grid pattern too)
      restoreBg = setExportBackground(canvas, true);
      canvas.requestRenderAll();

      // Calculate multiplier based on DPI (300 is base)
      const multiplier = dpi / 300;
      
      // Guard against extreme dimensions
      const outW = (canvas.width || 0) * multiplier;
      const outH = (canvas.height || 0) * multiplier;
      
      // Estimate file size
      const estimatedPixels = outW * outH;
      const estimatedMB = (estimatedPixels * 4) / (1024 * 1024);
      
      if (estimatedMB > 100) {
        toast.dismiss(toastId);
        toast.error(`Export size too large (${estimatedMB.toFixed(0)}MB). Try a lower DPI or smaller canvas.`);
        return;
      }
      
      if (outW > 10000 || outH > 10000) {
        toast.dismiss(toastId);
        toast.error('Export dimensions too large. Try a lower DPI setting.');
        return;
      }
      let dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier });
      const filename = selectionOnly ? `selection-transparent-${dpi}dpi.png` : `diagram-transparent-${dpi}dpi.png`;

      if (needsWatermarkRef.current) {
        dataURL = await applyWatermark(dataURL, outW, outH);
      }

      await safeDownloadDataUrl(dataURL, filename);
      toast.dismiss(toastId);
      toast.success(`Exported as PNG (transparent) at ${dpi} DPI`, { duration: 1500, className: 'animate-fade-in' });
    } catch (err) {
      toast.dismiss(toastId);
      console.error('Transparent PNG Export failed:', {
        error: err,
        canvasSize: { width: canvas.width, height: canvas.height },
        dpi,
        multiplier: dpi / 300
      });
      
      if (err instanceof Error && /tainted|cross-origin/i.test(err.message)) {
        toast.error("Export failed due to a cross-origin image. Re-add the image via upload or a URL with CORS enabled.");
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to export transparent PNG. Try a lower DPI or smaller canvas.');
      }
    } finally {
      // Restore background (grid pattern) and guides
      restoreBg();
      hidden.forEach((o) => (o.visible = true));
      hiddenForSelection.forEach((o) => (o.visible = true));

      // Restore opacity for control handles
      originalOpacities2.forEach((opacity, obj) => {
        obj.set({ opacity });
      });

      canvas.requestRenderAll();
    }
  }, [canvas, setExportBackground]);

  const exportAsJPG = useCallback(async (dpi: 150 | 300 | 600 = 300, selectionOnly: boolean = false) => {
    if (!canvas) return;

    const originalSelection = canvas.getActiveObject();
    const hiddenForSelection: FabricObject[] = [];
    const hidden: FabricObject[] = [];
    let restoreBg = () => {};

    const toastId = toast.loading(`Preparing JPG export at ${dpi} DPI...`);

    try {
      // If exporting selection only, temporarily hide non-selected objects
      if (selectionOnly && originalSelection) {
        canvas.getObjects().forEach((obj) => {
          if (obj !== originalSelection && obj.visible &&
              !(obj as any).isGridLine && !(obj as any).isRuler) {
            hiddenForSelection.push(obj);
            obj.visible = false;
          }
        });
      }

      // Temporarily hide guides, previews, handles, and eraser paths
      const originalOpacities3: Map<any, number> = new Map();
      canvas.getObjects().forEach((obj) => {
        const o: any = obj as any;
        if (o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine || o.isPreviewLine || o.isPortIndicator || o.isFeedback || o.isControlHandle || o.isAnchorHandle || o.isEraserPath) {
          if (o.isControlHandle) {
            originalOpacities3.set(obj, obj.opacity || 1);
            obj.set({ opacity: 0 });
          } else {
            if (obj.visible) {
              hidden.push(obj);
            }
            obj.visible = false;
          }
        }
      });
      // Replace grid pattern with user's background color
      restoreBg = setExportBackground(canvas);
      canvas.requestRenderAll();

      // Calculate multiplier based on DPI (300 is base)
      const multiplier = dpi / 300;

      // Guard against extreme dimensions
      const outW = (canvas.width || 0) * multiplier;
      const outH = (canvas.height || 0) * multiplier;

      // Estimate file size
      const estimatedPixels = outW * outH;
      const estimatedMB = (estimatedPixels * 0.5) / (1024 * 1024); // JPG uses ~0.5 bytes per pixel
      
      if (estimatedMB > 100) {
        toast.dismiss(toastId);
        toast.error(`Export size too large (${estimatedMB.toFixed(0)}MB). Try a lower DPI or smaller canvas.`);
        return;
      }
      
      if (outW > 10000 || outH > 10000) {
        toast.dismiss(toastId);
        toast.error('Export dimensions too large. Try a lower DPI setting.');
        return;
      }
      let dataURL = canvas.toDataURL({ format: 'jpeg', quality: 1, multiplier });
      const filename = selectionOnly ? `selection-${dpi}dpi.jpg` : `diagram-${dpi}dpi.jpg`;

      if (needsWatermarkRef.current) {
        dataURL = await applyWatermark(dataURL, outW, outH);
      }

      await safeDownloadDataUrl(dataURL, filename);
      toast.dismiss(toastId);
      toast.success(`Exported as JPG at ${dpi} DPI`, { duration: 1500, className: 'animate-fade-in' });
    } catch (err) {
      toast.dismiss(toastId);
      console.error('JPG Export failed:', {
        error: err,
        canvasSize: { width: canvas.width, height: canvas.height },
        dpi,
        multiplier: dpi / 300
      });
      
      if (err instanceof Error && /tainted|cross-origin/i.test(err.message)) {
        toast.error("Export failed due to a cross-origin image. Re-add the image via upload or a URL with CORS enabled.");
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to export JPG. Try a lower DPI or smaller canvas.');
      }
    } finally {
      // Restore background (grid pattern) and visibility
      restoreBg();
      hidden.forEach((o) => (o.visible = true));
      hiddenForSelection.forEach((o) => (o.visible = true));

      // Restore opacity for control handles
      originalOpacities3.forEach((opacity, obj) => {
        obj.set({ opacity });
      });

      canvas.requestRenderAll();
    }
  }, [canvas, setExportBackground]);

  const exportAsSVG = useCallback((selectionOnly: boolean = false) => {
    if (!canvas) return;

    const originalSelection = canvas.getActiveObject();
    
    // If exporting selection only, temporarily hide non-selected objects
    const hiddenForSelection: FabricObject[] = [];
    if (selectionOnly && originalSelection) {
      canvas.getObjects().forEach((obj) => {
        if (obj !== originalSelection && obj.visible && 
            !(obj as any).isGridLine && !(obj as any).isRuler) {
          hiddenForSelection.push(obj);
          obj.visible = false;
        }
      });
    }

    // Temporarily hide guides, previews, handles, and eraser paths
    const hidden: FabricObject[] = [];
    const originalOpacities4: Map<any, number> = new Map();
    canvas.getObjects().forEach((obj) => {
      const o: any = obj as any;
      if (o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine || o.isPreviewLine || o.isPortIndicator || o.isFeedback || o.isControlHandle || o.isAnchorHandle || o.isEraserPath) {
        if (o.isControlHandle) {
          originalOpacities4.set(obj, obj.opacity || 1);
          obj.set({ opacity: 0 });
        } else {
          if (obj.visible) {
            hidden.push(obj);
          }
          obj.visible = false;
        }
      }
    });
    const restoreGradients4 = bakeLineGradientsForExport(canvas);
    // Replace grid pattern with user's background color
    const restoreBg = setExportBackground(canvas);
    canvas.requestRenderAll();

    const svg = canvas.toSVG();
    restoreGradients4();
    restoreBg();

    // Restore visibility
    hidden.forEach((o) => (o.visible = true));
    hiddenForSelection.forEach((o) => (o.visible = true));

    // Restore opacity for control handles
    originalOpacities4.forEach((opacity, obj) => {
      obj.set({ opacity });
    });

    canvas.requestRenderAll();

    // Apply watermark for community downloads by non-premium users
    const finalSvg = needsWatermarkRef.current
      ? applyWatermarkToSVG(svg, canvas.width || 1200, canvas.height || 800)
      : svg;

    const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = selectionOnly ? 'selection.svg' : 'diagram.svg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as SVG`, { duration: 1500, className: 'animate-fade-in' });
  }, [canvas, setExportBackground]);

  // Export as PDF
  const exportAsPDF = useCallback(async (
    dpi: 150 | 300 | 600 = 300,
    selectionOnly: boolean = false,
    options?: { cmykMode?: boolean }
  ) => {
    if (!canvas) return;

    try {
      // Memory check
      const width = canvas.width || 800;
      const height = canvas.height || 600;
      const maxDimension = Math.max(width, height);

      if (maxDimension > 5000) {
        toast.warning('Large canvas detected. PDF export may take longer...');
      }

      const originalSelection = canvas.getActiveObject();

      // If exporting selection only, temporarily hide non-selected objects
      const hiddenForSelection: FabricObject[] = [];
      if (selectionOnly && originalSelection) {
        canvas.getObjects().forEach((obj) => {
          if (obj !== originalSelection && obj.visible &&
              !(obj as any).isGridLine && !(obj as any).isRuler) {
            hiddenForSelection.push(obj);
            obj.visible = false;
          }
        });
      }

      // Temporarily hide guides, previews, handles, and eraser paths
      const hidden: FabricObject[] = [];
      const originalOpacities: Map<any, number> = new Map();
      canvas.getObjects().forEach((obj) => {
        const o: any = obj as any;
        if (o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine ||
            o.isPreviewLine || o.isPortIndicator || o.isFeedback ||
            o.isControlHandle || o.isAnchorHandle || o.isEraserPath) {
          if (o.isControlHandle) {
            originalOpacities.set(obj, obj.opacity || 1);
            obj.set({ opacity: 0 });
          } else {
            if (obj.visible) {
              hidden.push(obj);
            }
            obj.visible = false;
          }
        }
      });
      const restoreGradients5 = bakeLineGradientsForExport(canvas);
      // Replace grid pattern with user's background color
      const restoreBg = setExportBackground(canvas);
      canvas.requestRenderAll();

      // Generate SVG and apply watermark if needed
      let svgString = canvas.toSVG();
      if (needsWatermarkRef.current) {
        svgString = applyWatermarkToSVG(svgString, width, height);
      }
      restoreGradients5();
      restoreBg();

      // Parse SVG to DOM
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;

      // Apply CMYK conversion if enabled
      // This actually modifies the SVG colors to simulate CMYK print gamut
      if (options?.cmykMode) {
        const warnings = validateSVGForCMYK(svgElement);
        if (warnings.length > 0) {
          
          toast.warning(warnings[0], { duration: 3000 });
        }
        const colorMap = applyCMYKConversion(svgElement);
        toast.success(`CMYK conversion applied (${colorMap.size} colors)`, { duration: 2000 });
      }

      // For vector PDFs, use canvas dimensions directly as points
      // 72 points = 1 inch, so an 800px canvas = ~11 inch PDF
      // This creates a full-size, print-ready PDF
      const pdfWidth = width;
      const pdfHeight = height;

      // Create jsPDF document
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
      });

      // Convert SVG to PDF
      await svg2pdf(svgElement, pdf, {
        x: 0,
        y: 0,
        width: pdfWidth,
        height: pdfHeight,
      });

      // Generate and download PDF
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      const filename = selectionOnly ? `selection-${dpi}dpi.pdf` : `diagram-${dpi}dpi.pdf`;
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      // Restore visibility
      hidden.forEach((o) => (o.visible = true));
      hiddenForSelection.forEach((o) => (o.visible = true));

      // Restore opacity for control handles
      originalOpacities.forEach((opacity, obj) => {
        obj.set({ opacity });
      });

      canvas.requestRenderAll();

      toast.success(`Exported as PDF`, { duration: 1500, className: 'animate-fade-in' });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF. Please try again.');

      // Ensure visibility is restored even on error
      if (canvas) {
        canvas.getObjects().forEach((obj) => {
          obj.visible = true;
          obj.set({ opacity: 1 });
        });
        canvas.requestRenderAll();
      }
    }
  }, [canvas, setExportBackground]);

  // Export as PowerPoint — renders canvas to high-res PNG and embeds in a slide
  const exportAsPPTX = useCallback(async (
    dpi: 150 | 300 | 600 = 300,
    selectionOnly: boolean = false,
  ) => {
    if (!canvas) return;

    try {
      toast.loading('Generating PowerPoint...', { id: 'pptx-export' });

      const width = canvas.width || 800;
      const height = canvas.height || 600;

      const originalSelection = canvas.getActiveObject();

      // If exporting selection only, temporarily hide non-selected objects
      const hiddenForSelection: FabricObject[] = [];
      if (selectionOnly && originalSelection) {
        canvas.getObjects().forEach((obj) => {
          if (obj !== originalSelection && obj.visible &&
              !(obj as any).isGridLine && !(obj as any).isRuler) {
            hiddenForSelection.push(obj);
            obj.visible = false;
          }
        });
      }

      // Temporarily hide guides, handles, etc.
      const hidden: FabricObject[] = [];
      canvas.getObjects().forEach((obj) => {
        const o: any = obj as any;
        if (o.isGridLine || o.isRuler || o.isGuideLine || o.isHandleLine ||
            o.isPreviewLine || o.isPortIndicator || o.isFeedback ||
            o.isControlHandle || o.isAnchorHandle || o.isEraserPath) {
          if (obj.visible) {
            hidden.push(obj);
          }
          obj.visible = false;
        }
      });

      // Replace grid pattern with user's background color
      const restoreBg = setExportBackground(canvas);

      // Render to high-res PNG data URL
      const multiplier = dpi / 300;
      const outW = (canvas.width || 0) * multiplier;
      const outH = (canvas.height || 0) * multiplier;
      canvas.renderAll(); // Must be synchronous — toDataURL reads pixels immediately
      let dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier,
      });

      if (needsWatermarkRef.current) {
        dataUrl = await applyWatermark(dataUrl, outW, outH);
      }

      // Restore background (grid pattern) and visibility
      restoreBg();
      hidden.forEach((o) => (o.visible = true));
      hiddenForSelection.forEach((o) => (o.visible = true));
      canvas.requestRenderAll();

      // Create PowerPoint
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();

      // Set slide dimensions to match canvas aspect ratio
      // PowerPoint uses inches; standard slide is 10" × 7.5"
      const maxSlideWidth = 10;
      const maxSlideHeight = 7.5;
      const canvasAspect = width / height;
      const slideAspect = maxSlideWidth / maxSlideHeight;

      let slideWidth: number;
      let slideHeight: number;

      if (canvasAspect > slideAspect) {
        // Canvas is wider — fit to width
        slideWidth = maxSlideWidth;
        slideHeight = maxSlideWidth / canvasAspect;
      } else {
        // Canvas is taller — fit to height
        slideHeight = maxSlideHeight;
        slideWidth = maxSlideHeight * canvasAspect;
      }

      pptx.defineLayout({ name: 'CANVAS', width: slideWidth, height: slideHeight });
      pptx.layout = 'CANVAS';

      // Add slide with the canvas image
      const slide = pptx.addSlide();
      slide.addImage({
        data: dataUrl,
        x: 0,
        y: 0,
        w: slideWidth,
        h: slideHeight,
      });

      // Generate and download
      const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
      const url = URL.createObjectURL(pptxBlob);
      const link = document.createElement('a');
      link.download = selectionOnly ? 'selection.pptx' : 'diagram.pptx';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Exported as PowerPoint', { id: 'pptx-export', duration: 1500 });
    } catch (error) {
      console.error('PPTX export failed:', error);
      toast.error('Failed to export PowerPoint. Please try again.', { id: 'pptx-export' });
    }
  }, [canvas, setExportBackground]);

  // Clean Export - One-click optimal export with transparent background
  const cleanExport = useCallback(() => {
    exportAsPNGTransparent(300, false);
  }, [exportAsPNGTransparent]);

  // Pin/Lock operations
  const pinObject = useCallback(() => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.set({
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hasControls: false,
      hasBorders: true,
      selectable: true,
    });
    (selectedObject as any).isPinned = true;
    setIsPinned(true);
    canvas.requestRenderAll();
    toast.success("Object pinned");
  }, [canvas, selectedObject]);

  const unpinObject = useCallback(() => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.set({
      lockMovementX: false,
      lockMovementY: false,
      lockRotation: false,
      lockScalingX: false,
      lockScalingY: false,
      hasControls: true,
      hasBorders: true,
      selectable: true,
    });
    (selectedObject as any).isPinned = false;
    setIsPinned(false);
    canvas.requestRenderAll();
    toast.success("Object unpinned");
  }, [canvas, selectedObject]);

  const togglePin = useCallback(() => {
    if (isPinned) {
      unpinObject();
    } else {
      pinObject();
    }
  }, [isPinned, pinObject, unpinObject]);

  // Update isPinned state when selectedObject changes
  useEffect(() => {
    if (selectedObject) {
      setIsPinned((selectedObject as any).isPinned || false);
    } else {
      setIsPinned(false);
    }
  }, [selectedObject]);

  // Layer panel operations
  const getCanvasObjects = useCallback(() => {
    if (!canvas) return [];
    return canvas.getObjects().filter(obj => {
      const o = obj as any;
      return (
        !o.isGridLine &&
        !o.isRuler &&
        !o.isEraserPath &&
        !o.isEndpointMarker &&
        !o.isDimensionLabel &&
        !o.isGuideLine &&
        !o.isSpacingGuide &&
        !o.isConnectionPoint &&
        !o.isAnchorHandle &&
        !o.isControlHandle &&
        !o.isHandleLine
      );
    });
  }, [canvas]);

  const selectObjectById = useCallback((id: string) => {
    if (!canvas) return;
    const objects = getCanvasObjects();
    const targetObject = objects.find(obj => (obj as any).uuid === id || obj === objects[parseInt(id)]);
    if (targetObject) {
      // Don't select hidden objects - they should remain hidden
      if (targetObject.visible === false) {
        return;
      }
      canvas.setActiveObject(targetObject);
      canvas.requestRenderAll();
    }
  }, [canvas, getCanvasObjects]);

  const toggleObjectVisibility = useCallback((id: string) => {
    if (!canvas) return;

    const objects = getCanvasObjects();
    const targetObject = objects.find(obj =>
      (obj as any).uuid === id ||
      obj === objects[parseInt(id)]
    );

    if (targetObject) {
      const newVisibility = !targetObject.visible;

      // If hiding the currently selected object, deselect it FIRST
      // (deselecting after hiding resets visibility)
      if (!newVisibility && canvas.getActiveObject() === targetObject) {
        canvas.discardActiveObject();
      }

      // Set visibility and selectable (hidden objects shouldn't be selectable)
      targetObject.set({
        visible: newVisibility,
        selectable: newVisibility,
        evented: newVisibility
      });
      targetObject.setCoords();

      // Fire event BEFORE requestRenderAll to ensure layers panel updates
      canvas.fire('layer:visibility:changed', { target: targetObject });
      canvas.requestRenderAll();

      toast.success(newVisibility ? "Object shown" : "Object hidden");
    }
  }, [canvas, getCanvasObjects]);

  const toggleObjectLock = useCallback((id: string) => {
    if (!canvas) return;

    const objects = getCanvasObjects();
    const targetObject = objects.find(obj =>
      (obj as any).uuid === id ||
      obj === objects[parseInt(id)]
    );

    if (targetObject) {
      const isCurrentlyLocked = targetObject.lockMovementX || false;
      const newLockState = !isCurrentlyLocked;

      targetObject.set({
        lockMovementX: newLockState,
        lockMovementY: newLockState,
        lockRotation: newLockState,
        lockScalingX: newLockState,
        lockScalingY: newLockState,
        hasControls: !newLockState, // Hide transform controls when locked
      });

      targetObject.setCoords();

      // Use custom event to avoid triggering history
      canvas.fire('layer:lock:changed', { target: targetObject });
      canvas.requestRenderAll();

      toast.success(newLockState ? "Object locked" : "Object unlocked");
    }
  }, [canvas, getCanvasObjects]);

  const reorderObjects = useCallback((fromId: string, toId: string) => {
    if (!canvas) return;

    const userObjects = getCanvasObjects();

    // Find objects by UUID or by index (as fallback)
    const fromObject = userObjects.find(obj =>
      (obj as any).uuid === fromId || obj === userObjects[parseInt(fromId)]
    );
    const toObject = userObjects.find(obj =>
      (obj as any).uuid === toId || obj === userObjects[parseInt(toId)]
    );

    if (!fromObject || !toObject) return;

    // Get all canvas objects (including grid, rulers, etc.)
    const allObjects = canvas.getObjects();
    const fromIndex = allObjects.indexOf(fromObject);
    const toIndex = allObjects.indexOf(toObject);

    if (fromIndex === -1 || toIndex === -1) return;

    // Temporarily suppress canvas events to prevent history saves during reorder
    const originalFireEvent = canvas.fire;
    const suppressedEvents = new Set(['object:added', 'object:removed', 'object:modified']);

    canvas.fire = function(eventName: string, options?: any) {
      if (suppressedEvents.has(eventName)) {
        return originalFireEvent.call(this, 'event:suppressed', { originalEvent: eventName, ...options });
      }
      return originalFireEvent.call(this, eventName, options);
    } as any;

    try {
      // Remove the object from its current position
      canvas.remove(fromObject);

      // Adjust the target index based on whether we're moving up or down
      // If moving from lower index to higher index, toIndex shifts down by 1 after removal
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;

      // Insert at the new position
      canvas.insertAt(adjustedIndex, fromObject);
    } finally {
      // Restore original fire function
      canvas.fire = originalFireEvent;
    }

    // Render the canvas to show the reordered objects
    canvas.requestRenderAll();
  }, [canvas, getCanvasObjects]);

  // Crop operation
  const cropImage = useCallback((cropData: any) => {
    if (!canvas || !selectedObject) return;

    if (selectedObject.type === 'activeSelection') {
      toast.error("Cannot crop a multi-selection. Select a single object.");
      return;
    }

    const object = selectedObject as any;
    const { mode, rect, isCircular, polygonPoints } = cropData;

    // ── 1. Serialize the original object for non-destructive reset ──
    // On first crop, capture the full original; on re-crop, keep the
    // previously stored original so we can always reset to the un-cropped state.
    let originalObjectData: any;
    if (object.cropConfig?.originalObjectData) {
      originalObjectData = object.cropConfig.originalObjectData;
    } else {
      // Temporarily remove any existing clipPath for a clean serialization
      const prevClip = object.clipPath;
      object.clipPath = null;
      originalObjectData = object.toObject([
        'id', 'name', 'data',
        'isStraightLine', 'isCurvedLine', 'isOrthogonalLine', 'isBezierPath',
        'isFreeformLine', 'isMembraneShape', 'isRasterizedMembrane',
        'isTripleMembrane', 'isDNAHelix', 'isLibraryIcon', 'isUserAsset',
        'iconId', 'assetId', 'membraneOptions', 'worldBezierPoints',
        'straightLineStart', 'straightLineEnd', 'straightLineControlPoint',
        'startMarkerType', 'endMarkerType', 'markerOptions',
        'originalImageSrc', 'colorMapConfig', 'iconToneColor',
        'iconToneIntensity', 'iconToneHue', 'originalColors',
        'startAttachment', 'endAttachment',
      ]);
      object.clipPath = prevClip;
    }

    // ── 2. Build the clipPath (same logic as before) ──
    // If re-cropping, restore original dimensions first
    if (object.cropConfig?.originalObjectData) {
      const orig = object.cropConfig.originalObjectData;
      if (object.clipPath) object.set({ clipPath: null });
      object.set({
        width: orig.width,
        height: orig.height,
        scaleX: orig.scaleX,
        scaleY: orig.scaleY,
      });
      object.setCoords();
    }

    const scaleX = object.scaleX || 1;
    const scaleY = object.scaleY || 1;
    const matrix = object.calcTransformMatrix();
    const invertedMatrix = util.invertTransform(matrix);

    let clipPath: FabricObject;
    let clipPathType: 'rect' | 'circle' | 'polygon';

    if (mode === 'freeform' && polygonPoints) {
      const localPoints = polygonPoints.map((pt: { x: number; y: number }) =>
        util.transformPoint(pt, invertedMatrix)
      );
      clipPath = new Polygon(localPoints, {
        originX: 'left',
        originY: 'top',
        absolutePositioned: false,
      });
      clipPathType = 'polygon';
    } else if (mode === 'circle' || mode === 'ellipse' || isCircular) {
      const canvasCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const localCenter = util.transformPoint(canvasCenter, invertedMatrix);
      let radiusX: number, radiusY: number;
      if (mode === 'circle') {
        const radius = Math.min(rect.width, rect.height) / 2 / Math.min(scaleX, scaleY);
        radiusX = radius;
        radiusY = radius;
      } else {
        radiusX = (rect.width / 2) / scaleX;
        radiusY = (rect.height / 2) / scaleY;
      }
      clipPath = new Circle({
        left: localCenter.x,
        top: localCenter.y,
        radius: radiusX,
        originX: 'center',
        originY: 'center',
      });
      if (mode === 'ellipse' && radiusX !== radiusY) {
        (clipPath as any).scaleY = radiusY / radiusX;
      }
      clipPathType = 'circle';
    } else {
      const topLeft = util.transformPoint(
        { x: rect.left, y: rect.top },
        invertedMatrix
      );
      const bottomRight = util.transformPoint(
        { x: rect.left + rect.width, y: rect.top + rect.height },
        invertedMatrix
      );
      clipPath = new Rect({
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
        originX: 'left',
        originY: 'top',
      });
      clipPathType = 'rect';
    }
    (clipPath as any).inverted = false;

    // ── 3. Apply crop — non-destructive for special objects, flatten for others ──
    // Special objects (triple membrane, DNA helix, membrane path) retain their
    // type and custom properties so users can still edit colors, anchor points, etc.
    // Regular objects are flattened to a correctly-sized image.
    const isSpecialObject = object.isTripleMembrane || object.isDNAHelix ||
      object.isMembraneShape || object.isRasterizedMembrane || object.isRasterizedHelix;

    if (isSpecialObject) {
      // ── Non-destructive clipPath crop — retains all object properties ──
      object.set({ clipPath });
      object.setCoords();

      // Store crop config for reset
      object.cropConfig = {
        type: mode || (isCircular ? 'circle' : 'square'),
        clipPathData: {
          type: clipPathType,
          ...clipPath.toObject(),
        },
        originalObjectData,
        originalDimensions: {
          width: originalObjectData.width,
          height: originalObjectData.height,
          scaleX: originalObjectData.scaleX,
          scaleY: originalObjectData.scaleY,
        },
      };

      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: object });
      saveState();
    } else {
      // ── Flatten to image — shrinks selection handles to match crop ──
      // Capture the full un-cropped image before clipping (for re-edit)
      const originalDataUrl = object.toDataURL({ format: 'png', multiplier: 2 });

      object.set({ clipPath });
      object.setCoords();
      canvas.requestRenderAll();

      // Compute the crop region's bounding box in world coordinates
      let cropWorldRect: { left: number; top: number; width: number; height: number };
      if (mode === 'freeform' && polygonPoints) {
        const xs = polygonPoints.map((p: any) => p.x);
        const ys = polygonPoints.map((p: any) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        cropWorldRect = {
          left: minX,
          top: minY,
          width: Math.max(...xs) - minX,
          height: Math.max(...ys) - minY,
        };
      } else {
        cropWorldRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      }

      // Render the clipped object to a canvas, then extract just the crop sub-region.
      // toCanvasElement renders the FULL object bounding box (clip just makes areas
      // transparent), so we must manually extract the visible crop area.
      const renderScale = 2; // 2x for quality
      const fullCanvas = object.toCanvasElement({ multiplier: renderScale });

      // The rendered canvas maps to the object's bounding rect in world coords
      const objBounds = object.getBoundingRect();

      // Calculate where the crop rect falls within the rendered canvas
      const srcX = ((cropWorldRect.left - objBounds.left) / objBounds.width) * fullCanvas.width;
      const srcY = ((cropWorldRect.top - objBounds.top) / objBounds.height) * fullCanvas.height;
      const srcW = (cropWorldRect.width / objBounds.width) * fullCanvas.width;
      const srcH = (cropWorldRect.height / objBounds.height) * fullCanvas.height;

      // Extract just the crop region onto a new, correctly-sized canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.ceil(srcW);
      cropCanvas.height = Math.ceil(srcH);
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(fullCanvas, srcX, srcY, srcW, srcH, 0, 0, cropCanvas.width, cropCanvas.height);
      }
      const dataUrl = cropCanvas.toDataURL('image/png');

      // Create a new FabricImage from the extracted crop region
      const imgEl = new Image();
      imgEl.onload = () => {
        const croppedImg = new FabricImage(imgEl, {
          left: cropWorldRect.left,
          top: cropWorldRect.top,
          originX: 'left',
          originY: 'top',
          scaleX: cropWorldRect.width / imgEl.width,
          scaleY: cropWorldRect.height / imgEl.height,
        });

        // Store crop config on the new image for reset
        (croppedImg as any).cropConfig = {
          type: mode || (isCircular ? 'circle' : 'square'),
          clipPathData: {
            type: clipPathType,
            ...clipPath.toObject(),
          },
          originalObjectData,
          originalDataUrl,
          originalDimensions: {
            width: originalObjectData.width,
            height: originalObjectData.height,
            scaleX: originalObjectData.scaleX,
            scaleY: originalObjectData.scaleY,
          },
        };
        (croppedImg as any).isCroppedObject = true;

        // Copy over the object's id so references (layers, etc.) still work
        if (object.id) (croppedImg as any).id = object.id;
        if (object.name) (croppedImg as any).name = object.name;

        // Insert at same z-index, remove original
        const idx = canvas.getObjects().indexOf(selectedObject);
        canvas.remove(selectedObject);
        canvas.insertAt(idx, croppedImg);
        canvas.setActiveObject(croppedImg);
        canvas.requestRenderAll();
        canvas.fire('object:modified', { target: croppedImg });
        saveState();
      };
      imgEl.src = dataUrl;
    }

    setCropMode('none');

    const modeText = mode === 'freeform' ? 'free-form' :
                     mode === 'circle' ? 'circular' :
                     mode === 'ellipse' ? 'elliptical' :
                     mode === 'square' ? 'square' : 'rectangular';
    toast.success(`Object cropped (${modeText})`);
  }, [canvas, selectedObject, saveState]);

  // Reset crop operation — restores the original object from stored data
  const resetCrop = useCallback(async () => {
    if (!canvas || !selectedObject) return;

    const imageObj = selectedObject as any;
    const cropConfig = imageObj.cropConfig;

    if (!cropConfig) {
      toast.info('Object is not cropped');
      return;
    }

    // For non-destructive crops (special objects like triple membrane, DNA helix),
    // the object itself wasn't replaced — just remove clipPath and restore dimensions.
    const isSpecialObject = imageObj.isTripleMembrane || imageObj.isDNAHelix ||
      imageObj.isMembraneShape || imageObj.isRasterizedMembrane || imageObj.isRasterizedHelix;

    if (isSpecialObject || !imageObj.isCroppedObject) {
      imageObj.set({ clipPath: null });
      const orig = cropConfig.originalDimensions;
      if (orig) {
        imageObj.set({
          width: orig.width,
          height: orig.height,
          scaleX: orig.scaleX,
          scaleY: orig.scaleY,
        });
      }
      delete imageObj.cropConfig;
      imageObj.setCoords();
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: selectedObject });
      saveState();
      toast.success('Crop reset to original');
      return;
    }

    // For flattened crops (regular objects replaced with FabricImage),
    // restore the original object from its full serialization.
    const originalData = cropConfig.originalObjectData;

    if (originalData) {
      try {
        const [restored] = await enliven([originalData]);
        if (restored) {
          restored.setCoords();

          const idx = canvas.getObjects().indexOf(selectedObject);
          canvas.remove(selectedObject);
          canvas.insertAt(idx, restored);
          canvas.setActiveObject(restored);
          canvas.requestRenderAll();
          canvas.fire('object:modified', { target: restored });
          saveState();
          toast.success('Crop reset to original');
          return;
        }
      } catch (err) {
        console.error('Failed to restore original object:', err);
      }
    }

    // Last-resort fallback: just remove clipPath and restore dimensions
    imageObj.set({ clipPath: null });
    const orig = cropConfig.originalDimensions;
    if (orig) {
      imageObj.set({
        width: orig.width,
        height: orig.height,
        scaleX: orig.scaleX,
        scaleY: orig.scaleY,
      });
    }
    delete imageObj.cropConfig;
    imageObj.isCroppedObject = false;
    imageObj.setCoords();
    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: selectedObject });
    saveState();
    toast.success('Crop reset to original');
  }, [canvas, selectedObject, saveState]);


  // Path smoothing operation
  const smoothenPath = useCallback((strength: number) => {
    if (!canvas || !selectedObject) return;
    
    // Check if selected object is a freeform line (Path)
    if (selectedObject.type !== 'path' || !(selectedObject as any).isFreeformLine) {
      toast.error("Please select a freeform line to smooth");
      return;
    }

    const pathObj = selectedObject as Path;
    
    try {
      smoothFabricPath(pathObj, strength);
      canvas.requestRenderAll();
      saveState();
      toast.success("Path smoothed");
    } catch (error) {
      console.error('Smoothing error:', error);
      toast.error("Failed to smooth path");
    }
  }, [canvas, selectedObject, saveState]);

  // Nudge operation for precise object movement
  const nudgeObject = useCallback((direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    // Get current position
    const currentLeft = activeObject.left || 0;
    const currentTop = activeObject.top || 0;

    // Calculate new position based on direction
    let newLeft = currentLeft;
    let newTop = currentTop;

    switch (direction) {
      case 'up':
        newTop = currentTop - amount;
        break;
      case 'down':
        newTop = currentTop + amount;
        break;
      case 'left':
        newLeft = currentLeft - amount;
        break;
      case 'right':
        newLeft = currentLeft + amount;
        break;
    }

    // Update object position
    activeObject.set({
      left: newLeft,
      top: newTop
    });

    // Update coordinates and render
    activeObject.setCoords();
    canvas.requestRenderAll();
    saveState();
  }, [canvas, saveState]);

  // Project save/load operations — desktop build has no cloud projects table.
  // All saves go through File > Save / toolbar Save (useFileActions). This
  // function is kept as a no-op so legacy callers (autosave timers, old
  // keyboard shortcuts) don't crash or show "sign in" toasts.
  const saveProject = useCallback(async (_isManualSave = false) => {
    return;
    // eslint-disable-next-line no-unreachable
    if (!canvas || !user) {
      toast.error("Please sign in to save projects");
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    // Track culled objects outside try so finally can restore them
    const allObjects = canvas.getObjects();
    const culledObjects: any[] = [];
    try {
      // Include custom properties when saving to database
      const CUSTOM_PROPS = CANVAS_CUSTOM_PROPS;

      // Ensure all culled (off-screen) objects are visible before serialization.
      // Object culling sets visible=false for performance, but we must save all objects
      // as visible so they aren't invisible on reload with a different viewport.
      allObjects.forEach((obj: any) => {
        if (!obj.visible && !obj.isGridLine && !obj.isRuler) {
          obj.visible = true;
          culledObjects.push(obj);
        }
      });

      // Get all objects and filter out UI elements (grids, rulers, guides, handles)
      // These should not be saved to the database as they are recreated on load
      const userObjects = allObjects.filter((obj: any) => {
        return !obj.isGridLine &&
               !obj.isRuler &&
               !obj.excludeFromExport &&
               !obj.isControlHandle &&
               !obj.isHandleLine &&
               !obj.isAnchorHandle &&
               !obj.isGuideLine &&
               !obj.isEraserPath &&
               !obj.isPortIndicator &&
               !obj.isFeedback &&
               !obj.isEndpointMarker; // Markers are derived; recreated from startMarkerType/endMarkerType on load
      });

      // Serialize filtered objects with custom properties

      const canvasData: any = {
        version: '6.0.0',
        objects: userObjects.map((obj: any, index: number) => {

          const objData = obj.toObject(CUSTOM_PROPS);

          const beforeSize = JSON.stringify(objData).length;

          // Manually ensure all custom props are included

          CUSTOM_PROPS.forEach(prop => {
            if (obj[prop] !== undefined) {
              objData[prop] = obj[prop];
            }
          });

          // Convert Map to plain object for JSON serialization
          if (obj.originalColors instanceof Map) {

            objData.originalColors = Object.fromEntries(obj.originalColors);
          }

          // Helper function to recursively strip icon content from nested objects
          const stripNestedIcons = (nestedObjects: any[]) => {
            if (!nestedObjects || !Array.isArray(nestedObjects)) return;

            nestedObjects.forEach((nestedObj: any) => {
              // Only strip objects that are confirmed library icons with an iconId.
              // Without iconId, the object can never be reconstructed on load.
              const hasIconId = nestedObj.iconId && nestedObj.isLibraryIcon;

              if (hasIconId) {
                const nestedType = nestedObj.type;
                // Strip SVG content from nested icon
                if ((nestedObj.type === 'Group' || nestedObj.type === 'group') && nestedObj.objects) {
                  delete nestedObj.objects;

                } else if ((nestedObj.type === 'Path' || nestedObj.type === 'path') && nestedObj.path) {
                  delete nestedObj.path;

                } else if ((nestedObj.type === 'Image' || nestedObj.type === 'image') && nestedObj.src) {
                  delete nestedObj.src;

                }
                nestedObj.type = 'libraryIcon';
                nestedObj.originalType = nestedType;
              } else if (nestedObj.objects) {
                // Recursively process deeper nesting
                stripNestedIcons(nestedObj.objects);
              }
            });
          };

          // Process rasterized membranes - they store settings for regeneration
          if (obj.isRasterizedMembrane) {
            console.log('[SAVE] Processing rasterized membrane:', {
              hasSrc: !!objData.src,
              hasMembraneOptions: !!objData.membraneOptions,
              hasWorldBezierPoints: !!objData.worldBezierPoints,
              isRasterizedMembrane: objData.isRasterizedMembrane,
            });
          }

          // Process membrane groups - strip icons inside them
          if (obj.isMembraneShape && objData.objects) {

            stripNestedIcons(objData.objects);
          }

          // Icon-by-reference: Strip SVG content from library icons
          // Save only iconId + transforms instead of full SVG (650 KB → 541 bytes per icon)
          if (obj.isLibraryIcon && obj.iconId) {

            const originalType = objData.type;

            // Strip large data based on object type (Fabric uses capitalized type names)
            if ((objData.type === 'Group' || objData.type === 'group') && objData.objects) {
              const objectCount = objData.objects.length;
              delete objData.objects; // Remove nested SVG paths/shapes

            } else if ((objData.type === 'Path' || objData.type === 'path') && objData.path) {
              delete objData.path; // Remove SVG path data

            } else if ((objData.type === 'Image' || objData.type === 'image') && objData.src) {
              delete objData.src; // Remove image data URL

            }

            // Mark as library icon reference
            objData.type = 'libraryIcon';
            objData.originalType = originalType; // Store original type for reconstruction

            const afterSize = JSON.stringify(objData).length;

          } else if ((objData.type === 'Group' || objData.type === 'group') && objData.objects) {

          }

          // Asset-by-reference: Strip image/SVG content from user assets
          // Save only assetId + transforms instead of full image data
          if (obj.isUserAsset && obj.assetId) {
            const originalType = objData.type;

            if ((objData.type === 'Image' || objData.type === 'image') && objData.src) {
              // Preserve src as fallback in case storage reconstruction fails on load
              objData._fallbackSrc = objData.src;
              delete objData.src;
              delete objData.originalImageSrc; // Reconstructed from storage on load
            } else if ((objData.type === 'Group' || objData.type === 'group') && objData.objects) {
              delete objData.objects; // SVG content
            }

            objData.type = 'userAsset';
            objData.originalType = originalType;
          }

          return objData;
        }),
        // Save background color but exclude grid Pattern (grid uses backgroundColor as Pattern)
        background: (typeof canvas.backgroundColor === 'string') ? canvas.backgroundColor : '',
      };

      const totalSize = JSON.stringify(canvasData).length;
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

      // LOG: Check what's actually going to the database
      const membranesInData = canvasData.objects.filter((obj: any) => obj.isRasterizedMembrane);
      console.log('[SAVE] Membranes going to database:', membranesInData.length);
      membranesInData.forEach((m: any, i: number) => {
        console.log(`[SAVE] Membrane ${i} in database payload:`, {
          hasMembraneOptions: !!m.membraneOptions,
          hasWorldBezierPoints: !!m.worldBezierPoints,
        });
      });

      // Base data for updates (don't include user_id to preserve original owner)
      const updateData = {
        name: projectName,
        canvas_data: canvasData,
        paper_size: paperSize,
        canvas_width: canvasDimensions.width,
        canvas_height: canvasDimensions.height,
        custom_unit: paperSize === 'custom' ? customDimensions.unit : 'px',
        updated_at: new Date().toISOString()
      };
      
      // Full data for inserts (includes user_id for new projects)
      const insertData = {
        ...updateData,
        user_id: user.id,
        approval_status: null,  // New projects have no review status until submitted
      };

      // Check payload size before saving
      const payloadSize = new Blob([JSON.stringify(insertData)]).size / (1024 * 1024);
      if (payloadSize > 4) {
        toast.error('Project too large to save (>4MB)', {
          description: 'Remove complex icons or reduce object count'
        });
        setIsSaving(false);
        return;
      }

      let savedProjectId: string | null = null;

      if (currentProjectId) {
        savedProjectId = currentProjectId;
        // Fetch the current project data from database for version creation
        const { data: currentProject } = await supabase
          .from('canvas_projects')
          .select('canvas_data, canvas_width, canvas_height, paper_size')
          .eq('id', currentProjectId)
          .single();

        // Check if we should create a version snapshot
        let shouldCreateVersion = isManualSave;

        if (!shouldCreateVersion && currentProject) {
          // For auto-saves, check if changes are significant
          shouldCreateVersion = isSignificantChange(currentProject.canvas_data, canvasData);
        }

        // Create version snapshot before updating main project
        // Version contains the PREVIOUS state (from database), not the NEW state (current canvas)
        if (shouldCreateVersion && currentProject) {
          try {
            await createVersion({
              projectId: currentProjectId,
              userId: user.id,
              canvasData: currentProject.canvas_data,
              canvasWidth: currentProject.canvas_width,
              canvasHeight: currentProject.canvas_height,
              paperSize: currentProject.paper_size || paperSize,
              isAutoSave: !isManualSave,
            });
          } catch (versionError) {
            console.error('Failed to create version snapshot:', versionError);
            // Don't fail the save if version creation fails
          }
        }

        // Update existing project (preserves original owner)
        // Use .select('id') so we can detect when RLS silently blocks the update (0 rows).
        const { data: updateResult, error } = await supabase
          .from('canvas_projects')
          .update(updateData)
          .eq('id', currentProjectId)
          .select('id');

        if (error) throw error;

        // RLS may silently filter out the row (e.g. project is pending approval).
        // In that case updateResult is an empty array — no rows were actually updated.
        if (!updateResult || updateResult.length === 0) {
          throw new Error(
            'Unable to save — this project may be locked for review. Please reload the page.'
          );
        }

        // Cleanup old versions in the background
        cleanupVersions(currentProjectId).catch(err =>
          console.error('Version cleanup failed:', err)
        );

        setSaveStatus('saved');
        setIsDirty(false); // Clear dirty flag after successful save
        toast.success("Project saved", {
          duration: 1000,
          className: 'success-pulse animate-fade-in'
        });

        // Update URL without triggering React Router to preserve canvas state
        if (isManualSave && !window.location.pathname.includes(currentProjectId)) {
          window.history.replaceState({}, '', `/canvas/${currentProjectId}`);
        }
      } else {
        // ── Enforce 5-project limit for non-premium, non-admin users ──
        const blocked = await checkProjectLimit(user.id);
        if (blocked) {
          setSaveStatus('idle');
          setIsSaving(false);
          return;
        }

        // Create new project
        const { data, error } = await supabase
          .from('canvas_projects')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          savedProjectId = data.id;
          setCurrentProjectId(data.id);
          setProjectOwnerId(user.id);
          setLoadedProjectId(data.id); // Mark project as loaded to prevent unnecessary reload
          setSaveStatus('saved');
          setIsDirty(false); // Clear dirty flag after successful save
          toast.success("Project created and saved", {
            duration: 1500,
            className: 'success-pulse animate-fade-in'
          });

          // Update URL without triggering React Router to preserve canvas state
          // This ensures users working on /canvas get the URL updated to /canvas/:id after first save
          window.history.replaceState({}, '', `/canvas/${data.id}`);
        }
      }

      // Sync project_asset_references so collaborators can access referenced assets.
      if (savedProjectId) {
        const referencedAssetIds = canvasData.objects
          .filter((obj: any) => obj.type === 'userAsset' && obj.assetId)
          .map((obj: any) => obj.assetId) as string[];

        // Fire-and-forget: delete stale references, then insert current ones
        supabase
          .from('project_asset_references')
          .delete()
          .eq('project_id', savedProjectId)
          .then(() => {
            if (referencedAssetIds.length === 0) return { error: null };
            return supabase
              .from('project_asset_references')
              .upsert(
                referencedAssetIds.map(assetId => ({ project_id: savedProjectId, asset_id: assetId })),
                { onConflict: 'project_id,asset_id' }
              );
          })
          .then((result: any) => {
            if (result?.error) console.error('[SAVE] Failed to sync asset references:', result.error);
          });
      }
    } catch (error: any) {
      console.error('Save error:', {
        message: error.message,
        details: error.toString(),
        hint: error.hint,
        code: error.code
      });
      
      // Provide specific error messages
      if (error.message?.includes('payload') || error.message?.includes('too large') || error.message?.includes('size')) {
        toast.error('Project too large to save', {
          description: 'Remove some complex icons and try again'
        });
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch') || error.message?.includes('network')) {
        toast.error('Network timeout during save', {
          description: 'Project may be too large or connection is slow'
        });
      } else {
        toast.error(error.message || "Failed to save project");
      }
    } finally {
      setIsSaving(false);
      // Re-hide objects that were temporarily shown for serialization.
      // This restores the culling state so rendering performance is not degraded.
      culledObjects.forEach((obj: any) => { obj.visible = false; });
    }
  }, [canvas, user, projectName, paperSize, canvasDimensions, customDimensions.unit, currentProjectId, navigate, isAdmin, hasPremiumAccess]);

  const loadProject = useCallback(async (id: string) => {
    if (!canvas || !user) return;

    // Skip if this project is already loaded
    if (loadedProjectId === id && canvas.getObjects().length > 0) {

      return;
    }

    // Set flags to prevent auto-save during project load
    isLoadingProjectRef.current = true;
    loadHadReconstructionFailuresRef.current = false;
    setIsLoadingProject(true);

    try {
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error("Project not found");
        isLoadingProjectRef.current = false;
        setIsLoadingProject(false);
        return;
      }

      // Wait for all fonts to load before rendering
      toast("Loading project...");
      await loadAllFonts();

      // Load canvas data
      const canvasData = data.canvas_data as Record<string, any>;

      // LOG: Check what we got from the database
      const membranesFromDB = canvasData.objects?.filter((obj: any) => obj.isRasterizedMembrane) || [];
      console.log('[LOAD] Membranes from database:', membranesFromDB.length);
      membranesFromDB.forEach((m: any, i: number) => {
        console.log(`[LOAD] Membrane ${i} from database:`, {
          hasMembraneOptions: !!m.membraneOptions,
          hasWorldBezierPoints: !!m.worldBezierPoints,
        });
      });

      // Icon-by-reference: Reconstruct icons from references before loading
      if (canvasData.objects && canvasData.objects.length > 0) {
        const { loadSVGFromString, util } = await import('fabric');

        // Helper to count all icons and user assets including nested ones
        const countAllIcons = (objects: any[]): number => {
          let count = 0;
          objects.forEach(obj => {
            if (obj.type === 'libraryIcon' && obj.iconId) {
              count++;
            }
            if (obj.type === 'userAsset' && obj.assetId) {
              count++;
            }
            // Check for nested icons in membrane groups
            if (obj.isMembraneShape && obj.objects) {
              count += countNestedIcons(obj.objects);
            }
          });
          return count;
        };

        const countNestedIcons = (nestedObjects: any[]): number => {
          let count = 0;
          nestedObjects.forEach(nested => {
            if (nested.type === 'libraryIcon' && nested.iconId) {
              count++;
            }
            if (nested.objects) {
              count += countNestedIcons(nested.objects);
            }
          });
          return count;
        };

        // Cache for icon SVG content to avoid repeated DB queries
        const iconSvgCache = new Map<string, string>();

        // Batch pre-fetch all unique icon SVGs in a single query (instead of N individual queries)
        const collectIconIds = (objects: any[]): Set<string> => {
          const ids = new Set<string>();
          for (const obj of objects) {
            if (obj.type === 'libraryIcon' && obj.iconId) ids.add(obj.iconId);
            if (obj.objects) {
              for (const id of collectIconIds(obj.objects)) ids.add(id);
            }
          }
          return ids;
        };
        const uniqueIconIds = collectIconIds(canvasData.objects);
        if (uniqueIconIds.size > 0) {
          const iconIdArr = [...uniqueIconIds];
          const BATCH_SIZE = 500;
          for (let i = 0; i < iconIdArr.length; i += BATCH_SIZE) {
            const batch = iconIdArr.slice(i, i + BATCH_SIZE);
            const { data: iconRows } = await supabase
              .from('icons')
              .select('id, svg_content')
              .in('id', batch);
            if (iconRows) {
              for (const row of iconRows) {
                if (row.svg_content) iconSvgCache.set(row.id, row.svg_content);
              }
            }
          }
        }

        // Cache for user asset content to avoid repeated storage downloads
        const assetContentCache = new Map<string, { content: string; mimeType: string }>();

        // Helper to reconstruct a single user asset from storage
        const reconstructUserAsset = async (assetObj: any): Promise<boolean> => {
          // Check cache first
          let cached = assetContentCache.get(assetObj.assetId);

          if (!cached) {
            // Look up asset metadata in user_assets table
            const { data: assetData, error: assetError } = await supabase
              .from('user_assets')
              .select('storage_path, mime_type, file_type')
              .eq('id', assetObj.assetId)
              .single();

            if (assetError || !assetData) {
              console.error(`Failed to load user asset ${assetObj.assetId}:`, assetError);
              return false;
            }

            // Download content from storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('user-assets')
              .download(assetData.storage_path);

            if (downloadError || !fileData) {
              console.error(`Failed to download user asset ${assetObj.assetId}:`, downloadError);
              return false;
            }

            let content: string;
            if (assetData.mime_type === 'image/svg+xml') {
              content = await fileData.text();
            } else {
              // Convert blob to data URL for raster images
              content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read asset file'));
                reader.readAsDataURL(fileData);
              });
            }

            cached = { content, mimeType: assetData.mime_type };
            assetContentCache.set(assetObj.assetId, cached);
          }

          const originalType = assetObj.originalType || 'Image';
          const normalizedType = originalType.toLowerCase();

          if (cached.mimeType === 'image/svg+xml') {
            // SVG asset - parse and reconstruct as Group
            const sanitizedContent = cached.content.trim().startsWith('<svg') || cached.content.includes('xmlns="http://www.w3.org/2000/svg"')
              ? cached.content : cached.content;
            const svgResult = await loadSVGFromString(sanitizedContent, undefined, {
              crossOrigin: 'anonymous'
            });
            const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);
            const groupData = tempGroup.toObject();
            assetObj.objects = groupData.objects;
            assetObj.type = originalType || 'Group';
          } else {
            // Raster image (PNG/JPG) - set src
            assetObj.src = cached.content;
            assetObj.crossOrigin = 'anonymous';
            assetObj.type = originalType || 'Image';

            // If color map was applied, store original src for non-destructive editing
            if (assetObj.colorMapConfig) {
              assetObj.originalImageSrc = cached.content;
            }
          }

          return true;
        };

        // Helper to reconstruct a single icon
        const reconstructIcon = async (iconObj: any) => {
          // Check cache first
          let svgContent = iconSvgCache.get(iconObj.iconId);

          if (!svgContent) {
            const { data: iconData, error: iconError } = await supabase
              .from('icons')
              .select('svg_content, thumbnail')
              .eq('id', iconObj.iconId)
              .single();

            if (iconError || !iconData?.svg_content) {
              console.error(`Failed to load icon ${iconObj.iconId}:`, iconError);
              return false;
            }

            svgContent = iconData.svg_content;
            iconSvgCache.set(iconObj.iconId, svgContent);
          }

          // Parse SVG with crossOrigin set for image elements
          const svgResult = await loadSVGFromString(svgContent, undefined, {
            crossOrigin: 'anonymous'
          });
          const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

          // If this is an image icon, ensure crossOrigin is set on image objects
          const setImageCrossOrigin = (obj: any) => {
            if (obj.type === 'image' || obj.type === 'Image') {
              obj.set({ crossOrigin: 'anonymous' });
            }
            if (obj._objects) {
              obj._objects.forEach((child: any) => setImageCrossOrigin(child));
            }
          };
          setImageCrossOrigin(tempGroup);

          const originalType = iconObj.originalType || 'Group';
          const normalizedType = originalType.toLowerCase();

          if (normalizedType === 'group') {
            const groupData = tempGroup.toObject();
            iconObj.objects = groupData.objects;
            iconObj.type = originalType;
          } else if (normalizedType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
            const pathData = tempGroup._objects[0].toObject();
            iconObj.path = pathData.path;
            iconObj.type = originalType;
          } else if (normalizedType === 'image') {
            // Image icons can be returned directly as Image objects or wrapped in a Group
            if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
              // tempGroup is directly an Image object
              const imageData = tempGroup.toObject();
              iconObj.src = imageData.src;
              iconObj.crossOrigin = 'anonymous';
              iconObj.type = originalType;
            } else if (tempGroup._objects && tempGroup._objects[0]) {
              // tempGroup is a Group containing an Image
              const imageData = tempGroup._objects[0].toObject();
              iconObj.src = imageData.src;
              iconObj.crossOrigin = 'anonymous';
              iconObj.type = originalType;
            } else {
              // Fallback - shouldn't happen but handle gracefully
              const groupData = tempGroup.toObject();
              iconObj.objects = groupData.objects;
              iconObj.type = originalType;
            }
          } else {
            const groupData = tempGroup.toObject();
            iconObj.objects = groupData.objects;
            iconObj.type = 'Group';
          }

          return true;
        };

        // Helper to recursively reconstruct nested icons
        const reconstructNestedIcons = async (nestedObjects: any[]): Promise<number> => {
          let count = 0;
          for (const nested of nestedObjects) {
            if (nested.type === 'libraryIcon' && nested.iconId) {
              let nestedSuccess = false;
              try {
                nestedSuccess = await reconstructIcon(nested);
                count++;
              } catch (error) {
                console.error(`Error reconstructing nested icon ${nested.iconId}:`, error);
                count++;
              }

              if (!nestedSuccess) {
                // Replace with placeholder to prevent Fabric from dropping the object
                console.warn(`Nested icon ${nested.iconId} could not be loaded — replaced with placeholder`);
                nested.type = 'Rect';
                nested.fill = '#fff3f3';
                nested.stroke = '#cc0000';
                nested.strokeWidth = 2;
                nested.strokeDashArray = [5, 5];
                nested.width = nested.width || 60;
                nested.height = nested.height || 60;
                nested._isMissingIconPlaceholder = true;
                loadHadReconstructionFailuresRef.current = true;
              }
            }
            // Recursively process deeper nesting
            if (nested.objects) {
              count += await reconstructNestedIcons(nested.objects);
            }
          }
          return count;
        };

        // Count total icons (including nested)
        const iconCount = countAllIcons(canvasData.objects);
        let loadedIcons = 0;

        if (iconCount > 0) {
          setIconLoadingProgress({ current: 0, total: iconCount });
        }

        for (let i = 0; i < canvasData.objects.length; i++) {
          const objData = canvasData.objects[i];

          // Process membrane groups - reconstruct nested icons
          if (objData.isMembraneShape && objData.objects) {

            const nestedCount = await reconstructNestedIcons(objData.objects);
            loadedIcons += nestedCount;
            if (iconCount > 0) {
              setIconLoadingProgress(prev => {
                if (!prev || loadedIcons > prev.current) {
                  return { current: loadedIcons, total: iconCount };
                }
                return prev;
              });
            }
          }

          // Detect library icon references
          if (objData.type === 'libraryIcon' && objData.iconId) {
            let iconSuccess = false;
            try {
              iconSuccess = await reconstructIcon(objData);
            } catch (error) {
              console.error(`Error reconstructing icon ${objData.iconId}:`, error);
            }

            if (!iconSuccess) {
              // Reconstruction failed — convert to visible placeholder so Fabric can
              // deserialise it (unknown 'libraryIcon' type would be silently dropped).
              console.warn(`Icon ${objData.iconId} could not be loaded — replaced with placeholder`);
              objData.type = 'Rect';
              objData.fill = '#fff3f3';
              objData.stroke = '#cc0000';
              objData.strokeWidth = 2;
              objData.strokeDashArray = [5, 5];
              objData.width = objData.width || 80;
              objData.height = objData.height || 80;
              objData._isMissingIconPlaceholder = true;
              // Keep iconId so a future load can still try to reconstruct
              loadHadReconstructionFailuresRef.current = true;
            }

            loadedIcons++;
            if (iconCount > 0) {
              setIconLoadingProgress(prev => {
                if (!prev || loadedIcons > prev.current) {
                  return { current: loadedIcons, total: iconCount };
                }
                return prev;
              });
            }
          }

          // Asset-by-reference: Reconstruct user assets from storage
          if (objData.type === 'userAsset' && objData.assetId) {
            const assetIdForLog = objData.assetId;
            try {
              const success = await reconstructUserAsset(objData);
              // Clean up fallback src after successful reconstruction
              if (success) {
                delete objData._fallbackSrc;
              }
              if (!success) {
                if (objData._fallbackSrc) {
                  // Reconstruction failed but we have inline fallback — restore image
                  console.warn(`Asset ${assetIdForLog} reconstruction failed - using inline fallback`);
                  objData.src = objData._fallbackSrc;
                  objData.crossOrigin = 'anonymous';
                  objData.type = objData.originalType || 'Image';
                  delete objData._fallbackSrc;
                } else {
                  // No fallback available - create a placeholder
                  console.warn(`Asset ${assetIdForLog} not found and no fallback - replaced with placeholder`);
                  objData.type = 'Rect';
                  objData.fill = '#f0f0f0';
                  objData.stroke = '#cc0000';
                  objData.strokeWidth = 2;
                  objData.strokeDashArray = [5, 5];
                  objData.width = objData.width || 200;
                  objData.height = objData.height || 200;
                  objData._isMissingAssetPlaceholder = true;
                  delete objData.assetId;
                  delete objData.isUserAsset;
                  delete objData.originalType;
                }
              }

              loadedIcons++;
              if (iconCount > 0) {
                setIconLoadingProgress(prev => {
                  if (!prev || loadedIcons > prev.current) {
                    return { current: loadedIcons, total: iconCount };
                  }
                  return prev;
                });
              }
            } catch (error) {
              console.error(`Error reconstructing user asset ${objData.assetId}:`, error);
              loadedIcons++;
              if (iconCount > 0) {
                setIconLoadingProgress(prev => {
                  if (!prev || loadedIcons > prev.current) {
                    return { current: loadedIcons, total: iconCount };
                  }
                  return prev;
                });
              }
            }
          }
        }

        // Show toast if any assets failed to load
        const missingAssets = canvasData.objects.filter((obj: any) =>
          obj._isMissingAssetPlaceholder
        );
        if (missingAssets.length > 0) {
          toast.error(`${missingAssets.length} image(s) could not be loaded. They may have been deleted from your assets.`);
        }

        // Show toast if any icons failed to reconstruct
        const countMissingIcons = (objs: any[]): number => {
          let n = 0;
          for (const o of objs) {
            if (o._isMissingIconPlaceholder) n++;
            if (o.objects) n += countMissingIcons(o.objects);
          }
          return n;
        };
        const missingIconCount = countMissingIcons(canvasData.objects);
        if (missingIconCount > 0) {
          toast.error(`${missingIconCount} icon(s) could not be loaded. They are shown as red placeholders. Auto-save is paused to protect your data — please save manually after re-adding them.`);
        }

        // Clear progress indicator
        if (iconCount > 0) {
          setIconLoadingProgress(null);
        }
      }

      // Use the latest canvas reference — the closure-captured `canvas` may be
      // stale if the component re-rendered during async reconstruction above.
      const activeCanvas = canvasRef.current;
      if (!activeCanvas || activeCanvas.destroyed || activeCanvas.disposed) {
        console.error('Canvas was disposed during asset reconstruction. Aborting load.');
        toast.error("Failed to load project — please try again");
        return;
      }

      await activeCanvas.loadFromJSON(canvasData);

      // Clean up any grid lines or rulers that might have been saved in old data
      // These should never be loaded from saved data as they're recreated on load
      const strayUIElements = activeCanvas.getObjects().filter((obj: any) =>
        obj.isGridLine || obj.isRuler
      );
      strayUIElements.forEach(obj => {
        activeCanvas.remove(obj);
      });

      // Restore custom properties and run all post-load reconnection steps
      if (canvasData.objects) {
        restorePropsRecursive(activeCanvas.getObjects(), canvasData.objects);
      }
      await runPostLoadGlobalSteps(activeCanvas);
      // Force-invalidate cache on all groups so child images (membranes, etc.)
      // are re-rendered from their fully-decoded image elements
      for (const obj of activeCanvas.getObjects()) {
        if (obj.type === 'group') (obj as any).dirty = true;
      }
      activeCanvas.requestRenderAll();

      // Update context state
      setCurrentProjectId(data.id);
      setProjectOwnerId(data.user_id);
      setProjectName(data.name);
      setPaperSize(data.paper_size);
      setCanvasDimensions({
        width: data.canvas_width,
        height: data.canvas_height
      });

      // Increment version to trigger ruler/grid re-render
      setCanvasLoadVersion(prev => prev + 1);

      // Restore custom dimensions if this is a custom-sized canvas
      if (data.paper_size === 'custom' && data.custom_unit) {
        const unit = data.custom_unit as Unit;
        setCustomDimensions({
          width: fromPixels(data.canvas_width, unit),
          height: fromPixels(data.canvas_height, unit),
          unit: unit
        });
      }

      // Helper to lock canvas objects into view-only mode
      const lockCanvasViewOnly = () => {
        activeCanvas.getObjects().forEach(obj => {
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
        activeCanvas.selection = false;
        activeCanvas.requestRenderAll();
        setIsReadOnly(true);
      };

      const isOwner = data.user_id === user.id;
      // Mark as community clone if project was cloned from another project
      setIsCommunityClone(!!data.original_project_id);
      const isPending = data.is_public && data.approval_status === 'pending';

      if (isOwner && !isAdmin && isPending) {
        // Owner lock: project is pending approval — owner cannot edit (admins can)
        lockCanvasViewOnly();
        toast.info("This project is locked while pending admin review");
      } else if (!isOwner && isAdmin && !isPending) {
        // Admin viewing a project NOT submitted for review — view-only
        lockCanvasViewOnly();
        toast.success("Project loaded (view only)");
      } else if (!isOwner && !isAdmin) {
        // Non-owner, non-admin: check collaboration permissions
        const { data: canEdit } = await supabase.rpc('user_can_edit_project', {
          check_user_id: user.id,
          check_project_id: id,
        });

        if (!canEdit) {
          lockCanvasViewOnly();
          toast.success("Project loaded (view only)");
        } else {
          toast.success("Project loaded");
        }
      } else {
        // Owner editing their own non-pending project, or admin editing a pending project
        toast.success("Project loaded");
      }

      // Mark this project as loaded to prevent redundant reloads
      setLoadedProjectId(id);

      // Clear history and save initial state after loading project
      historyManager.current.clear();
      saveState(true); // Force save even though still loading
      setSaveStatus('saved');
      setIsDirty(false); // Clear dirty flag after loading

      // Clear any stale recovery data since we just loaded fresh from database
      localStorage.removeItem('canvas_recovery');
    } catch (error: any) {
      console.error('Load error:', error);
      toast.error(error.message || "Failed to load project");
    } finally {
      // Delay clearing flag to allow all async canvas operations to complete
      setTimeout(() => {
        isLoadingProjectRef.current = false;
        setIsLoadingProject(false);
      }, 1000); // 1 second delay to ensure all canvas events settle
    }
  }, [canvas, user, saveState, loadedProjectId]);

  const loadSharedProject = useCallback(async (id: string) => {
    if (!canvas || !user) return;

    // Set flag to prevent auto-save during project load
    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);

    try {
      const { data, error} = await supabase
        .from('canvas_projects')
        .select('*')
        .eq('id', id)
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .single();

      if (error || !data) {
        toast.error("Shared project not found or not available");
        navigate('/projects');
        isLoadingProjectRef.current = false;
        setIsLoadingProject(false);
        return;
      }

      // Wait for all fonts to load
      toast("Loading shared project...");
      await loadAllFonts();

      // Load canvas data
      const canvasData = data.canvas_data as Record<string, any>;

      // Icon-by-reference & asset-by-reference: reconstruct from DB/storage
      // before loading into Fabric (same logic as loadProject, without progress UI)
      if (canvasData.objects && canvasData.objects.length > 0) {
        const { loadSVGFromString, util } = await import('fabric');

        const iconSvgCache = new Map<string, string>();
        const assetContentCache = new Map<string, { content: string; mimeType: string }>();

        const reconstructUserAsset = async (assetObj: any): Promise<boolean> => {
          let cached = assetContentCache.get(assetObj.assetId);
          if (!cached) {
            const { data: assetData, error: assetError } = await supabase
              .from('user_assets')
              .select('storage_path, mime_type, file_type')
              .eq('id', assetObj.assetId)
              .single();
            if (assetError || !assetData) return false;

            const { data: fileData, error: downloadError } = await supabase.storage
              .from('user-assets')
              .download(assetData.storage_path);
            if (downloadError || !fileData) return false;

            let content: string;
            if (assetData.mime_type === 'image/svg+xml') {
              content = await fileData.text();
            } else {
              content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read asset file'));
                reader.readAsDataURL(fileData);
              });
            }
            cached = { content, mimeType: assetData.mime_type };
            assetContentCache.set(assetObj.assetId, cached);
          }

          const originalType = assetObj.originalType || 'Image';
          if (cached.mimeType === 'image/svg+xml') {
            const svgResult = await loadSVGFromString(cached.content, undefined, { crossOrigin: 'anonymous' });
            const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);
            assetObj.objects = tempGroup.toObject().objects;
            assetObj.type = originalType || 'Group';
          } else {
            assetObj.src = cached.content;
            assetObj.crossOrigin = 'anonymous';
            assetObj.type = originalType || 'Image';
            if (assetObj.colorMapConfig) assetObj.originalImageSrc = cached.content;
          }
          return true;
        };

        const reconstructIcon = async (iconObj: any): Promise<boolean> => {
          let svgContent = iconSvgCache.get(iconObj.iconId);
          if (!svgContent) {
            const { data: iconData, error: iconError } = await supabase
              .from('icons')
              .select('svg_content')
              .eq('id', iconObj.iconId)
              .single();
            if (iconError || !iconData?.svg_content) return false;
            svgContent = iconData.svg_content;
            iconSvgCache.set(iconObj.iconId, svgContent);
          }

          const svgResult = await loadSVGFromString(svgContent, undefined, { crossOrigin: 'anonymous' });
          const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

          const setImageCrossOrigin = (obj: any) => {
            if (obj.type === 'image' || obj.type === 'Image') obj.set({ crossOrigin: 'anonymous' });
            if (obj._objects) obj._objects.forEach((c: any) => setImageCrossOrigin(c));
          };
          setImageCrossOrigin(tempGroup);

          const originalType = iconObj.originalType || 'Group';
          const normalizedType = originalType.toLowerCase();
          if (normalizedType === 'group') {
            iconObj.objects = tempGroup.toObject().objects;
            iconObj.type = originalType;
          } else if (normalizedType === 'path' && tempGroup._objects?.[0]) {
            iconObj.path = tempGroup._objects[0].toObject().path;
            iconObj.type = originalType;
          } else if (normalizedType === 'image') {
            if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
              const d = tempGroup.toObject();
              iconObj.src = d.src; iconObj.crossOrigin = 'anonymous'; iconObj.type = originalType;
            } else if (tempGroup._objects?.[0]) {
              const d = tempGroup._objects[0].toObject();
              iconObj.src = d.src; iconObj.crossOrigin = 'anonymous'; iconObj.type = originalType;
            } else {
              iconObj.objects = tempGroup.toObject().objects; iconObj.type = originalType;
            }
          } else {
            iconObj.objects = tempGroup.toObject().objects; iconObj.type = 'Group';
          }
          return true;
        };

        const reconstructNestedIcons = async (nestedObjects: any[]) => {
          for (const nested of nestedObjects) {
            if (nested.type === 'libraryIcon' && nested.iconId) {
              try { await reconstructIcon(nested); } catch (e) { console.error(`Nested icon ${nested.iconId}:`, e); }
            }
            if (nested.objects) await reconstructNestedIcons(nested.objects);
          }
        };

        for (const objData of canvasData.objects) {
          if (objData.isMembraneShape && objData.objects) {
            await reconstructNestedIcons(objData.objects);
          }
          if (objData.type === 'libraryIcon' && objData.iconId) {
            try { await reconstructIcon(objData); } catch (e) { console.error(`Icon ${objData.iconId}:`, e); }
          }
          if (objData.type === 'userAsset' && objData.assetId) {
            try {
              const success = await reconstructUserAsset(objData);
              if (success) {
                delete objData._fallbackSrc;
              }
              if (!success) {
                if (objData._fallbackSrc) {
                  objData.src = objData._fallbackSrc;
                  objData.crossOrigin = 'anonymous';
                  objData.type = objData.originalType || 'Image';
                  delete objData._fallbackSrc;
                } else {
                  objData.type = 'Rect';
                  objData.fill = '#f0f0f0';
                  objData.stroke = '#cc0000';
                  objData.strokeWidth = 2;
                  objData.strokeDashArray = [5, 5];
                  objData.width = objData.width || 200;
                  objData.height = objData.height || 200;
                  objData._isMissingAssetPlaceholder = true;
                  delete objData.assetId;
                  delete objData.isUserAsset;
                  delete objData.originalType;
                }
              }
            } catch (e) { console.error(`Asset ${objData.assetId}:`, e); }
          }
        }

        const missingAssets = canvasData.objects.filter((obj: any) => obj._isMissingAssetPlaceholder);
        if (missingAssets.length > 0) {
          toast.error(`${missingAssets.length} image(s) could not be loaded. They may have been deleted.`);
        }
      }

      // Use the latest canvas reference to guard against stale closures
      const activeCanvas = canvasRef.current;
      if (!activeCanvas || activeCanvas.destroyed || activeCanvas.disposed) {
        console.error('Canvas was disposed before shared project could be loaded.');
        toast.error("Failed to load project — please try again");
        return;
      }

      await activeCanvas.loadFromJSON(canvasData);

      // Clean up any grid lines or rulers that might have been saved in old data
      // These should never be loaded from saved data as they're recreated on load
      const strayUIElements = activeCanvas.getObjects().filter((obj: any) =>
        obj.isGridLine || obj.isRuler
      );
      strayUIElements.forEach(obj => {
        activeCanvas.remove(obj);
      });

      // Restore custom properties and run all post-load reconnection steps
      if (canvasData.objects) {
        restorePropsRecursive(activeCanvas.getObjects(), canvasData.objects);
      }
      await runPostLoadGlobalSteps(activeCanvas);
      for (const obj of activeCanvas.getObjects()) {
        if (obj.type === 'group') (obj as any).dirty = true;
      }

      // Update state
      setCurrentProjectId(data.id);
      setProjectOwnerId(data.user_id);
      setProjectName(data.name);
      setPaperSize(data.paper_size);
      setCanvasDimensions({
        width: data.canvas_width,
        height: data.canvas_height
      });

      // Increment version to trigger ruler/grid re-render
      setCanvasLoadVersion(prev => prev + 1);

      if (data.paper_size === 'custom' && data.custom_unit) {
        const unit = data.custom_unit as Unit;
        setCustomDimensions({
          width: fromPixels(data.canvas_width, unit),
          height: fromPixels(data.canvas_height, unit),
          unit: unit
        });
      }

      // Lock all objects for read-only mode
      activeCanvas.getObjects().forEach(obj => {
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

      activeCanvas.selection = false;
      activeCanvas.requestRenderAll();

      // Shared projects are always community content
      setIsCommunityClone(true);
      toast.success("Shared project loaded (read-only)");
      historyManager.current.clear();
      setSaveStatus('saved');
      setIsDirty(false); // Clear dirty flag after loading
    } catch (error: any) {
      console.error('Load shared project error:', error);
      toast.error(error.message || "Failed to load shared project");
      navigate('/projects');
    } finally {
      // Delay clearing flag to allow all async canvas operations to complete
      setTimeout(() => {
        isLoadingProjectRef.current = false;
        setIsLoadingProject(false);
      }, 1000); // 1 second delay to ensure all canvas events settle
    }
  }, [canvas, user, navigate]);

  // Activity tracking for smart auto-save (canvas events only)
  useEffect(() => {
    if (!canvas) return;

    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    // Track canvas edit events
    canvas.on('object:modified', updateActivity);
    canvas.on('object:moving', updateActivity);
    canvas.on('object:scaling', updateActivity);
    canvas.on('object:rotating', updateActivity);
    canvas.on('object:added', updateActivity);
    canvas.on('object:removed', updateActivity);

    return () => {
      canvas.off('object:modified', updateActivity);
      canvas.off('object:moving', updateActivity);
      canvas.off('object:scaling', updateActivity);
      canvas.off('object:rotating', updateActivity);
      canvas.off('object:added', updateActivity);
      canvas.off('object:removed', updateActivity);
    };
  }, [canvas]);

  // Debounced auto-save - triggers after 5 seconds of no canvas activity
  useEffect(() => {
    if (!canvas || !user || !isDirty || isReadOnly) return;

    // Skip auto-save if we're currently loading a project
    if (isLoadingProjectRef.current) return;

    // Skip auto-save if the last load had reconstruction failures — saving now
    // would permanently overwrite the original icon references with placeholders.
    if (loadHadReconstructionFailuresRef.current) return;

    const INACTIVITY_DELAY = 5000; // 5 seconds of no canvas activity
    // Give the user a window after undo/redo to notice and correct a bad restore
    // before autosave persists it. Long enough to survive a distracted moment.
    const UNDO_AUTOSAVE_PAUSE_MS = 30000;

    const checkAndSave = () => {
      const timeSinceActivity = Date.now() - lastActivityTimeRef.current;
      const timeSinceUndoRedo = Date.now() - lastUndoRedoTimeRef.current;

      // Pause autosave shortly after undo/redo so a bad restore never propagates
      // to the server before the user notices. Any new edit (which bumps activity
      // time) can still fire the save once the inactivity window passes.
      if (timeSinceUndoRedo < UNDO_AUTOSAVE_PAUSE_MS) return;

      if (timeSinceActivity >= INACTIVITY_DELAY) {
        // 5+ seconds of no canvas activity, safe to save
        if (isDirty && canvas && user && !isReadOnly && !isLoadingProjectRef.current && !loadHadReconstructionFailuresRef.current) {
          // Check if canvas has actual content (exclude UI elements like grid/rulers)
          const hasContent = canvas.getObjects().some(obj =>
            !(obj as any).isGridLine &&
            !(obj as any).isRuler &&
            !(obj as any).isControlHandle &&
            !(obj as any).isHandleLine &&
            !(obj as any).isGuideLine
          );

          // Only auto-save if there's actual content
          if (hasContent) {

            saveProject();
          }
          setIsDirty(false);
        }
      }
    };

    // Check every second if we should save
    const interval = setInterval(checkAndSave, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [canvas, user, isDirty, isReadOnly, saveProject]);

  // Periodic auto-save - REMOVED (debounced save with activity tracking is sufficient)

  // Optimized auto-recovery - only save if dirty
  useEffect(() => {
    if (!canvas || !isDirty || isReadOnly) return;

    const debouncedRecover = debounce(() => {
      if (saveStatus === 'unsaved' && isDirty && !isReadOnly) {
        // Skip recovery save if load had reconstruction failures
        if (loadHadReconstructionFailuresRef.current) return;
        // Also pause recovery snapshotting right after undo/redo so a bad
        // restore doesn't overwrite the last good recovery blob.
        if (Date.now() - lastUndoRedoTimeRef.current < 30000) return;

        // Include custom properties when saving recovery state
        const CUSTOM_PROPS = CANVAS_CUSTOM_PROPS;

        // Ensure culled objects are visible for serialization, track them for restoration
        const allObjects = canvas.getObjects();
        const culledObjects: any[] = [];
        allObjects.forEach((obj: any) => {
          if (!obj.visible && !obj.isGridLine && !obj.isRuler) {
            obj.visible = true;
            culledObjects.push(obj);
          }
        });

        // Filter out UI elements (grids, rulers, guides, handles) before saving
        const userObjects = allObjects.filter((obj: any) => {
          return !obj.isGridLine &&
                 !obj.isRuler &&
                 !obj.excludeFromExport &&
                 !obj.isControlHandle &&
                 !obj.isHandleLine &&
                 !obj.isAnchorHandle &&
                 !obj.isGuideLine &&
                 !obj.isEraserPath &&
                 !obj.isPortIndicator &&
                 !obj.isFeedback &&
                 !obj.isEndpointMarker; // Markers are derived; recreated on load
        });

        // Create recovery state with filtered objects
        const state: any = {
          version: '6.0.0',
          objects: userObjects.map((obj: any) => {
            const objData = obj.toObject(CUSTOM_PROPS);
            // Manually ensure all custom props are included
            CUSTOM_PROPS.forEach(prop => {
              if (obj[prop] !== undefined) {
                objData[prop] = obj[prop];
              }
            });

            // Convert Map to plain object for JSON serialization
            if (obj.originalColors instanceof Map) {
              objData.originalColors = Object.fromEntries(obj.originalColors);
            }

            // Helper function to recursively strip icon content from nested objects
            const stripNestedIcons = (nestedObjects: any[]) => {
              if (!nestedObjects || !Array.isArray(nestedObjects)) return;

              nestedObjects.forEach((nestedObj: any) => {
                // Check if this is a library icon (has iconId) OR looks like an icon (Group with many children)
                const hasIconId = nestedObj.iconId && nestedObj.isLibraryIcon;
                const looksLikeIcon = (nestedObj.type === 'Group' || nestedObj.type === 'group') &&
                                       nestedObj.objects &&
                                       Array.isArray(nestedObj.objects) &&
                                       nestedObj.objects.length > 10;

                if (hasIconId || looksLikeIcon) {
                  const nestedType = nestedObj.type;
                  if ((nestedObj.type === 'Group' || nestedObj.type === 'group') && nestedObj.objects) {
                    delete nestedObj.objects;
                  } else if ((nestedObj.type === 'Path' || nestedObj.type === 'path') && nestedObj.path) {
                    delete nestedObj.path;
                  } else if ((nestedObj.type === 'Image' || nestedObj.type === 'image') && nestedObj.src) {
                    delete nestedObj.src;
                  }
                  nestedObj.type = 'libraryIcon';
                  nestedObj.originalType = nestedType;
                } else if (nestedObj.objects) {
                  stripNestedIcons(nestedObj.objects);
                }
              });
            };

            // Process rasterized membranes - they store vector data for edit mode
            if (obj.isRasterizedMembrane) {
              // Rasterized membranes store vectorObjects which may contain nested icons
              if (objData.vectorObjects && objData.vectorObjects.objects) {
                stripNestedIcons(objData.vectorObjects.objects);
              }
            }

            // Process membrane groups - strip icons inside them
            if (obj.isMembraneShape && objData.objects) {
              stripNestedIcons(objData.objects);
            }

            // Icon-by-reference: Strip SVG content from library icons
            if (obj.isLibraryIcon && obj.iconId) {
              const originalType = objData.type;

              if ((objData.type === 'Group' || objData.type === 'group') && objData.objects) {
                delete objData.objects;
              } else if ((objData.type === 'Path' || objData.type === 'path') && objData.path) {
                delete objData.path;
              } else if ((objData.type === 'Image' || objData.type === 'image') && objData.src) {
                delete objData.src;
              }

              objData.type = 'libraryIcon';
              objData.originalType = originalType;
            }

            return objData;
          }),
          // Save background color but exclude grid Pattern (grid uses backgroundColor as Pattern)
        background: (typeof canvas.backgroundColor === 'string') ? canvas.backgroundColor : '',
        };

        const recovery = {
          state,
          timestamp: Date.now(),
          projectName,
          projectId: currentProjectId
        };
        localStorage.setItem('canvas_recovery', JSON.stringify(recovery));

        // Restore culled objects to their hidden state
        culledObjects.forEach((obj: any) => { obj.visible = false; });
      }
    }, 30000);

    debouncedRecover();
  }, [canvas, saveStatus, projectName, currentProjectId, isDirty, isReadOnly]);

  // Warn on page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Save initial canvas state when canvas is first created
  useEffect(() => {
    if (!canvas) return;

    // Save initial empty state so undo/redo works correctly
    // Use ref to prevent saving multiple times if component re-renders
    // Use 200ms delay - enough for canvas to initialize but before tests start creating objects
    if (historyManager.current.getHistoryLength() === 0 && !initialStateSaved.current) {
      initialStateSaved.current = true;
      const timer = setTimeout(() => {
        saveState();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [canvas, saveState]);

  // Set up icon reconstructor for history manager (undo/redo)
  useEffect(() => {
    if (!supabase) return;

    const reconstructIcons = async (canvasData: any) => {
      if (!canvasData.objects || canvasData.objects.length === 0) return;

      const { loadSVGFromString, util } = await import('fabric');

      // Cache for icon SVG content to avoid repeated DB queries
      const iconSvgCache = new Map<string, string>();

      // Helper to recursively reconstruct nested icons in membrane groups
      const reconstructNestedIcons = async (nestedObjects: any[]) => {
        if (!nestedObjects || !Array.isArray(nestedObjects)) return;

        for (const nested of nestedObjects) {
          if (nested.iconId && nested.isLibraryIcon) {
            try {
              // Check cache first
              let svgContent = iconSvgCache.get(nested.iconId);

              if (!svgContent) {
                const { data: iconData } = await supabase.from('icons').select('svg_content').eq('id', nested.iconId).single();
                if (iconData?.svg_content) {
                  svgContent = iconData.svg_content;
                  iconSvgCache.set(nested.iconId, svgContent);
                }
              }

              if (svgContent) {
                const svgResult = await loadSVGFromString(svgContent, undefined, { crossOrigin: 'anonymous' });
                const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

                const originalType = nested.originalType || nested.type || 'Group';
                if (originalType.toLowerCase() === 'group') {
                  const groupData = tempGroup.toObject();
                  nested.objects = groupData.objects;
                } else if (originalType.toLowerCase() === 'path' && tempGroup._objects && tempGroup._objects[0]) {
                  const pathData = tempGroup._objects[0].toObject();
                  nested.path = pathData.path;
                } else if (originalType.toLowerCase() === 'image') {
                  // Image icons can be returned directly as Image objects or wrapped in a Group
                  if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                    // tempGroup is directly an Image object
                    const imageData = tempGroup.toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                  } else if (tempGroup._objects && tempGroup._objects[0]) {
                    // tempGroup is a Group containing an Image
                    const imageData = tempGroup._objects[0].toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                  }
                }
              }
            } catch (error) {
              console.error(`[HISTORY] Failed to reconstruct nested icon ${nested.iconId}:`, error);
            }
          } else if (nested.objects) {
            await reconstructNestedIcons(nested.objects);
          }
        }
      };

      // Process each object
      for (const objData of canvasData.objects) {
        // Process rasterized membranes
        if (objData.isRasterizedMembrane && objData.vectorObjects && objData.vectorObjects.objects) {
          await reconstructNestedIcons(objData.vectorObjects.objects);
        }

        // Process membrane groups
        if (objData.isMembraneShape && objData.objects) {
          await reconstructNestedIcons(objData.objects);
        }

        // Process top-level library icons
        if (objData.isLibraryIcon && objData.iconId) {
          try {
            // Check cache first
            let svgContent = iconSvgCache.get(objData.iconId);

            if (!svgContent) {
              const { data: iconData } = await supabase.from('icons').select('svg_content').eq('id', objData.iconId).single();
              if (iconData?.svg_content) {
                svgContent = iconData.svg_content;
                iconSvgCache.set(objData.iconId, svgContent);
              }
            }

            if (!svgContent) continue;

            const svgResult = await loadSVGFromString(svgContent, undefined, { crossOrigin: 'anonymous' });
            const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

            const originalType = objData.originalType || objData.type || 'Group';
            if (originalType.toLowerCase() === 'group') {
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = originalType;
            } else if (originalType.toLowerCase() === 'path' && tempGroup._objects && tempGroup._objects[0]) {
              const pathData = tempGroup._objects[0].toObject();
              objData.path = pathData.path;
              objData.type = originalType;
            } else if (originalType.toLowerCase() === 'image' && tempGroup._objects && tempGroup._objects[0]) {
              const imageData = tempGroup._objects[0].toObject();
              objData.src = imageData.src;
              objData.crossOrigin = 'anonymous';
              objData.type = originalType;
            }
          } catch (error) {
            console.error(`[HISTORY] Failed to reconstruct icon ${objData.iconId}:`, error);
          }
        }
      }
    };

    historyManager.current.setIconReconstructor(reconstructIcons);
  }, [supabase]);

  const recoverCanvas = useCallback(async (recoveryData: any) => {
    if (!canvas) return;

    const recoveryState = recoveryData.state;

    // Icon-by-reference: Reconstruct icons from references before loading
    if (recoveryState.objects && recoveryState.objects.length > 0) {
      const { loadSVGFromString, util } = await import('fabric');

      // Cache for icon SVG content to avoid repeated DB queries
      const iconSvgCache = new Map<string, string>();

      const iconCount = recoveryState.objects.filter((obj: any) => obj.type === 'libraryIcon' && obj.iconId).length;
      let loadedIcons = 0;

      if (iconCount > 0) {
        setIconLoadingProgress({ current: 0, total: iconCount });
      }

      // Helper to recursively reconstruct nested icons in membrane groups
      const reconstructNestedIcons = async (nestedObjects: any[]): Promise<number> => {
        let count = 0;
        for (const nested of nestedObjects) {
          if (nested.type === 'libraryIcon' && nested.iconId) {
            try {
              // Check cache first
              let svgContent = iconSvgCache.get(nested.iconId);

              if (!svgContent) {
                const { data: iconData } = await supabase.from('icons').select('svg_content, thumbnail').eq('id', nested.iconId).single();
                if (iconData?.svg_content) {
                  svgContent = iconData.svg_content;
                  iconSvgCache.set(nested.iconId, svgContent);
                }
              }

              if (svgContent) {
                const svgResult = await loadSVGFromString(svgContent, undefined, { crossOrigin: 'anonymous' });
                const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

                // Set crossOrigin on image elements
                const setImageCrossOrigin = (obj: any) => {
                  if (obj.type === 'image' || obj.type === 'Image') obj.set({ crossOrigin: 'anonymous' });
                  if (obj._objects) obj._objects.forEach((child: any) => setImageCrossOrigin(child));
                };
                setImageCrossOrigin(tempGroup);
                const originalType = nested.originalType || 'Group';
                const normalizedType = originalType.toLowerCase();

                if (normalizedType === 'group') {
                  nested.objects = tempGroup.toObject().objects;
                  nested.type = originalType;
                } else if (normalizedType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
                  const pathData = tempGroup._objects[0].toObject();
                  nested.path = pathData.path;
                  nested.type = originalType;
                } else if (normalizedType === 'image') {
                  // Image icons can be returned directly as Image objects or wrapped in a Group
                  if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                    const imageData = tempGroup.toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                    nested.type = originalType;
                  } else if (tempGroup._objects && tempGroup._objects[0]) {
                    const imageData = tempGroup._objects[0].toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                    nested.type = originalType;
                  }
                } else {
                  nested.objects = tempGroup.toObject().objects;
                  nested.type = originalType;
                }
                count++;
              }
            } catch (error) {
              count++;
            }
          }
          if (nested.objects) {
            count += await reconstructNestedIcons(nested.objects);
          }
        }
        return count;
      };

      for (let i = 0; i < recoveryState.objects.length; i++) {
        const objData = recoveryState.objects[i];

        // Process membrane groups first
        if (objData.isMembraneShape && objData.objects) {
          const nestedCount = await reconstructNestedIcons(objData.objects);
          loadedIcons += nestedCount;
          if (iconCount > 0) {
            setIconLoadingProgress(prev => (!prev || loadedIcons > prev.current) ? { current: loadedIcons, total: iconCount } : prev);
          }
        }

        if (objData.type === 'libraryIcon' && objData.iconId) {
          try {
            // Check cache first
            let svgContent = iconSvgCache.get(objData.iconId);

            if (!svgContent) {
              const { data: iconData, error: iconError } = await supabase
                .from('icons')
                .select('svg_content')
                .eq('id', objData.iconId)
                .single();

              if (iconError || !iconData?.svg_content) {
                console.error(`Failed to load icon ${objData.iconId}:`, iconError);
                continue;
              }

              svgContent = iconData.svg_content;
              iconSvgCache.set(objData.iconId, svgContent);
            }

            const svgResult = await loadSVGFromString(svgContent);
            const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

            const originalType = objData.originalType || 'Group';
            const normalizedType = originalType.toLowerCase();

            if (normalizedType === 'group') {
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = originalType;
            } else if (normalizedType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
              const pathData = tempGroup._objects[0].toObject();
              objData.path = pathData.path;
              objData.type = originalType;
            } else if (normalizedType === 'image') {
              // Image icons can be returned directly as Image objects or wrapped in a Group
              if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                // tempGroup is directly an Image object
                const imageData = tempGroup.toObject();
                objData.src = imageData.src;
              objData.crossOrigin = 'anonymous';
                objData.type = originalType;
              } else if (tempGroup._objects && tempGroup._objects[0]) {
                // tempGroup is a Group containing an Image
                const imageData = tempGroup._objects[0].toObject();
                objData.src = imageData.src;
              objData.crossOrigin = 'anonymous';
                objData.type = originalType;
              } else {
                // Fallback
                const groupData = tempGroup.toObject();
                objData.objects = groupData.objects;
                objData.type = originalType;
              }
            } else {
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = 'Group';
            }

            loadedIcons++;
            if (iconCount > 0) {
              setIconLoadingProgress(prev => {
                // Only update if new value is greater (prevent decrements)
                if (!prev || loadedIcons > prev.current) {
                  return { current: loadedIcons, total: iconCount };
                }
                return prev;
              });
            }
          } catch (error) {
            console.error(`Error reconstructing icon ${objData.iconId}:`, error);
            loadedIcons++;
            if (iconCount > 0) {
              setIconLoadingProgress(prev => {
                // Only update if new value is greater (prevent decrements)
                if (!prev || loadedIcons > prev.current) {
                  return { current: loadedIcons, total: iconCount };
                }
                return prev;
              });
            }
          }
        }
      }

      if (iconCount > 0) {
        setIconLoadingProgress(null);
      }
    }

    canvas.loadFromJSON(recoveryState).then(async () => {
      // Clean up any grid lines or rulers that might have been saved in old data
      const strayUIElements = canvas.getObjects().filter((obj: any) =>
        obj.isGridLine || obj.isRuler
      );
      strayUIElements.forEach(obj => {
        canvas.remove(obj);
      });

      // Restore custom properties and run all post-load reconnection steps
      if (recoveryState.objects) {
        restorePropsRecursive(canvas.getObjects(), recoveryState.objects);
      }
      await runPostLoadGlobalSteps(canvas);
      for (const obj of canvas.getObjects()) {
        if (obj.type === 'group') (obj as any).dirty = true;
      }
      canvas.requestRenderAll();

      // Increment version to trigger ruler/grid re-render
      setCanvasLoadVersion(prev => prev + 1);

      toast.success('Canvas recovered successfully!');
      localStorage.removeItem('canvas_recovery');
      setSaveStatus('unsaved');
    });
  }, [canvas]);

  const checkForRecovery = useCallback(() => {
    const recovery = localStorage.getItem('canvas_recovery');
    if (recovery) {
      const data = JSON.parse(recovery);
      const ageMinutes = (Date.now() - data.timestamp) / 60000;
      if (ageMinutes < 60) {
        return {
          data,
          ageMinutes: Math.floor(ageMinutes)
        };
      } else {
        localStorage.removeItem('canvas_recovery');
      }
    }
    return null;
  }, []);

  const loadTemplate = useCallback(async (template: any) => {
    if (!canvas) return;

    try {
      toast("Loading template...");
      await loadAllFonts();

      canvas.clear();
      setLoadedProjectId(null); // Clear loaded project when loading template
      const templateData = template.canvasData;

      // Icon-by-reference: Reconstruct icons from references before loading
      if (templateData.objects && templateData.objects.length > 0) {
        const { loadSVGFromString, util } = await import('fabric');

        // Cache for icon SVG content to avoid repeated DB queries
        const iconSvgCache = new Map<string, string>();

        const iconCount = templateData.objects.filter((obj: any) => obj.type === 'libraryIcon' && obj.iconId).length;
        let loadedIcons = 0;

        if (iconCount > 0) {
          setIconLoadingProgress({ current: 0, total: iconCount });
        }

        // Helper to recursively reconstruct nested icons in membrane groups
        const reconstructNestedIcons = async (nestedObjects: any[]): Promise<number> => {
          let count = 0;
          for (const nested of nestedObjects) {
            if (nested.type === 'libraryIcon' && nested.iconId) {
              try {
                // Check cache first
                let svgContent = iconSvgCache.get(nested.iconId);

                if (!svgContent) {
                  const { data: iconData } = await supabase.from('icons').select('svg_content, thumbnail').eq('id', nested.iconId).single();
                  if (iconData?.svg_content) {
                    svgContent = iconData.svg_content;
                    iconSvgCache.set(nested.iconId, svgContent);
                  }
                }

                if (svgContent) {
                  const svgResult = await loadSVGFromString(svgContent, undefined, { crossOrigin: 'anonymous' });
                  const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

                  // Set crossOrigin on image elements
                  const setImageCrossOrigin = (obj: any) => {
                    if (obj.type === 'image' || obj.type === 'Image') obj.set({ crossOrigin: 'anonymous' });
                    if (obj._objects) obj._objects.forEach((child: any) => setImageCrossOrigin(child));
                  };
                  setImageCrossOrigin(tempGroup);
                  const originalType = nested.originalType || 'group';

                  if (originalType === 'group') {
                    nested.objects = tempGroup.toObject().objects;
                    nested.type = 'group';
                  } else if (originalType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
                    const pathData = tempGroup._objects[0].toObject();
                    nested.path = pathData.path;
                    nested.type = 'path';
                  } else if (originalType === 'image') {
                    // Image icons can be returned directly as Image objects or wrapped in a Group
                    if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                      const imageData = tempGroup.toObject();
                      nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                      nested.type = 'image';
                    } else if (tempGroup._objects && tempGroup._objects[0]) {
                      const imageData = tempGroup._objects[0].toObject();
                      nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                      nested.type = 'image';
                    }
                  } else {
                    nested.objects = tempGroup.toObject().objects;
                    nested.type = 'group';
                  }
                  count++;
                }
              } catch (error) {
                count++;
              }
            }
            if (nested.objects) {
              count += await reconstructNestedIcons(nested.objects);
            }
          }
          return count;
        };

        for (let i = 0; i < templateData.objects.length; i++) {
          const objData = templateData.objects[i];

          // Process membrane groups first
          if (objData.isMembraneShape && objData.objects) {
            const nestedCount = await reconstructNestedIcons(objData.objects);
            loadedIcons += nestedCount;
            if (iconCount > 0) {
              setIconLoadingProgress(prev => (!prev || loadedIcons > prev.current) ? { current: loadedIcons, total: iconCount } : prev);
            }
          }

          if (objData.type === 'libraryIcon' && objData.iconId) {
            try {
              // Check cache first
              let svgContent = iconSvgCache.get(objData.iconId);

              if (!svgContent) {
                const { data: iconData, error: iconError } = await supabase
                  .from('icons')
                  .select('svg_content')
                  .eq('id', objData.iconId)
                  .single();

                if (iconError || !iconData?.svg_content) {
                  console.error(`Failed to load icon ${objData.iconId}:`, iconError);
                  continue;
                }

                svgContent = iconData.svg_content;
                iconSvgCache.set(objData.iconId, svgContent);
              }

              const svgResult = await loadSVGFromString(svgContent);
              const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

              const originalType = objData.originalType || 'group';
              if (originalType === 'group') {
                const groupData = tempGroup.toObject();
                objData.objects = groupData.objects;
                objData.type = 'group';
              } else if (originalType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
                const pathData = tempGroup._objects[0].toObject();
                objData.path = pathData.path;
                objData.type = 'path';
              } else if (originalType === 'image') {
                // Image icons can be returned directly as Image objects or wrapped in a Group
                if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                  // tempGroup is directly an Image object
                  const imageData = tempGroup.toObject();
                  objData.src = imageData.src;
              objData.crossOrigin = 'anonymous';
                  objData.type = 'image';
                } else if (tempGroup._objects && tempGroup._objects[0]) {
                  // tempGroup is a Group containing an Image
                  const imageData = tempGroup._objects[0].toObject();
                  objData.src = imageData.src;
              objData.crossOrigin = 'anonymous';
                  objData.type = 'image';
                } else {
                  // Fallback
                  const groupData = tempGroup.toObject();
                  objData.objects = groupData.objects;
                  objData.type = 'group';
                }
              } else {
                const groupData = tempGroup.toObject();
                objData.objects = groupData.objects;
                objData.type = 'group';
              }

              loadedIcons++;
              if (iconCount > 0) {
                setIconLoadingProgress(prev => {
                  // Only update if new value is greater (prevent decrements)
                  if (!prev || loadedIcons > prev.current) {
                    return { current: loadedIcons, total: iconCount };
                  }
                  return prev;
                });
              }
            } catch (error) {
              console.error(`Error reconstructing icon ${objData.iconId}:`, error);
              loadedIcons++;
              if (iconCount > 0) {
                setIconLoadingProgress(prev => {
                  // Only update if new value is greater (prevent decrements)
                  if (!prev || loadedIcons > prev.current) {
                    return { current: loadedIcons, total: iconCount };
                  }
                  return prev;
                });
              }
            }
          }
        }

        if (iconCount > 0) {
          setIconLoadingProgress(null);
        }
      }

      await canvas.loadFromJSON(templateData);

      // Restore custom properties and run all post-load reconnection steps
      if (templateData.objects) {
        restorePropsRecursive(canvas.getObjects(), templateData.objects);
      }
      await runPostLoadGlobalSteps(canvas);
      for (const obj of canvas.getObjects()) {
        if (obj.type === 'group') (obj as any).dirty = true;
      }
      canvas.requestRenderAll();

      setProjectName(`Untitled from ${template.name}`);
      setCurrentProjectId(null);
      setPaperSize(template.paperSize);
      setCanvasDimensions(template.dimensions);
      canvas.setDimensions(template.dimensions);

      // Increment version to trigger ruler/grid re-render
      setCanvasLoadVersion(prev => prev + 1);

      historyManager.current.clear();
      saveState();
      setSaveStatus('unsaved');
      
      toast.success(`Template "${template.name}" loaded!`);
    } catch (error: any) {
      console.error('Template load error:', error);
      toast.error("Failed to load template");
    }
  }, [canvas, saveState]);

  const importProjectToCanvas = useCallback(async (projectId: string, mode: 'replace' | 'overlay') => {
    const activeCanvas = canvasRef.current;
    if (!activeCanvas || activeCanvas.destroyed || activeCanvas.disposed) return;

    // For replace mode, confirm if canvas has objects
    if (mode === 'replace' && activeCanvas.getObjects().filter((o: any) => !o.isGridLine && !o.isRuler).length > 0) {
      // Confirmation is handled by the UI layer before calling this
    }

    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);

    try {
      toast("Importing template...");
      await loadAllFonts();

      // Fetch the source project's canvas data
      const { data: projectData, error: fetchError } = await supabase
        .from('canvas_projects')
        .select('canvas_data, canvas_width, canvas_height, paper_size, name')
        .eq('id', projectId)
        .single();

      if (fetchError || !projectData) {
        toast.error("Failed to fetch template data");
        return;
      }

      const canvasData = projectData.canvas_data as Record<string, any>;
      if (!canvasData?.objects || canvasData.objects.length === 0) {
        toast.error("Template has no objects");
        return;
      }

      // Reconstruct icons and assets by reference — batch DB lookups
      const { loadSVGFromString: loadSVG, util: fabricUtil } = await import('fabric');
      const iconSvgCache = new Map<string, string>();
      const assetMetaCache = new Map<string, { storage_path: string; mime_type: string }>();
      const assetContentCache = new Map<string, { content: string; mimeType: string }>();

      // Collect all unique icon IDs and asset IDs upfront (including nested in membranes)
      const uniqueIconIds = new Set<string>();
      const uniqueAssetIds = new Set<string>();
      const collectIds = (objects: any[]) => {
        for (const obj of objects) {
          if (obj.type === 'libraryIcon' && obj.iconId) uniqueIconIds.add(obj.iconId);
          if (obj.type === 'userAsset' && obj.assetId) uniqueAssetIds.add(obj.assetId);
          if (obj.objects) collectIds(obj.objects);
        }
      };
      collectIds(canvasData.objects);

      // Batch fetch all icon SVGs in one query
      if (uniqueIconIds.size > 0) {
        const { data: iconRows } = await supabase
          .from('icons')
          .select('id, svg_content')
          .in('id', [...uniqueIconIds]);
        if (iconRows) {
          for (const row of iconRows) {
            if (row.svg_content) iconSvgCache.set(row.id, row.svg_content);
          }
        }
      }

      // Batch fetch all asset metadata in one query
      if (uniqueAssetIds.size > 0) {
        const { data: assetRows } = await supabase
          .from('user_assets')
          .select('id, storage_path, mime_type')
          .in('id', [...uniqueAssetIds]);
        if (assetRows) {
          for (const row of assetRows) {
            assetMetaCache.set(row.id, { storage_path: row.storage_path, mime_type: row.mime_type });
          }
        }
      }

      const reconstructIcon = async (iconObj: any) => {
        const svgContent = iconSvgCache.get(iconObj.iconId);
        if (!svgContent) return false;

        const svgResult = await loadSVG(svgContent, undefined, { crossOrigin: 'anonymous' });
        const tempGroup = fabricUtil.groupSVGElements(svgResult.objects, svgResult.options);

        const setImageCrossOrigin = (obj: any) => {
          if (obj.type === 'image' || obj.type === 'Image') obj.set({ crossOrigin: 'anonymous' });
          if (obj._objects) obj._objects.forEach((child: any) => setImageCrossOrigin(child));
        };
        setImageCrossOrigin(tempGroup);

        const originalType = (iconObj.originalType || 'group').toLowerCase();
        if (originalType === 'group') {
          iconObj.objects = tempGroup.toObject().objects;
          iconObj.type = iconObj.originalType || 'Group';
        } else if (originalType === 'path' && tempGroup._objects?.[0]) {
          iconObj.path = tempGroup._objects[0].toObject().path;
          iconObj.type = iconObj.originalType || 'Path';
        } else if (originalType === 'image') {
          if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
            iconObj.src = tempGroup.toObject().src;
          } else if (tempGroup._objects?.[0]) {
            iconObj.src = tempGroup._objects[0].toObject().src;
          }
          iconObj.crossOrigin = 'anonymous';
          iconObj.type = iconObj.originalType || 'Image';
        } else {
          iconObj.objects = tempGroup.toObject().objects;
          iconObj.type = 'Group';
        }
        return true;
      };

      const reconstructUserAsset = async (assetObj: any): Promise<boolean> => {
        let cached = assetContentCache.get(assetObj.assetId);
        if (!cached) {
          const meta = assetMetaCache.get(assetObj.assetId);
          if (!meta) return false;

          const { data: fileData } = await supabase.storage
            .from('user-assets')
            .download(meta.storage_path);
          if (!fileData) return false;

          let content: string;
          if (meta.mime_type === 'image/svg+xml') {
            content = await fileData.text();
          } else {
            content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to read asset'));
              reader.readAsDataURL(fileData);
            });
          }
          cached = { content, mimeType: meta.mime_type };
          assetContentCache.set(assetObj.assetId, cached);
        }

        if (cached.mimeType === 'image/svg+xml') {
          const svgResult = await loadSVG(cached.content, undefined, { crossOrigin: 'anonymous' });
          const tempGroup = fabricUtil.groupSVGElements(svgResult.objects, svgResult.options);
          assetObj.objects = tempGroup.toObject().objects;
          assetObj.type = assetObj.originalType || 'Group';
        } else {
          assetObj.src = cached.content;
          assetObj.crossOrigin = 'anonymous';
          assetObj.type = assetObj.originalType || 'Image';
        }
        return true;
      };

      const reconstructNestedIcons = async (nestedObjects: any[]) => {
        for (const nested of nestedObjects) {
          if (nested.type === 'libraryIcon' && nested.iconId) {
            try { await reconstructIcon(nested); } catch (e) { /* skip */ }
          }
          if (nested.objects) await reconstructNestedIcons(nested.objects);
        }
      };

      // Count and show progress
      const totalRefs = uniqueIconIds.size + uniqueAssetIds.size;
      if (totalRefs > 0) setIconLoadingProgress({ current: 0, total: totalRefs });
      let loaded = 0;

      for (const objData of canvasData.objects) {
        if (objData.isMembraneShape && objData.objects) {
          await reconstructNestedIcons(objData.objects);
        }
        if (objData.type === 'libraryIcon' && objData.iconId) {
          try { await reconstructIcon(objData); } catch (e) { /* skip */ }
          loaded++;
          if (totalRefs > 0) setIconLoadingProgress({ current: loaded, total: totalRefs });
        }
        if (objData.type === 'userAsset' && objData.assetId) {
          const ok = await reconstructUserAsset(objData);
          if (ok) {
            delete objData._fallbackSrc;
          }
          if (!ok) {
            if (objData._fallbackSrc) {
              objData.src = objData._fallbackSrc;
              objData.crossOrigin = 'anonymous';
              objData.type = objData.originalType || 'Image';
              delete objData._fallbackSrc;
            } else {
              objData.type = 'Rect';
              objData.fill = '#f0f0f0';
              objData.stroke = '#cc0000';
              objData.strokeWidth = 2;
              objData.width = objData.width || 200;
              objData.height = objData.height || 200;
            }
          }
          loaded++;
          if (totalRefs > 0) setIconLoadingProgress({ current: loaded, total: totalRefs });
        }
      }
      if (totalRefs > 0) setIconLoadingProgress(null);

      if (mode === 'replace') {
        // Clear canvas and load the full project data
        activeCanvas.clear();
        await activeCanvas.loadFromJSON(canvasData);

        // Clean up stray UI elements
        activeCanvas.getObjects().filter((obj: any) => obj.isGridLine || obj.isRuler)
          .forEach((obj: any) => activeCanvas.remove(obj));

        // Restore custom properties
        if (canvasData.objects) {
          restorePropsRecursive(activeCanvas.getObjects(), canvasData.objects);
        }
        await runPostLoadGlobalSteps(activeCanvas);
        for (const obj of activeCanvas.getObjects()) {
          if (obj.type === 'group') (obj as any).dirty = true;
        }
        activeCanvas.requestRenderAll();

        // Update dimensions to match source
        setCanvasDimensions({
          width: projectData.canvas_width,
          height: projectData.canvas_height
        });
        setPaperSize(projectData.paper_size || 'letter');
        setCanvasLoadVersion(prev => prev + 1);

        historyManager.current.clear();
        saveState(true);
        toast.success("Template loaded — canvas replaced");
      } else {
        // Overlay mode: use a DOM-mounted temp canvas so loadFromJSON works correctly
        const { Canvas: TempCanvas } = await import('fabric');

        const tempCanvasEl = document.createElement('canvas');
        tempCanvasEl.style.display = 'none';
        document.body.appendChild(tempCanvasEl);

        const tempCanvas = new TempCanvas(tempCanvasEl, {
          width: projectData.canvas_width,
          height: projectData.canvas_height,
        });

        try {
          await tempCanvas.loadFromJSON(canvasData);

          // Restore custom props on temp objects
          if (canvasData.objects) {
            restorePropsRecursive(tempCanvas.getObjects(), canvasData.objects);
          }

          // Run post-load steps (rasterizes membranes, reconnects lines, etc.)
          await runPostLoadGlobalSteps(tempCanvas);

          // Move each object to the active canvas with a slight offset
          const objectsToMove = [...tempCanvas.getObjects()];
          for (const obj of objectsToMove) {
            tempCanvas.remove(obj);
            obj.set({
              left: (obj.left || 0) + 20,
              top: (obj.top || 0) + 20,
            });
            activeCanvas.add(obj);
          }

          activeCanvas.requestRenderAll();
          saveState();
          toast.success(`Added ${objectsToMove.length} objects to canvas`);
        } finally {
          tempCanvas.dispose();
          tempCanvasEl.remove();
        }
      }

      // Increment cloned_count on the source project
      supabase
        .from('canvas_projects')
        .update({ cloned_count: undefined }) // Use rpc instead
        .eq('id', projectId);
      // Use raw SQL increment via rpc if available, otherwise skip
      try {
        await supabase.rpc('increment_cloned_count', { project_id: projectId });
      } catch {
        // Non-critical — silently skip if rpc doesn't exist
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import template");
    } finally {
      setTimeout(() => {
        isLoadingProjectRef.current = false;
        setIsLoadingProject(false);
      }, 500);
    }
  }, [saveState]);

  // Clone a single object. Rasterized membranes / helixes have custom
  // toObject() that strips the image src (to save space in serialization).
  // clone() goes through toObject→fromObject, so the cloned image would be
  // empty. For these objects we re-create a FabricImage from the current
  // canvas element and copy metadata manually.
  const cloneObject = useCallback(async (obj: FabricObject): Promise<FabricObject> => {
    const o = obj as any;
    const isRasterized = o.isRasterizedMembrane || o.isRasterizedHelix;
    if (!isRasterized) {
      const cloned = await obj.clone();
      cloned.setCoords();
      // Preserve ALL custom properties that Fabric.js clone() doesn't copy.
      // This covers line endpoints, icon metadata, membrane data, etc.
      for (const prop of CANVAS_CUSTOM_PROPS) {
        if (o[prop] !== undefined && (cloned as any)[prop] === undefined) {
          // Deep-copy plain objects/arrays so clone doesn't share references
          const val = o[prop];
          if (val instanceof Map) {
            (cloned as any)[prop] = new Map(val);
          } else if (Array.isArray(val)) {
            (cloned as any)[prop] = JSON.parse(JSON.stringify(val));
          } else if (val !== null && typeof val === 'object' && !(val instanceof Element)) {
            (cloned as any)[prop] = JSON.parse(JSON.stringify(val));
          } else {
            (cloned as any)[prop] = val;
          }
        }
      }
      // Don't carry over marker object references — these will be recreated
      (cloned as any).startMarker = null;
      (cloned as any).endMarker = null;

      // Restore interactive group properties that clone() may drop.
      // Preserve the ORIGINAL's interactive value — forcing interactive
      // true on every group breaks leader lines and brackets, whose
      // children (arrow, label, path) end up draggable independently of
      // the group on the clone, distorting the duplicated shape. Only
      // groups that opted in to interactive (colored text-boxes etc.)
      // should keep it.
      if (cloned.type === 'group' && o.subTargetCheck) {
        (cloned as any).set({
          subTargetCheck: true,
          interactive: o.interactive === true,
          objectCaching: false,
        });
        // Only re-enable child textbox editing on groups that were
        // already interactive (the colored text-box pattern). Doing
        // this on every group is what made bracket/leader children
        // selectable and draggable in isolation.
        if (o.interactive === true) {
          ((cloned as any)._objects || []).forEach((child: any) => {
            if (child.type === 'textbox' || child.type === 'i-text') {
              child.set({ selectable: true, evented: true, hoverCursor: 'text' });
            }
          });
        }
      }

      return cloned;
    }

    // Get the current rendered image from the FabricImage's element
    const srcEl = (obj as any).getElement?.();
    let dataUrl: string;
    if (srcEl instanceof HTMLCanvasElement) {
      dataUrl = srcEl.toDataURL('image/png');
    } else if (srcEl instanceof HTMLImageElement) {
      dataUrl = srcEl.src;
    } else {
      // Fallback: render object to data URL directly, bypassing custom toObject
      const origToObject = o.toObject;
      delete o.toObject; // temporarily remove override so default includes src
      dataUrl = obj.toDataURL({ format: 'png', multiplier: 2 });
      o.toObject = origToObject;
    }

    const newImg = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
    newImg.set({
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      originX: obj.originX,
      originY: obj.originY,
      flipX: obj.flipX,
      flipY: obj.flipY,
      selectable: true,
      evented: true,
    });

    // Copy all custom metadata properties
    const metaKeys = [
      'isMembraneShape', 'membraneOptions', 'bezierPoints', 'worldBezierPoints',
      'isClosed', 'id', 'originalScaleX', 'originalScaleY', 'isRasterizedMembrane',
      'isTripleMembrane', 'tripleMembraneOptions',
      'isDNAHelix', 'dnaHelixOptions', 'isRasterizedHelix',
      'name', 'data',
    ];
    for (const key of metaKeys) {
      if (o[key] !== undefined) {
        // Deep-copy objects/arrays to avoid shared references
        (newImg as any)[key] = typeof o[key] === 'object' && o[key] !== null
          ? JSON.parse(JSON.stringify(o[key]))
          : o[key];
      }
    }
    // Give the clone a fresh id
    (newImg as any).id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    // Re-apply the custom toObject override that strips src
    if (o.isRasterizedMembrane) {
      const origToObj = newImg.toObject.bind(newImg);
      (newImg as any).toObject = function (props?: string[]) {
        const isTriple = (this as any).isTripleMembrane;
        const result = origToObj([
          ...(props || []),
          ...(isTriple
            ? ['isTripleMembrane', 'tripleMembraneOptions', 'bezierPoints',
               'worldBezierPoints', 'isClosed', 'id',
               'originalScaleX', 'originalScaleY', 'isRasterizedMembrane']
            : ['isMembraneShape', 'membraneOptions', 'bezierPoints',
               'worldBezierPoints', 'isClosed', 'id',
               'originalScaleX', 'originalScaleY', 'isRasterizedMembrane']),
        ]);
        delete result.src;
        return result;
      };
    } else if (o.isRasterizedHelix) {
      const origToObj = newImg.toObject.bind(newImg);
      (newImg as any).toObject = function (props?: string[]) {
        const result = origToObj([
          ...(props || []),
          'isDNAHelix', 'dnaHelixOptions', 'bezierPoints',
          'worldBezierPoints', 'isClosed', 'id',
          'originalScaleX', 'originalScaleY', 'isRasterizedHelix',
        ]);
        delete result.src;
        return result;
      };
    }

    return newImg;
  }, []);

  const duplicateSelected = useCallback(async () => {
    if (!canvas || !selectedObject) return;

    if (selectedObject.type === 'activeSelection') {
      const activeSelection = selectedObject as ActiveSelection;
      const objects = activeSelection.getObjects();

      // Capture world transforms while objects are still in the selection.
      // ActiveSelection children have local coords; calcTransformMatrix()
      // walks up the parent chain to give correct world-space matrices.
      const worldTransforms = objects.map(obj => obj.calcTransformMatrix());

      const clones: FabricObject[] = [];

      for (let i = 0; i < objects.length; i++) {
        const cloned = await cloneObject(objects[i]);
        // Apply the saved world transform so the clone appears at the
        // correct position, not at the local-to-selection coords.
        util.applyTransformToObject(cloned, worldTransforms[i]);
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
        });
        canvas.add(cloned);
        // Recreate endpoint markers for duplicated lines
        if ((cloned as any).startMarkerType || (cloned as any).endMarkerType) {
          const c = cloned as any;
          // Assign a new unique id so removeEndpointMarkers doesn't strip the original's markers
          c.id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          c.startMarker = null;
          c.endMarker = null;
          // Shift stored world coordinates to match the clone's offset position
          if (c.straightLineStart) c.straightLineStart = { x: c.straightLineStart.x + 20, y: c.straightLineStart.y + 20 };
          if (c.straightLineEnd) c.straightLineEnd = { x: c.straightLineEnd.x + 20, y: c.straightLineEnd.y + 20 };
          if (c.curvedLineStart) c.curvedLineStart = { x: c.curvedLineStart.x + 20, y: c.curvedLineStart.y + 20 };
          if (c.curvedLineEnd) c.curvedLineEnd = { x: c.curvedLineEnd.x + 20, y: c.curvedLineEnd.y + 20 };
          cloned.setCoords();
          const { applyEndpointMarkers } = await import('@/lib/lineEndpointRenderer');
          applyEndpointMarkers(canvas, cloned, c.startMarkerType || 'none', c.endMarkerType || 'none');
        }
        clones.push(cloned);
      }

      if (clones.length > 0) {
        const selection = new ActiveSelection(clones, { canvas });
        canvas.setActiveObject(selection);
        canvas.requestRenderAll();
        flashCanvas('success');
        toast.success('Duplicated selection');
        saveState();
      }
    } else {
      const cloned = await cloneObject(selectedObject);
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      canvas.add(cloned);
      // Recreate endpoint markers for duplicated lines
      const c = cloned as any;
      if (c.startMarkerType || c.endMarkerType) {
        // Assign a new unique id so removeEndpointMarkers doesn't strip the original's markers
        c.id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        // Clear stale marker references from the original
        c.startMarker = null;
        c.endMarker = null;
        // Shift stored world coordinates to match the clone's offset position
        if (c.straightLineStart) c.straightLineStart = { x: c.straightLineStart.x + 20, y: c.straightLineStart.y + 20 };
        if (c.straightLineEnd) c.straightLineEnd = { x: c.straightLineEnd.x + 20, y: c.straightLineEnd.y + 20 };
        if (c.curvedLineStart) c.curvedLineStart = { x: c.curvedLineStart.x + 20, y: c.curvedLineStart.y + 20 };
        if (c.curvedLineEnd) c.curvedLineEnd = { x: c.curvedLineEnd.x + 20, y: c.curvedLineEnd.y + 20 };
        cloned.setCoords();
        const { applyEndpointMarkers } = await import('@/lib/lineEndpointRenderer');
        applyEndpointMarkers(canvas, cloned, c.startMarkerType || 'none', c.endMarkerType || 'none');
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      flashCanvas('success');
      toast.success('Duplicated object');
      saveState();
    }
  }, [canvas, selectedObject, saveState, flashCanvas, cloneObject]);

  const pasteInPlace = useCallback(() => {
    paste();
  }, [paste]);

  const deselectAll = useCallback(() => {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [canvas]);

  const toggleLockSelected = useCallback(() => {
    if (!canvas || !selectedObject) return;

    const currentLocked = (selectedObject as any).pinned || false;
    selectedObject.set({
      pinned: !currentLocked,
      selectable: currentLocked,
      evented: currentLocked,
    } as any);
    canvas.requestRenderAll();
    toast.success(currentLocked ? 'Unlocked object' : 'Locked object');
    saveState();
  }, [canvas, selectedObject, saveState]);

  const hideSelected = useCallback(() => {
    if (!canvas || !selectedObject) return;

    selectedObject.set({ visible: false });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    toast.success('Object hidden (Cmd+H to show all)');
    saveState();
  }, [canvas, selectedObject, saveState]);

  const showAllHidden = useCallback(() => {
    if (!canvas) return;

    let count = 0;
    canvas.getObjects().forEach((obj: FabricObject) => {
      if (!obj.visible) {
        obj.set({ visible: true });
        count++;
      }
    });
    canvas.requestRenderAll();
    if (count > 0) {
      toast.success(`Showed ${count} hidden object${count > 1 ? 's' : ''}`);
      saveState();
    }
  }, [canvas, saveState]);

  const rotateSelected = useCallback((degrees: number) => {
    if (!canvas || !selectedObject) return;

    const currentAngle = selectedObject.angle || 0;
    selectedObject.rotate(currentAngle + degrees);
    canvas.requestRenderAll();
    saveState();
  }, [canvas, selectedObject, saveState]);

  const duplicateBelow = useCallback(async () => {
    if (!canvas || !selectedObject) return;

    const cloned = await selectedObject.clone();
    const height = selectedObject.getScaledHeight();
    cloned.set({
      left: selectedObject.left,
      top: (selectedObject.top || 0) + height + 20,
    });
    // Preserve custom properties that clone() doesn't copy
    const so = selectedObject as any;
    if (so.isUserGroup) (cloned as any).isUserGroup = true;
    if (so.iconId) (cloned as any).iconId = so.iconId;
    if (so.isLibraryIcon) (cloned as any).isLibraryIcon = true;
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    toast.success('Duplicated below');
    saveState();
  }, [canvas, selectedObject, saveState]);

  // Helper to detect if object is a shape-with-text group
  const isShapeWithTextGroup = (obj: any): boolean => {
    if (obj.type !== 'group') return false;
    const objects = obj.getObjects();
    return (objects.length === 2 &&
           (objects[0].type === 'circle' || objects[0].type === 'rect') &&
           objects[1].type === 'textbox') ||
           (objects.length === 3 &&
           objects[0].type === 'rect' &&
           objects[1].type === 'textbox' &&
           objects[2].type === 'textbox');
  };

  // Helper to get the shape from a group
  const getShapeFromGroup = (obj: any) => {
    if (isShapeWithTextGroup(obj)) {
      return obj.getObjects()[0]; // First object is the shape
    }
    return obj; // Return the object itself if not a group
  };

  // Gradient operations
  const applyGradient = useCallback((config: GradientConfig, target: 'fill' | 'stroke') => {
    if (!selectedObject || !canvas) return;
    
    const targetObj = getShapeFromGroup(selectedObject);
    let gradient;
    
    if (config.type === 'linear') {
      const angleRad = (config.angle * Math.PI) / 180;
      const coords = {
        x1: Math.cos(angleRad) * -50,
        y1: Math.sin(angleRad) * -50,
        x2: Math.cos(angleRad) * 50,
        y2: Math.sin(angleRad) * 50,
      };
      gradient = new Gradient({
        type: 'linear',
        coords: coords,
        colorStops: config.stops.map(stop => ({
          offset: stop.offset,
          color: stop.color,
          opacity: stop.opacity || 1
        }))
      });
    } else {
      gradient = new Gradient({
        type: 'radial',
        coords: {
          x1: config.centerX * 100,
          y1: config.centerY * 100,
          x2: config.centerX * 100,
          y2: config.centerY * 100,
          r1: 0,
          r2: config.radius
        },
        colorStops: config.stops.map(stop => ({
          offset: stop.offset,
          color: stop.color,
          opacity: stop.opacity || 1
        }))
      });
    }
    
    targetObj.set(target, gradient);
    canvas.requestRenderAll();
    saveState();
    toast.success(`Gradient applied to ${target}`);
  }, [selectedObject, canvas, saveState]);

  const clearGradient = useCallback((target: 'fill' | 'stroke') => {
    if (!selectedObject || !canvas) return;
    
    const targetObj = getShapeFromGroup(selectedObject);
    targetObj.set(target, '');
    canvas.requestRenderAll();
    saveState();
    toast.success(`Gradient cleared from ${target}`);
  }, [selectedObject, canvas, saveState]);

  // Shadow operations
  const applyShadow = useCallback((config: ShadowConfig) => {
    if (!selectedObject || !canvas) return;
    
    if (config.enabled) {
      const shadow = new Shadow({
        color: config.color,
        blur: config.blur,
        offsetX: config.offsetX,
        offsetY: config.offsetY,
      });
      // Manually set opacity by manipulating the color with alpha
      const hexOpacity = Math.round(config.opacity * 255).toString(16).padStart(2, '0');
      shadow.color = config.color + hexOpacity;
      
      selectedObject.set('shadow', shadow);
      toast.success('Shadow applied');
    } else {
      selectedObject.set('shadow', null);
      toast.success('Shadow removed');
    }

    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: selectedObject });
    saveState();
  }, [selectedObject, canvas, saveState]);

  const clearEffects = useCallback(() => {
    if (!selectedObject || !canvas) return;

    selectedObject.set('shadow', null);
    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: selectedObject });
    saveState();
    toast.success('All effects cleared');
  }, [selectedObject, canvas, saveState]);

  // Image filter operations
  const applyImageFilters = useCallback((config: ImageFilterConfig) => {
    if (!selectedObject || !canvas) return;

    // Only apply to images
    if (selectedObject.type !== 'image' && !(selectedObject instanceof FabricImage)) {
      toast.error('Please select an image first');
      return;
    }

    const imageObj = selectedObject as FabricImage;

    // Store filter config on the image object for persistence
    (imageObj as any).imageFilters = config;

    // Apply filters using the utility function
    applyImageFiltersUtil(imageObj, config);

    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: imageObj });
    saveState();
    toast.success('Filters applied');
  }, [selectedObject, canvas, saveState]);

  const getImageFilters = useCallback((): ImageFilterConfig | null => {
    if (!selectedObject || (selectedObject.type !== 'image' && !(selectedObject instanceof FabricImage))) {
      return null;
    }

    const imageObj = selectedObject as any;
    return imageObj.imageFilters || DEFAULT_IMAGE_FILTER_CONFIG;
  }, [selectedObject]);

  const clearImageFilters = useCallback(() => {
    if (!selectedObject || !canvas) return;

    if (selectedObject.type !== 'image' && !(selectedObject instanceof FabricImage)) {
      return;
    }

    const imageObj = selectedObject as FabricImage;

    // Clear filter config
    (imageObj as any).imageFilters = DEFAULT_IMAGE_FILTER_CONFIG;

    // Preserve tone filter if it exists, remove others
    const existingFilters = imageObj.filters || [];
    const toneFilter = existingFilters.find((f: any) => f.type === 'BlendColor');

    imageObj.filters = toneFilter ? [toneFilter] : [];
    imageObj.applyFilters();

    canvas.requestRenderAll();
    saveState();
    toast.success('Filters cleared');
  }, [selectedObject, canvas, saveState]);

  // Background removal
  const removeImageBackground = useCallback(async () => {
    if (!canvas || !selectedObject || selectedObject.type !== 'image') {
      toast.error('Please select an image first');
      return;
    }

    const toastId = toast.loading('Loading AI model... This may take up to 30 seconds on first use.');
    
    try {
      const imageObj = selectedObject as FabricImage;
      const imageElement = imageObj.getElement() as HTMLImageElement;
      
      // Update toast to show processing
      toast.loading('Processing image...', { id: toastId });
      
      // Remove background using existing library
      const resultBlob = await removeBackground(imageElement);
      
      // Convert blob to data URL
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(resultBlob);
      });
      
      // Create new image with transparent background
      const newImg = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      
      // Preserve all properties from original
      newImg.set({
        left: imageObj.left,
        top: imageObj.top,
        scaleX: imageObj.scaleX,
        scaleY: imageObj.scaleY,
        angle: imageObj.angle,
        opacity: imageObj.opacity,
        flipX: imageObj.flipX,
        flipY: imageObj.flipY,
        originX: imageObj.originX,
        originY: imageObj.originY,
        lockMovementX: imageObj.lockMovementX,
        lockMovementY: imageObj.lockMovementY,
        selectable: imageObj.selectable,
      });
      
      // Replace old image with new one at same z-index
      const objects = canvas.getObjects();
      const index = objects.indexOf(imageObj);
      canvas.remove(imageObj);
      if (index >= 0) {
        canvas.insertAt(index, newImg);
      } else {
        canvas.add(newImg);
      }
      canvas.setActiveObject(newImg);
      
      canvas.requestRenderAll();
      saveState();
      toast.dismiss(toastId);
      toast.success('Background removed successfully! ✨');
    } catch (error: any) {
      console.error('Background removal failed:', error);
      toast.dismiss(toastId);
      const errorMsg = error?.message || 'Failed to remove background';
      toast.error(errorMsg, { duration: 5000 });
    }
  }, [selectedObject, canvas, saveState]);

  // Line gradient operations
  const applyLineGradient = useCallback((config: LineGradientConfig) => {
    if (!selectedObject || !canvas) return;
    
    const isConnectorGroup =
      selectedObject.type === 'group' && (selectedObject as any).connectorData;

    // Check if it's a line/connector/curved line
    const isLine =
      isConnectorGroup ||
      (selectedObject as any).isConnector ||
      (selectedObject as any).isCurvedLine ||
      (selectedObject as any).isOrthogonalLine ||
      (selectedObject as any).isStraightLine ||
      (selectedObject as any).isBezierPath ||
      (selectedObject as any).isFreeformLine ||
      selectedObject.type === 'path' ||
      selectedObject.type === 'line';
    
    if (!isLine) {
      toast.error('Please select a line or connector');
      return;
    }

    // Get the target object (path inside group or the object itself)
    let targetObj: any = selectedObject;
    if (selectedObject.type === 'group') {
      const group = selectedObject as Group;
      // For curved lines, use mainPath property
      if ((selectedObject as any).mainPath) {
        targetObj = (selectedObject as any).mainPath;
      } else {
        // For orthogonal/straight lines and connectors, find the path or line
        targetObj =
          group._objects?.find(obj => obj.type === 'path' || obj.type === 'line') ||
          group._objects?.[0];
      }
    }

    if (!targetObj) {
      toast.error('Invalid line object');
      return;
    }

    // Store gradient config for persistence.
    // Rendering happens in FabricCanvas after:render — the original line is not modified.
    (selectedObject as any).gradientConfig = config;
    (targetObj as any).gradientConfig = config;

    // Hide original stroke so it doesn't show beneath the gradient overlay.
    // Only save the original stroke the first time. For re-applies or after path regeneration,
    // use the previously saved stroke from the parent group (selectedObject).
    if (!(targetObj as any).gradientOriginalStroke) {
      const savedOnParent = (selectedObject as any).gradientOriginalStroke as string | undefined;
      const currentStroke = typeof targetObj.stroke === 'string' ? targetObj.stroke : '#000000';
      const origStroke = savedOnParent ?? (currentStroke !== 'transparent' ? currentStroke : '#000000');
      (selectedObject as any).gradientOriginalStroke = origStroke;
      (targetObj as any).gradientOriginalStroke = origStroke;
    }
    targetObj.set('stroke', 'transparent');

    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: selectedObject });
    saveState();
    toast.success('Line gradient applied');
  }, [selectedObject, canvas, saveState]);

  const clearLineGradient = useCallback(() => {
    if (!selectedObject || !canvas) return;
    
    // Determine target object
    let targetObj: any = selectedObject;
    if (selectedObject.type === 'group') {
      const group = selectedObject as Group;
      targetObj =
        group._objects?.find(obj => obj.type === 'path' || obj.type === 'line') ||
        group._objects?.[0];
    }

    if (!targetObj) {
      return;
    }

    // Remove gradient config — the after:render overlay will stop drawing automatically.
    delete (selectedObject as any).gradientConfig;
    delete (targetObj as any).gradientConfig;

    // Restore original stroke
    const origStroke = (targetObj as any).gradientOriginalStroke || (selectedObject as any).gradientOriginalStroke || '#000000';
    targetObj.set('stroke', origStroke);
    delete (selectedObject as any).gradientOriginalStroke;
    delete (targetObj as any).gradientOriginalStroke;

    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: selectedObject });
    saveState();
    toast.success('Line gradient cleared');
  }, [selectedObject, canvas, saveState]);

  // Helper: find the rendered path child of a line object (same logic as applyLineGradient)
  const _findLineTargetObj = (o: any): any => {
    if (o.type !== 'group') return o;
    return o.mainPath ?? o._objects?.find((c: any) => c.type === 'path' || c.type === 'line') ?? o;
  };

  // Exit bezier edit mode
  const exitBezierEditMode = useCallback(() => {
    if (bezierEditModeRef.current && canvas) {
      // Restore gradient overlay visibility and re-hide original stroke where gradient is active
      canvas.getObjects().forEach((o: any) => {
        o._gradientHidden = false;
        if (o.gradientConfig && o.gradientOriginalStroke) {
          _findLineTargetObj(o).set('stroke', 'transparent');
        }
      });
      bezierEditModeRef.current.deactivate();
      // Explicitly clear the path ref to prevent stale references
      bezierEditModeRef.current.path = null;
      setIsBezierEditMode(false);
      setEditingBezierPath(null);
      // Re-register attachments so connections made in edit mode are tracked
      if ((canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.reloadAllAttachments();
      }
      // Extra render call to ensure handles are visually removed
      canvas.requestRenderAll();
      toast.success("Edit mode exited");
    }
  }, [canvas]);

  // Exit curved line edit mode
  const exitCurvedLineEditMode = useCallback(() => {
    if (curvedLineEditModeRef.current && canvas) {
      canvas.getObjects().forEach((o: any) => {
        o._gradientHidden = false;
        if (o.gradientConfig && o.gradientOriginalStroke) {
          _findLineTargetObj(o).set('stroke', 'transparent');
        }
      });
      curvedLineEditModeRef.current.deactivate();
      setIsCurvedLineEditMode(false);
      setEditingCurvedLine(null);
      // Re-register attachments so connections made in edit mode are tracked
      if ((canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.reloadAllAttachments();
      }
      // Extra render call to ensure handles are visually removed
      canvas.requestRenderAll();
      toast.success("Edit mode exited");
    }
  }, [canvas]);

  // Exit straight line edit mode
  const exitStraightLineEditMode = useCallback(() => {
    if (straightLineEditModeRef.current && canvas) {
      canvas.getObjects().forEach((o: any) => {
        o._gradientHidden = false;
        if (o.gradientConfig && o.gradientOriginalStroke) {
          _findLineTargetObj(o).set('stroke', 'transparent');
        }
      });
      straightLineEditModeRef.current.deactivate();
      setIsStraightLineEditMode(false);
      setEditingStraightLine(null);
      // Re-register attachments so connections made in edit mode are tracked
      if ((canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.reloadAllAttachments();
      }
      // Extra render call to ensure handles are visually removed
      canvas.requestRenderAll();
      toast.success("Edit mode exited");
    }
  }, [canvas]);

  // Exit orthogonal line edit mode
  const exitOrthogonalLineEditMode = useCallback(() => {
    if (orthogonalLineEditModeRef.current && canvas) {
      canvas.getObjects().forEach((o: any) => {
        o._gradientHidden = false;
        if (o.gradientConfig && o.gradientOriginalStroke) {
          _findLineTargetObj(o).set('stroke', 'transparent');
        }
      });
      orthogonalLineEditModeRef.current.deactivate();
      setIsOrthogonalLineEditMode(false);
      setEditingOrthogonalLine(null);
      // Re-register attachments so connections made in edit mode are tracked
      if ((canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.reloadAllAttachments();
      }
      // Extra render call to ensure handles are visually removed
      canvas.requestRenderAll();
      toast.success("Edit mode exited");
    }
  }, [canvas]);

  const exitImageEditMode = useCallback(() => {
    if (canvas) {
      // Get the current masked image group - either from ref or from selected object
      const group = imageEditModeRef.current || (selectedObject?.type === 'group' && (selectedObject as any).isMaskedImage ? selectedObject as Group : null);
      if (group) {
        exitImageEditModeFn(canvas, group, setIsImageEditMode);
        imageEditModeRef.current = null;
        setEditingMaskedImage(null);
      } else {
        // Fallback - just clear the mode
        setIsImageEditMode(false);
        toast.info("Edit mode exited");
      }
    } else {
    }
  }, [canvas, selectedObject]);

  // Auto-exit image edit mode when selection changes
  useEffect(() => {
    if (isImageEditMode && imageEditModeRef.current) {
      const group = imageEditModeRef.current;
      const extractedImage = (group as any).extractedImage;

      // Allow selection to be either the group OR the extracted image
      const isValidSelection = selectedObject === group || selectedObject === extractedImage;

      // If selection changed to a different object (or cleared), exit edit mode
      if (!selectedObject || !isValidSelection) {
        exitImageEditMode();
      }
    }
  }, [selectedObject, isImageEditMode, exitImageEditMode]);

  // Exit membrane edit mode
  const exitMembraneEditMode = useCallback(async () => {

    if (membraneEditModeRef.current && canvas) {

      const newMembraneGroup = await membraneEditModeRef.current.deactivate();

      setIsMembraneEditMode(false);
      membraneEditModeRef.current = null;

      // Update the editing membrane reference to the new group
      if (newMembraneGroup) {
        setEditingMembrane(newMembraneGroup);
      } else {
        setEditingMembrane(null);
      }

      canvas.requestRenderAll();

      toast.success("Membrane edit mode exited");
    } else {

    }
  }, [canvas]);

  const value: CanvasContextType = {
    canvas,
    setCanvas,
    selectedObject,
    setSelectedObject,
    firstSelectedObjectRef,
    zoom,
    setZoom,
    backgroundColor,
    setBackgroundColor,
    backgroundGradient,
    setBackgroundGradient,
    gradientStartColor,
    setGradientStartColor,
    gradientEndColor,
    setGradientEndColor,
    gradientType,
    setGradientType,
    gradientAngle,
    setGradientAngle,
    gradientCenterX,
    setGradientCenterX,
    gradientCenterY,
    setGradientCenterY,
    gradientRadius,
    setGradientRadius,
    canvasDimensions,
    setCanvasDimensions,
    paperSize,
    setPaperSize,
    canvasLoadVersion,
    setCanvasLoadVersion,
    customDimensions,
    setCustomDimensions,
    currentProjectId,
    setCurrentProjectId,
    projectOwnerId,
    projectName,
    setProjectName,
    isSaving,
    isLoadingProject,
    iconLoadingProgress,
    saveProject,
    loadProject,
    saveStatus,
    setSaveStatus,
    undo,
    redo,
    beginHistoryTransaction,
    commitHistoryTransaction,
    cancelHistoryTransaction,
    saveStateWithLabel,
    cut,
    copy,
    paste,
    deleteSelected,
    selectAll,
    hasClipboardContent: clipboard !== null,
    zoomIn,
    zoomOut,
    zoomToFit,
    resetZoom,
    setCustomZoom,
    alignLeft,
    alignCenter,
    alignRight,
    alignTop,
    alignMiddle,
    alignBottom,
    distributeHorizontally,
    distributeVertically,
    distributionSpacing,
    setDistributionSpacing,
    matchWidth,
    matchHeight,
    flipHorizontal,
    flipVertical,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    groupSelected,
    ungroupSelected,
    extractObjectsFromImage,
    exportAsPNG,
    exportAsPNGTransparent,
    exportAsJPG,
    exportAsSVG,
    exportAsPDF,
    exportAsPPTX,
    cleanExport,
    exportDialogOpen,
    setExportDialogOpen,
    textFont,
    setTextFont,
    textAlign,
    setTextAlign,
    textUnderline,
    setTextUnderline,
    textOverline,
    setTextOverline,
    textBold,
    setTextBold,
    textItalic,
    setTextItalic,
    textListType,
    setTextListType,
    textSubscript,
    setTextSubscript,
    textSuperscript,
    setTextSuperscript,
    pinObject,
    unpinObject,
    togglePin,
    isPinned,
    getCanvasObjects,
    selectObjectById,
    toggleObjectVisibility,
    toggleObjectLock,
    reorderObjects,
    cropMode,
    setCropMode,
    cropImage,
    resetCrop,
    smoothenPath,
    nudgeObject,
    saveState,
    saveTransformDelta,
    isPerformingHistoryOperationRef: isPerformingHistoryOperation,
    recentColors,
    addToRecentColors,
    flashCanvas,
    recoverCanvas,
    checkForRecovery,
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
    applyGradient,
    clearGradient,
    applyShadow,
    clearEffects,
    applyImageFilters,
    getImageFilters,
    clearImageFilters,
    removeImageBackground,
    applyLineGradient,
    clearLineGradient,
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
    setIsImageEditMode,
    imageEditModeRef,
    editingMaskedImage,
    setEditingMaskedImage,
    exitImageEditMode,
    isMembraneEditMode,
    setIsMembraneEditMode,
    membraneEditModeRef,
    editingMembrane,
    setEditingMembrane,
    exitMembraneEditMode,
    isReadOnly,
    setIsReadOnly,
    loadSharedProject,
    smartConnectorsEnabled,
    setSmartConnectorsEnabled,
    autoPathfindingEnabled,
    setAutoPathfindingEnabled,
    lineStyleType,
    setLineStyleType,
    lineStartEndpoint,
    setLineStartEndpoint,
    lineEndEndpoint,
    setLineEndEndpoint,
    lineStrokeWidth,
    setLineStrokeWidth,
    lineDashPattern,
    setLineDashPattern,
    lineCornerStyle,
    setLineCornerStyle,
  };

  // Expose context to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const gridRulerState = useGridAndRulerStore.getState();
      (window as any).canvasContext = {
        ...value,
        // Include grid/ruler for backward compatibility and snap-to-grid
        gridEnabled: gridRulerState.gridEnabled,
        rulersEnabled: gridRulerState.rulersEnabled,
        snapToGrid: gridRulerState.snapToGrid,
        gridSize: gridRulerState.gridSize,
        gridPattern: gridRulerState.gridPattern,
        // Expose historyManager for testing
        historyManager: historyManager.current,
      };
    }
  }, [value]);

  // Subscribe to grid/ruler store changes to keep window.canvasContext in sync
  useEffect(() => {
    const unsubscribe = useGridAndRulerStore.subscribe((state) => {
      if (typeof window !== 'undefined' && (window as any).canvasContext) {
        (window as any).canvasContext.snapToGrid = state.snapToGrid;
        (window as any).canvasContext.gridSize = state.gridSize;
        (window as any).canvasContext.gridEnabled = state.gridEnabled;
        (window as any).canvasContext.rulersEnabled = state.rulersEnabled;
        (window as any).canvasContext.gridPattern = state.gridPattern;
      }
    });

    return unsubscribe;
  }, []);

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
};
