import { useState, useEffect, useCallback, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricObject, Group } from "fabric";
import { Button } from "@/components/ui/button";
import { Check, X, Square, Circle, Pentagon, RectangleHorizontal, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CropMode } from "@/types/effects";
import { toast } from "sonner";
import { CropTestIds } from "@/lib/test-ids";

interface CropToolProps {
  canvas: FabricCanvas;
  selectedObject: FabricObject;
  cropMode: CropMode;
  onApply: (cropData: any) => void;
  onCancel: () => void;
}

interface PolygonPoint {
  x: number;
  y: number;
  id: string;
}

interface LightboxImage {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

export const CropTool = ({ canvas, selectedObject, cropMode: initialCropMode, onApply, onCancel }: CropToolProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropRect, setCropRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropMode, setCropMode] = useState<CropMode>(initialCropMode);

  // Lightbox image positioning
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string>("");

  // Freeform polygon state
  const [polygonPoints, setPolygonPoints] = useState<PolygonPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const [polygonDragStart, setPolygonDragStart] = useState({ x: 0, y: 0 });

  // Initialize crop mode from props
  useEffect(() => {
    setCropMode(initialCropMode);
  }, [initialCropMode]);

  // Initialize lightbox image and crop area
  useEffect(() => {
    if (!selectedObject || !canvas) return;

    const initializeLightbox = async () => {
      // Get image data URL — use stored original if available (flattened crop),
      // otherwise render the current object without its clipPath.
      let dataUrl = "";
      const obj = selectedObject as any;
      const originalDims = obj.cropConfig?.originalDimensions;

      if (obj.cropConfig?.originalDataUrl) {
        // Re-editing a flattened crop — use stored original image
        dataUrl = obj.cropConfig.originalDataUrl;
      } else {
        // First crop or clipPath-based crop — render without clipPath
        const hadClipPath = obj.clipPath;
        if (hadClipPath) {
          obj.clipPath = null;
          if (originalDims) {
            obj.set({
              width: originalDims.width,
              height: originalDims.height,
              scaleX: originalDims.scaleX,
              scaleY: originalDims.scaleY,
            });
          }
        }

        dataUrl = selectedObject.toDataURL({ format: 'png' });

        if (hadClipPath) {
          obj.clipPath = hadClipPath;
          if (originalDims) {
            canvas?.requestRenderAll();
          }
        }
      }

      setImageDataUrl(dataUrl);

      // Calculate lightbox image dimensions and position
      const CONTROL_PANEL_WIDTH = 280; // Space for controls on the right
      const PADDING = 40; // Padding around image

      const viewportWidth = window.innerWidth - CONTROL_PANEL_WIDTH - PADDING * 2;
      const viewportHeight = window.innerHeight - PADDING * 2;

      // Use original dimensions for bounds if editing a crop
      let bounds;
      if (originalDims) {
        // Calculate bounds based on original dimensions
        const width = originalDims.width * originalDims.scaleX;
        const height = originalDims.height * originalDims.scaleY;
        bounds = {
          left: obj.left - width / 2,
          top: obj.top - height / 2,
          width: width,
          height: height
        };
      } else {
        bounds = selectedObject.getBoundingRect();
      }
      const imageAspect = bounds.width / bounds.height;
      const viewportAspect = viewportWidth / viewportHeight;

      let displayWidth, displayHeight, scale;

      if (imageAspect > viewportAspect) {
        // Image is wider - fit to width
        displayWidth = viewportWidth;
        displayHeight = viewportWidth / imageAspect;
        scale = displayWidth / bounds.width;
      } else {
        // Image is taller - fit to height
        displayHeight = viewportHeight;
        displayWidth = viewportHeight * imageAspect;
        scale = displayHeight / bounds.height;
      }

      const left = PADDING + (viewportWidth - displayWidth) / 2;
      const top = (window.innerHeight - displayHeight) / 2;

      const lightbox: LightboxImage = {
        left,
        top,
        width: displayWidth,
        height: displayHeight,
        scale
      };

      setLightboxImage(lightbox);

      // Check if we're editing an existing crop (obj already declared above)
      const existingCrop = obj.cropConfig;

      // Initialize crop rectangle based on mode
      let initialCrop;

      // Validate that we have all required data for restoration
      const canRestoreCrop = existingCrop &&
                            existingCrop.clipPathData &&
                            originalDims &&
                            originalDims.width > 0 &&
                            originalDims.height > 0;

      if (canRestoreCrop) {
        // EDITING: Restore crop from stored clipPathData
        const clipData = existingCrop.clipPathData;
        const origWidth = originalDims.width;
        const origHeight = originalDims.height;

        if (clipData.type?.toLowerCase() === 'polygon' && cropMode === 'freeform' && Array.isArray(clipData.points)) {
          // Restore polygon points
          // Points are in local object coordinates, adjust from center-based to top-left-based
          const restoredPoints = clipData.points.map((p: any, idx: number) => {
            // Adjust by adding half dimensions
            const adjustedX = p.x + origWidth / 2;
            const adjustedY = p.y + origHeight / 2;
            // Convert from local coords to relative (0-1)
            const relX = adjustedX / origWidth;
            const relY = adjustedY / origHeight;
            // Convert to lightbox screen coordinates
            return {
              x: left + relX * displayWidth,
              y: top + relY * displayHeight,
              id: `p${idx + 1}`
            };
          });
          setPolygonPoints(restoredPoints);

          // Set initial crop to bounds for consistency
          initialCrop = {
            left: left,
            top: top,
            width: displayWidth,
            height: displayHeight
          };
        } else if (clipData.type?.toLowerCase() === 'rect' &&
                   typeof clipData.left === 'number' &&
                   typeof clipData.top === 'number' &&
                   typeof clipData.width === 'number' &&
                   typeof clipData.height === 'number') {
          // Restore rectangle/square crop
          // The clipPath coordinates are in object local space, which may be relative to center
          // Adjust by adding half dimensions to convert from center-based to top-left-based
          const adjustedLeft = clipData.left + origWidth / 2;
          const adjustedTop = clipData.top + origHeight / 2;

          const relX = adjustedLeft / origWidth;
          const relY = adjustedTop / origHeight;
          const relWidth = clipData.width / origWidth;
          const relHeight = clipData.height / origHeight;

          const restoredCrop = {
            left: left + relX * displayWidth,
            top: top + relY * displayHeight,
            width: relWidth * displayWidth,
            height: relHeight * displayHeight
          };

          // Validate the result
          if (isFinite(restoredCrop.left) && isFinite(restoredCrop.top) &&
              isFinite(restoredCrop.width) && isFinite(restoredCrop.height)) {
            initialCrop = restoredCrop;
          }
        } else if (clipData.type?.toLowerCase() === 'circle' &&
                   typeof clipData.radius === 'number' &&
                   clipData.radius > 0) {
          // Restore circle/ellipse crop
          // Circle uses center origin, so left/top are the center position relative to object center
          // Object dimensions at crop time were origWidth x origHeight
          // The clipPath center is offset from the object's center
          const clipLeft = clipData.left || 0;
          const clipTop = clipData.top || 0;
          const centerX = origWidth / 2 + clipLeft;
          const centerY = origHeight / 2 + clipTop;

          // Calculate radius in original dimensions
          const radiusX = clipData.radius;
          const radiusY = clipData.radius * (clipData.scaleY || 1);

          // Convert to relative coordinates
          const relCenterX = centerX / origWidth;
          const relCenterY = centerY / origHeight;
          const relRadiusX = radiusX / origWidth;
          const relRadiusY = radiusY / origHeight;

          // Convert to lightbox coordinates (top-left of bounding box)
          const lightboxCenterX = left + relCenterX * displayWidth;
          const lightboxCenterY = top + relCenterY * displayHeight;
          const lightboxRadiusX = relRadiusX * displayWidth;
          const lightboxRadiusY = relRadiusY * displayHeight;

          const restoredCrop = {
            left: lightboxCenterX - lightboxRadiusX,
            top: lightboxCenterY - lightboxRadiusY,
            width: lightboxRadiusX * 2,
            height: lightboxRadiusY * 2
          };

          // Validate the result
          if (isFinite(restoredCrop.left) && isFinite(restoredCrop.top) &&
              isFinite(restoredCrop.width) && isFinite(restoredCrop.height)) {
            initialCrop = restoredCrop;
          }
        }

        // If restoration failed or wasn't applicable, fall through to default initialization
        if (!initialCrop) {
          initialCrop = {
            left: left,
            top: top,
            width: displayWidth,
            height: displayHeight
          };
        }
      } else {
        // NEW CROP: Initialize based on mode
        if (cropMode === 'square' || cropMode === 'circle') {
          // Square/Circle: full height, width = height (1:1), centered horizontally
          const size = displayHeight;
          initialCrop = {
            left: left + (displayWidth - size) / 2,
            top: top,
            width: size,
            height: size
          };
        } else {
          // Rectangle, Ellipse, Free-form: full width and height
          initialCrop = {
            left: left,
            top: top,
            width: displayWidth,
            height: displayHeight
          };
        }

        // Initialize polygon for freeform mode (new crop only)
        if (cropMode === 'freeform') {
          initializePolygon(initialCrop);
        }
      }

      setCropRect(initialCrop);
    };

    initializeLightbox();
  }, [selectedObject, canvas, cropMode]);

