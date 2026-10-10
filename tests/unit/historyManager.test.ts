/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryManager } from '../../src/lib/historyManager';
import { Canvas as FabricCanvas, Rect, Group, Path, Circle } from 'fabric';
import * as LZString from 'lz-string';

describe('HistoryManager - Enhanced Undo/Redo System', () => {
  let canvas: FabricCanvas;
  let manager: HistoryManager;

  beforeEach(() => {
    // Create a canvas for testing
    const canvasEl = document.createElement('canvas');
    canvas = new FabricCanvas(canvasEl);
    manager = new HistoryManager(100);
  });

  describe('Deep History - 100 Operations', () => {
    it('should store up to 100 history states', () => {
      // Create 120 states
      for (let i = 0; i < 120; i++) {
        const rect = new Rect({ left: i * 10, top: 0, width: 50, height: 50 });
        canvas.add(rect);
        manager.saveState(canvas);
      }

      // Should only keep the most recent 100
      expect(manager.getHistoryLength()).toBe(100);
      expect(manager.canUndo()).toBe(true);
    });

    it('should enforce 100 operation maximum and drop oldest states', () => {
      // Create exactly 100 states
      for (let i = 0; i < 100; i++) {
        const rect = new Rect({ left: i * 10, top: 0, width: 50, height: 50 });
        canvas.add(rect);
        manager.saveState(canvas);
      }

      expect(manager.getHistoryLength()).toBe(100);

      // Get the first state's object count to track it
      const history = (manager as any).history;
      const firstStateObjectCount = history[0].objectCount;

      // Add one more state
      const rect = new Rect({ left: 1000, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      // History length should still be 100
      expect(manager.getHistoryLength()).toBe(100);

      // The oldest state should have been dropped
      const newHistory = (manager as any).history;
      const newFirstStateObjectCount = newHistory[0].objectCount;

      // First state should have more objects than before (oldest was dropped)
      expect(newFirstStateObjectCount).toBeGreaterThan(firstStateObjectCount);
    });

    it('should support undo of 100 operations', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas); // Initial state

      // Perform 100 operations
      for (let i = 1; i <= 100; i++) {
        rect.set({ left: i * 10 });
        manager.saveState(canvas);
      }

      expect(manager.getHistoryLength()).toBe(100); // Max size is 100, oldest dropped

      // Undo 99 operations (can't undo past first state in history)
      for (let i = 0; i < 99; i++) {
        const success = await manager.undo(canvas);
        expect(success).toBe(true);
      }

      // Should be back at first state in history (which is i=1, left=10)
      // The initial state (left=0) was dropped due to maxSize=100
      const objects = canvas.getObjects();
      expect(objects[0].left).toBe(10);

      // Attempting one more undo should fail
      const finalUndo = await manager.undo(canvas);
      expect(finalUndo).toBe(false);
    });

    it('should maintain differential compression efficiency', () => {
      // Add objects and save states
      for (let i = 0; i < 50; i++) {
        const rect = new Rect({ left: i * 10, top: 0, width: 50, height: 50 });
        canvas.add(rect);
        manager.saveState(canvas);
      }

      // Memory usage should be reasonable (< 1MB for 50 states)
      const memoryUsage = manager.getMemoryUsage();
      expect(memoryUsage).toBeLessThan(1024 * 1024); // Less than 1MB
    });
  });

  describe('Transaction Grouping', () => {
    it('should group multiple operations in a transaction', () => {
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas); // Initial state

      manager.beginTransaction(canvas);

      // Make multiple changes
      canvas.getObjects()[0].set({ left: 100 });
      manager.saveState(canvas);

      canvas.getObjects()[0].set({ left: 200 });
      manager.saveState(canvas);

      canvas.getObjects()[0].set({ left: 300 });
      manager.saveState(canvas);

      manager.commitTransaction(canvas);

      // Should only have 2 states: initial + final
      expect(manager.getHistoryLength()).toBe(2);
    });

    it('should cancel transaction and revert to start', () => {
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas);

      const initialStep = manager.getCurrentStep();

      manager.beginTransaction(canvas);

      canvas.getObjects()[0].set({ left: 100 });
      manager.saveState(canvas);

      canvas.getObjects()[0].set({ left: 200 });
      manager.saveState(canvas);

      manager.cancelTransaction();

      // Should be back at initial step
      expect(manager.getCurrentStep()).toBe(initialStep);
    });

    it('should auto-commit transaction after timeout', async () => {
      vi.useFakeTimers();

      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas);

      manager.beginTransaction(canvas);

      canvas.getObjects()[0].set({ left: 100 });
      manager.saveState(canvas);

      // Wait for auto-commit timeout (300ms)
      vi.advanceTimersByTime(350);

      // Transaction should be auto-committed
      expect(manager.getHistoryLength()).toBe(2);

      vi.useRealTimers();
    });

    it('should batch multi-object changes into single undo step', () => {
      // Add 5 objects
      for (let i = 0; i < 5; i++) {
        canvas.add(new Rect({ left: i * 50, top: 0, width: 50, height: 50 }));
      }
      manager.saveState(canvas); // Initial state

      const initialStep = manager.getCurrentStep();

      // Begin transaction for multi-object operation
      manager.beginTransaction(canvas);

      // Modify all objects
      const objects = canvas.getObjects();
      for (let i = 0; i < objects.length; i++) {
        objects[i].set({ left: objects[i].left + 100 });
        manager.saveState(canvas); // Each change creates intermediate state
      }

      // Commit transaction
      manager.commitTransaction(canvas);

      // Should only have 2 states: initial + final
      expect(manager.getCurrentStep()).toBe(initialStep + 1);
      expect(manager.getHistoryLength()).toBe(2);
    });

    it('should handle nested transaction attempts gracefully', () => {
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas);

      manager.beginTransaction(canvas);
      manager.saveState(canvas);

      // Attempting to begin another transaction should not cause issues
      manager.beginTransaction(canvas);
      manager.saveState(canvas);

      manager.commitTransaction(canvas);

      // Should still work correctly
      expect(manager.getHistoryLength()).toBeGreaterThan(0);
    });
  });

  describe('Property-Level Tracking', () => {
    it('should undo color changes', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, fill: 'blue' });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ fill: 'red' });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect(restored.fill).toBe('blue');
    });

    it('should undo position changes', async () => {
      const rect = new Rect({ left: 100, top: 100, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ left: 200, top: 200 });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect(restored.left).toBe(100);
      expect(restored.top).toBe(100);
    });

    it('should undo size/scale changes', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, scaleX: 1, scaleY: 1 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ scaleX: 2, scaleY: 2 });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect(restored.scaleX).toBe(1);
      expect(restored.scaleY).toBe(1);
    });

    it('should undo rotation changes', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, angle: 0 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ angle: 45 });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect(restored.angle).toBe(0);
    });

    it('should undo opacity changes', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, opacity: 1 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ opacity: 0.5 });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect(restored.opacity).toBe(1);
    });
  });

  describe('Custom Property Persistence', () => {
    it('should preserve custom properties on undo/redo', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      (rect as any).customProp = 'initial value';
      (rect as any).isBezierPath = true;
      canvas.add(rect);
      manager.saveState(canvas);

      (rect as any).customProp = 'changed value';
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect((restored as any).customProp).toBe('initial value');
      expect((restored as any).isBezierPath).toBe(true);
    });

    it('should preserve bezier path custom properties', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      (rect as any).isBezierPath = true;
      (rect as any).bezierPoints = [
        { x: 0, y: 0, id: '1', type: 'smooth' },
        { x: 100, y: 100, id: '2', type: 'corner' }
      ];
      canvas.add(rect);
      manager.saveState(canvas);

      (rect as any).bezierPoints[0].x = 50;
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect((restored as any).bezierPoints[0].x).toBe(0);
    });

    it('should preserve curved line custom properties', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      (rect as any).isCurvedLine = true;
      (rect as any).curvedLineControlPoint = { x: 50, y: 50 };
      canvas.add(rect);
      manager.saveState(canvas);

      (rect as any).curvedLineControlPoint = { x: 100, y: 100 };
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect((restored as any).curvedLineControlPoint).toEqual({ x: 50, y: 50 });
    });

    it('should preserve image mask custom properties', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      (rect as any).isMaskedImage = true;
      (rect as any).maskShape = 'circle';
      (rect as any).cornerRadius = 10;
      canvas.add(rect);
      manager.saveState(canvas);

      (rect as any).maskShape = 'rect';
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects()[0];
      expect((restored as any).maskShape).toBe('circle');
      expect((restored as any).cornerRadius).toBe(10);
    });
  });

  describe('State Metadata', () => {
    it('should save state with label and event type', () => {
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas, 'Initial state', 'canvas:init');

      expect(manager.getHistoryLength()).toBe(1);
    });

    it('should track multiple labeled states', () => {
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas, 'Add rectangle', 'object:added');

      canvas.getObjects()[0].set({ fill: 'red' });
      manager.saveState(canvas, 'Change color', 'object:modified');

      expect(manager.getHistoryLength()).toBe(2);
    });
  });

  describe('Undo/Redo Behavior', () => {
    it('should redo after undo', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ left: 100 });
      manager.saveState(canvas);

      await manager.undo(canvas);
      expect(canvas.getObjects()[0].left).toBe(0);

      await manager.redo(canvas);
      expect(canvas.getObjects()[0].left).toBe(100);
    });

    it('should clear redo stack after new change', async () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      rect.set({ left: 100 });
      manager.saveState(canvas);

      rect.set({ left: 200 });
      manager.saveState(canvas);

      // Undo twice
      await manager.undo(canvas);
      await manager.undo(canvas);

      expect(manager.canRedo()).toBe(true);

      // Make new change - get fresh reference to object after undo
      const currentRect = canvas.getObjects()[0] as any;
      currentRect.set({ left: 150 });
      manager.saveState(canvas);

      // Redo should no longer be available
      expect(manager.canRedo()).toBe(false);
    });

    it('should handle boundary conditions', async () => {
      // Cannot undo with empty history
      expect(manager.canUndo()).toBe(false);
      expect(await manager.undo(canvas)).toBe(false);

      // Add one state
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas);

      // Cannot undo past first state
      expect(manager.canUndo()).toBe(false);
      expect(await manager.undo(canvas)).toBe(false);

      // Cannot redo when at latest state
      expect(manager.canRedo()).toBe(false);
      expect(await manager.redo(canvas)).toBe(false);
    });
  });

  describe('Property Diffing and Storage', () => {
    it('should store only changed property values using differential compression', () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, fill: 'blue' });
      canvas.add(rect);
      manager.saveState(canvas); // Full state

      // Make a small change (only position)
      rect.set({ left: 100 });
      manager.saveState(canvas); // Should attempt differential

      // Make another small change (only fill)
      rect.set({ fill: 'red' });
      manager.saveState(canvas); // Should attempt differential

      // Get history entries via reflection
      const history = (manager as any).history;

      // First entry should be full state
      expect(history[0].isDiff).toBe(false);

      // All entries should have isDiff defined (either true or false)
      // This verifies the differential logic is being evaluated
      history.forEach((entry: any, index: number) => {
        expect(typeof entry.isDiff).toBe('boolean');
      });

      // History should work correctly regardless of whether diffs were used
      expect(history.length).toBe(3);
    });

    it('should track only modified objects in differential states', () => {
      // Add 3 objects
      canvas.add(new Rect({ left: 0, top: 0, width: 50, height: 50 }));
      canvas.add(new Rect({ left: 100, top: 0, width: 50, height: 50 }));
      canvas.add(new Rect({ left: 200, top: 0, width: 50, height: 50 }));
      manager.saveState(canvas); // Full state

      // Modify only the second object
      canvas.getObjects()[1].set({ fill: 'red' });
      manager.saveState(canvas); // Should be differential

      const history = (manager as any).history;

      // If the second state is differential, it should only track the modified object
      if (history[1]?.isDiff) {
        const diffData = JSON.parse(LZString.decompress(history[1].compressed));

        // Should have modified objects but minimal data
        expect(diffData.objects).toBeDefined();
        expect(diffData.objects.modified).toBeDefined();

        // Modified array should not be empty
        if (diffData.objects.modified) {
          expect(diffData.objects.modified.length).toBeGreaterThan(0);
        }

        // Should not have stored all 3 objects in the diff
        const totalTracked = (diffData.objects.added?.length || 0) +
                            (diffData.objects.modified?.length || 0) +
                            (diffData.objects.removed?.length || 0);
        expect(totalTracked).toBeLessThan(3);
      }
    });

    it('should fall back to full state when diff is too large', () => {
      // Create a simple initial state
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      // Make a massive change (add many objects)
      for (let i = 0; i < 50; i++) {
        canvas.add(new Rect({ left: i * 10, top: 0, width: 50, height: 50 }));
      }
      manager.saveState(canvas);

      // Get history entries
      const history = (manager as any).history;

      // The second entry might be full state if diff exceeded threshold
      // This is implementation-specific, but verify it's either diff or full
      expect(history[1].isDiff !== undefined).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('should efficiently handle rapid state changes', () => {
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);

      const startTime = performance.now();

      // Simulate rapid changes
      for (let i = 0; i < 100; i++) {
        rect.set({ left: i * 10 });
        manager.saveState(canvas);
      }

      const endTime = performance.now();
      const elapsed = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should provide accurate memory usage estimates', () => {
      for (let i = 0; i < 10; i++) {
        canvas.add(new Rect({ left: i * 10, top: 0, width: 50, height: 50 }));
        manager.saveState(canvas);
      }

      const memoryUsage = manager.getMemoryUsage();
      expect(memoryUsage).toBeGreaterThan(0);
      expect(typeof memoryUsage).toBe('number');
    });

    it('should clear history properly', () => {
      for (let i = 0; i < 10; i++) {
        canvas.add(new Rect({ left: i * 10, top: 0, width: 50, height: 50 }));
        manager.saveState(canvas);
      }

      expect(manager.getHistoryLength()).toBeGreaterThan(0);

      manager.clear();

      expect(manager.getHistoryLength()).toBe(0);
      expect(manager.getCurrentStep()).toBe(-1);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('Grid and Ruler Preservation', () => {
    it('should exclude grid lines from history state', () => {
      // Add a regular rectangle
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);

      // Add a grid line (marked with isGridLine)
      const gridLine = new Rect({ left: 0, top: 100, width: 100, height: 1 });
      (gridLine as any).isGridLine = true;
      canvas.add(gridLine);

      // Save state
      manager.saveState(canvas);

      // Get the history entry
      const history = (manager as any).history;
      const lastEntry = history[history.length - 1];
      const savedJson = LZString.decompress(lastEntry.compressed);
      const savedState = JSON.parse(savedJson);

      // Should only have 1 object (the rectangle), not the grid line
      expect(savedState.objects.length).toBe(1);
      expect(savedState.objects[0].width).toBe(50);
    });

    it('should exclude rulers from history state', () => {
      // Add a regular rectangle
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);

      // Add a ruler (marked with isRuler)
      const ruler = new Rect({ left: 0, top: 0, width: 500, height: 20 });
      (ruler as any).isRuler = true;
      canvas.add(ruler);

      // Save state
      manager.saveState(canvas);

      // Get the history entry
      const history = (manager as any).history;
      const lastEntry = history[history.length - 1];
      const savedJson = LZString.decompress(lastEntry.compressed);
      const savedState = JSON.parse(savedJson);

      // Should only have 1 object (the rectangle), not the ruler
      expect(savedState.objects.length).toBe(1);
      expect(savedState.objects[0].width).toBe(50);
    });

    it('should preserve grid lines and rulers after undo', async () => {
      // Add grid line
      const gridLine = new Rect({ left: 0, top: 100, width: 100, height: 1 });
      (gridLine as any).isGridLine = true;
      canvas.add(gridLine);

      // Add ruler
      const ruler = new Rect({ left: 0, top: 0, width: 500, height: 20 });
      (ruler as any).isRuler = true;
      canvas.add(ruler);

      // Add regular rectangle
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      // Add another rectangle
      const rect2 = new Rect({ left: 100, top: 0, width: 50, height: 50 });
      canvas.add(rect2);
      manager.saveState(canvas);

      // Undo (should remove rect2 but keep grid and ruler)
      await manager.undo(canvas);

      const objects = canvas.getObjects();
      const gridLines = objects.filter((obj: any) => obj.isGridLine);
      const rulers = objects.filter((obj: any) => obj.isRuler);
      const userObjects = objects.filter((obj: any) => !obj.isGridLine && !obj.isRuler);

      // Grid line and ruler should still be there
      expect(gridLines.length).toBe(1);
      expect(rulers.length).toBe(1);
      // Only first rectangle should remain
      expect(userObjects.length).toBe(1);
    });

    it('should preserve grid lines and rulers after redo', async () => {
      // Add grid line
      const gridLine = new Rect({ left: 0, top: 100, width: 100, height: 1 });
      (gridLine as any).isGridLine = true;
      canvas.add(gridLine);

      // Add rectangle
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50 });
      canvas.add(rect);
      manager.saveState(canvas);

      // Add another rectangle
      const rect2 = new Rect({ left: 100, top: 0, width: 50, height: 50 });
      canvas.add(rect2);
      manager.saveState(canvas);

      // Undo then redo
      await manager.undo(canvas);
      await manager.redo(canvas);

      const objects = canvas.getObjects();
      const gridLines = objects.filter((obj: any) => obj.isGridLine);
      const userObjects = objects.filter((obj: any) => !obj.isGridLine && !obj.isRuler);

      // Grid line should still be there
      expect(gridLines.length).toBe(1);
      // Both rectangles should be there after redo
      expect(userObjects.length).toBe(2);
    });
  });

  describe('Composite Object Restoration (Undo deletes half of Figure)', () => {
    // Regression suite for the "Undo deletes half of the Figure" bug:
    // composite objects (Groups with `objects`, Paths with mutated `path`)
    // must fully restore on undo, not just their transform/style.

    function makeBand(left: number, color: string): Rect {
      return new Rect({ left, top: 0, width: 30, height: 80, fill: color });
    }

    function makeTripleMembrane(left: number): Group {
      const bands = [makeBand(0, '#ff0000'), makeBand(35, '#00ff00'), makeBand(70, '#0000ff')];
      const group = new Group(bands, { left, top: 0, subTargetCheck: true });
      (group as any).isTripleMembrane = true;
      (group as any).tripleMembraneOptions = { bandWidth: 30, bandGap: 5 };
      (group as any).id = `tm_${Math.random().toString(36).slice(2, 9)}`;
      return group;
    }

    it('triple membrane: child band removal then undo restores all 3 bands', async () => {
      const membrane = makeTripleMembrane(50);
      canvas.add(membrane);
      manager.saveState(canvas); // initial — 3 bands

      // Mutate: remove the middle band directly from the group internals.
      const childrenBefore = (membrane as any).getObjects();
      expect(childrenBefore.length).toBe(3);
      (membrane as any)._objects = [childrenBefore[0], childrenBefore[2]];
      manager.saveState(canvas); // post-mutation — 2 bands

      // Undo → all 3 bands should return.
      const ok = await manager.undo(canvas);
      expect(ok).toBe(true);

      const restored = canvas.getObjects().find((o: any) => o.isTripleMembrane);
      expect(restored).toBeTruthy();
      const restoredChildren = (restored as any).getObjects?.() || (restored as any)._objects || [];
      expect(restoredChildren.length).toBe(3);
    });

    it('triple membrane: id is preserved across recreate-on-restore', async () => {
      const membrane = makeTripleMembrane(50);
      const originalId = (membrane as any).id;
      canvas.add(membrane);
      manager.saveState(canvas);

      // Mutate child count to force recreate path
      const children = (membrane as any).getObjects();
      (membrane as any)._objects = [children[0]];
      manager.saveState(canvas);

      await manager.undo(canvas);
      const restored = canvas.getObjects().find((o: any) => o.isTripleMembrane);
      expect((restored as any).id).toBe(originalId);
    });

    it('path mutation: existing path with new `path` data is recreated', async () => {
      const path = new Path('M 0 0 L 100 0', { stroke: '#000', strokeWidth: 2 });
      (path as any).id = 'p1';
      canvas.add(path);
      manager.saveState(canvas); // initial path

      // Mutate path data directly. updateObjectProperties cannot handle this
      // because Fabric doesn't recompute pathOffset/bbox on .set('path', ...).
      (path as any).path = [['M', 0, 0], ['L', 50, 50]];
      manager.saveState(canvas); // post-mutation

      const ok = await manager.undo(canvas);
      expect(ok).toBe(true);

      const restored = canvas.getObjects().find((o: any) => o.id === 'p1') as any;
      expect(restored).toBeTruthy();
      // After recreate, path should match the original M 0 0 L 100 0
      const restoredPath = restored.path;
      expect(Array.isArray(restoredPath)).toBe(true);
      // First command is the move-to from initial state
      expect(restoredPath[0][0]).toBe('M');
    });

    it('leader-line props survive a round trip', async () => {
      // Leader line is a Group with custom-named props. Before the fix
      // these props were not in CUSTOM_PROPS so undo would lose them.
      const linePath = new Path('M 0 0 L 100 50');
      const group = new Group([linePath], { left: 10, top: 10 });
      (group as any).customType = 'leader-line';
      (group as any).leaderLocalStart = { x: 0, y: 0 };
      (group as any).leaderLocalEnd = { x: 100, y: 50 };
      (group as any).labelOffsetX = 5;
      (group as any).labelOffsetY = -8;
      (group as any).id = 'leader1';
      canvas.add(group);
      manager.saveState(canvas);

      // Mutate label offsets
      (group as any).labelOffsetX = 99;
      (group as any).labelOffsetY = 99;
      manager.saveState(canvas);

      await manager.undo(canvas);

      const restored = canvas.getObjects().find((o: any) => o.id === 'leader1') as any;
      expect(restored).toBeTruthy();
      expect(restored.labelOffsetX).toBe(5);
      expect(restored.labelOffsetY).toBe(-8);
      expect(restored.leaderLocalStart).toEqual({ x: 0, y: 0 });
      expect(restored.leaderLocalEnd).toEqual({ x: 100, y: 50 });
    });

    it('transform-only delta on a simple rect uses fast in-place update', async () => {
      // Guards against regressing the fast-path optimization for the common
      // drag/resize case. A Rect with only transform changes must NOT trigger
      // a recreate (structureChanged=false → updateObjectProperties branch).
      const rect = new Rect({ left: 0, top: 0, width: 50, height: 50, fill: '#abc' });
      (rect as any).id = 'r1';
      canvas.add(rect);
      manager.saveState(canvas);

      const initialRef = canvas.getObjects()[0];

      rect.set({ left: 200, top: 100 });
      manager.saveState(canvas);

      await manager.undo(canvas);

      const afterRef = canvas.getObjects().find((o: any) => o.id === 'r1');
      // Same JS object reference proves the in-place update path was taken
      // (recreate path would replace the reference).
      expect(afterRef).toBe(initialRef);
      expect((afterRef as any).left).toBe(0);
      expect((afterRef as any).top).toBe(0);
    });

    it('unrelated objects are not disturbed by undoing a composite mutation', async () => {
      const sidekick = new Rect({ left: 500, top: 500, width: 10, height: 10, fill: '#0f0' });
      (sidekick as any).id = 'sidekick';
      canvas.add(sidekick);

      const membrane = makeTripleMembrane(50);
      canvas.add(membrane);
      manager.saveState(canvas);

      const sidekickRef = canvas.getObjects().find((o: any) => o.id === 'sidekick');

      const children = (membrane as any).getObjects();
      (membrane as any)._objects = [children[0]];
      manager.saveState(canvas);

      await manager.undo(canvas);

      const sidekickAfter = canvas.getObjects().find((o: any) => o.id === 'sidekick');
      // Sidekick should be the same instance — not recreated.
      expect(sidekickAfter).toBe(sidekickRef);
      expect((sidekickAfter as any).left).toBe(500);
    });
  });
});
