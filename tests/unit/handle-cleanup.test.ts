/**
 * Unit tests for ghost handle cleanup on line/curve deletion.
 *
 * When a line or curve is deleted from the canvas, its associated
 * edit-mode handles (control handles, guide lines, anchor handles)
 * must also be removed. Otherwise they persist as ghost green dots/lines.
 */
import { describe, it, expect, vi } from 'vitest';

// Minimal mock of a Fabric canvas
function createMockCanvas() {
  const objects = new Set<any>();
  return {
    _objects: objects,
    contains(obj: any) { return objects.has(obj); },
    add(obj: any) { objects.add(obj); },
    remove(obj: any) { objects.delete(obj); },
    getObjects() { return [...objects]; },
  };
}

// Replica of the cleanup logic from FabricCanvas.tsx object:removed handler
function cleanupLineHandles(canvas: ReturnType<typeof createMockCanvas>, targetData: any) {
  if (targetData.isCurvedLine || targetData.isStraightLine || targetData.isOrthogonalLine || targetData.isBezierPath) {
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
      if (canvas.contains(h)) {
        canvas.remove(h);
      }
    }
  }
}

describe('Handle cleanup on line deletion', () => {
  it('should remove controlHandle and handleLines when curved line is deleted', () => {
    const canvas = createMockCanvas();

    const controlHandle = { type: 'circle', isControlHandle: true, fill: '#10b981' };
    const handleLine1 = { type: 'line', isHandleLine: true };
    const handleLine2 = { type: 'line', isHandleLine: true };

    const curvedLine = {
      type: 'path',
      isCurvedLine: true,
      controlHandle,
      handleLines: [handleLine1, handleLine2],
    };

    // All objects on canvas
    canvas.add(curvedLine);
    canvas.add(controlHandle);
    canvas.add(handleLine1);
    canvas.add(handleLine2);
    expect(canvas.getObjects()).toHaveLength(4);

    // Simulate deletion: remove the line, then run cleanup
    canvas.remove(curvedLine);
    cleanupLineHandles(canvas, curvedLine);

    // Only the handles should be gone too
    expect(canvas.getObjects()).toHaveLength(0);
    expect(canvas.contains(controlHandle)).toBe(false);
    expect(canvas.contains(handleLine1)).toBe(false);
    expect(canvas.contains(handleLine2)).toBe(false);
  });

  it('should remove anchor handles when straight line is deleted', () => {
    const canvas = createMockCanvas();

    const startAnchor = { type: 'circle', isAnchorHandle: true, fill: '#3b82f6' };
    const endAnchor = { type: 'circle', isAnchorHandle: true, fill: '#3b82f6' };

    const straightLine = {
      type: 'line',
      isStraightLine: true,
      startAnchorHandle: startAnchor,
      endAnchorHandle: endAnchor,
    };

    canvas.add(straightLine);
    canvas.add(startAnchor);
    canvas.add(endAnchor);
    expect(canvas.getObjects()).toHaveLength(3);

    canvas.remove(straightLine);
    cleanupLineHandles(canvas, straightLine);

    expect(canvas.getObjects()).toHaveLength(0);
    expect(canvas.contains(startAnchor)).toBe(false);
    expect(canvas.contains(endAnchor)).toBe(false);
  });

  it('should remove all handle types when orthogonal line is deleted', () => {
    const canvas = createMockCanvas();

    const controlHandle = { type: 'circle', isControlHandle: true };
    const startAnchor = { type: 'circle', isAnchorHandle: true };
    const endAnchor = { type: 'circle', isAnchorHandle: true };
    const handleLine = { type: 'line', isHandleLine: true };

    const orthogonalLine = {
      type: 'path',
      isOrthogonalLine: true,
      controlHandle,
      startAnchorHandle: startAnchor,
      endAnchorHandle: endAnchor,
      handleLines: [handleLine],
    };

    canvas.add(orthogonalLine);
    canvas.add(controlHandle);
    canvas.add(startAnchor);
    canvas.add(endAnchor);
    canvas.add(handleLine);

    canvas.remove(orthogonalLine);
    cleanupLineHandles(canvas, orthogonalLine);

    expect(canvas.getObjects()).toHaveLength(0);
  });

  it('should handle missing handles gracefully (no crash)', () => {
    const canvas = createMockCanvas();

    // Line with no handles attached
    const line = {
      type: 'path',
      isCurvedLine: true,
      controlHandle: null,
      handleLines: null,
      startAnchorHandle: undefined,
      endAnchorHandle: undefined,
    };

    canvas.add(line);
    canvas.remove(line);

    // Should not throw
    expect(() => cleanupLineHandles(canvas, line)).not.toThrow();
    expect(canvas.getObjects()).toHaveLength(0);
  });

  it('should handle partially set handles (only some exist)', () => {
    const canvas = createMockCanvas();

    const controlHandle = { type: 'circle', isControlHandle: true };

    const line = {
      type: 'path',
      isCurvedLine: true,
      controlHandle,
      handleLines: [null, null], // Lines were never created
    };

    canvas.add(line);
    canvas.add(controlHandle);

    canvas.remove(line);
    cleanupLineHandles(canvas, line);

    expect(canvas.getObjects()).toHaveLength(0);
    expect(canvas.contains(controlHandle)).toBe(false);
  });

  it('should NOT remove handles from non-line objects', () => {
    const canvas = createMockCanvas();

    const someCircle = { type: 'circle', fill: '#10b981' };
    const rect = { type: 'rect', controlHandle: someCircle }; // Not a line

    canvas.add(rect);
    canvas.add(someCircle);

    canvas.remove(rect);
    cleanupLineHandles(canvas, rect);

    // someCircle should remain — rect is not a line type
    expect(canvas.getObjects()).toHaveLength(1);
    expect(canvas.contains(someCircle)).toBe(true);
  });

  it('should handle bezier path deletion', () => {
    const canvas = createMockCanvas();

    const controlHandle = { type: 'circle', isControlHandle: true };
    const handleLine = { type: 'line', isHandleLine: true };

    const bezierPath = {
      type: 'path',
      isBezierPath: true,
      controlHandle,
      handleLines: [handleLine],
    };

    canvas.add(bezierPath);
    canvas.add(controlHandle);
    canvas.add(handleLine);

    canvas.remove(bezierPath);
    cleanupLineHandles(canvas, bezierPath);

    expect(canvas.getObjects()).toHaveLength(0);
  });

  it('should not crash if handle was already removed from canvas', () => {
    const canvas = createMockCanvas();

    const controlHandle = { type: 'circle', isControlHandle: true };

    const line = {
      type: 'path',
      isCurvedLine: true,
      controlHandle,
      handleLines: [],
    };

    canvas.add(line);
    // controlHandle was never added to canvas (or already removed)

    canvas.remove(line);

    // Should not throw even though controlHandle is not on canvas
    expect(() => cleanupLineHandles(canvas, line)).not.toThrow();
  });

  it('should leave other canvas objects intact when cleaning up handles', () => {
    const canvas = createMockCanvas();

    const otherRect = { type: 'rect', fill: 'blue' };
    const otherCircle = { type: 'circle', fill: 'red' };
    const controlHandle = { type: 'circle', isControlHandle: true };

    const line = {
      type: 'path',
      isCurvedLine: true,
      controlHandle,
      handleLines: [],
    };

    canvas.add(otherRect);
    canvas.add(line);
    canvas.add(controlHandle);
    canvas.add(otherCircle);

    canvas.remove(line);
    cleanupLineHandles(canvas, line);

    // Other objects should remain
    expect(canvas.getObjects()).toHaveLength(2);
    expect(canvas.contains(otherRect)).toBe(true);
    expect(canvas.contains(otherCircle)).toBe(true);
    expect(canvas.contains(controlHandle)).toBe(false);
  });
});
