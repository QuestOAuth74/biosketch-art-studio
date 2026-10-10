import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, GripVertical, Maximize2 } from 'lucide-react';

interface ReferenceImageOverlayProps {
  src: string;
  onClose: () => void;
  initialSize?: 'small' | 'medium' | 'large';
}

const SIZE_MAP = {
  small: 200,
  medium: 320,
  large: 480,
};

export const ReferenceImageOverlay = ({ src, onClose, initialSize = 'medium' }: ReferenceImageOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [width, setWidth] = useState(SIZE_MAP[initialSize]);
  const [opacity, setOpacity] = useState(80);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0 });
  const [aspectRatio, setAspectRatio] = useState(1);

  // Get aspect ratio from loaded image
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  const height = Math.round(width / aspectRatio);

  // Drag handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Resize handlers
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const newWidth = Math.max(120, Math.min(800, resizeStart.current.w + dx));
      setWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: width };
    setIsResizing(true);
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-30 rounded-lg border border-border/50 shadow-lg overflow-hidden select-none"
      style={{
        left: position.x,
        top: position.y,
        width,
        opacity: opacity / 100,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Top bar — entire bar is draggable */}
      <div
        className="flex items-center justify-between bg-background/90 backdrop-blur-sm px-2 py-1 border-b border-border/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Reference</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Image — draggable */}
      <div
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <img
          src={src}
          alt="AI reference guide"
          className="w-full block pointer-events-none"
          style={{ height }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Bottom controls */}
      <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm px-2 py-1.5 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Opacity</span>
        <Slider
          value={[opacity]}
          onValueChange={(v) => setOpacity(v[0])}
          min={10}
          max={100}
          step={5}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-7 text-right">{opacity}%</span>

        {/* Resize handle */}
        <div
          className="cursor-se-resize p-0.5 hover:bg-muted rounded ml-1"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};
