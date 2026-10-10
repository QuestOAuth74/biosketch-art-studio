import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PushPinIcon, PushPinSlashIcon, ScribbleIcon } from "@phosphor-icons/react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useCanvas } from "@/contexts/CanvasContext";
import { isBracket } from "@/lib/bracketTool";
import { isLeaderLine } from "@/lib/leaderLineTool";
import { isCallout } from "@/lib/numberedCalloutTool";
import { getTextBoxData, isTextBox } from "@/lib/textBoxTool";
import { isChart } from "@/lib/chartTool";
import { FabricImage } from "fabric";
import { useEffect, useState } from "react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { getPaperSize } from "@/types/paperSizes";

// Custom hooks
import { useTextProperties } from "@/hooks/properties/useTextProperties";
import { useFreeformLineProperties } from "@/hooks/properties/useFreeformLineProperties";
import { useImageToneManagement } from "@/hooks/properties/useImageToneManagement";
import { useIconToneManagement } from "@/hooks/properties/useIconToneManagement";
import { applyLineStyles, getLineStyles, applyCornerStyle } from "@/lib/lineStyleApplicator";
import { applyEndpointMarkers, attachMarkerSyncForLine } from "@/lib/lineEndpointRenderer";
import { convertLineType, canConvertTo } from "@/lib/lineTypeConverter";
import { detectLineType } from "@/lib/lineTypeDetector";
import { LineEndpointType, CornerStyle } from "@/types/effects";
import { findOrthogonalPath, findMinimalBezierWaypoints, waypointsToSmoothBezierPoints } from "@/lib/pathfinding";
import { calculateConnectionPoints } from "@/lib/connectionPoints";
import { util, Point as FabricPoint, Path, Group } from "fabric";

// Specialized panels
import { BezierSimplificationPanel } from "./BezierSimplificationPanel";
import { EditModePanel } from "./EditModePanel";
import { ImageEraserDialog } from "./ImageEraserDialog";
import { ImageMaskPanel } from "./ImageMaskPanel";
import { LineGradientPanel } from "./LineGradientPanel";
import { LineIntersectionPanel } from "./LineIntersectionPanel";
import { LinePropertiesPanel } from "./LinePropertiesPanel";
import { MembranePropertiesPanel } from "./MembranePropertiesPanel";
import { TripleMembranePropertiesPanel } from "./TripleMembranePropertiesPanel";
import { DNAHelixPropertiesPanel } from "./DNAHelixPropertiesPanel";
import { StylePresets } from "./StylePresets";

// Property sections - General
import { DiagramSettingsSection } from "./properties/DiagramSettingsSection";
import { TextPropertiesSection } from "./properties/TextPropertiesSection";

// Property sections - Style tab
import { ColorsSection } from "./properties/style/ColorsSection";
import { GradientsSection } from "./properties/style/GradientsSection";
import { EffectsSection } from "./properties/style/EffectsSection";

// Property sections - Transform tab
import { PositionSection } from "./properties/transform/PositionSection";
import { SizeSection } from "./properties/transform/SizeSection";
import { RotationSection } from "./properties/transform/RotationSection";
import { AlignmentSection } from "./properties/transform/AlignmentSection";
import { DistributionSection } from "./properties/transform/DistributionSection";
import { LayerOrderSection } from "./properties/transform/LayerOrderSection";

// Property sections - Properties tab (object-specific)
import { TextBoxPropertiesSection } from "./properties/TextBoxPropertiesSection";
import { ChartPropertiesSection } from "./properties/ChartPropertiesSection";
import { TableConfigPanel } from "./TableConfigPanel";
import { BracketPropertiesSection } from "./properties/BracketPropertiesSection";
import { LeaderLinePropertiesSection } from "./properties/LeaderLinePropertiesSection";
import { ImagePropertiesSection } from "./properties/ImagePropertiesSection";
import { CropSection } from "./properties/CropSection";
import { IconStylingSection } from "./properties/IconStylingSection";
import { ShapeMaskingSection } from "./properties/ShapeMaskingSection";
import { LegendVisibilitySection } from "./properties/LegendVisibilitySection";
import { EraserControlsSection } from "./properties/EraserControlsSection";
import { LineConnectionSection } from "./properties/LineConnectionSection";
import { LineStyleSection } from "./properties/LineStyleSection";
import { CommentsSection } from "./properties/CommentsSection";
import { isIconGroup } from "@/lib/stylePresetExtractor";