  // Initialize default 4-point polygon at image corners
  const initializePolygon = useCallback((bounds: typeof cropRect) => {
    setPolygonPoints([
      { x: bounds.left, y: bounds.top, id: 'p1' },
      { x: bounds.left + bounds.width, y: bounds.top, id: 'p2' },
      { x: bounds.left + bounds.width, y: bounds.top + bounds.height, id: 'p3' },
      { x: bounds.left, y: bounds.top + bounds.height, id: 'p4' },
    ]);
  }, []);

  const switchMode = useCallback((newMode: CropMode) => {
    setCropMode(newMode);
    if (newMode === 'freeform' && lightboxImage) {
      initializePolygon(cropRect);
    }
  }, [lightboxImage, cropRect, initializePolygon]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setResizeHandle(handle || null);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isDraggingPoint && !isDraggingPolygon) return;
    if (!lightboxImage) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const imageBounds = {
      left: lightboxImage.left,
      top: lightboxImage.top,
      width: lightboxImage.width,
      height: lightboxImage.height
    };

    if (isDraggingPoint && selectedPointId) {
      // Handle polygon point dragging
      const newX = Math.max(imageBounds.left, Math.min(e.clientX, imageBounds.left + imageBounds.width));
      const newY = Math.max(imageBounds.top, Math.min(e.clientY, imageBounds.top + imageBounds.height));

      setPolygonPoints(prev =>
        prev.map(p => p.id === selectedPointId ? { ...p, x: newX, y: newY } : p)
      );
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isDraggingPolygon) {
      // Handle dragging the entire polygon
      const deltaX = e.clientX - polygonDragStart.x;
      const deltaY = e.clientY - polygonDragStart.y;

      // Check if all points would be within bounds
      const canMove = polygonPoints.every(p => {
        const newX = p.x + deltaX;
        const newY = p.y + deltaY;
        return newX >= imageBounds.left && newX <= imageBounds.left + imageBounds.width &&
               newY >= imageBounds.top && newY <= imageBounds.top + imageBounds.height;
      });

      if (canMove) {
        setPolygonPoints(prev =>
          prev.map(p => ({ ...p, x: p.x + deltaX, y: p.y + deltaY }))
        );
        setPolygonDragStart({ x: e.clientX, y: e.clientY });
      }
    } else if (isDragging) {
      // Handle rect/circle dragging/resizing
      setCropRect(prev => {
        let newRect = { ...prev };

        if (resizeHandle) {
          // Resizing
          let width = prev.width;
          let height = prev.height;
          let left = prev.left;
          let top = prev.top;

          switch (resizeHandle) {
            case 'tl':
              left = Math.max(imageBounds.left, Math.min(prev.left + deltaX, prev.left + prev.width - 10));
              top = Math.max(imageBounds.top, Math.min(prev.top + deltaY, prev.top + prev.height - 10));
              width = Math.max(10, prev.width - deltaX);
              height = Math.max(10, prev.height - deltaY);
              break;
            case 'tr':
              top = Math.max(imageBounds.top, Math.min(prev.top + deltaY, prev.top + prev.height - 10));
              width = Math.max(10, Math.min(prev.width + deltaX, imageBounds.left + imageBounds.width - prev.left));
              height = Math.max(10, prev.height - deltaY);
              break;
            case 'bl':
              left = Math.max(imageBounds.left, Math.min(prev.left + deltaX, prev.left + prev.width - 10));
              width = Math.max(10, prev.width - deltaX);
              height = Math.max(10, Math.min(prev.height + deltaY, imageBounds.top + imageBounds.height - prev.top));
              break;
            case 'br':
              width = Math.max(10, Math.min(prev.width + deltaX, imageBounds.left + imageBounds.width - prev.left));
              height = Math.max(10, Math.min(prev.height + deltaY, imageBounds.top + imageBounds.height - prev.top));
              break;
            case 't':
              top = Math.max(imageBounds.top, Math.min(prev.top + deltaY, prev.top + prev.height - 10));
              height = Math.max(10, prev.height - deltaY);
              break;
            case 'r':
              width = Math.max(10, Math.min(prev.width + deltaX, imageBounds.left + imageBounds.width - prev.left));
              break;
            case 'b':
              height = Math.max(10, Math.min(prev.height + deltaY, imageBounds.top + imageBounds.height - prev.top));
              break;
            case 'l':
              left = Math.max(imageBounds.left, Math.min(prev.left + deltaX, prev.left + prev.width - 10));
              width = Math.max(10, prev.width - deltaX);
              break;
          }

          // Apply aspect lock for square and circle modes (always 1:1)
          if (cropMode === 'square' || cropMode === 'circle') {
            // Constrain to 1:1 aspect ratio
            if (resizeHandle === 'tl' || resizeHandle === 'tr' || resizeHandle === 'bl' || resizeHandle === 'br') {
              const size = Math.min(width, height);
              width = size;
              height = size;

              // Adjust position based on handle
              if (resizeHandle === 'tl') {
                left = prev.left + prev.width - width;
                top = prev.top + prev.height - height;
              } else if (resizeHandle === 'tr') {
                top = prev.top + prev.height - height;
              } else if (resizeHandle === 'bl') {
                left = prev.left + prev.width - width;
              }
            }
          }

          newRect = { left, top, width, height };
        } else {
          // Dragging
          newRect = {
            left: Math.max(imageBounds.left, Math.min(prev.left + deltaX, imageBounds.left + imageBounds.width - prev.width)),
            top: Math.max(imageBounds.top, Math.min(prev.top + deltaY, imageBounds.top + imageBounds.height - prev.height)),
            width: prev.width,
            height: prev.height
          };
        }

        return newRect;
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, isDraggingPoint, isDraggingPolygon, selectedPointId, resizeHandle, dragStart, polygonDragStart, lightboxImage, cropMode, polygonPoints]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingPoint(false);
    setIsDraggingPolygon(false);
    setResizeHandle(null);
    // Don't clear selectedPointId on mouse up - keep point selected
  }, []);

