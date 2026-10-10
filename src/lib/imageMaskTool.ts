import {
  Canvas,
  FabricImage,
  FabricObject,
  Group,
  Circle,
  Rect,
  Polygon,
  Ellipse,
  util,
} from "fabric";
import { toast } from "sonner";
import { MaskShape } from "@/types/imageMask";
import { loadImageWithCORS } from "./utils";

/**
 * Read a File as a portable data URL (base64-encoded).
 * Unlike URL.createObjectURL(), data URLs work across browser contexts
 * and survive serialization for real-time sync and project saves.
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Create a masked image from a shape and an image file
 * @param canvas - The Fabric canvas
 * @param shape - The selected shape to use as mask
 * @param imageFile - The image file to load
 * @returns The masked image group, or null if creation failed
 */
export async function createMaskedImage(
  canvas: Canvas,
  shape: FabricObject,
  imageFile: File
): Promise<Group | null> {
  try {
    // Load the image as a data URL (portable across browser contexts for sync)
    const imageUrl = await readFileAsDataURL(imageFile);
    const image = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });

    // Get shape bounds
    const shapeBounds = shape.getBoundingRect();

    // Calculate scale to fit image within shape bounds (cover mode)
    const scaleX = shapeBounds.width / (image.width || 1);
    const scaleY = shapeBounds.height / (image.height || 1);
    const scale = Math.max(scaleX, scaleY);

    // Position image to center within shape
    image.set({
      left: 0,
      top: 0,
      scaleX: scale,
      scaleY: scale,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    // Create clipPath from shape
    const clipPath = createClipPathFromShape(shape);
    if (!clipPath) {
      toast.error("Could not create mask from this shape");
      return null;
    }

    // Create group with image
    const group = new Group([image], {
      left: shapeBounds.left + shapeBounds.width / 2,
      top: shapeBounds.top + shapeBounds.height / 2,
      originX: "center",
      originY: "center",
      clipPath: clipPath,
    });

    // Add metadata
    (group as any).isMaskedImage = true;
    (group as any).maskShape = detectMaskShape(shape);
    (group as any).isEditingImage = false;

    // Store corner radius if rounded rectangle
    if (shape.type === "rect" && (shape as any).rx) {
      (group as any).cornerRadius = (shape as any).rx;
    }

    return group;
  } catch (error) {
    console.error("Error creating masked image:", error);
    toast.error("Failed to load image");
    return null;
  }
}

/**
 * Create a clipPath from a shape's geometry
 */
function createClipPathFromShape(shape: FabricObject): FabricObject | null {
  const bounds = shape.getBoundingRect();
  const width = bounds.width;
  const height = bounds.height;

  switch (shape.type) {
    case "circle": {
      const circle = shape as Circle;
      return new Circle({
        radius: circle.radius || Math.min(width, height) / 2,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });
    }

    case "ellipse": {
      const ellipse = shape as Ellipse;
      return new Ellipse({
        rx: ellipse.rx || width / 2,
        ry: ellipse.ry || height / 2,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });
    }

    case "rect": {
      const rect = shape as Rect;
      return new Rect({
        width: rect.width || width,
        height: rect.height || height,
        rx: (rect as any).rx || 0,
        ry: (rect as any).ry || 0,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });
    }

    case "polygon": {
      const polygon = shape as Polygon;
      const points = polygon.points;
      if (!points) return null;

      // Create a copy of the points for the clipPath
      const clipPoints = points.map((p) => ({ x: p.x, y: p.y }));

      return new Polygon(clipPoints, {
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });
    }

    default:
      // For complex shapes, try to use the shape itself as clipPath
      console.warn("Unsupported shape type for masking:", shape.type);
      return null;
  }
}

/**
 * Detect the mask shape type from a Fabric object
 */
function detectMaskShape(shape: FabricObject): MaskShape {
  switch (shape.type) {
    case "circle":
      return "circle";
    case "ellipse":
      return "ellipse";
    case "rect":
      if ((shape as any).rx && (shape as any).rx > 0) {
        return "roundedRect";
      }
      return "rect";
    case "polygon":
      return "polygon";
    default:
      return "custom";
  }
}

/**
 * Enter image edit mode - allows editing the image within the mask
 */
