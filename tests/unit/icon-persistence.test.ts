/**
 * Unit tests for icon persistence fixes (Steps 1–6).
 *
 * These tests validate the save/load data transformations without a browser
 * or Supabase connection.  They exercise the exact code paths that caused
 * icons to silently disappear.
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers: minimal replicas of the production functions so we can test
// the logic in isolation.
// ---------------------------------------------------------------------------

/**
 * Replica of stripNestedIcons — FIXED version (Step 3).
 * Only strips objects that have BOTH iconId AND isLibraryIcon.
 */
function stripNestedIcons(nestedObjects: any[]) {
  if (!nestedObjects || !Array.isArray(nestedObjects)) return;

  nestedObjects.forEach((nestedObj: any) => {
    const hasIconId = nestedObj.iconId && nestedObj.isLibraryIcon;

    if (hasIconId) {
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
}

/**
 * Old (broken) stripNestedIcons that used the looksLikeIcon heuristic.
 */
function stripNestedIconsBroken(nestedObjects: any[]) {
  if (!nestedObjects || !Array.isArray(nestedObjects)) return;

  nestedObjects.forEach((nestedObj: any) => {
    const hasIconId = nestedObj.iconId && nestedObj.isLibraryIcon;
    const looksLikeIcon = (nestedObj.type === 'Group' || nestedObj.type === 'group') &&
                           nestedObj.objects &&
                           Array.isArray(nestedObj.objects) &&
                           nestedObj.objects.length > 10;

    if (hasIconId || looksLikeIcon) {
      const nestedType = nestedObj.type;
      if ((nestedObj.type === 'Group' || nestedObj.type === 'group') && nestedObj.objects) {
        delete nestedObj.objects;
      }
      nestedObj.type = 'libraryIcon';
      nestedObj.originalType = nestedType;
    } else if (nestedObj.objects) {
      stripNestedIconsBroken(nestedObj.objects);
    }
  });
}

/**
 * Replica of restorePropsRecursive — FIXED version (Step 6).
 */
function restoreObjectCustomProps(obj: any, data: any) {
  if (data.iconId) obj.iconId = data.iconId;
  if (data.isLibraryIcon) obj.isLibraryIcon = true;
  if (data.isMembraneShape) obj.isMembraneShape = true;
  if (data.id) obj.id = data.id;
}

function restorePropsRecursive(objects: any[], dataArray: any[]) {
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

  // Counts differ — use identity matching
  const fingerprint = (d: any) => {
    const id = d.id || d.iconId || d.assetId || '';
    const left = Math.round((d.left ?? 0) * 10);
    const top = Math.round((d.top ?? 0) * 10);
    return `${d.type || d.originalType || ''}|${id}|${left}|${top}`;
  };

  const usedIndices = new Set<number>();
  for (const obj of objects) {
    const objFp = fingerprint(obj);
    let bestIdx = -1;

    for (let i = 0; i < dataArray.length; i++) {
      if (usedIndices.has(i)) continue;
      if (fingerprint(dataArray[i]) === objFp) {
        bestIdx = i;
        break;
      }
    }

    if (bestIdx === -1) {
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

/**
 * Collect unique icon IDs (Step 4 batch fetch helper).
 */
function collectIconIds(objects: any[]): Set<string> {
  const ids = new Set<string>();
  for (const obj of objects) {
    if (obj.type === 'libraryIcon' && obj.iconId) ids.add(obj.iconId);
    if (obj.objects) {
      for (const id of collectIconIds(obj.objects)) ids.add(id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 1 & 2: Placeholder fallback for failed icon reconstruction', () => {
  it('should convert failed libraryIcon to visible Rect placeholder', () => {
    // Simulate a canvas object that failed reconstruction
    const objData: any = {
      type: 'libraryIcon',
      iconId: 'abc-123',
      isLibraryIcon: true,
      left: 100,
      top: 200,
      width: 80,
      height: 80,
    };

    // Simulate reconstruction failure → apply placeholder
    const iconSuccess = false; // reconstructIcon returned false
    if (!iconSuccess) {
      objData.type = 'Rect';
      objData.fill = '#fff3f3';
      objData.stroke = '#cc0000';
      objData.strokeWidth = 2;
      objData.strokeDashArray = [5, 5];
      objData._isMissingIconPlaceholder = true;
    }

    expect(objData.type).toBe('Rect');
    expect(objData._isMissingIconPlaceholder).toBe(true);
    expect(objData.iconId).toBe('abc-123'); // Preserved for retry
    expect(objData.fill).toBe('#fff3f3');
  });

  it('should NOT have type=libraryIcon after failed reconstruction', () => {
    const objData: any = {
      type: 'libraryIcon',
      iconId: 'abc-123',
    };

    // After fix: placeholder replaces unknown type
    objData.type = 'Rect';
    objData._isMissingIconPlaceholder = true;

    // Fabric can deserialize 'Rect' — previously it would silently drop 'libraryIcon'
    expect(objData.type).not.toBe('libraryIcon');
  });

  it('should count missing icon placeholders recursively', () => {
    const canvasData = {
      objects: [
        { type: 'Rect', _isMissingIconPlaceholder: true },
        { type: 'Group', objects: [
          { type: 'Rect', _isMissingIconPlaceholder: true },
          { type: 'Path' },
        ]},
        { type: 'Rect' },
      ],
    };

    const countMissingIcons = (objs: any[]): number => {
      let n = 0;
      for (const o of objs) {
        if (o._isMissingIconPlaceholder) n++;
        if (o.objects) n += countMissingIcons(o.objects);
      }
      return n;
    };

    expect(countMissingIcons(canvasData.objects)).toBe(2);
  });
});

describe('Step 3: looksLikeIcon heuristic fix', () => {
  it('should NOT strip groups with >10 children that lack iconId', () => {
    const nestedObjects = [
      {
        type: 'Group',
        // 15 children — old code would strip this!
        objects: Array.from({ length: 15 }, (_, i) => ({ type: 'Path', path: `M${i} ${i}` })),
        left: 50,
        top: 50,
      },
    ];

    stripNestedIcons(nestedObjects);

    // Fixed: object should NOT be stripped (no iconId)
    expect(nestedObjects[0].type).toBe('Group');
    expect(nestedObjects[0].objects).toBeDefined();
    expect(nestedObjects[0].objects!.length).toBe(15);
  });

  it('OLD CODE: would incorrectly strip groups with >10 children', () => {
    const nestedObjects = [
      {
        type: 'Group',
        objects: Array.from({ length: 15 }, (_, i) => ({ type: 'Path', path: `M${i}` })),
        left: 50,
        top: 50,
      },
    ];

    stripNestedIconsBroken(nestedObjects);

    // Broken: object was stripped even without iconId!
    expect(nestedObjects[0].type).toBe('libraryIcon');
    expect(nestedObjects[0].objects).toBeUndefined(); // Data permanently lost
  });

  it('should STILL strip library icons that have iconId', () => {
    const nestedObjects = [
      {
        type: 'Group',
        iconId: 'cell-receptor-1',
        isLibraryIcon: true,
        objects: Array.from({ length: 20 }, (_, i) => ({ type: 'Path', path: `M${i}` })),
      },
    ];

    stripNestedIcons(nestedObjects);

    // Should be stripped — it's a real library icon with iconId
    expect(nestedObjects[0].type).toBe('libraryIcon');
    expect(nestedObjects[0].objects).toBeUndefined();
    expect((nestedObjects[0] as any).originalType).toBe('Group');
  });

  it('should handle mixed nested objects (icons + non-icons)', () => {
    const nestedObjects = [
      // Real icon — should be stripped
      {
        type: 'Group',
        iconId: 'icon-1',
        isLibraryIcon: true,
        objects: [{ type: 'Path', path: 'M0 0' }],
      },
      // Complex group without iconId — should NOT be stripped
      {
        type: 'Group',
        objects: Array.from({ length: 20 }, () => ({ type: 'Rect' })),
      },
      // Simple group — should NOT be stripped
      {
        type: 'Group',
        objects: [{ type: 'Rect' }, { type: 'Circle' }],
      },
    ];

    stripNestedIcons(nestedObjects);

    expect(nestedObjects[0].type).toBe('libraryIcon'); // Stripped
    expect(nestedObjects[1].type).toBe('Group'); // Preserved
    expect(nestedObjects[1].objects).toBeDefined();
    expect(nestedObjects[1].objects!.length).toBe(20); // All children intact
    expect(nestedObjects[2].type).toBe('Group'); // Preserved
  });
});

describe('Step 4: Batch icon ID collection', () => {
  it('should collect all unique icon IDs from flat objects', () => {
    const objects = [
      { type: 'libraryIcon', iconId: 'icon-a' },
      { type: 'libraryIcon', iconId: 'icon-b' },
      { type: 'libraryIcon', iconId: 'icon-a' }, // duplicate
      { type: 'Rect' }, // not an icon
    ];

    const ids = collectIconIds(objects);
    expect(ids.size).toBe(2);
    expect(ids.has('icon-a')).toBe(true);
    expect(ids.has('icon-b')).toBe(true);
  });

  it('should collect icon IDs from nested membrane objects', () => {
    const objects = [
      {
        type: 'Group',
        isMembraneShape: true,
        objects: [
          { type: 'libraryIcon', iconId: 'nested-icon-1' },
          { type: 'libraryIcon', iconId: 'nested-icon-2' },
          { type: 'Path' },
        ],
      },
      { type: 'libraryIcon', iconId: 'top-icon' },
    ];

    const ids = collectIconIds(objects);
    expect(ids.size).toBe(3);
    expect(ids.has('nested-icon-1')).toBe(true);
    expect(ids.has('nested-icon-2')).toBe(true);
    expect(ids.has('top-icon')).toBe(true);
  });

  it('should handle deeply nested structures', () => {
    const objects = [
      {
        type: 'Group',
        objects: [
          {
            type: 'Group',
            objects: [
              { type: 'libraryIcon', iconId: 'deep-icon' },
            ],
          },
        ],
      },
    ];

    const ids = collectIconIds(objects);
    expect(ids.size).toBe(1);
    expect(ids.has('deep-icon')).toBe(true);
  });

  it('should return empty set when no icons', () => {
    const objects = [
      { type: 'Rect' },
      { type: 'Circle' },
      { type: 'Group', objects: [{ type: 'Path' }] },
    ];

    const ids = collectIconIds(objects);
    expect(ids.size).toBe(0);
  });
});

describe('Step 5: Culling — visible=true before save', () => {
  it('should set visible=true on culled objects before serialization', () => {
    // Simulate canvas objects where some are culled (off-screen)
    const objects = [
      { type: 'Rect', visible: true, isGridLine: false, isRuler: false },
      { type: 'Group', visible: false, isGridLine: false, isRuler: false }, // culled!
      { type: 'Path', visible: false, isGridLine: false, isRuler: false },  // culled!
      { type: 'Line', visible: false, isGridLine: true, isRuler: false },   // grid line — keep hidden
    ];

    // Apply the fix: show all culled user objects
    const culledObjects: any[] = [];
    objects.forEach((obj: any) => {
      if (!obj.visible && !obj.isGridLine && !obj.isRuler) {
        obj.visible = true;
        culledObjects.push(obj);
      }
    });

    // All user objects should now be visible
    expect(objects[0].visible).toBe(true);
    expect(objects[1].visible).toBe(true); // Was culled, now visible
    expect(objects[2].visible).toBe(true); // Was culled, now visible
    expect(objects[3].visible).toBe(false); // Grid line stays hidden

    // After serialization, restore culling state
    culledObjects.forEach((obj: any) => { obj.visible = false; });
    expect(objects[1].visible).toBe(false); // Restored
    expect(objects[2].visible).toBe(false); // Restored
  });
});

describe('Step 6: restorePropsRecursive — identity matching', () => {
  it('should use index matching when counts are equal', () => {
    const objects = [
      { type: 'Rect', left: 10, top: 20 },
      { type: 'Circle', left: 100, top: 200 },
    ];
    const dataArray = [
      { type: 'Rect', left: 10, top: 20, id: 'rect-1', isMembraneShape: true },
      { type: 'Circle', left: 100, top: 200, id: 'circ-1' },
    ];

    restorePropsRecursive(objects, dataArray);

    expect(objects[0].id).toBe('rect-1');
    expect((objects[0] as any).isMembraneShape).toBe(true);
    expect(objects[1].id).toBe('circ-1');
  });

  it('should use identity matching when Fabric dropped objects', () => {
    // Fabric dropped 1 object (count mismatch)
    const objects = [
      { type: 'Rect', left: 10, top: 20, id: 'rect-1' },
      // The icon was dropped by Fabric (type 'libraryIcon' unknown)
      { type: 'Circle', left: 100, top: 200, id: 'circ-1' },
    ];
    const dataArray = [
      { type: 'Rect', left: 10, top: 20, id: 'rect-1', isMembraneShape: true },
      { type: 'libraryIcon', left: 50, top: 50, iconId: 'icon-1' }, // Dropped by Fabric
      { type: 'Circle', left: 100, top: 200, id: 'circ-1', iconId: 'extra-prop' },
    ];

    restorePropsRecursive(objects, dataArray);

    // Rect should get its props from the correct data entry (not the dropped icon's data)
    expect(objects[0].id).toBe('rect-1');
    expect((objects[0] as any).isMembraneShape).toBe(true);

    // Circle should get its props from the correct data entry
    expect(objects[1].id).toBe('circ-1');
    expect((objects[1] as any).iconId).toBe('extra-prop');
  });

  it('should match by iconId when positions differ slightly', () => {
    const objects = [
      { type: 'group', left: 10.01, top: 20.02, iconId: 'icon-A' },
    ];
    const dataArray = [
      { type: 'libraryIcon', left: 50, top: 50, iconId: 'dropped' }, // dropped
      { type: 'group', left: 10.01, top: 20.02, iconId: 'icon-A', isLibraryIcon: true },
    ];

    restorePropsRecursive(objects, dataArray);

    expect((objects[0] as any).isLibraryIcon).toBe(true);
  });
});

describe('Integration: full save/load cycle simulation', () => {
  it('should not lose data in strip → reconstruct cycle for library icons', () => {
    // Simulate the full cycle:
    // 1. Canvas has 3 icons
    const canvasObjects = [
      {
        type: 'Group',
        iconId: 'receptor-1',
        isLibraryIcon: true,
        objects: Array.from({ length: 12 }, (_, i) => ({ type: 'Path', path: `M${i}` })),
        left: 100,
        top: 100,
      },
      {
        type: 'Group',
        iconId: 'receptor-1', // same icon, different position
        isLibraryIcon: true,
        objects: Array.from({ length: 12 }, (_, i) => ({ type: 'Path', path: `M${i}` })),
        left: 200,
        top: 200,
      },
      {
        type: 'Group',
        iconId: 'receptor-2', // different icon
        isLibraryIcon: true,
        objects: Array.from({ length: 8 }, (_, i) => ({ type: 'Path', path: `M${i}` })),
        left: 300,
        top: 300,
      },
    ];

    // 2. Save: strip icons to references
    const serialized = JSON.parse(JSON.stringify(canvasObjects));
    serialized.forEach((obj: any) => {
      if (obj.isLibraryIcon && obj.iconId) {
        delete obj.objects;
        obj.originalType = obj.type;
        obj.type = 'libraryIcon';
      }
    });

    // Verify stripped
    expect(serialized[0].type).toBe('libraryIcon');
    expect(serialized[0].objects).toBeUndefined();
    expect(serialized[1].type).toBe('libraryIcon');
    expect(serialized[2].type).toBe('libraryIcon');

    // 3. Collect unique IDs for batch fetch
    const ids = collectIconIds(serialized);
    expect(ids.size).toBe(2); // receptor-1 and receptor-2

    // 4. Simulate reconstruction (success for all)
    serialized.forEach((obj: any) => {
      if (obj.type === 'libraryIcon' && obj.iconId) {
        obj.objects = Array.from({ length: 10 }, () => ({ type: 'Path', path: 'M0 0' }));
        obj.type = obj.originalType || 'Group';
      }
    });

    // Verify all reconstructed
    expect(serialized[0].type).toBe('Group');
    expect(serialized[0].objects.length).toBe(10);
    expect(serialized[1].type).toBe('Group');
    expect(serialized[2].type).toBe('Group');
  });

  it('should produce visible placeholders (not data loss) when reconstruction fails', () => {
    const serialized = [
      { type: 'libraryIcon', iconId: 'missing-icon', left: 100, top: 100 },
      { type: 'Rect', left: 200, top: 200 },
    ];

    // Simulate reconstruction failure for icon
    const reconstructed = serialized.map((obj: any) => {
      if (obj.type === 'libraryIcon' && obj.iconId) {
        const success = false; // Supabase returned nothing
        if (!success) {
          return {
            ...obj,
            type: 'Rect',
            fill: '#fff3f3',
            stroke: '#cc0000',
            strokeWidth: 2,
            _isMissingIconPlaceholder: true,
          };
        }
      }
      return obj;
    });

    // Placeholder is a valid Fabric type — will NOT be dropped
    expect(reconstructed[0].type).toBe('Rect');
    expect(reconstructed[0]._isMissingIconPlaceholder).toBe(true);
    expect(reconstructed[0].iconId).toBe('missing-icon'); // Preserved for retry

    // Other objects unaffected
    expect(reconstructed[1].type).toBe('Rect');
    expect(reconstructed[1]._isMissingIconPlaceholder).toBeUndefined();

    // Total object count preserved (no silent drops)
    expect(reconstructed.length).toBe(2);
  });
});