  useEffect(() => {
    if (isDragging || isDraggingPoint || isDraggingPolygon) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isDraggingPoint, isDraggingPolygon, handleMouseMove, handleMouseUp]);

  const handlePointMouseDown = useCallback((pointId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPointId(pointId);
    setIsDraggingPoint(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleEdgeClick = useCallback((edgeIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const x = e.clientX;
    const y = e.clientY;
    const newPoint: PolygonPoint = { x, y, id: `p-${Date.now()}` };

    setPolygonPoints(prev => {
      const updated = [...prev];
      updated.splice(edgeIndex + 1, 0, newPoint);
      return updated;
    });
  }, []);

  const handleDeletePoint = useCallback((pointId?: string) => {
    const idToDelete = pointId || selectedPointId;
    if (!idToDelete) return;

    if (polygonPoints.length <= 3) {
      toast.error("Minimum 3 points required");
      return;
    }
    setPolygonPoints(prev => prev.filter(p => p.id !== idToDelete));
    setSelectedPointId(null);
  }, [polygonPoints.length, selectedPointId]);

  const handlePolygonMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPolygon(true);
    setPolygonDragStart({ x: e.clientX, y: e.clientY });
    setSelectedPointId(null); // Deselect point when dragging polygon
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedPointId && cropMode === 'freeform') {
        e.preventDefault();
        handleDeletePoint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointId, cropMode, handleDeletePoint]);

  const handleApply = () => {
    if (!lightboxImage) return;

    // Convert lightbox coords back to canvas coordinates
    const canvasEl = canvas.getElement();
    const rect = canvasEl.getBoundingClientRect();
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const bounds = selectedObject.getBoundingRect();

    let cropData;

    if (cropMode === 'freeform') {
      // Convert polygon points from lightbox to canvas coords
      const canvasPoints = polygonPoints.map(p => {
        // Convert from lightbox screen coords to relative coords within lightbox image
        const relX = (p.x - lightboxImage.left) / lightboxImage.width;
        const relY = (p.y - lightboxImage.top) / lightboxImage.height;

        // Convert to canvas coords
        return {
          x: bounds.left + relX * bounds.width,
          y: bounds.top + relY * bounds.height
        };
      });

      cropData = {
        mode: 'freeform',
        polygonPoints: canvasPoints
      };
    } else {
      // Convert crop rect from lightbox to canvas coords
      const relX = (cropRect.left - lightboxImage.left) / lightboxImage.width;
      const relY = (cropRect.top - lightboxImage.top) / lightboxImage.height;
      const relWidth = cropRect.width / lightboxImage.width;
      const relHeight = cropRect.height / lightboxImage.height;

      const canvasCropRect = {
        left: bounds.left + relX * bounds.width,
        top: bounds.top + relY * bounds.height,
        width: relWidth * bounds.width,
        height: relHeight * bounds.height
      };

      cropData = {
        mode: cropMode,
        rect: canvasCropRect,
        isCircular: cropMode === 'circle' || cropMode === 'ellipse'
      };
    }

    onApply(cropData);
  };

  const dimensions = cropMode === 'freeform'
    ? `${polygonPoints.length} points`
    : lightboxImage
      ? `${Math.round(cropRect.width / lightboxImage.scale)} × ${Math.round(cropRect.height / lightboxImage.scale)} px`
      : "";

  if (!lightboxImage) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      data-testid={CropTestIds.CROP_LIGHTBOX}
      className="fixed inset-0 z-50 bg-black"
      style={{ cursor: isDragging || isDraggingPoint ? 'grabbing' : 'default' }}
    >
      {/* Control panel - right side */}
      <div className="absolute right-4 top-4 bottom-4 w-64 flex flex-col gap-4 z-50 min-h-0">
        {/* Mode selector */}
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl">
          <h3 className="text-sm font-semibold mb-2 text-slate-900">Crop Mode</h3>
          <Select value={cropMode} onValueChange={(value) => switchMode(value as CropMode)}>
            <SelectTrigger data-testid={CropTestIds.CROP_MODE_SELECT} className="w-full">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {cropMode === 'rectangle' && <><RectangleHorizontal className="h-4 w-4" /> Rectangle</>}
                  {cropMode === 'square' && <><Square className="h-4 w-4" /> Square (1:1)</>}
                  {cropMode === 'ellipse' && <><Circle className="h-4 w-4" style={{ transform: 'scaleX(1.4)' }} /> Ellipse</>}
                  {cropMode === 'circle' && <><Circle className="h-4 w-4" /> Circle (1:1)</>}
                  {cropMode === 'freeform' && <><Pentagon className="h-4 w-4" /> Free-form</>}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rectangle">
                <div className="flex items-center gap-2">
                  <RectangleHorizontal className="h-4 w-4" />
                  <span>Rectangle</span>
                </div>
              </SelectItem>
              <SelectItem value="square">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4" />
                  <span>Square (1:1)</span>
                </div>
              </SelectItem>
              <SelectItem value="ellipse">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4" style={{ transform: 'scaleX(1.4)' }} />
                  <span>Ellipse</span>
                </div>
              </SelectItem>
              <SelectItem value="circle">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4" />
                  <span>Circle (1:1)</span>
                </div>
              </SelectItem>
              <SelectItem value="freeform">
                <div className="flex items-center gap-2">
                  <Pentagon className="h-4 w-4" />
                  <span>Free-form</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p data-testid={CropTestIds.CROP_DIMENSIONS} className="text-xs text-slate-600 mt-2">{dimensions}</p>
        </div>

        {/* Instructions */}
        <div
          className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl flex-1 flex flex-col"
          style={{ minHeight: cropMode === 'freeform' && selectedPointId ? '100px' : '60px' }}
        >
          <div className="flex-shrink-0">
            <h3 className="text-sm font-semibold mb-2 text-slate-900">Instructions</h3>

            {/* Delete button for selected point (freeform mode only) - at top */}
            {cropMode === 'freeform' && selectedPointId && (
              <Button
                data-testid={CropTestIds.DELETE_POINT_BUTTON}
                onClick={() => handleDeletePoint()}
                variant="destructive"
                size="sm"
                className="w-full mb-3"
                disabled={polygonPoints.length <= 3}
                title={polygonPoints.length <= 3 ? "Minimum 3 points required" : ""}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected Point
                {polygonPoints.length <= 3 && <span className="ml-1 text-xs">(min 3)</span>}
              </Button>
            )}
          </div>

          {/* Scrollable instructions content */}
          <div className="text-xs text-slate-600 space-y-2 overflow-y-auto flex-1 min-h-0">
            {cropMode === 'freeform' ? (
              <>
                <p>• Drag anchor points to adjust shape</p>
                <p>• Drag inside polygon to move it</p>
                <p>• Click edges to add new points</p>
                <p>• Select point and click delete to remove</p>
                <p>• Minimum 3 points required</p>
              </>
            ) : (
              <>
                <p>• Drag corners to resize</p>
                <p>• Drag center to move</p>
                {(cropMode === 'square' || cropMode === 'circle') && <p>• Aspect ratio locked to 1:1</p>}
                {(cropMode === 'rectangle' || cropMode === 'ellipse') && <p>• Free aspect ratio</p>}
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 flex-shrink-0">
          <Button
            data-testid={CropTestIds.APPLY_CROP_BUTTON}
            onClick={handleApply}
            size="lg"
            className="w-full shadow-lg"
          >
            <Check className="h-4 w-4 mr-2" />
            Apply Crop
          </Button>
          <Button
            data-testid={CropTestIds.CANCEL_CROP_BUTTON}
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="w-full shadow-lg"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Image display */}
      <img
        ref={imageRef}
        src={imageDataUrl}
        alt="Crop preview"
        className="absolute"
        style={{
          left: lightboxImage.left,
          top: lightboxImage.top,
          width: lightboxImage.width,
          height: lightboxImage.height,
          objectFit: 'contain',
          pointerEvents: 'none'
        }}
      />

      {/* Crop overlay */}
      {cropMode === 'freeform' ? (
        /* Freeform polygon mode */
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100vw', height: '100vh' }}
        >
          {/* Dark overlay with polygon cutout */}
          <defs>
            <mask id="crop-mask">
              <rect width="100%" height="100%" fill="white" />
              <polygon
                points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#crop-mask)"
          />

          {/* Polygon fill area (draggable to move entire polygon) */}
          <polygon
            points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="none"
            className="pointer-events-auto cursor-move"
            onMouseDown={(e) => handlePolygonMouseDown(e as any)}
          />

          {/* Polygon border */}
          <polygon
            points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Edge lines (clickable to add points) */}
          {polygonPoints.map((point, i) => {
            const nextPoint = polygonPoints[(i + 1) % polygonPoints.length];
            return (
              <line
                key={`edge-${i}`}
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                stroke="transparent"
                strokeWidth="10"
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => handleEdgeClick(i, e as any)}
              />
            );
          })}

          {/* Anchor points */}
          {polygonPoints.map((point) => (
            <circle
              key={point.id}
              data-testid={`${CropTestIds.POLYGON_POINT}-${point.id}`}
              cx={point.x}
              cy={point.y}
              r="8"
              fill={selectedPointId === point.id ? '#f97316' : '#ffffff'}
              stroke={selectedPointId === point.id ? '#f97316' : '#3b82f6'}
              strokeWidth="2"
              className="pointer-events-auto cursor-move"
              onMouseDown={(e) => handlePointMouseDown(point.id, e as any)}
              style={{ cursor: 'move' }}
            />
          ))}
        </svg>
      ) : (cropMode === 'circle' || cropMode === 'ellipse') ? (
        /* Circle/Ellipse mode with SVG mask */
        <>
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100vw', height: '100vh' }}
          >
            {/* Dark overlay with circular/elliptical cutout */}
            <defs>
              <mask id="circle-mask">
                <rect width="100%" height="100%" fill="white" />
                <ellipse
                  cx={cropRect.left + cropRect.width / 2}
                  cy={cropRect.top + cropRect.height / 2}
                  rx={cropRect.width / 2}
                  ry={cropRect.height / 2}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#circle-mask)"
            />

            {/* Crop border */}
            <ellipse
              cx={cropRect.left + cropRect.width / 2}
              cy={cropRect.top + cropRect.height / 2}
              rx={cropRect.width / 2}
              ry={cropRect.height / 2}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            />
          </svg>

          {/* Draggable area for moving */}
          <div
            className="absolute"
            style={{
              left: cropRect.left,
              top: cropRect.top,
              width: cropRect.width,
              height: cropRect.height,
              cursor: 'move',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => handleMouseDown(e)}
          />

          {/* Corner handles */}
          {['tl', 'tr', 'bl', 'br'].map(handle => (
            <div
              key={handle}
              data-testid={`crop-handle-${handle}`}
              className="absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg"
              style={{
                left: cropRect.left + (handle.includes('l') ? -8 : cropRect.width - 8),
                top: cropRect.top + (handle.includes('t') ? -8 : cropRect.height - 8),
                cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`
              }}
              onMouseDown={(e) => handleMouseDown(e, handle)}
            />
          ))}
        </>
      ) : (
        /* Rectangle/Square mode */
        <>
          {/* Dark overlay outside crop area */}
          <div
            className="absolute"
            style={{
              left: cropRect.left,
              top: cropRect.top,
              width: cropRect.width,
              height: cropRect.height,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none'
            }}
          />

          {/* Crop border */}
          <div
            data-testid="crop-border-rect"
            className="absolute border-2 border-primary"
            style={{
              left: cropRect.left,
              top: cropRect.top,
              width: cropRect.width,
              height: cropRect.height,
              cursor: 'move'
            }}
            onMouseDown={(e) => handleMouseDown(e)}
          >
            {/* Corner handles */}
            {['tl', 'tr', 'bl', 'br'].map(handle => (
              <div
                key={handle}
                data-testid={`crop-handle-${handle}`}
                className="absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg"
                style={{
                  ...(handle.includes('t') ? { top: -8 } : { bottom: -8 }),
                  ...(handle.includes('l') ? { left: -8 } : { right: -8 }),
                  cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`
                }}
                onMouseDown={(e) => handleMouseDown(e, handle)}
              />
            ))}

            {/* Edge handles */}
            {['t', 'r', 'b', 'l'].map(handle => (
              <div
                key={handle}
                className="absolute bg-primary shadow-lg"
                style={{
                  ...(handle === 't' || handle === 'b'
                    ? {
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 24,
                        height: 10,
                        ...(handle === 't' ? { top: -5 } : { bottom: -5 }),
                        cursor: 'ns-resize',
                        borderRadius: '0 0 4px 4px'
                      }
                    : {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 10,
                        height: 24,
                        ...(handle === 'l' ? { left: -5 } : { right: -5 }),
                        cursor: 'ew-resize',
                        borderRadius: '0 4px 4px 0'
                      }
                  )
                }}
                onMouseDown={(e) => handleMouseDown(e, handle)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