export function enterImageEditMode(
  canvas: Canvas,
  group: Group,
  setIsImageEditMode: (val: boolean) => void
): void {
  if (!canvas || !(group as any).isMaskedImage) {
    console.error("Cannot enter edit mode: invalid group");
    return;
  }
  // Get the image from the group
  const image = group.getObjects()[0] as FabricImage;
  if (!image) {
    console.error("No image found in group");
    toast.error("No image found in mask");
    return;
  }

  try {
    // Mark as editing
    (group as any).isEditingImage = true;

    // Store original clipPath AND group transform
    (group as any).originalClipPath = group.clipPath;
    (group as any).originalGroupTransform = {
      left: group.left,
      top: group.top,
      scaleX: group.scaleX || 1,
      scaleY: group.scaleY || 1,
      angle: group.angle || 0,
    };

    // Calculate absolute position of the image BEFORE removing it
    // The image position is relative to the group, so we just need to add group's position
    // since both have originX/Y center and the image is at (0,0) in the group
    const imageAbsolutePosition = {
      left: group.left,
      top: group.top,
      scaleX: image.scaleX! * (group.scaleX || 1),
      scaleY: image.scaleY! * (group.scaleY || 1),
      angle: (image.angle || 0) + (group.angle || 0),
    };
    // Extract image from group first
    group.remove(image);

    // Position image at absolute coordinates
    image.set({
      left: imageAbsolutePosition.left,
      top: imageAbsolutePosition.top,
      scaleX: imageAbsolutePosition.scaleX,
      scaleY: imageAbsolutePosition.scaleY,
      angle: imageAbsolutePosition.angle,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
    });

    // Hide the now-empty group
    group.set({
      visible: false,
      selectable: false,
      evented: false,
    });

    // Add image to canvas FIRST
    canvas.add(image);
    (group as any).extractedImage = image;

    // Create and add visual indicator of mask boundary AFTER image so it's on top
    if (group.clipPath) {
      const clipPath = group.clipPath;
      let maskIndicator: FabricObject | null = null;

      // Recreate the shape based on clipPath type
      switch (clipPath.type) {
        case "circle": {
          const c = clipPath as Circle;
          maskIndicator = new Circle({
            radius: c.radius,
            left: group.left,
            top: group.top,
            scaleX: group.scaleX,
            scaleY: group.scaleY,
            angle: group.angle,
            fill: 'rgba(59, 130, 246, 0.15)',
            stroke: '#3B82F6',
            strokeWidth: 3,
            strokeDashArray: [10, 5],
            opacity: 1,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
          });
          break;
        }
        case "ellipse": {
          const e = clipPath as Ellipse;
          maskIndicator = new Ellipse({
            rx: e.rx,
            ry: e.ry,
            left: group.left,
            top: group.top,
            scaleX: group.scaleX,
            scaleY: group.scaleY,
            angle: group.angle,
            fill: 'rgba(59, 130, 246, 0.15)',
            stroke: '#3B82F6',
            strokeWidth: 3,
            strokeDashArray: [10, 5],
            opacity: 1,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
          });
          break;
        }
        case "rect": {
          const r = clipPath as Rect;
          maskIndicator = new Rect({
            width: r.width,
            height: r.height,
            rx: (r as any).rx || 0,
            ry: (r as any).ry || 0,
            left: group.left,
            top: group.top,
            scaleX: group.scaleX,
            scaleY: group.scaleY,
            angle: group.angle,
            fill: 'rgba(59, 130, 246, 0.15)',
            stroke: '#3B82F6',
            strokeWidth: 3,
            strokeDashArray: [10, 5],
            opacity: 1,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
          });
          break;
        }
        case "polygon": {
          const p = clipPath as Polygon;
          const points = p.points?.map((pt) => ({ x: pt.x, y: pt.y }));
          if (points) {
            maskIndicator = new Polygon(points, {
              left: group.left,
              top: group.top,
              scaleX: group.scaleX,
              scaleY: group.scaleY,
              angle: group.angle,
              fill: 'rgba(59, 130, 246, 0.15)',
              stroke: '#3B82F6',
              strokeWidth: 3,
              strokeDashArray: [10, 5],
              opacity: 1,
              selectable: false,
              evented: false,
              originX: 'center',
              originY: 'center',
            });
          }
          break;
        }
      }

      // Add mask indicator AFTER image so it renders on top
      if (maskIndicator) {
        canvas.add(maskIndicator);
        (group as any).maskIndicator = maskIndicator;
      }
    }

    // Update state and select image
    setIsImageEditMode(true);
    canvas.setActiveObject(image);

    // Ensure mask indicator stays on top after selection
    const maskIndicator = (group as any).maskIndicator;
    if (maskIndicator) {
      canvas.bringObjectToFront(maskIndicator);

      // Keep mask indicator on top during image manipulation
      const keepMaskOnTop = () => {
        canvas.bringObjectToFront(maskIndicator);
        canvas.requestRenderAll();
      };

      // Listen to image manipulation events
      image.on('moving', keepMaskOnTop);
      image.on('scaling', keepMaskOnTop);
      image.on('rotating', keepMaskOnTop);
      image.on('modified', keepMaskOnTop);

      // Store event handlers for cleanup
      (group as any).maskIndicatorEvents = keepMaskOnTop;
    }

    canvas.requestRenderAll();
    toast.info("Move and scale the image. Press Escape or click Done when finished.");
  } catch (error) {
    console.error("Error entering image edit mode:", error);
    toast.error("Failed to enter edit mode");

    // Cleanup on error
    (group as any).isEditingImage = false;
    if ((group as any).maskIndicator) {
      canvas.remove((group as any).maskIndicator);
      delete (group as any).maskIndicator;
    }
  }
}