export const PropertiesPanel = ({
  isCollapsed,
  onToggleCollapse,
  activeTool,
  projectId,
  projectOwnerId,
  onSelectComment,
  showComments,
  onToggleComments,
  selectedCommentId,
}: {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeTool?: string;
  projectId?: string;
  projectOwnerId?: string;
  onSelectComment?: (id: string) => void;
  showComments?: boolean;
  onToggleComments?: () => void;
  selectedCommentId?: string | null;
}) => {
  const {
    canvas,
    selectedObject,
    togglePin,
    isPinned,
    recentColors,
    addToRecentColors,
    saveState,
    isBezierEditMode,
    isCurvedLineEditMode,
    isStraightLineEditMode,
    isOrthogonalLineEditMode,
    isMembraneEditMode,
    isImageEditMode,
    imageEditModeRef,
    setCropMode,
    resetCrop,
    // Diagram settings
    gridEnabled,
    setGridEnabled,
    rulersEnabled,
    setRulersEnabled,
    gridSize,
    setGridSize,
    gridPattern,
    setGridPattern,
    snapToGrid,
    setSnapToGrid,
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
    paperSize,
    setPaperSize,
    canvasDimensions,
    setCanvasDimensions,
    customDimensions,
    setCustomDimensions,
    canvasLoadVersion,
    setCanvasLoadVersion,
    // Transform operations
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
    // Line connection and styling
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
    removeImageBackground,
  } = useCanvas();

  // Sticky header configuration
  const HEADER_HEIGHT = 36; // Height of each sticky header in pixels

  // Zustand store for section collapse state
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const freeformLineCollapsed = useSectionCollapseStore((state) => state.sections['section-line-smoothing'] ?? true);

  // Local state
  const [activeTab, setActiveTab] = useState<string>("diagram");
  const [showImageEraser, setShowImageEraser] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [bracketSize, setBracketSize] = useState(60);
  const [bracketGap, setBracketGap] = useState(15);
  const [showLeaderLineArrow, setShowLeaderLineArrow] = useState(true);
  const [showBgColor, setShowBgColor] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0); // Force re-render counter

  const handleAutoRemoveBackground = async () => {
    setIsRemovingBackground(true);
    try {
      await removeImageBackground();
    } finally {
      setIsRemovingBackground(false);
    }
  };

  // Transform state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);

  // Custom hooks for property management
  const {
    textFont,
    textSize,
    textColor,
    handleFontChange,
    handleTextSizeChange,
    handleTextColorChange,
  } = useTextProperties(selectedObject, canvas, addToRecentColors, getTextObject);

  const {
    freeformLineColor,
    freeformLineThickness,
    freeformStartMarker,
    freeformEndMarker,
    smoothingStrength,
    handleFreeformLineColorChange,
    handleFreeformLineThicknessChange,
    handleFreeformStartMarkerChange,
    handleFreeformEndMarkerChange,
    handleSmoothingStrengthChange,
  } = useFreeformLineProperties(selectedObject, canvas, addToRecentColors);

  const {
    imageToneColor,
    imageToneOpacity,
    handleImageToneChange,
    handleImageToneOpacityChange,
    handleRemoveImageTone,
  } = useImageToneManagement(selectedObject, canvas, addToRecentColors);

  const {
    iconToneColor,
    iconToneIntensity,
    handleIconToneChange,
    handleIconToneIntensityChange,
    handleRemoveIconTone,
  } = useIconToneManagement(selectedObject, canvas);

  // Helper function to get text object from selection
  function getTextObject(obj: any): any {
    if (obj?.type === "textbox") {
      return obj;
    }
    if (obj?.type === "group") {
      const textObj = obj.getObjects().find((o: any) => o.type === "textbox");
      return textObj || null;
    }
    return null;
  }

  // Helper to detect if object is a shape-with-text group
  const isShapeWithTextGroup = (obj: any): boolean => {
    if (obj.type !== "group") return false;
    const objects = obj.getObjects();
    return (
      (objects.length === 2 &&
        (objects[0].type === "circle" || objects[0].type === "rect") &&
        objects[1].type === "textbox") ||
      (objects.length === 3 &&
        objects[0].type === "rect" &&
        objects[1].type === "textbox" &&
        objects[2].type === "textbox")
    );
  };

  // Helper functions to determine object types
  const isTextObject = (obj: any) => {
    return (
      obj?.type === "textbox" ||
      (obj?.type === "group" &&
        obj.getObjects().some((o: any) => o.type === "textbox")) ||
      isTextBox(obj)
    );
  };

  const isLineObject = (obj: any) => {
    const isConnectorGroup =
      obj?.type === "group" && (obj as any)?.connectorData;

    return (
      isConnectorGroup ||
      obj?.type === "path" ||
      obj?.type === "line" ||
      (obj as any)?.isFreeformLine ||
      (obj as any)?.isConnector ||
      (obj as any)?.isCurvedLine ||
      (obj as any)?.isOrthogonalLine ||
      (obj as any)?.isStraightLine
    );
  };

  const isShapeObject = (obj: any) => {
    return (
      obj?.type === "rect" ||
      obj?.type === "circle" ||
      obj?.type === "ellipse" ||
      obj?.type === "polygon"
    );
  };

  const isImageObject = (obj: any) => {
    return obj?.type === "image";
  };

  const isMaskedImageGroup = (obj: any): boolean => {
    return obj?.type === "group" && (obj as any).isMaskedImage === true;
  };

  const isStandaloneShape = (obj: any): boolean => {
    return isShapeObject(obj) && !obj._objects;
  };

  const isBezierPath = (obj: any): boolean => {
    return (
      obj?.type === "path" &&
      (obj as any)?.isBezierPath === true &&
      (obj as any)?.bezierPoints?.length >= 2
    );
  };

  // Update transform state when selection changes
  useEffect(() => {
    if (selectedObject) {
      setPosition({
        x: selectedObject.left || 0,
        y: selectedObject.top || 0,
      });
      const currentWidth =
        (selectedObject.width || 1) * (selectedObject.scaleX || 1);
      const currentHeight =
        (selectedObject.height || 1) * (selectedObject.scaleY || 1);
      setSize({ width: currentWidth, height: currentHeight });
      setRotation(selectedObject.angle || 0);
    }
  }, [selectedObject]);

  // Update active tab when selectedObject changes
  useEffect(() => {
    // Don't update properties for control handles or guide lines
    if (
      selectedObject &&
      ((selectedObject as any).isControlHandle ||
        (selectedObject as any).isHandleLine)
    ) {
      return;
    }

    if (!selectedObject) {
      setActiveTab("diagram");
    } else {
      setActiveTab("style");
    }
  }, [selectedObject]);

  // Expand comments section when comment tool is active or a comment is selected
  useEffect(() => {
    if (activeTool === 'comment' || selectedCommentId) {
      // If nothing is selected, switch to diagram tab where CommentsSection lives
      if (!selectedObject) {
        setActiveTab('diagram');
      }
      useSectionCollapseStore.getState().setSection('section-comments', false);
    }
  }, [activeTool, selectedCommentId, selectedObject]);

  // Update bracket properties when bracket is selected
  useEffect(() => {
    if (selectedObject && isBracket(selectedObject)) {
      setBracketSize((selectedObject as any).bracketSize || 60);
      setBracketGap((selectedObject as any).bracketGap || 15);
    }
  }, [selectedObject]);

  // Update leader line properties
  useEffect(() => {
    if (selectedObject && isLeaderLine(selectedObject)) {
      const group = selectedObject as any;
      const objects = group.getObjects();
      const arrow = objects.length > 1 ? objects[1] : null;
      setShowLeaderLineArrow(arrow ? arrow.visible !== false : true);
    }
  }, [selectedObject]);

  // Update legend visibility when callout is selected
  useEffect(() => {
    if (selectedObject && isCallout(selectedObject)) {
      // Force the legend section to be expanded when a callout is selected
      const sections = useSectionCollapseStore.getState().sections;
      if (sections['section-legend'] !== false) {
        useSectionCollapseStore.getState().setSection('section-legend', false);
      }

      const legend = canvas
        ?.getObjects()
        .find((obj) => (obj as any).customType === "callout-legend");
      if (legend) {
        const isHidden = (legend as any).legendHidden === true;
        setShowLegend(!isHidden);
      } else if (canvas) {
        const isHidden = (canvas as any).legendHidden === true;
        setShowLegend(!isHidden);
      }
    }
  }, [selectedObject, canvas]);

  // Close eraser tool if selection changes
  useEffect(() => {
    if (!selectedObject || !(selectedObject instanceof FabricImage)) {
      setShowImageEraser(false);
    }
  }, [selectedObject]);

  // Auto-switch to style tab when line tool is active
  useEffect(() => {
    const isLineTool =
      activeTool === 'pen' ||
      activeTool === 'freeform-line' ||
      activeTool?.startsWith('straight-line') ||
      activeTool?.startsWith('curved-line') ||
      activeTool?.startsWith('orthogonal-line') ||
      activeTool?.startsWith('bezier');

    if (isLineTool && !selectedObject) {
      setActiveTab('style');
    }
  }, [activeTool, selectedObject]);

  // Load line styles and type from selected object
  useEffect(() => {
    if (selectedObject && isLineObject(selectedObject)) {
      // Detect and set line type
      const detectedType = detectLineType(selectedObject);
      if (detectedType) {
        setLineStyleType(detectedType);
      }

      // Load line styles
      const styles = getLineStyles(selectedObject);
      setLineStrokeWidth(styles.strokeWidth);
      setLineDashPattern(styles.dashPattern);
      setLineCornerStyle(styles.cornerStyle);

      // Load endpoint marker types
      const startMarker = (selectedObject as any).startMarkerType || 'none';
      const endMarker = (selectedObject as any).endMarkerType || 'none';
      setLineStartEndpoint(startMarker);
      setLineEndEndpoint(endMarker);
    }
  }, [selectedObject]);

  // Transform handlers
  const handlePositionChange = (axis: "x" | "y", value: number) => {
    if (!selectedObject) return;
    if (axis === "x") {
      selectedObject.set({ left: value });
      setPosition((prev) => ({ ...prev, x: value }));
    } else {
      selectedObject.set({ top: value });
      setPosition((prev) => ({ ...prev, y: value }));
    }
    selectedObject.canvas?.requestRenderAll();
  };

  const handleSizeChange = (dimension: "width" | "height", value: number) => {
    if (!selectedObject) return;

    if (dimension === "width") {
      const scaleX = value / (selectedObject.width || 1);
      selectedObject.set({ scaleX });
    } else {
      const scaleY = value / (selectedObject.height || 1);
      selectedObject.set({ scaleY });
    }

    selectedObject.setCoords();
    setSize((prev) => ({ ...prev, [dimension]: value }));
    selectedObject.canvas?.requestRenderAll();
  };

  const handleRotate = () => {
    if (!selectedObject) return;
    selectedObject.set({ angle: rotation });
    selectedObject.canvas?.requestRenderAll();
  };

  const handleEraserWidthChange = (value: number[]) => {
    const width = value[0];
    setEraserWidth(width);
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = width;
    }
  };

  // Line style handlers - apply styles to selected object
  const handleLineStrokeWidthChange = (values: number[]) => {
    const width = values[0];
    setLineStrokeWidth(width);
    if (selectedObject && isLineObject(selectedObject)) {
      applyLineStyles(selectedObject, { strokeWidth: width });
      canvas?.requestRenderAll();
      canvas?.fire('object:modified', { target: selectedObject });
    }
  };

  const handleLineDashPatternChange = (pattern: 'solid' | 'dashed' | 'dotted' | 'custom') => {
    setLineDashPattern(pattern);
    if (selectedObject && isLineObject(selectedObject)) {
      applyLineStyles(selectedObject, { dashPattern: pattern });
      canvas?.requestRenderAll();
      canvas?.fire('object:modified', { target: selectedObject });
    }
  };

  const handleLineCornerStyleChange = (style: CornerStyle) => {
    setLineCornerStyle(style);
    if (selectedObject && isLineObject(selectedObject)) {
      applyLineStyles(selectedObject, { cornerStyle: style });
      canvas?.requestRenderAll();
      canvas?.fire('object:modified', { target: selectedObject });
    }
  };

  const handleLineStartEndpointChange = (type: LineEndpointType) => {
    setLineStartEndpoint(type);
    if (canvas && selectedObject && isLineObject(selectedObject)) {
      // Update the marker type property on the line object
      (selectedObject as any).startMarkerType = type;
      applyEndpointMarkers(canvas, selectedObject, type, lineEndEndpoint);
      attachMarkerSyncForLine(canvas, selectedObject);
      canvas.fire('object:modified', { target: selectedObject });
      saveState();
    }
  };

  const handleLineEndEndpointChange = (type: LineEndpointType) => {
    setLineEndEndpoint(type);
    if (canvas && selectedObject && isLineObject(selectedObject)) {
      // Update the marker type property on the line object
      (selectedObject as any).endMarkerType = type;
      applyEndpointMarkers(canvas, selectedObject, lineStartEndpoint, type);
      attachMarkerSyncForLine(canvas, selectedObject);
      canvas.fire('object:modified', { target: selectedObject });
      saveState();
    }
  };

  const handleLineTypeChange = async (type: 'straight' | 'curved' | 'orthogonal' | 'bezier') => {
    if (!canvas || !selectedObject || !isLineObject(selectedObject)) return;

    // Check if conversion is possible
    if (!canConvertTo(selectedObject, type)) {
      console.warn(`Cannot convert line to ${type} type`);
      return;
    }

    // Perform conversion
    const newLine = await convertLineType(canvas, selectedObject, type, () => {});

    if (newLine) {
      // Update state
      setLineStyleType(type);

      // Get preserved marker properties from the converted line
      const preservedStartMarker = (newLine as any).startMarkerType || 'none';
      const preservedEndMarker = (newLine as any).endMarkerType || 'none';

      // Update state to match preserved properties
      setLineStartEndpoint(preservedStartMarker);
      setLineEndEndpoint(preservedEndMarker);

      // Select the new line (this will automatically update selectedObject via canvas events)
      canvas.setActiveObject(newLine);

      // Attach transform sync so markers follow the new line on move/rotate/scale
      attachMarkerSyncForLine(canvas, newLine);

      applyLineStyles(newLine, {
        strokeWidth: lineStrokeWidth,
        dashPattern: lineDashPattern,
        cornerStyle: lineCornerStyle,
      });

      canvas.requestRenderAll();
    }
  };

  // Handler for toggling autopathfinding on a selected line
  const handleSelectedLineAutoPathfindingChange = (enabled: boolean) => {
    if (!canvas || !selectedObject || !isLineObject(selectedObject)) {
      return;
    }

    const lineData = selectedObject as any;

    // Update the line's autopathfinding flag
    lineData.autoPathfindingEnabled = enabled;

    // If enabling autopathfinding for an orthogonal line, immediately recalculate path
    // Works even without attachments - routes from first to last waypoint
    if (enabled && lineData.isOrthogonalLine) {
      const waypoints = lineData.orthogonalLineWaypoints;
      if (!waypoints || waypoints.length < 2) return;

      const start = waypoints[0];
      const end = waypoints[waypoints.length - 1];

      // Collect object IDs to exclude from obstacle detection (if attached)
      const excludeObjectIds: string[] = [];
      if (lineData.startAttachment?.objectId) {
        excludeObjectIds.push(lineData.startAttachment.objectId);
      }
      if (lineData.endAttachment?.objectId) {
        excludeObjectIds.push(lineData.endAttachment.objectId);
      }

      // Run pathfinding to get new waypoints
      const pathfindingResult = findOrthogonalPath(
        canvas,
        start,
        end,
        lineData.id,
        excludeObjectIds
      );

      // Update waypoints with pathfinding result
      lineData.orthogonalLineWaypoints = pathfindingResult;

      // Rebuild path using the same approach as edit mode:
      // - convert world waypoints → local coordinates via the group's inverse transform
      // - build path data in local coords with pathOffset = (0,0)
      // - do NOT touch pathObj.left/top or group.left/top (those are correct as-is)
      // This avoids the coordinate-system bug where world values are stored as group-local.
      const pathObj = selectedObject instanceof Group
        ? (selectedObject as Group).getObjects()[0] as Path
        : selectedObject as Path;

      if (pathObj) {
        const matrix = selectedObject.calcTransformMatrix();
        const invMatrix = util.invertTransform(matrix);

        // findOrthogonalPath already returns simplified orthogonal waypoints
        // (each consecutive pair is axis-aligned: horizontal or vertical).
        // Using them directly as routing points avoids the duplicate-point bug
        // in calculateOrthogonalPathFromWaypoints, which adds an "elbow" point
        // coinciding with each waypoint (zero-length segment → Q curves with
        // radius=0 → corners look sharp even with rounded style).
        const localPoints = pathfindingResult.map((wp: any) =>
          util.transformPoint(new FabricPoint(wp.x, wp.y), invMatrix)
        );

        // Build path data in local coordinates (same as edit mode)
        let pathData = `M ${localPoints[0].x} ${localPoints[0].y}`;
        for (let i = 1; i < localPoints.length; i++) {
          pathData += ` L ${localPoints[i].x} ${localPoints[i].y}`;
        }

        // Update path commands only — no position changes
        pathObj.set({
          path: util.parsePath(pathData),
          pathOffset: new FabricPoint(0, 0),
          dirty: true
        });
        pathObj.setCoords();

        // Store updated local points and waypoints for edit mode
        lineData.orthogonalLineLocalPoints = localPoints;
        lineData.orthogonalLineLocalWaypoints = localPoints;

        // Pre-populate the sharp-corner cache with our correct local points.
        // This ensures applyCornerStyle uses these points directly rather than
        // re-extracting from pathObj.path (which could have stale data).
        lineData._sharpRoutePoints = localPoints.map((p: FabricPoint) => new FabricPoint(p.x, p.y));

        // Force the group to re-render (child dirty doesn't always propagate)
        if (selectedObject instanceof Group) {
          (selectedObject as any).dirty = true;
        }

        // Re-apply corner style if not sharp
        if (lineData.cornerStyle && lineData.cornerStyle !== 'sharp') {
          applyCornerStyle(selectedObject, lineData.cornerStyle);
        }
      }

      canvas.requestRenderAll();
    }

    // If enabling autopathfinding for a bezier line, immediately recalculate path
    if (enabled && lineData.isBezierPath) {
      const bezierPoints = lineData.bezierPoints;
      if (!bezierPoints || bezierPoints.length < 2) return;

      const path = selectedObject as Path;
      const matrix = path.calcTransformMatrix();

      // Convert stored local bezier points to world coordinates
      const worldAnchors = bezierPoints.map((pt: any) =>
        util.transformPoint(new FabricPoint(pt.x, pt.y), matrix)
      );
      const worldCP1s = bezierPoints.map((pt: any) =>
        pt.controlPoint1
          ? util.transformPoint(new FabricPoint(pt.controlPoint1.x, pt.controlPoint1.y), matrix)
          : null
      );
      const worldCP2s = bezierPoints.map((pt: any) =>
        pt.controlPoint2
          ? util.transformPoint(new FabricPoint(pt.controlPoint2.x, pt.controlPoint2.y), matrix)
          : null
      );

      const start = worldAnchors[0];
      const end = worldAnchors[worldAnchors.length - 1];

      const excludeObjectIds: string[] = [];
      if (lineData.startAttachment?.objectId) excludeObjectIds.push(lineData.startAttachment.objectId);
      if (lineData.endAttachment?.objectId) excludeObjectIds.push(lineData.endAttachment.objectId);

      const waypoints = findMinimalBezierWaypoints(canvas, start, end, lineData.id, excludeObjectIds);

      if (waypoints.length >= 2) {
        const newBezierPts = waypointsToSmoothBezierPoints(waypoints);

        // Replace world anchor/CP arrays with pathfinding result
        worldAnchors.length = 0;
        worldCP1s.length = 0;
        worldCP2s.length = 0;
        for (const bp of newBezierPts) {
          worldAnchors.push(new FabricPoint(bp.x, bp.y));
          worldCP1s.push(bp.controlPoint1 ? new FabricPoint(bp.controlPoint1.x, bp.controlPoint1.y) : null);
          worldCP2s.push(bp.controlPoint2 ? new FabricPoint(bp.controlPoint2.x, bp.controlPoint2.y) : null);
        }

        // Rebuild SVG path string from world coordinates
        let pathData = `M ${worldAnchors[0].x} ${worldAnchors[0].y}`;
        for (let i = 0; i < worldAnchors.length - 1; i++) {
          const cp1 = worldCP2s[i] || worldAnchors[i];
          const cp2 = worldCP1s[i + 1] || worldAnchors[i + 1];
          pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${worldAnchors[i + 1].x} ${worldAnchors[i + 1].y}`;
        }

        // Use a temp path to compute correct bounding dimensions
        const tempPath = new Path(pathData);
        path.set({
          path: tempPath.path,
          pathOffset: tempPath.pathOffset,
          left: tempPath.left,
          top: tempPath.top,
          width: tempPath.width,
          height: tempPath.height,
        });

        // Convert world coords back to the new local coordinate system
        const newInvMatrix = util.invertTransform(path.calcTransformMatrix());
        lineData.bezierPoints = newBezierPts.map((bp: any, i: number) => {
          const localAnchor = util.transformPoint(worldAnchors[i], newInvMatrix);
          const result: any = { x: localAnchor.x, y: localAnchor.y, type: bp.type, id: bp.id };
          if (worldCP1s[i]) {
            const lcp1 = util.transformPoint(worldCP1s[i], newInvMatrix);
            result.controlPoint1 = { x: lcp1.x, y: lcp1.y };
          }
          if (worldCP2s[i]) {
            const lcp2 = util.transformPoint(worldCP2s[i], newInvMatrix);
            result.controlPoint2 = { x: lcp2.x, y: lcp2.y };
          }
          return result;
        });

        lineData.manualPathOverride = false;
        path.setCoords();
        path.dirty = true;
        canvas.requestRenderAll();
      }
    }

    // Save state
    saveState();

    // Force UI update by re-setting the active object
    // This triggers the selection events which causes React to re-render
    canvas.setActiveObject(selectedObject);
    canvas.requestRenderAll();

    // Force React to re-render by updating state
    setRenderTrigger(prev => prev + 1);
  };

  // Helper function to recalculate orthogonal path from waypoints
  const recalculateOrthogonalPath = (line: any, lineData: any) => {
    const worldWaypoints = lineData.orthogonalLineWaypoints as Array<{ x: number; y: number }>;
    const isClosed = lineData.isClosed || false;

    if (!worldWaypoints || worldWaypoints.length < 2) return;

    // If closed, add closing segment from last point back to first
    let waypointsForPath = worldWaypoints;
    if (isClosed && worldWaypoints.length >= 3) {
      waypointsForPath = [...worldWaypoints, worldWaypoints[0]];
    }

    // Calculate orthogonal path from waypoints
    const orthogonalWorldPoints = calculateOrthogonalPathFromWaypoints(waypointsForPath);
    if (orthogonalWorldPoints.length < 2) return;

    // Build path data string from WORLD coordinates
    let pathData = `M ${orthogonalWorldPoints[0].x} ${orthogonalWorldPoints[0].y}`;
    for (let i = 1; i < orthogonalWorldPoints.length; i++) {
      pathData += ` L ${orthogonalWorldPoints[i].x} ${orthogonalWorldPoints[i].y}`;
    }

    // Create a temporary path to get properly calculated dimensions
    const tempPath = new Path(pathData);

    if (line instanceof Group) {
      // For groups with markers
      const pathObj = (line as Group).getObjects()[0] as Path;
      if (pathObj) {
        pathObj.set({
          path: tempPath.path,
          pathOffset: tempPath.pathOffset,
          left: tempPath.left,
          top: tempPath.top,
          width: tempPath.width,
          height: tempPath.height,
          dirty: true
        });
        pathObj.setCoords();

        (line as Group).set({
          left: tempPath.left,
          top: tempPath.top,
          width: tempPath.width,
          height: tempPath.height,
          dirty: true
        });
        (line as Group).setCoords();

        // Convert world points to new local coordinates
        const newInvMatrix = util.invertTransform(line.calcTransformMatrix());
        const localPoints = orthogonalWorldPoints.map(wp =>
          util.transformPoint(wp, newInvMatrix)
        );
        lineData.orthogonalLineLocalPoints = localPoints;

        if (lineData.orthogonalLineWaypoints && Array.isArray(lineData.orthogonalLineWaypoints)) {
          const localWaypoints = lineData.orthogonalLineWaypoints.map((wp: any) =>
            util.transformPoint(new FabricPoint(wp.x, wp.y), newInvMatrix)
          );
          lineData.orthogonalLineLocalWaypoints = localWaypoints;
        }
      }
    } else {
      // For simple paths without markers
      const pathObj = line as Path;
      pathObj.set({
        path: tempPath.path,
        pathOffset: tempPath.pathOffset,
        left: tempPath.left,
        top: tempPath.top,
        width: tempPath.width,
        height: tempPath.height,
        dirty: true
      });
      pathObj.setCoords();

      const newInvMatrix = util.invertTransform(pathObj.calcTransformMatrix());
      const localPoints = orthogonalWorldPoints.map(wp =>
        util.transformPoint(wp, newInvMatrix)
      );
      lineData.orthogonalLineLocalPoints = localPoints;

      if (lineData.orthogonalLineWaypoints && Array.isArray(lineData.orthogonalLineWaypoints)) {
        const localWaypoints = lineData.orthogonalLineWaypoints.map((wp: any) =>
          util.transformPoint(new FabricPoint(wp.x, wp.y), newInvMatrix)
        );
        lineData.orthogonalLineLocalWaypoints = localWaypoints;
      }
    }

    line.setCoords();
    line.dirty = true;
  };

  // Helper to calculate orthogonal path from waypoints
  const calculateOrthogonalPathFromWaypoints = (points: Array<{ x: number; y: number }>): FabricPoint[] => {
    if (points.length < 2) return [];

    const fabricPoints: FabricPoint[] = [];
    fabricPoints.push(new FabricPoint(points[0].x, points[0].y));

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      const dx = Math.abs(curr.x - prev.x);
      const dy = Math.abs(curr.y - prev.y);

      // Calculate the L-turn elbow point.
      // Only add it if it's distinct from the endpoint — when the segment is
      // already axis-aligned (horizontal or vertical), the elbow equals curr,
      // which would create a zero-length segment and break corner style rendering.
      const elbowX = dx > dy ? curr.x : prev.x;
      const elbowY = dx > dy ? prev.y : curr.y;
      if (elbowX !== curr.x || elbowY !== curr.y) {
        fabricPoints.push(new FabricPoint(elbowX, elbowY));
      }
      fabricPoints.push(new FabricPoint(curr.x, curr.y));
    }

    return fabricPoints;
  };

  // Wrapper for setCanvasDimensions that also updates the canvas object and triggers ruler refresh
  const handleCanvasDimensionsChange = (newDimensions: { width: number; height: number }) => {
    // Update state
    setCanvasDimensions(newDimensions);

    // Update the actual canvas object
    if (canvas) {
      canvas.setDimensions(newDimensions);
      canvas.requestRenderAll();

      // Increment version to trigger ruler/grid re-render
      setCanvasLoadVersion(prev => prev + 1);
    }
  };

  // Handler for paper size changes - updates both state and canvas dimensions
  const handlePaperSizeChange = (sizeId: string) => {
    setPaperSize(sizeId);

    // Skip dimension update if "custom" is selected (handled by CustomDimensionInputs)
    if (sizeId === 'custom') {
      return;
    }

    // Look up the paper size and update canvas dimensions
    const paperSizeData = getPaperSize(sizeId);

    if (paperSizeData) {
      const newDimensions = {
        width: paperSizeData.width,
        height: paperSizeData.height
      };

      handleCanvasDimensionsChange(newDimensions);
    }
  };

  // Show edit mode panel when in edit modes

  if (isBezierEditMode || isCurvedLineEditMode || isStraightLineEditMode || isOrthogonalLineEditMode || isMembraneEditMode) {
    return (
      <>
        {!isCollapsed && (
          <>
            <ScrollArea type="always" className="flex-1 min-h-0">
              <EditModePanel />
            </ScrollArea>
            {selectedObject instanceof FabricImage && (
              <ImageEraserDialog
                open={showImageEraser}
                onOpenChange={setShowImageEraser}
                image={selectedObject}
                onComplete={() => {
                  setShowImageEraser(false);
                  canvas?.requestRenderAll();
                }}
              />
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* Static Header */}
          <div className="p-4 border-b border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Properties</h3>
              {selectedObject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePin}
                  className={`h-8 gap-1.5 border-blue-600 text-blue-600 hover:bg-blue-50 ${isPinned ? 'bg-blue-50' : ''}`}
                >
                  {isPinned ? (
                    <>
                      <PushPinIcon style={{ width: 16, height: 16 }} weight="fill" />
                      Pinned
                    </>
                  ) : (
                    <>
                      <PushPinSlashIcon style={{ width: 16, height: 16 }} weight="regular" />
                      Pin Object
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Tabs - Show when object is selected OR when line tool is active */}
            {(selectedObject ||
              activeTool === 'pen' ||
              activeTool === 'freeform-line' ||
              activeTool?.startsWith('straight-line') ||
              activeTool?.startsWith('curved-line') ||
              activeTool?.startsWith('orthogonal-line') ||
              activeTool?.startsWith('bezier')) && (
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  className={`flex-1 h-8 text-xs rounded-md transition-all flex items-center justify-center gap-1 font-medium ${
                    activeTab === 'style'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setActiveTab('style')}
                >
                  Style
                </button>
                <button
                  className={`flex-1 h-8 text-xs rounded-md transition-all flex items-center justify-center gap-1 font-medium ${
                    activeTab === 'transform'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setActiveTab('transform')}
                >
                  Transform
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Content */}
          <ScrollArea type="always" className="flex-1">
            {/* Show CommentsSection at the top when comment tool is active or a comment is selected,
                even when an object is selected (since the diagram tab won't be visible) */}
            {selectedObject && (activeTool === 'comment' || selectedCommentId) && projectId && onSelectComment && (
              <CommentsSection
                projectId={projectId}
                projectOwnerId={projectOwnerId}
                onSelectComment={onSelectComment}
                showComments={showComments}
                onToggleComments={onToggleComments}
              />
            )}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >

              {/* DIAGRAM TAB - Shown when no object selected */}
              {!selectedObject && (
                <TabsContent value="diagram" className="space-y-0 mt-0">
                  {projectId && onSelectComment && (
                    <CommentsSection
                      projectId={projectId}
                      projectOwnerId={projectOwnerId}
                      onSelectComment={onSelectComment}
                      showComments={showComments}
                      onToggleComments={onToggleComments}
                    />
                  )}
                  <DiagramSettingsSection
                    backgroundColor={backgroundColor}
                    setBackgroundColor={setBackgroundColor}
                    backgroundGradient={backgroundGradient}
                    setBackgroundGradient={setBackgroundGradient}
                    gradientStartColor={gradientStartColor}
                    setGradientStartColor={setGradientStartColor}
                    gradientEndColor={gradientEndColor}
                    setGradientEndColor={setGradientEndColor}
                    gradientType={gradientType}
                    setGradientType={setGradientType}
                    gradientAngle={gradientAngle}
                    setGradientAngle={setGradientAngle}
                    gradientCenterX={gradientCenterX}
                    setGradientCenterX={setGradientCenterX}
                    gradientCenterY={gradientCenterY}
                    setGradientCenterY={setGradientCenterY}
                    gradientRadius={gradientRadius}
                    setGradientRadius={setGradientRadius}
                    paperSize={paperSize}
                    setPaperSize={handlePaperSizeChange}
                    canvasDimensions={canvasDimensions}
                    setCanvasDimensions={handleCanvasDimensionsChange}
                    customDimensions={customDimensions}
                    setCustomDimensions={setCustomDimensions}
                    showBgColor={showBgColor}
                    setShowBgColor={setShowBgColor}
                  />
                </TabsContent>
              )}

              {/* STYLE TAB - Visual styling for all/most objects OR when line tool is active */}
              {(selectedObject ||
                activeTool === 'pen' ||
                activeTool === 'freeform-line' ||
                activeTool?.startsWith('straight-line') ||
                activeTool?.startsWith('curved-line') ||
                activeTool?.startsWith('orthogonal-line') ||
                activeTool?.startsWith('bezier')) && (
                <TabsContent value="style" className="space-y-0 mt-0">
                  {selectedObject && <StylePresets />}

                  {/* ========== TOOL-SPECIFIC SECTIONS WITH ICONS (shown first when applicable) ========== */}

                  {/* Membrane Properties */}
                  {selectedObject && ((selectedObject as any).isMembrane || (selectedObject as any).isMembraneShape) && !(selectedObject as any).isTripleMembrane && (
                    <MembranePropertiesPanel membrane={selectedObject as any} />
                  )}

                  {/* Triple Membrane Properties */}
                  {selectedObject && (selectedObject as any).isTripleMembrane && (
                    <TripleMembranePropertiesPanel membrane={selectedObject as any} />
                  )}

                  {/* DNA Helix Properties */}
                  {selectedObject && (selectedObject as any).isDNAHelix && (
                    <DNAHelixPropertiesPanel helix={selectedObject as any} />
                  )}

                  {/* Text Box Properties */}
                  {isTextBox(selectedObject) && (
                    <TextBoxPropertiesSection
                      selectedObject={selectedObject}
                      canvas={canvas}
                    />
                  )}

                  {/* Chart Properties */}
                  {isChart(selectedObject) && (
                    <ChartPropertiesSection
                      selectedObject={selectedObject}
                      canvas={canvas}
                    />
                  )}

                  {/* Table Properties */}
                  {(selectedObject as any)?.customType === 'table' && (
                    <TableConfigPanel
                      canvas={canvas}
                      selectedObject={selectedObject}
                      saveState={saveState}
                    />
                  )}

                  {/* Eraser Controls - Only when eraser tool active */}
                  {activeTool === "eraser" && (
                    <EraserControlsSection
                      eraserWidth={eraserWidth}
                      handleEraserWidthChange={handleEraserWidthChange}
                    />
                  )}

                  {/* ========== IMAGE SECTIONS WITH ICONS ========== */}

                  {/* Shape Masking - Only for standalone shapes */}
                  {isStandaloneShape(selectedObject) &&
                    !isMaskedImageGroup(selectedObject) && (
                      <ShapeMaskingSection
                        selectedObject={selectedObject}
                        canvas={canvas}
                      />
                    )}

                  {/* Masked Image Panel */}
                  {((selectedObject && isMaskedImageGroup(selectedObject)) || (isImageEditMode && imageEditModeRef.current)) && (
                    <ImageMaskPanel group={(isImageEditMode && imageEditModeRef.current ? imageEditModeRef.current : selectedObject) as any} />
                  )}

                  {/* Reference Guide info */}
                  {selectedObject && (selectedObject as any).isReferenceGuide && (
                    <div className="px-3 py-2 space-y-2 border-b">
                      <p className="text-xs text-muted-foreground">
                        This is a pinned reference guide (40% opacity). Resize or reposition it, then draw over it.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => {
                          if (canvas && selectedObject) {
                            canvas.remove(selectedObject);
                            canvas.discardActiveObject();
                            canvas.requestRenderAll();
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Remove Reference
                      </Button>
                    </div>
                  )}

                  {/* Image Properties - Only for images (excluding membranes and reference guides) */}
                  {selectedObject && (selectedObject.type === "image" ||
                    selectedObject instanceof FabricImage) &&
                    !(selectedObject as any).isMembraneShape &&
                    !(selectedObject as any).isRasterizedMembrane &&
                    !(selectedObject as any).isTripleMembrane &&
                    !(selectedObject as any).isDNAHelix &&
                    !(selectedObject as any).isReferenceGuide && (
                    <ImagePropertiesSection
                      imageToneColor={imageToneColor}
                      imageToneOpacity={imageToneOpacity}
                      handleImageToneChange={handleImageToneChange}
                      handleImageToneOpacityChange={handleImageToneOpacityChange}
                      handleRemoveImageTone={handleRemoveImageTone}
                      setCropMode={setCropMode}
                      setShowImageEraser={setShowImageEraser}
                      onAutoRemoveBackground={handleAutoRemoveBackground}
                      isRemovingBackground={isRemovingBackground}
                      selectedObject={selectedObject as FabricImage}
                      resetCrop={resetCrop}
                      stickyOffset={HEADER_HEIGHT * 3}
                    />
                  )}

                  {/* Crop Section - For objects not covered by ImagePropertiesSection */}
                  {selectedObject &&
                    selectedObject.type !== 'activeSelection' &&
                    !isTextObject(selectedObject) &&
                    (
                      // Non-image objects (groups, paths, shapes)
                      !(selectedObject.type === "image" || selectedObject instanceof FabricImage) ||
                      // OR image-based special objects excluded from ImagePropertiesSection
                      (selectedObject as any).isMembraneShape ||
                      (selectedObject as any).isRasterizedMembrane ||
                      (selectedObject as any).isTripleMembrane ||
                      (selectedObject as any).isDNAHelix
                    ) && (
                    <CropSection
                      selectedObject={selectedObject}
                      setCropMode={setCropMode}
                      resetCrop={resetCrop}
                    />
                  )}

                  {/* ========== TEXT SECTIONS WITH ICONS ========== */}

                  {/* Text Properties */}
                  {isTextObject(selectedObject) && (
                    <TextPropertiesSection
                      textFont={textFont}
                      textSize={textSize}
                      textColor={textColor}
                      onFontChange={handleFontChange}
                      onSizeChange={handleTextSizeChange}
                      onColorChange={handleTextColorChange}
                      recentColors={recentColors}
                    />
                  )}

                  {/* ========== LINE SECTIONS WITH ICONS ========== */}

                  {/* Line Style - Show only when line object is selected */}
                  {isLineObject(selectedObject) && (
                    <LineStyleSection
                      lineType={lineStyleType}
                      startEndpoint={lineStartEndpoint}
                      endEndpoint={lineEndEndpoint}
                      strokeWidth={lineStrokeWidth}
                      dashPattern={lineDashPattern}
                      cornerStyle={lineCornerStyle}
                      anchorPointCount={(() => {
                        if (!selectedObject) return 2;
                        const obj = selectedObject as any;
                        // Check different line types for anchor point count
                        if (obj.bezierPoints?.length) return obj.bezierPoints.length;
                        if (obj.orthogonalLineLocalWaypoints?.length) return obj.orthogonalLineLocalWaypoints.length;
                        if (obj.orthogonalWorldPoints?.length) return obj.orthogonalWorldPoints.length;
                        if (obj.anchorPoints?.length) return obj.anchorPoints.length;
                        return 2; // Default for straight/curved lines
                      })()}
                      onLineTypeChange={handleLineTypeChange}
                      onStartEndpointChange={handleLineStartEndpointChange}
                      onEndEndpointChange={handleLineEndEndpointChange}
                      onStrokeWidthChange={handleLineStrokeWidthChange}
                      onDashPatternChange={handleLineDashPatternChange}
                      onCornerStyleChange={handleLineCornerStyleChange}
                    />
                  )}

                  {/* Line Connection - Show when line tool active or line selected (exclude freeform lines) */}
                  {((isLineObject(selectedObject) && !(selectedObject as any)?.isFreeformLine) ||
                    activeTool === 'pen' ||
                    activeTool?.startsWith('straight-line') ||
                    activeTool?.startsWith('curved-line') ||
                    activeTool?.startsWith('orthogonal-line') ||
                    activeTool?.startsWith('bezier')) && (() => {
                      const isLineSelected = isLineObject(selectedObject) && !(selectedObject as any)?.isFreeformLine;
                      const selectedLineAutoPathfinding = (selectedObject as any)?.autoPathfindingEnabled;

                      return (
                        <LineConnectionSection
                          smartConnectorsEnabled={smartConnectorsEnabled}
                          autoPathfindingEnabled={autoPathfindingEnabled}
                          onSmartConnectorsChange={setSmartConnectorsEnabled}
                          onAutoPathfindingChange={setAutoPathfindingEnabled}
                          // Per-line settings (when a line is selected)
                          isLineSelected={isLineSelected}
                          selectedLineAutoPathfinding={selectedLineAutoPathfinding}
                          selectedLineHasAttachments={
                            !!(selectedObject as any)?.startAttachment &&
                            !!(selectedObject as any)?.endAttachment
                          }
                          onSelectedLineAutoPathfindingChange={handleSelectedLineAutoPathfindingChange}
                        />
                      );
                    })()}

                  {/* Line Properties */}
                  {isLineObject(selectedObject) && (
                    <>
                      <LinePropertiesPanel />
                      <LineGradientPanel />
                      <LineIntersectionPanel />

                      {/* Line Smoothing Controls */}
                      {(selectedObject as any).isFreeformLine && (
                        <div id="section-line-smoothing" className="relative">
                          {/* Collapsible Header */}
                          <div
                            className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => toggleSection('section-line-smoothing')}
                          >
                            <div className="flex items-center gap-2">
                              <ScribbleIcon className="h-4 w-4 text-primary" />
                              <h3 className="text-xs font-semibold uppercase tracking-wider">
                                Line Smoothing
                              </h3>
                            </div>
                            {freeformLineCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-slate-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-600" />
                            )}
                          </div>

                          {/* Content */}
                          {!freeformLineCollapsed && (
                          <div className="px-3 pb-3 pt-3">
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium">
                                Smoothing: {smoothingStrength}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={smoothingStrength}
                                onChange={(e) =>
                                  handleSmoothingStrengthChange(
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full mt-1"
                              />
                            </div>
                          </div>
                          </div>
                          )}
                        </div>
                      )}

                      {/* Bezier Simplification */}
                      {isBezierPath(selectedObject) && (
                        <BezierSimplificationPanel
                          path={selectedObject as any}
                          canvas={canvas}
                        />
                      )}
                    </>
                  )}

                  {/* ========== ANNOTATION SECTIONS WITH ICONS ========== */}

                  {/* Bracket Properties */}
                  {isBracket(selectedObject) && (
                    <BracketPropertiesSection
                      selectedObject={selectedObject}
                      canvas={canvas}
                      bracketSize={bracketSize}
                      bracketGap={bracketGap}
                      setBracketSize={setBracketSize}
                      setBracketGap={setBracketGap}
                      stickyOffset={HEADER_HEIGHT * 3}
                    />
                  )}

                  {/* Leader Line Properties */}
                  {isLeaderLine(selectedObject) && (
                    <LeaderLinePropertiesSection
                      selectedObject={selectedObject}
                      canvas={canvas}
                      showLeaderLineArrow={showLeaderLineArrow}
                      setShowLeaderLineArrow={setShowLeaderLineArrow}
                      stickyOffset={HEADER_HEIGHT * 3}
                    />
                  )}

                  {/* Callout Legend Visibility */}
                  {isCallout(selectedObject) && (
                    <LegendVisibilitySection
                      canvas={canvas}
                      showLegend={showLegend}
                      setShowLegend={setShowLegend}
                    />
                  )}

                  {/* ========== GENERAL SECTIONS WITHOUT ICONS ========== */}

                  {/* Colors - No accordion (primary controls, always visible) */}
                  {selectedObject && (
                    <ColorsSection
                      selectedObject={selectedObject}
                      canvas={canvas}
                      recentColors={recentColors}
                      addToRecentColors={addToRecentColors}
                      stickyOffset={0}
                    />
                  )}

                  {/* Gradients - Accordion default open (secondary controls) */}
                  {selectedObject && <GradientsSection stickyOffset={HEADER_HEIGHT} />}

                  {/* Effects - Accordion default closed (advanced controls) */}
                  {/* Hide shadows for brackets - shadows can cause rendering issues with bracket geometry */}
                  {selectedObject && !isBracket(selectedObject) && (
                    <EffectsSection stickyOffset={HEADER_HEIGHT * 2} />
                  )}

                  {/* Icon Styling - Only for actual icons */}
                  {selectedObject && isIconGroup(selectedObject) && (
                    <IconStylingSection
                      iconToneColor={iconToneColor}
                      iconToneIntensity={iconToneIntensity}
                      handleIconToneChange={handleIconToneChange}
                      handleIconToneIntensityChange={
                        handleIconToneIntensityChange
                      }
                      handleRemoveIconTone={handleRemoveIconTone}
                    />
                  )}
                </TabsContent>
              )}

              {/* TRANSFORM TAB - Position, size, rotation, alignment */}
              {selectedObject && (
                <TabsContent value="transform" className="space-y-0 mt-0">
                  {/* Position - No accordion (primary controls) */}
                  <PositionSection
                    selectedObject={selectedObject}
                    position={position}
                    onPositionChange={handlePositionChange}
                    stickyOffset={0}
                  />

                  {/* Size - No accordion (primary controls) */}
                  <SizeSection
                    selectedObject={selectedObject}
                    size={size}
                    onSizeChange={handleSizeChange}
                    stickyOffset={HEADER_HEIGHT}
                  />

                  {/* Rotation - Accordion default open (secondary controls) */}
                  <RotationSection
                    selectedObject={selectedObject}
                    rotation={rotation}
                    setRotation={setRotation}
                    onRotate={handleRotate}
                    onFlipHorizontal={flipHorizontal}
                    onFlipVertical={flipVertical}
                    stickyOffset={HEADER_HEIGHT * 2}
                  />

                  {/* Alignment - Accordion default open (secondary controls) */}
                  <AlignmentSection
                    canvas={canvas}
                    onAlignLeft={alignLeft}
                    onAlignCenter={alignCenter}
                    onAlignRight={alignRight}
                    onAlignTop={alignTop}
                    onAlignMiddle={alignMiddle}
                    onAlignBottom={alignBottom}
                    stickyOffset={HEADER_HEIGHT * 3}
                  />

                  {/* Distribution - Accordion default closed (advanced) */}
                  <DistributionSection
                    canvas={canvas}
                    distributionSpacing={distributionSpacing}
                    setDistributionSpacing={setDistributionSpacing}
                    onDistributeHorizontally={distributeHorizontally}
                    onDistributeVertically={distributeVertically}
                    onMatchWidth={matchWidth}
                    onMatchHeight={matchHeight}
                    stickyOffset={HEADER_HEIGHT * 4}
                  />

                  {/* Layer Order - Accordion default closed (advanced) */}
                  <LayerOrderSection
                    selectedObject={selectedObject}
                    onBringToFront={bringToFront}
                    onSendToBack={sendToBack}
                    onBringForward={bringForward}
                    onSendBackward={sendBackward}
                    stickyOffset={HEADER_HEIGHT * 5}
                  />
                </TabsContent>
              )}

            </Tabs>
          </ScrollArea>

          {selectedObject instanceof FabricImage && (
            <ImageEraserDialog
              open={showImageEraser}
              onOpenChange={setShowImageEraser}
              image={selectedObject}
              onComplete={() => {
                setShowImageEraser(false);
                canvas?.requestRenderAll();
              }}
            />
          )}
        </div>
      )}
    </>
  );
};
