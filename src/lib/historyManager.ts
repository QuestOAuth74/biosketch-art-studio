import { Canvas as FabricCanvas, util } from 'fabric';
import * as LZString from 'lz-string';
import { HISTORY_CUSTOM_PROPS } from './historyProps';

/**
 * Shallow array equality used to detect when an object's `path` or `points`
 * data has changed between snapshot and live state. Returns false on any
 * length or per-element mismatch (deep-compares array segments).
 */
function pathOrPointsEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === bi) continue;
    if (Array.isArray(ai) && Array.isArray(bi)) {
      if (ai.length !== bi.length) return false;
      for (let j = 0; j < ai.length; j++) {
        if (ai[j] !== bi[j]) return false;
      }
    } else if (
      ai && bi && typeof ai === 'object' && typeof bi === 'object' &&
      typeof ai.x === 'number' && typeof ai.y === 'number'
    ) {
      if (ai.x !== bi.x || ai.y !== bi.y) return false;
    } else {
      return false;
    }
  }
  return true;
}

export interface HistoryEntry {
  compressed: string;
  timestamp: number;
  objectCount?: number;
}

export interface DifferentialHistoryEntry extends HistoryEntry {
  isDiff: boolean;
  baseIndex?: number;
  label?: string;
  eventType?: string;
}

/**
 * Helper to enliven objects from JSON
 */