/**
 * Exit image edit mode - return to mask editing
 */
export function exitImageEditMode(
  canvas: Canvas,
  group: Group,
  setIsImageEditMode: (val: boolean) => void
): void {
  if (!canvas || !group) {
    console.error("Cannot exit image edit mode: missing canvas or group");
    return;
  }
  // Get the extracted image
  const image = (group as any).extractedImage as FabricImage;
  if (!image) {
    console.error("No extracted image found");
    return;
  }

  // Get the stored original group transform
  const originalGroupTransform = (group as any).originalGroupTransform || {
    left: group.left,
    top: group.top,
    scaleX: group.scaleX || 1,
    scaleY: group.scaleY || 1,
    angle: group.angle || 0,
  };

  // Get the image's current absolute position
  const imageAbsolutePosition = {
    left: image.left || 0,
    top: image.top || 0,
    scaleX: image.scaleX || 1,
    scaleY: image.scaleY || 1,
    angle: image.angle || 0,
  };
  // INVERSE APPROACH: Keep image at (0,0), move group to image position, offset the clipPath
  // This prevents the group from resizing to fit the image

  // Calculate the clipPath offset to act as a "window" into the image
  // The mask was at originalGroupTransform position, image is now at imageAbsolutePosition
  // ClipPath offset = where the mask should be relative to the image center
  const clipPathOffsetX = originalGroupTransform.left - imageAbsolutePosition.left;
  const clipPathOffsetY = originalGroupTransform.top - imageAbsolutePosition.top;
  // Remove image from canvas
  canvas.remove(image);

  // Keep image centered at (0, 0) in the group
  image.set({
    left: 0,
    top: 0,
    scaleX: imageAbsolutePosition.scaleX / originalGroupTransform.scaleX,
    scaleY: imageAbsolutePosition.scaleY / originalGroupTransform.scaleY,
    angle: imageAbsolutePosition.angle - originalGroupTransform.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  });

  // Add image back to group
  group.add(image);

  // Move the GROUP to where the IMAGE is (not the original mask position)
  group.set({
    left: imageAbsolutePosition.left,
    top: imageAbsolutePosition.top,
    scaleX: originalGroupTransform.scaleX,
    scaleY: originalGroupTransform.scaleY,
    angle: originalGroupTransform.angle,
  });
  // Force group to recalculate its bounding box and rendering
  group.setCoords();
  group.dirty = true;
  // Restore clipPath with offset to act as a "window" into the image
  if ((group as any).originalClipPath) {
    const clipPath = (group as any).originalClipPath;
    // Position the clipPath to act as a window at the mask's position
    // Offset it from the image center by the calculated amount
    clipPath.set({
      left: clipPathOffsetX,
      top: clipPathOffsetY,
      originX: 'center',
      originY: 'center',
    });
    group.set({ clipPath: clipPath });
  }

  // Clean up event listeners from image
  if ((group as any).maskIndicatorEvents) {
    const keepMaskOnTop = (group as any).maskIndicatorEvents;
    image.off('moving', keepMaskOnTop);
    image.off('scaling', keepMaskOnTop);
    image.off('rotating', keepMaskOnTop);
    image.off('modified', keepMaskOnTop);
    delete (group as any).maskIndicatorEvents;
  }

  // Remove mask indicator if exists
  if ((group as any).maskIndicator) {
    canvas.remove((group as any).maskIndicator);
    delete (group as any).maskIndicator;
  }

  // Make group visible and interactive again
  group.set({
    visible: true,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    isEditingImage: false,
  });
  group.setCoords();

  // Clean up stored references
  delete (group as any).extractedImage;
  delete (group as any).originalGroupTransform;

  // Update state BEFORE canvas operations
  setIsImageEditMode(false);

  // Select the group and ensure it renders
  canvas.discardActiveObject();
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  toast.success("Edit mode exited");
}

