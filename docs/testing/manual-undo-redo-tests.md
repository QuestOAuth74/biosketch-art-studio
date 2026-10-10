# Manual Testing: Undo/Redo System

**Estimated Time:** 45-50 minutes
**Setup:** Open `/canvas` with browser DevTools Console open

---

## 1. Basic Tool Coverage (15 min)

### Drawing Tools
- [ ] Rectangle: Draw → Undo → Disappears
- [ ] Circle: Draw → Undo → Disappears
- [ ] Line: Draw → Undo → Disappears
- [ ] Pen Tool: Draw bezier (3-4 points) → Undo → Disappears
- [ ] Text: Add text → Undo → Disappears

### Edit Mode Tools
- [ ] **Bezier**: Draw path → Double-click → Drag anchor → Exit → Undo → Anchor reverts
- [ ] **Bezier**: Same path → Edit → Drag control handle → Exit → Undo → Control reverts
- [ ] **Curved Line**: Draw → Double-click → Drag control → Exit → Undo → Control reverts

### Complex Objects
- [ ] **Group**: Select 3 shapes → Group (Cmd/Ctrl+G) → Undo → Ungroups
- [ ] **Ungroup**: Create group → Ungroup → Undo → Re-groups
- [ ] **Image**: Upload image → Undo → Disappears

---

## 2. Property Changes (10 min)

Create one rectangle, test each:
- [ ] Position: Move → Undo → Returns
- [ ] Size: Resize → Undo → Returns
- [ ] Rotation: Rotate 45° → Undo → Returns to 0°
- [ ] Color: Change fill → Undo → Original restored
- [ ] Opacity: Set 50% → Undo → Returns to 100%
- [ ] Gradient: Apply → Undo → Removed

---

## 3. Multi-Object Transaction (5 min)

- [ ] Create 5 rectangles
- [ ] Select all 5 (Shift+Click)
- [ ] Drag entire selection to new position
- [ ] Undo ONCE
- [ ] ✅ All 5 return to original positions together

---

## 4. Deep History (5 min)

- [ ] Create rectangle → Select it
- [ ] Hold arrow key for ~10 seconds (100+ moves)
- [ ] Undo rapidly (Cmd/Ctrl+Z)
- [ ] ✅ Can undo at least 100 operations

---

## 5. Redo Stack Behavior (3 min)

- [ ] Create 2 shapes
- [ ] Undo last shape (Redo available)
- [ ] Create NEW shape
- [ ] Try Redo (should be disabled)
- [ ] ✅ Redo stack cleared after new action

---

## 6. Performance Check (5 min)

### Test 1: Undo Performance
```javascript
for (let i = 0; i < 20; i++) {
  const rect = new fabric.Rect({ left: i*10, top: 0, width: 50, height: 50 });
  fabricCanvas.add(rect);
  canvasContext.saveState();
}

console.time('undo');
canvasContext.undo();
console.timeEnd('undo');
// Should be < 50ms
```

### Test 2: Memory Usage
```javascript
const memBefore = canvasContext.historyManager?.current?.getMemoryUsage();
console.log('Before:', (memBefore / 1024).toFixed(2), 'KB');

for (let i = 0; i < 100; i++) {
  fabricCanvas.getActiveObject().set({ left: i });
  fabricCanvas.fire('object:modified', { target: fabricCanvas.getActiveObject() });
}

setTimeout(() => {
  const memAfter = canvasContext.historyManager?.current?.getMemoryUsage();
  console.log('After:', (memAfter / 1024).toFixed(2), 'KB');
  console.log('Length:', canvasContext.historyManager?.current?.getHistoryLength());
  // Should be < 500 KB
}, 2000);
```

- [ ] ✅ Undo time < 50ms
- [ ] ✅ 100 states < 500KB

---

## 7. Edge Cases (5 min)

- [ ] Empty canvas: Undo → No effect
- [ ] At history start: Undo button disabled
- [ ] At history end: Redo button disabled
- [ ] Rapid operations: Hold arrow 5s → Undo → Works smoothly

---

## Success Criteria

✅ **Pass:**
- No console errors
- Undo/redo feels instant (< 50ms)
- Memory < 500KB for 100 ops
- Multi-object = single undo
- All properties reversible

⚠️ **Fail:**
- Tool doesn't support undo
- Laggy (> 50ms)
- Excessive memory
- Transaction grouping broken
