import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeSlashIcon, LockIcon, MagnifyingGlassIcon, TrashIcon } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { FabricObject } from "fabric";
import { toast } from "sonner";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  fabricObject: FabricObject;
}

interface SortableLayerItemProps {
  layer: Layer;
  index: number;
  isSelected: boolean;
  isLayerSelected: boolean;
  onLayerClick: (layer: Layer) => void;
  onLayerSelect: (layerId: string, ctrlKey: boolean) => void;
  onToggleVisibility: (id: string, e: React.MouseEvent) => void;
  onToggleLock: (id: string, e: React.MouseEvent) => void;
  generateThumbnail: (obj: FabricObject) => string;
}

const SortableLayerItem = ({
  layer,
  index,
  isSelected,
  isLayerSelected,
  onLayerClick,
  onLayerSelect,
  onToggleVisibility,
  onToggleLock,
  generateThumbnail,
}: SortableLayerItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        // Only trigger layer selection if not clicking on a button
        if ((e.target as HTMLElement).closest('button')) return;
        onLayerClick(layer);
        onLayerSelect(layer.id, e.ctrlKey || e.metaKey);
      }}
      className={`flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer group transition-colors ${
        isSelected || isLayerSelected ? 'bg-accent' : ''
      }`}
      data-testid={`${CanvasEditorTestIds.LAYER_ITEM}-${index}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing h-8 w-4 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <div className="flex flex-col gap-0.5">
          <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="h-8 w-8 rounded bg-muted shrink-0 overflow-hidden border">
        <img
          src={generateThumbnail(layer.fabricObject)}
          alt={layer.name}
          className="w-full h-full object-contain"
        />
      </div>
      <Button
        size="icon"
        variant="ghost"
        className={`h-6 w-6 shrink-0 transition-all ${!layer.visible && 'opacity-50 hover:opacity-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(layer.id, e);
        }}
        data-testid={`${CanvasEditorTestIds.LAYER_VISIBILITY_TOGGLE}-${index}`}
      >
        {layer.visible ? (
          <EyeIcon style={{ width: 18, height: 18 }} weight="regular" className="text-primary" />
        ) : (
          <EyeSlashIcon style={{ width: 18, height: 18 }} weight="regular" className="text-muted-foreground" />
        )}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className={`h-6 w-6 shrink-0 transition-all ${layer.locked ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(layer.id, e);
        }}
        data-testid={`${CanvasEditorTestIds.LAYER_LOCK_TOGGLE}-${index}`}
      >
        <LockIcon size={14} weight="regular" className={layer.locked ? 'text-primary' : 'text-muted-foreground'} />
      </Button>

      <span className={`flex-1 text-sm truncate transition-opacity ${!layer.visible && 'opacity-50'}`}>
        {layer.name}
      </span>
    </div>
  );
};

export const LayersPanel = () => {
  const { canvas, selectedObject, getCanvasObjects, selectObjectById, toggleObjectVisibility, toggleObjectLock, reorderObjects } = useCanvas();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [, setRefresh] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const thumbnailCache = useRef<Map<string, { dataUrl: string; dirtyKey: string }>>(new Map());
  const thumbnailGenPending = useRef(false);
  const [thumbnailVersion, setThumbnailVersion] = useState(0);

  const getObjectName = (obj: FabricObject, index: number): string => {
    if ((obj as any).name) return (obj as any).name;
    
    if (obj.type === 'textbox' || obj.type === 'text') {
      const text = (obj as any).text || '';
      return text.length > 20 ? text.substring(0, 20) + '...' : text || 'Text';
    }
    
    if (obj.type === 'group') return 'Icon';
    if (obj.type === 'rect') return 'Rectangle';
    if (obj.type === 'circle') return 'Circle';
    if (obj.type === 'path') return 'Line';
    
    return `${obj.type || 'Object'} ${index + 1}`;
  };

  const updateLayers = () => {
    const objects = getCanvasObjects();
    const newLayers = objects.map((obj, index) => ({
      id: (obj as any).uuid || index.toString(),
      name: getObjectName(obj, index),
      visible: obj.visible !== false,
      locked: obj.lockMovementX || false,
      fabricObject: obj,
    })).reverse(); // Reverse to show top layer first
    setLayers(newLayers);
  };

  useEffect(() => {
    if (!canvas) return;

    updateLayers();

    // Debounce layer list rebuilds — multiple events can fire in quick succession
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdateLayers = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => updateLayers(), 100);
    };

    const handleSelectionUpdated = () => setRefresh(prev => prev + 1);

    canvas.on('object:modified', debouncedUpdateLayers);
    canvas.on('object:added', debouncedUpdateLayers);
    canvas.on('object:removed', debouncedUpdateLayers);
    canvas.on('selection:created', handleSelectionUpdated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionUpdated);
    canvas.on('layer:visibility:changed', debouncedUpdateLayers);
    canvas.on('layer:lock:changed', debouncedUpdateLayers);
    canvas.on('layer:reordered', debouncedUpdateLayers);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      canvas.off('object:modified', debouncedUpdateLayers);
      canvas.off('object:added', debouncedUpdateLayers);
      canvas.off('object:removed', debouncedUpdateLayers);
      canvas.off('selection:created', handleSelectionUpdated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionUpdated);
      canvas.off('layer:visibility:changed', debouncedUpdateLayers);
      canvas.off('layer:lock:changed', debouncedUpdateLayers);
      canvas.off('layer:reordered', debouncedUpdateLayers);
    };
  }, [canvas, getCanvasObjects]);

  const handleLayerClick = (layer: Layer) => {
    selectObjectById(layer.id);
  };

  const toggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleObjectVisibility(id);
  };

  const toggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleObjectLock(id);
  };

  // Build a dirty key from object properties that affect its visual appearance
  const getDirtyKey = (obj: FabricObject): string => {
    const o = obj as any;
    return `${o.type}_${Math.round(o.left || 0)}_${Math.round(o.top || 0)}_${Math.round(o.width || 0)}_${Math.round(o.height || 0)}_${o.fill || ''}_${o.stroke || ''}_${o.opacity ?? 1}_${o.angle || 0}_${o.scaleX || 1}_${o.scaleY || 1}_${o.text?.slice(0, 20) || ''}_${o.visible !== false ? 1 : 0}_${o.dirty ? 1 : 0}`;
  };

  // Render a single thumbnail — expensive, only called when cache misses
  const renderThumbnail = (obj: FabricObject): string => {
    try {
      const tempCanvas = document.createElement('canvas');
      const size = 32;
      tempCanvas.width = size;
      tempCanvas.height = size;
      const ctx = tempCanvas.getContext('2d');

      if (!ctx) return '';

      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, size, size);

      const objBounds = obj.getBoundingRect();
      if (objBounds.width === 0 || objBounds.height === 0) return '';

      const scale = Math.min(size / objBounds.width, size / objBounds.height) * 0.8;

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(scale, scale);
      ctx.translate(-objBounds.width / 2, -objBounds.height / 2);

      obj.render(ctx as any);
      ctx.restore();

      return tempCanvas.toDataURL();
    } catch (error) {
      return '';
    }
  };

  // Return cached thumbnail or empty string; schedule idle regeneration if stale
  const generateThumbnail = useCallback((obj: FabricObject): string => {
    const id = (obj as any).uuid || (obj as any).id || '';
    if (!id) return renderThumbnail(obj); // no id = can't cache

    const dirtyKey = getDirtyKey(obj);
    const cached = thumbnailCache.current.get(id);

    if (cached && cached.dirtyKey === dirtyKey) {
      return cached.dataUrl; // cache hit — no work
    }

    // Return stale thumbnail if we have one (better than blank)
    // and schedule regeneration on idle
    if (!thumbnailGenPending.current) {
      thumbnailGenPending.current = true;
      const scheduleRegen = typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 50);

      scheduleRegen(() => {
        thumbnailGenPending.current = false;
        // Regenerate all stale thumbnails in one batch
        let anyUpdated = false;
        for (const layer of layers) {
          const layerId = (layer.fabricObject as any).uuid || (layer.fabricObject as any).id || '';
          if (!layerId) continue;
          const key = getDirtyKey(layer.fabricObject);
          const existing = thumbnailCache.current.get(layerId);
          if (!existing || existing.dirtyKey !== key) {
            const dataUrl = renderThumbnail(layer.fabricObject);
            if (dataUrl) {
              thumbnailCache.current.set(layerId, { dataUrl, dirtyKey: key });
              anyUpdated = true;
            }
          }
        }
        if (anyUpdated) {
          setThumbnailVersion(v => v + 1); // trigger re-render with fresh thumbnails
        }
      });
    }

    return cached?.dataUrl || ''; // stale or empty while regenerating
  }, [layers]);

  const handleBulkDelete = () => {
    if (!canvas || selectedLayers.length === 0) return;
    
    selectedLayers.forEach(layerId => {
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        canvas.remove(layer.fabricObject);
      }
    });
    
    setSelectedLayers([]);
    canvas.requestRenderAll();
    toast.success(`Deleted ${selectedLayers.length} layer(s)`, { duration: 1000, className: 'animate-fade-in' });
  };

  const handleLayerSelect = (layerId: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      setSelectedLayers(prev => 
        prev.includes(layerId) 
          ? prev.filter(id => id !== layerId)
          : [...prev, layerId]
      );
    } else {
      setSelectedLayers([]);
    }
  };

  const isSelected = (layer: Layer) => {
    return selectedObject === layer.fabricObject;
  };

  const isLayerSelected = (layerId: string) => {
    return selectedLayers.includes(layerId);
  };

  const filteredLayers = layers.filter(layer =>
    layer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layers.findIndex(layer => layer.id === active.id);
      const newIndex = layers.findIndex(layer => layer.id === over.id);

      // Reorder in local state for immediate UI feedback
      setLayers((items) => arrayMove(items, oldIndex, newIndex));

      // Reorder in canvas
      reorderObjects(active.id as string, over.id as string);
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-auto border-t-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Layers</h3>
        <div className="relative mb-2">
          <MagnifyingGlassIcon size={14} weight="regular" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      
      {/* Bulk Actions */}
      {selectedLayers.length > 0 && (
        <div className="p-2 border-b bg-accent/10 flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex-1">
            {selectedLayers.length} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            className="h-7 text-xs"
          >
            <TrashIcon size={14} weight="regular" className="mr-1" />
            Delete
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredLayers.map(layer => layer.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="p-2 space-y-1">
              {filteredLayers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-muted-foreground/40 mb-2">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    {searchQuery ? 'No matching layers' : 'No objects yet'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-muted-foreground/70">
                      Add shapes, text, or icons to get started
                    </p>
                  )}
                </div>
              ) : (
                filteredLayers.map((layer, index) => (
                  <SortableLayerItem
                    key={layer.id}
                    layer={layer}
                    index={index}
                    isSelected={isSelected(layer)}
                    isLayerSelected={isLayerSelected(layer.id)}
                    onLayerClick={handleLayerClick}
                    onLayerSelect={handleLayerSelect}
                    onToggleVisibility={toggleVisibility}
                    onToggleLock={toggleLock}
                    generateThumbnail={generateThumbnail}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
    </div>
  );
};