/**
 * Replace the image in a masked image group
 */
export async function replaceMaskImage(
  canvas: Canvas,
  group: Group,
  newImageFile: File
): Promise<void> {
  try {
    // Load new image as a data URL (portable across browser contexts for sync)
    const imageUrl = await readFileAsDataURL(newImageFile);
    const newImage = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });

    // Get old image for reference
    const oldImage = group.getObjects()[0] as FabricImage;
    if (!oldImage) return;

    // Copy transform properties from old image
    newImage.set({
      left: oldImage.left,
      top: oldImage.top,
      scaleX: oldImage.scaleX,
      scaleY: oldImage.scaleY,
      angle: oldImage.angle,
      originX: oldImage.originX,
      originY: oldImage.originY,
      selectable: false,
      evented: false,
    });

    // Replace in group
    group.remove(oldImage);
    group.addWithUpdate(newImage);

    canvas.requestRenderAll();
    toast.success("Image replaced successfully");
  } catch (error) {
    console.error("Error replacing image:", error);
    toast.error("Failed to replace image");
  }
}

/**
 * Change the mask shape while preserving the image
 */
export function changeMaskShape(
  canvas: Canvas,
  group: Group,
  newShapeType: MaskShape,
  cornerRadius?: number
): void {
  const currentClipPath = group.clipPath as FabricObject;
  if (!currentClipPath) return;

  // Get current dimensions
  const width = (currentClipPath as any).width || (currentClipPath as Circle).radius! * 2;
  const height = (currentClipPath as any).height || (currentClipPath as Circle).radius! * 2;

  // Create new clipPath of different type
  const newClipPath = createClipPathOfType(newShapeType, width, height, cornerRadius);
  if (!newClipPath) {
    toast.error("Could not create mask shape");
    return;
  }

  // Replace clipPath
  group.set({ clipPath: newClipPath });
  (group as any).maskShape = newShapeType;
  if (cornerRadius !== undefined) {
    (group as any).cornerRadius = cornerRadius;
  }

  canvas.requestRenderAll();
  toast.success("Mask shape changed");
}

/**
 * Create a clipPath of a specific shape type
 */
function createClipPathOfType(
  type: MaskShape,
  width: number,
  height: number,
  cornerRadius?: number
): FabricObject | null {
  switch (type) {
    case "circle":
      return new Circle({
        radius: Math.min(width, height) / 2,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });

    case "ellipse":
      return new Ellipse({
        rx: width / 2,
        ry: height / 2,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });

    case "rect":
      return new Rect({
        width,
        height,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });

    case "roundedRect":
      return new Rect({
        width,
        height,
        rx: cornerRadius || 20,
        ry: cornerRadius || 20,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
      });

    default:
      return null;
  }
}

/**
 * Update corner radius for rounded rectangle masks
 */
export function updateCornerRadius(
  canvas: Canvas,
  group: Group,
  radius: number
): void {
  if ((group as any).maskShape !== "roundedRect") return;

  const clipPath = group.clipPath as Rect;
  if (!clipPath) return;

  clipPath.set({
    rx: radius,
    ry: radius,
  });

  (group as any).cornerRadius = radius;
  canvas.requestRenderAll();
}

/**
 * Remove the mask and extract the image
 */
export function removeMask(canvas: Canvas, group: Group): FabricImage | null {
  const image = group.getObjects()[0] as FabricImage;
  if (!image) return null;

  // Calculate absolute position of image
  const groupMatrix = group.calcTransformMatrix();
  const imageRelative = image.calcTransformMatrix();
  const absoluteMatrix = util.multiplyTransformMatrices(groupMatrix, imageRelative);

  // Decompose matrix to get position, scale, and rotation
  const options = util.qrDecompose(absoluteMatrix);

  // Apply to image
  image.set({
    left: options.translateX,
    top: options.translateY,
    scaleX: options.scaleX,
    scaleY: options.scaleY,
    angle: options.angle,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  });

  // Remove group, add image
  canvas.remove(group);
  canvas.add(image);
  canvas.setActiveObject(image);
  canvas.requestRenderAll();

  toast.success("Mask removed");
  return image;
}