function enlivenObjects(jsons: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const maybe = (util as any).enlivenObjects(jsons, (objects: any[]) => {
        resolve(objects);
      });
      if (maybe && typeof (maybe as any).then === 'function') {
        (maybe as any).then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Differential History Manager
 * Stores only changes between states instead of full canvas JSON
 * Uses compression to reduce memory footprint
 */
export class HistoryManager {
  private history: DifferentialHistoryEntry[] = [];
  private currentStep: number = -1;
  private readonly maxSize: number;
  private readonly diffThreshold: number = 0.3; // If diff is >30% of full state, store full state
  private isInTransaction: boolean = false;
  private transactionStartStep: number = -1;
  private transactionCanvas: FabricCanvas | null = null; // Canvas reference for auto-commit
  private transactionTimer: NodeJS.Timeout | null = null;
  private readonly TRANSACTION_TIMEOUT = 300; // ms
  private isRestoring: boolean = false; // Flag to prevent saves during undo/redo
  private lastSavedJson: string | null = null; // Cache for duplicate detection (avoids decompressing diffs)
  private iconReconstructor?: (canvasData: any) => Promise<void>; // Callback to reconstruct icons from references

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Set the icon reconstructor callback for handling icon-by-reference restoration
   */
  setIconReconstructor(reconstructor: (canvasData: any) => Promise<void>): void {
    this.iconReconstructor = reconstructor;
  }

  /**
   * Get filtered canvas JSON excluding grid lines and rulers
   * For library icons, only stores transforms/properties - not SVG content
   */
  private getFilteredCanvasJSON(canvas: FabricCanvas): string {
    // Sourced from src/lib/historyProps.ts — single source of truth
    // for every custom property that must round-trip through history.
    // startMarker/endMarker, controlHandle and handleLines are intentionally
    // excluded — they are runtime canvas object refs recreated on restore.
    const CUSTOM_PROPS = HISTORY_CUSTOM_PROPS;

    // Ensure all objects have IDs for property-based restoration
    const allObjects = canvas.getObjects();
    allObjects.forEach((obj: any) => {
      if (!obj.id) {
        obj.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    });

    // Filter out grid lines, rulers, edit mode handles, endpoint markers,
    // connection points, and other derived/transient objects.
    // Endpoint markers are recreated from startMarkerType/endMarkerType on restore.
    // Connection points are recreated dynamically by the connector system.
    const userObjects = allObjects.filter((obj: any) => {
      return !obj.isGridLine && !obj.isRuler && !obj.excludeFromExport &&
             !obj.isControlHandle && !obj.isHandleLine && !obj.isAnchorHandle && !obj.isGuideLine &&
             !obj.isEndpointMarker && !obj.isConnectionPoint && !obj.isPortIndicator && !obj.isFeedback;
    });

    // Serialize filtered objects with custom properties
    const canvasData: any = {
      version: '6.0.0',
      objects: userObjects.map((obj: any) => {
        let objData: any;

        // Icon-by-reference optimization: For library icons, serialize minimal data only
        // This avoids the expensive toObject() call that serializes all child objects
        if (obj.isLibraryIcon && obj.iconId) {
          // Manually construct minimal object data for icons
          objData = {
            type: obj.type,
            version: '6.0.0',
            originX: obj.originX,
            originY: obj.originY,
            left: obj.left,
            top: obj.top,
            width: obj.width,
            height: obj.height,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            flipX: obj.flipX,
            flipY: obj.flipY,
            opacity: obj.opacity,
            visible: obj.visible,
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            strokeDashArray: obj.strokeDashArray,
            strokeLineCap: obj.strokeLineCap,
            strokeLineJoin: obj.strokeLineJoin,
            strokeMiterLimit: obj.strokeMiterLimit,
            fill: obj.fill,
            fillRule: obj.fillRule,
            shadow: obj.shadow,
            skewX: obj.skewX,
            skewY: obj.skewY,
            backgroundColor: obj.backgroundColor,
            clipPath: obj.clipPath,
            paintFirst: obj.paintFirst,
            globalCompositeOperation: obj.globalCompositeOperation,
            // Icon-specific properties
            iconId: obj.iconId,
            isLibraryIcon: obj.isLibraryIcon,
            originalType: obj.originalType || obj.type,
            isIconReference: true,
          };

          // Add custom properties
          CUSTOM_PROPS.forEach(prop => {
            if (obj[prop] !== undefined && !objData.hasOwnProperty(prop)) {
              objData[prop] = obj[prop];
            }
          });
        } else {
          // Normal serialization for non-icon objects
          objData = obj.toObject(CUSTOM_PROPS);

          // CRITICAL: Explicitly remove edit mode handles from paths
          // These contain Fabric Circle/Line objects that shouldn't be serialized
          delete objData.anchorHandles;
          delete objData.controlHandles;
          delete objData.guideLines;
          delete objData.controlHandle;
          delete objData.handleLines;

          // Manually ensure all custom props are included
          CUSTOM_PROPS.forEach(prop => {
            if (obj[prop] !== undefined) {
              objData[prop] = obj[prop];
            }
          });
        }

        // Helper function to recursively strip icon content from nested objects
        const stripNestedIcons = (nestedObjects: any[]) => {
          if (!nestedObjects || !Array.isArray(nestedObjects)) return;

          nestedObjects.forEach((nestedObj: any) => {
            if (nestedObj.iconId && nestedObj.isLibraryIcon) {
              // Store original type for reconstruction
              if (!nestedObj.originalType) {
                nestedObj.originalType = nestedObj.type;
              }

              if ((nestedObj.type === 'Group' || nestedObj.type === 'group') && nestedObj.objects) {
                delete nestedObj.objects;
              } else if ((nestedObj.type === 'Path' || nestedObj.type === 'path') && nestedObj.path) {
                delete nestedObj.path;
              } else if ((nestedObj.type === 'Image' || nestedObj.type === 'image') && nestedObj.src) {
                delete nestedObj.src;
              }
            } else if (nestedObj.objects) {
              stripNestedIcons(nestedObj.objects);
            }
          });
        };

        // Process rasterized membranes - they store vector data for edit mode
        if (obj.isRasterizedMembrane && objData.vectorObjects && objData.vectorObjects.objects) {
          stripNestedIcons(objData.vectorObjects.objects);
        }

        // Process membrane groups - strip icons inside them
        if (obj.isMembraneShape && objData.objects) {
          stripNestedIcons(objData.objects);
        }

        // Strip selection-only shadow so it doesn't persist in history
        if (obj._selectionShadow) {
          delete objData.shadow;
        }

        return objData;
      }),
      background: canvas.backgroundColor || '',
    };

    return JSON.stringify(canvasData);
  }

  /**
   * Fast-path save for simple transform operations (move, resize, rotate).
   * Captures only the changed object's properties directly from the event,
   * skipping full canvas serialization. Falls back to full saveState if:
   * - No previous full snapshot exists to diff against
   * - The operation is complex (add/delete/group)
   * - We're due for a full snapshot (every 10th step)
   */
  saveTransformDelta(canvas: FabricCanvas, target: any, action?: string): boolean {
    if (this.isRestoring || this.isInTransaction) return false;

    // Need a full snapshot base to build diffs from
    if (this.history.length === 0 || this.currentStep === -1) return false;

    // Force full snapshot every 10th step for safety
    if ((this.currentStep + 1) % 10 === 0) return false;

    // Only handle simple transform actions
    const simpleActions = ['drag', 'scale', 'scaleX', 'scaleY', 'rotate', 'move'];
    if (action && !simpleActions.includes(action)) return false;

    // Must have an object ID to track
    if (!target?.id) return false;

    // Find the nearest full snapshot to use as base
    let baseIndex = this.currentStep;
    while (baseIndex >= 0 && this.history[baseIndex].isDiff) {
      baseIndex = this.history[baseIndex].baseIndex ?? -1;
    }
    if (baseIndex < 0) return false;

    // Capture only transform + style properties from the live object
    const delta: any = {
      id: target.id,
      left: target.left,
      top: target.top,
      scaleX: target.scaleX,
      scaleY: target.scaleY,
      angle: target.angle,
      width: target.width,
      height: target.height,
      flipX: target.flipX,
      flipY: target.flipY,
      skewX: target.skewX,
      skewY: target.skewY,
    };

    const diff = {
      objects: {
        added: [] as any[],
        modified: [delta],
        removed: [] as any[],
      }
    };

    const diffJson = JSON.stringify(diff);
    const diffCompressed = LZString.compress(diffJson);

    const entry: DifferentialHistoryEntry = {
      compressed: diffCompressed,
      timestamp: Date.now(),
      objectCount: undefined,
      isDiff: true,
      baseIndex,
      label: `transform:${action || 'move'}`,
      eventType: action,
    };

    this.addEntry(entry);

    // Update lastSavedJson cache — since we skipped full serialization,
    // null it out so the next full saveState doesn't skip as "duplicate"
    this.lastSavedJson = null;

    return true; // fast path succeeded
  }

  /**
   * Save current canvas state
   * Automatically determines whether to store full state or differential
   */
  saveState(canvas: FabricCanvas, label?: string, eventType?: string): void {
    // Don't save during undo/redo operations
    if (this.isRestoring) {
      return;
    }

    // Don't save during transactions - will save once when transaction commits
    if (this.isInTransaction) {
      return;
    }

    const startTime = performance.now();
    const currentJson = this.getFilteredCanvasJSON(canvas);
    const serializationTime = performance.now() - startTime;
    const jsonSizeKB = (currentJson.length / 1024).toFixed(2);
    const parsed = JSON.parse(currentJson);
    const objectCount = parsed.objects?.length || 0;

    // Warn about performance issues
    if (parseFloat(jsonSizeKB) > 1000) {
      console.error(`[HISTORY] Large save: ${jsonSizeKB} KB - icon-by-reference may not be working`);
    }

    if (serializationTime > 100) {
      console.warn(`[HISTORY] Slow save: ${serializationTime.toFixed(0)}ms for ${objectCount} objects`);
    }

    // Check if this state is identical to the last saved state.
    // Use cached JSON so duplicate detection works even when the last entry is a diff.
    if (this.lastSavedJson && this.lastSavedJson === currentJson) {
      return;
    }

    // Diagnostic: log destructive saves so the caller shows up in the console.
    // We do NOT block here — a legit mass-delete (Select All + Delete) needs to
    // save the empty state so undo can restore it. But the STACK TRACE tells us
    // which code path triggered any spurious save, which is the root-cause hunt.
    if (this.lastSavedJson) {
      try {
        const prevCount = JSON.parse(this.lastSavedJson).objects?.length || 0;
        if (prevCount >= 10 && objectCount <= prevCount * 0.1) {
          console.warn(
            `[HISTORY] Destructive save: ${prevCount} -> ${objectCount} objects. ` +
            `label=${label ?? 'none'} eventType=${eventType ?? 'none'}. ` +
            `If this was NOT a Select-All + Delete, this save is likely spurious.\n` +
            `Stack:\n${new Error().stack}`
          );
        }
      } catch { /* ignore parse errors */ }
    }

    // Update cache for future duplicate detection
    this.lastSavedJson = currentJson;

    // If this is the first entry or we're at a full state checkpoint, store full state
    const shouldStoreFullState =
      this.history.length === 0 ||
      this.currentStep === -1 ||
      (this.currentStep + 1) % 10 === 0; // Full state every 10 steps

    if (shouldStoreFullState) {
      const compressed = LZString.compress(currentJson);
      const entry: DifferentialHistoryEntry = {
        compressed,
        timestamp: Date.now(),
        objectCount,
        isDiff: false,
        label,
        eventType
      };

      this.addEntry(entry);
    } else {
      // Calculate differential from previous state
      const prevEntry = this.history[this.currentStep];
      if (prevEntry && !prevEntry.isDiff) {
        const prevJson = LZString.decompress(prevEntry.compressed);
        const diff = this.calculateDiff(prevJson!, currentJson);
        const diffCompressed = LZString.compress(JSON.stringify(diff));

        // If diff is too large, store full state instead
        if (diffCompressed.length > currentJson.length * this.diffThreshold) {
          const compressed = LZString.compress(currentJson);
          const entry: DifferentialHistoryEntry = {
            compressed,
            timestamp: Date.now(),
            objectCount,
            isDiff: false,
            label,
            eventType
          };
          this.addEntry(entry);
        } else {
          const entry: DifferentialHistoryEntry = {
            compressed: diffCompressed,
            timestamp: Date.now(),
            objectCount,
            isDiff: true,
            baseIndex: this.currentStep,
            label,
            eventType
          };
          this.addEntry(entry);
        }
      } else {
        // Fallback to full state
        const compressed = LZString.compress(currentJson);
        const entry: DifferentialHistoryEntry = {
          compressed,
          timestamp: Date.now(),
          objectCount,
          isDiff: false,
          label,
          eventType
        };
        this.addEntry(entry);
      }
    }
  }

  /**
   * Reconstruct a differential state as a full state
   */
  private reconstructDifferentialToFull(historyEntry: DifferentialHistoryEntry, baseEntry: DifferentialHistoryEntry): DifferentialHistoryEntry {
    const baseJson = LZString.decompress(baseEntry.compressed);
    const diff = JSON.parse(LZString.decompress(historyEntry.compressed)!);

    if (baseJson) {
      const base = JSON.parse(baseJson);
      const reconstructed = this.applyDiff(base, diff);
      const reconstructedJson = JSON.stringify(reconstructed);

      return {
        ...historyEntry,
        compressed: LZString.compress(reconstructedJson),
        isDiff: false,
        baseIndex: undefined
      };
    }

    // Fallback if reconstruction fails
    return { ...historyEntry, isDiff: false, baseIndex: undefined };
  }

  /**
   * Add entry to history and manage size limits
   */
  private addEntry(entry: DifferentialHistoryEntry): void {
    // Remove any entries after current step
    this.history = this.history.slice(0, this.currentStep + 1);

    // Add new entry
    this.history.push(entry);

    // Limit history size
    if (this.history.length > this.maxSize) {
      const numDropped = this.history.length - this.maxSize;

      // Before slicing, identify differentials whose bases will be dropped and reconstruct them
      const updatedHistory: DifferentialHistoryEntry[] = [];

      for (let i = 0; i < this.history.length; i++) {
        const historyEntry = this.history[i];

        // If this entry will be kept after slicing
        if (i >= numDropped) {
          if (historyEntry.isDiff && historyEntry.baseIndex !== undefined) {
            // Check if base will be dropped
            if (historyEntry.baseIndex < numDropped) {
              // Base will be dropped - reconstruct this differential as full state
              const baseEntry = this.history[historyEntry.baseIndex];
              updatedHistory.push(this.reconstructDifferentialToFull(historyEntry, baseEntry));
            } else {
              // Base will be kept - adjust baseIndex
              updatedHistory.push({
                ...historyEntry,
                baseIndex: historyEntry.baseIndex - numDropped
              });
            }
          } else {
            // Full state or no adjustment needed
            updatedHistory.push(historyEntry);
          }
        }
      }

      this.history = updatedHistory;
    }

    this.currentStep = this.history.length - 1;
  }

  /**
   * Calculate property-level diff between two objects
   */
  private calculatePropertyDiff(prevObj: any, currentObj: any): any {
    const propertyDiff: any = {
      id: currentObj.id // Include ID for matching during apply
    };

    // Compare each property
    for (const key in currentObj) {
      if (currentObj.hasOwnProperty(key)) {
        const prevValue = prevObj[key];
        const currentValue = currentObj[key];

        // Use JSON.stringify for deep comparison (handles objects/arrays)
        if (JSON.stringify(prevValue) !== JSON.stringify(currentValue)) {
          propertyDiff[key] = currentValue;
        }
      }
    }

    return propertyDiff;
  }

  /**
   * Calculate diff between two JSON strings with property-level granularity
   */
  private calculateDiff(prevJson: string, currentJson: string): any {
    try {
      const prev = JSON.parse(prevJson);
      const current = JSON.parse(currentJson);

      const diff: any = {
        objects: {
          added: [],
          modified: [],
          removed: []
        }
      };

      // Compare objects
      const prevObjects = prev.objects || [];
      const currentObjects = current.objects || [];

      const prevMap = new Map(prevObjects.map((obj: any, idx: number) => [obj.id || idx, obj]));
      const currentMap = new Map(currentObjects.map((obj: any, idx: number) => [obj.id || idx, obj]));

      // Find added and modified objects
      currentObjects.forEach((obj: any, idx: number) => {
        const id = obj.id || idx;
        if (!prevMap.has(id)) {
          // New object - store entire object
          diff.objects.added.push(obj);
        } else {
          const prevObj = prevMap.get(id);
          if (JSON.stringify(prevObj) !== JSON.stringify(obj)) {
            // Object modified - store only changed properties
            const propertyDiff = this.calculatePropertyDiff(prevObj, obj);
            // Only include if there are actual changes beyond just the ID
            if (Object.keys(propertyDiff).length > 1) {
              diff.objects.modified.push(propertyDiff);
            }
          }
        }
      });

      // Find removed objects
      prevObjects.forEach((obj: any, idx: number) => {
        const id = obj.id || idx;
        if (!currentMap.has(id)) {
          diff.objects.removed.push(id);
        }
      });

      // Compare other properties
      if (prev.background !== current.background) {
        diff.background = current.background;
      }

      return diff;
    } catch (error) {
      return null;
    }
  }

  /**
   * Restore state at given step using property-based updates.
   * Icons stay in memory - only their properties are updated.
   *
   * `guardDestructive` toggles the "refuse to wipe the canvas" safety check.
   * Only undo() passes true — redo and the edit-mode-refresh path must always
   * succeed because the user explicitly asked to move forward or reload the
   * current step, and a legitimate destructive action (e.g. Select All+Delete)
   * needs to be reachable via redo.
   */
  async restoreState(canvas: FabricCanvas, step: number, guardDestructive = false): Promise<void> {
    if (step < 0 || step >= this.history.length) {
      throw new Error('Invalid history step');
    }

    const entry = this.history[step];

    // Preserve grid lines and rulers
    const nonUserObjects = canvas.getObjects().filter((obj: any) => obj.isGridLine || obj.isRuler);

    // Reconstruct the target state data first (do NOT touch canvas yet).
    let stateData: any = null;
    if (!entry.isDiff) {
      const json = LZString.decompress(entry.compressed);
      if (json) stateData = JSON.parse(json);
    } else {
      const baseIndex = entry.baseIndex!;
      const baseEntry = this.history[baseIndex];

      if (!baseEntry || baseEntry.isDiff) {
        throw new Error('Invalid base entry for differential state');
      }

      const baseJson = LZString.decompress(baseEntry.compressed);
      const diffJson = LZString.decompress(entry.compressed);
      if (baseJson && diffJson) {
        stateData = this.applyDiff(JSON.parse(baseJson), JSON.parse(diffJson));
      }
    }

    if (!stateData) {
      throw new Error('Failed to reconstruct history state');
    }

    // Safety guard (undo only): catch the ONE catastrophic case that motivated
    // this whole thing — an undo that empties a canvas with lots of work on it,
    // caused by a corrupted/race-saved empty history entry. Anything narrower
    // (proportional-drop checks, small-canvas empties) produced false positives
    // and made legitimate undos silently no-op — worse UX than the original bug.
    // The autosave pause is the second line of defense: even if this misses,
    // nothing gets persisted for 30s so the user can redo.
    if (guardDestructive) {
      const targetObjectCount = Array.isArray(stateData.objects) ? stateData.objects.length : 0;
      const currentUserObjectCount = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.excludeFromExport &&
        !obj.isControlHandle && !obj.isHandleLine && !obj.isAnchorHandle && !obj.isGuideLine &&
        !obj.isEndpointMarker && !obj.isConnectionPoint && !obj.isPortIndicator && !obj.isFeedback
      ).length;

      if (targetObjectCount === 0 && currentUserObjectCount >= 10) {
        console.warn(`[HISTORY] Destructive undo blocked (empty target, ${currentUserObjectCount} objects on canvas). step=${step} isDiff=${entry.isDiff} baseIndex=${entry.baseIndex}`);
        throw new Error('EMPTY_STATE_RESTORE_BLOCKED');
      }
    }

    await this.restoreStateFromData(canvas, stateData, nonUserObjects);
    this.currentStep = step;
  }

  /**
   * Property-based restoration - updates existing objects instead of recreating
   */
  private async restoreStateFromData(canvas: FabricCanvas, savedData: any, nonUserObjects: any[]): Promise<void> {
    const restoreStart = performance.now();
    const savedObjects = savedData.objects || [];

    // Map current canvas objects by ID
    // Filter to match getFilteredCanvasJSON — only user objects participate in restore.
    // Transient/derived objects (handles, markers, connection points) are excluded
    // here to avoid spurious removals; they are recreated by reconnect functions.
    const currentObjects = canvas.getObjects().filter((obj: any) =>
      !obj.isGridLine && !obj.isRuler && !obj.excludeFromExport &&
      !obj.isControlHandle && !obj.isHandleLine && !obj.isAnchorHandle && !obj.isGuideLine &&
      !obj.isEndpointMarker && !obj.isConnectionPoint && !obj.isPortIndicator && !obj.isFeedback
    );
    const currentObjectsMap = new Map(currentObjects.map((obj: any) => [obj.id, obj]));

    const iconReferences = savedObjects.filter((o: any) => o.isIconReference).length;

    // Track which objects to keep
    const objectsToKeep = new Set<any>();
    let updated = 0;
    let created = 0;
    let removed = 0;
    let iconsFetched = 0;

    // Process each saved object
    for (const savedObjData of savedObjects) {
      const existingObj = currentObjectsMap.get(savedObjData.id);

      if (existingObj && savedObjData.isIconReference) {
        // Icon exists on canvas - just update properties
        this.updateObjectProperties(existingObj, savedObjData);
        objectsToKeep.add(existingObj);
        updated++;
      } else if (!existingObj && savedObjData.isIconReference) {
        // Icon doesn't exist - need to create it (fetch SVG from database)
        const newObj = await this.createIconFromReference(savedObjData);
        if (newObj) {
          canvas.add(newObj);
          objectsToKeep.add(newObj);
          created++;
          iconsFetched++;
        }
      } else if (existingObj && !savedObjData.isIconReference) {
        // Regular object exists. Decide between fast in-place update
        // and a full recreate via createObjectFromJSON.
        //
        // updateObjectProperties cannot rebuild Fabric bounds for nested
        // structural data: a Group's `objects` array, or a Path's `path`/`points`
        // arrays. If the saved snapshot has any of those AND it differs
        // from the live object's current value, we must recreate the
        // object — otherwise the parent's transform/style restores while
        // its children (bands, cells, segments, etc.) stay stale, which
        // is the "Undo deleted half of the Figure" bug.
        const structureChanged =
          (Array.isArray(savedObjData.objects) &&
            !pathOrPointsEqual(savedObjData.objects, (existingObj as any)._objects || (existingObj as any).getObjects?.())) ||
          (Array.isArray(savedObjData.path) &&
            !pathOrPointsEqual(savedObjData.path, (existingObj as any).path)) ||
          (Array.isArray(savedObjData.points) &&
            !pathOrPointsEqual(savedObjData.points, (existingObj as any).points));

        if (structureChanged) {
          const originalIndex = currentObjects.indexOf(existingObj);
          canvas.remove(existingObj);
          const newObj = await this.createObjectFromJSON(savedObjData);
          if (newObj) {
            // Preserve id so subsequent diffs continue to match.
            (newObj as any).id = savedObjData.id;
            canvas.add(newObj);
            if (originalIndex >= 0 && typeof (canvas as any).moveObjectTo === 'function') {
              try { (canvas as any).moveObjectTo(newObj, originalIndex); } catch { /* z-order best effort */ }
            }
            objectsToKeep.add(newObj);
            created++;
          }
        } else {
          this.updateObjectProperties(existingObj, savedObjData);
          objectsToKeep.add(existingObj);
          updated++;
        }
      } else {
        // Regular object doesn't exist - create from JSON
        const newObj = await this.createObjectFromJSON(savedObjData);
        if (newObj) {
          canvas.add(newObj);
          objectsToKeep.add(newObj);
          created++;
        }
      }
    }

    // Remove objects that aren't in saved state
    for (const currentObj of currentObjects) {
      if (!objectsToKeep.has(currentObj)) {
        canvas.remove(currentObj);
        removed++;
      }
    }

    // Remove existing grid lines and rulers before re-adding (prevent duplication)
    const existingNonUserObjects = canvas.getObjects().filter((obj: any) => obj.isGridLine || obj.isRuler);
    existingNonUserObjects.forEach(obj => canvas.remove(obj));

    const restoreTime = performance.now() - restoreStart;

    if (restoreTime > 200) {
      console.warn(`[HISTORY] Slow restore: ${restoreTime.toFixed(0)}ms (${iconsFetched} icons fetched from database)`);
    }

    // Re-add grid lines and rulers from saved state
    if (nonUserObjects.length > 0) {
      const { util } = await import('fabric');
      const nonUserObjectsJSON = nonUserObjects.map(obj => obj.toObject(['isGridLine', 'isRuler']));
      const enlivenedObjects = await enlivenObjects(nonUserObjectsJSON);

      const gridObjects = enlivenedObjects.filter((obj: any) => obj.isGridLine);
      const rulerObjects = enlivenedObjects.filter((obj: any) => obj.isRuler);

      gridObjects.forEach(obj => {
        obj.set({ selectable: false, evented: false, hasControls: false, hasBorders: false });
        canvas.add(obj);
      });

      for (let i = gridObjects.length - 1; i >= 0; i--) {
        canvas.sendObjectToBack(gridObjects[i]);
      }

      rulerObjects.forEach(obj => {
        obj.set({ selectable: false, evented: false, hasControls: false, hasBorders: false });
        canvas.add(obj);
        canvas.bringObjectToFront(obj);
      });
    }

    canvas.requestRenderAll();
  }

  /**
   * Update object properties without recreating it
   */
  private updateObjectProperties(obj: any, savedData: any): void {
    // Update transform properties
    const transformProps = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'skewX', 'skewY'];
    transformProps.forEach(prop => {
      if (savedData[prop] !== undefined) {
        obj.set(prop, savedData[prop]);
      }
    });

    // Update style properties
    const styleProps = ['fill', 'stroke', 'strokeWidth', 'opacity', 'visible', 'shadow'];
    styleProps.forEach(prop => {
      if (savedData[prop] !== undefined) {
        obj.set(prop, savedData[prop]);
      }
    });

    // Update geometry properties that change during resize, edit, etc.
    // NOTE: 'path' and 'points' are intentionally excluded — setting them via
    // .set() does not trigger Fabric's internal recalculations (pathOffset,
    // bounding box, etc.). Objects whose path/points change are better
    // recreated via createObjectFromJSON than updated in-place.
    const geometryProps = [
      'width', 'height', 'rx', 'ry', 'radius',
      'x1', 'y1', 'x2', 'y2', // Line endpoints
      'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
      'textAlign', 'lineHeight', 'charSpacing', 'underline', 'overline',
      'strokeDashArray', 'strokeLineCap', 'strokeLineJoin',
    ];
    geometryProps.forEach(prop => {
      if (savedData[prop] !== undefined) {
        obj.set(prop, savedData[prop]);
      }
    });

    // Update custom properties — sourced from src/lib/historyProps.ts so
    // this list cannot drift from CUSTOM_PROPS in getFilteredCanvasJSON.
    HISTORY_CUSTOM_PROPS.forEach(prop => {
      if (savedData[prop] !== undefined) {
        obj[prop] = savedData[prop];
      }
    });

    // Defense in depth: if a structural array (objects/path/points) reached
    // this code path despite the recreate dispatch in restoreStateFromData,
    // assign it so the value isn't silently lost. The dispatch path is the
    // primary fix; this is a backstop against future code paths bypassing it.
    if (savedData.objects !== undefined && Array.isArray(savedData.objects)) {
      obj.objects = savedData.objects;
    }
    if (savedData.path !== undefined) {
      obj.path = savedData.path;
    }
    if (savedData.points !== undefined) {
      obj.points = savedData.points;
    }

    if (typeof obj._calcBounds === 'function') {
      try { obj._calcBounds(); } catch { /* best effort */ }
    }
    obj.setCoords();
  }

  /**
   * Create icon from reference (fetch SVG if needed)
   */
  private async createIconFromReference(savedData: any): Promise<any> {
    if (!this.iconReconstructor) {
      console.error('[HISTORY] No icon reconstructor available');
      return null;
    }

    // Reconstruct the icon data
    const tempData = { objects: [savedData] };
    await this.iconReconstructor(tempData);

    // Now create from the reconstructed data
    return await this.createObjectFromJSON(tempData.objects[0]);
  }

  /**
   * Create object from JSON data
   */
  private async createObjectFromJSON(objData: any): Promise<any> {
    const { util } = await import('fabric');

    return new Promise((resolve, reject) => {
      try {
        const maybe = (util as any).enlivenObjects([objData], (objects: any[]) => {
          resolve(objects[0]);
        });
        if (maybe && typeof (maybe as any).then === 'function') {
          (maybe as any).then((objects: any[]) => resolve(objects[0])).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }


  /**
   * Apply diff to base state
   */
  private applyDiff(base: any, diff: any): any {
    const result = { ...base };

    if (diff.objects) {
      const objects = [...(base.objects || [])];
      
      // Remove objects
      if (diff.objects.removed && diff.objects.removed.length > 0) {
        const removedIds = new Set(diff.objects.removed);
        result.objects = objects.filter((obj: any, idx: number) => {
          const id = obj.id || idx;
          return !removedIds.has(id);
        });
      } else {
        result.objects = objects;
      }

      // Add objects
      if (diff.objects.added && diff.objects.added.length > 0) {
        result.objects = [...result.objects, ...diff.objects.added];
      }

      // Modify objects - merge property-level changes
      if (diff.objects.modified && diff.objects.modified.length > 0) {
        const modifiedMap = new Map(
          diff.objects.modified.map((propertyDiff: any) => [propertyDiff.id, propertyDiff])
        );
        result.objects = result.objects.map((obj: any) => {
          const id = obj.id;
          if (modifiedMap.has(id)) {
            // Merge changed properties with base object
            const propertyDiff = modifiedMap.get(id);
            return { ...obj, ...propertyDiff };
          }
          return obj;
        });
      }
    }

    // Apply other property changes
    if (diff.background !== undefined) {
      result.background = diff.background;
    }

    return result;
  }

  /**
   * Undo to previous state
   */
  async undo(canvas: FabricCanvas): Promise<boolean> {
    if (this.currentStep <= 0) {
      return false;
    }

    this.isRestoring = true;
    try {
      await this.restoreState(canvas, this.currentStep - 1, /* guardDestructive */ true);
      return true;
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Redo to next state
   */
  async redo(canvas: FabricCanvas): Promise<boolean> {
    if (this.currentStep >= this.history.length - 1) {
      return false;
    }

    this.isRestoring = true;
    try {
      await this.restoreState(canvas, this.currentStep + 1);
      return true;
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentStep > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentStep < this.history.length - 1;
  }

  /**
   * Get current history step
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get history length
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentStep = -1;
  }

  /**
   * Get memory usage estimate (in bytes)
   */
  getMemoryUsage(): number {
    return this.history.reduce((total, entry) => {
      return total + entry.compressed.length * 2; // UTF-16 characters
    }, 0);
  }

  /**
   * Start a transaction - multiple saves will be grouped
   */
  beginTransaction(canvas?: FabricCanvas): void {
    if (this.isInTransaction) {
      return;
    }

    this.isInTransaction = true;
    this.transactionStartStep = this.currentStep;
    this.transactionCanvas = canvas || null;

    // Auto-commit after timeout (safety)
    if (this.transactionTimer) clearTimeout(this.transactionTimer);
    this.transactionTimer = setTimeout(() => {
      this.commitTransaction();
    }, this.TRANSACTION_TIMEOUT);
  }

  /**
   * Commit transaction - saves the final state
   */
  commitTransaction(canvas?: FabricCanvas): void {
    if (!this.isInTransaction) {
      return;
    }

    if (this.transactionTimer) {
      clearTimeout(this.transactionTimer);
      this.transactionTimer = null;
    }

    this.isInTransaction = false;
    this.transactionStartStep = -1;

    // Save the final state after transaction ends
    // Use provided canvas or stored transaction canvas
    const canvasToSave = canvas || this.transactionCanvas;
    if (canvasToSave) {
      this.saveState(canvasToSave);
    }

    this.transactionCanvas = null;
  }

  /**
   * Cancel transaction - revert to transaction start
   */
  cancelTransaction(): void {
    if (!this.isInTransaction) return;

    if (this.transactionTimer) {
      clearTimeout(this.transactionTimer);
      this.transactionTimer = null;
    }

    // Remove all states after transaction start
    if (this.transactionStartStep >= 0) {
      this.history = this.history.slice(0, this.transactionStartStep + 1);
      this.currentStep = this.transactionStartStep;
    }

    this.isInTransaction = false;
    this.transactionStartStep = -1;
    this.transactionCanvas = null;
  }
}
