/**
 * Alignment and distribution utilities
 * Used for smart object arrangement on canvas
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Distribute objects horizontally with equal spacing
 * @param objects Array of objects to distribute
 * @param customSpacing Optional custom spacing in pixels (if not provided, distributes evenly)
 * @returns Array of objects with updated x positions
 */
export function distributeHorizontally(objects: BoundingBox[], customSpacing?: number): BoundingBox[] {
  if (objects.length < 2) return objects;
  if (objects.length === 2) return objects;

  // Create array with original indices
  const indexed = objects.map((obj, index) => ({ obj, index }));

  // Sort by x position (left edge)
  const sorted = indexed.sort((a, b) => a.obj.x - b.obj.x);

  // Identify leftmost object
  const first = sorted[0].obj;
  const firstRight = first.x + first.width;

  let gapSize: number;

  if (customSpacing !== undefined) {
    // Use custom spacing
    gapSize = customSpacing;
  } else {
    // Calculate even distribution between first and last
    const last = sorted[sorted.length - 1].obj;
    const lastLeft = last.x;
    const totalObjectWidth = sorted.slice(1, -1).reduce(
      (sum, item) => sum + item.obj.width,
      0
    );
    const availableSpace = lastLeft - firstRight;
    const numGaps = sorted.length - 1;
    gapSize = (availableSpace - totalObjectWidth) / numGaps;
  }

  // Position objects with calculated gaps
  let currentX = firstRight + gapSize;

  const distributed = sorted.map((item, sortedIndex) => {
    if (sortedIndex === 0) {
      // Keep first in original position
      return { ...item.obj };
    }

    const newObj = { ...item.obj, x: currentX };
    currentX += item.obj.width + gapSize;
    return newObj;
  });

  // Map back to original order using the indices we saved
  const result = new Array(objects.length);
  sorted.forEach((item, sortedIndex) => {
    result[item.index] = distributed[sortedIndex];
  });

  return result;
}

/**
 * Distribute objects vertically with equal spacing
 * @param objects Array of objects to distribute
 * @param customSpacing Optional custom spacing in pixels (if not provided, distributes evenly)
 * @returns Array of objects with updated y positions
 */
export function distributeVertically(objects: BoundingBox[], customSpacing?: number): BoundingBox[] {
  if (objects.length < 2) return objects;
  if (objects.length === 2) return objects;

  // Create array with original indices
  const indexed = objects.map((obj, index) => ({ obj, index }));

  // Sort by y position (top edge)
  const sorted = indexed.sort((a, b) => a.obj.y - b.obj.y);

  // Identify topmost object
  const first = sorted[0].obj;
  const firstBottom = first.y + first.height;

  let gapSize: number;

  if (customSpacing !== undefined) {
    // Use custom spacing
    gapSize = customSpacing;
  } else {
    // Calculate even distribution between first and last
    const last = sorted[sorted.length - 1].obj;
    const lastTop = last.y;
    const totalObjectHeight = sorted.slice(1, -1).reduce(
      (sum, item) => sum + item.obj.height,
      0
    );
    const availableSpace = lastTop - firstBottom;
    const numGaps = sorted.length - 1;
    gapSize = (availableSpace - totalObjectHeight) / numGaps;
  }

  // Position objects with calculated gaps
  let currentY = firstBottom + gapSize;

  const distributed = sorted.map((item, sortedIndex) => {
    if (sortedIndex === 0) {
      // Keep first in original position
      return { ...item.obj };
    }

    const newObj = { ...item.obj, y: currentY };
    currentY += item.obj.height + gapSize;
    return newObj;
  });

  // Map back to original order using the indices we saved
  const result = new Array(objects.length);
  sorted.forEach((item, sortedIndex) => {
    result[item.index] = distributed[sortedIndex];
  });

  return result;
}

/**
 * Match width of all objects to target width
 * @param objects Array of objects to modify
 * @param targetWidth Target width for all objects
 * @returns Array of objects with updated widths
 */
export function matchWidth(objects: BoundingBox[], targetWidth: number): BoundingBox[] {
  if (objects.length === 0) return objects;
  if (targetWidth <= 0) {
    throw new Error('Target width must be positive');
  }

  return objects.map(obj => ({
    ...obj,
    width: targetWidth
    // Preserve: x, y, height
  }));
}

/**
 * Match height of all objects to target height
 * @param objects Array of objects to modify
 * @param targetHeight Target height for all objects
 * @returns Array of objects with updated heights
 */
export function matchHeight(objects: BoundingBox[], targetHeight: number): BoundingBox[] {
  if (objects.length === 0) return objects;
  if (targetHeight <= 0) {
    throw new Error('Target height must be positive');
  }

  return objects.map(obj => ({
    ...obj,
    height: targetHeight
    // Preserve: x, y, width
  }));
}
