import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, RotateCcw, Palette, Ruler, Scale } from 'lucide-react';
import { ColorPickerInput } from '@/components/ColorPicker/ColorPickerInput';

interface SVGCustomizationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgContent: string;
  onApply: (modifiedSVG: string) => void;
}

interface ColorInfo {
  color: string;
  count: number;
  elements: string[];
}

export const SVGCustomizationEditor = ({
  open,
  onOpenChange,
  svgContent,
  onApply
}: SVGCustomizationEditorProps) => {
  const [originalSVG, setOriginalSVG] = useState(svgContent);
  const [modifiedSVG, setModifiedSVG] = useState(svgContent);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // Customization states
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [scale, setScale] = useState(100);
  const [fillColors, setFillColors] = useState<Map<string, string>>(new Map());
  const [strokeColors, setStrokeColors] = useState<Map<string, string>>(new Map());
  
  // Color palette discovery
  const [detectedFills, setDetectedFills] = useState<ColorInfo[]>([]);
  const [detectedStrokes, setDetectedStrokes] = useState<ColorInfo[]>([]);

  // Parse SVG and detect colors on mount
  useEffect(() => {
    if (!svgContent) return;

    setOriginalSVG(svgContent);
    setModifiedSVG(svgContent);
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      // Detect fill colors
      const fillMap = new Map<string, { count: number; elements: string[] }>();
      const strokeMap = new Map<string, { count: number; elements: string[] }>();
      
      const elements = doc.querySelectorAll('[fill], [stroke]');
      elements.forEach((el) => {
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        const tagName = el.tagName;
        
        if (fill && fill !== 'none') {
          const existing = fillMap.get(fill) || { count: 0, elements: [] };
          fillMap.set(fill, {
            count: existing.count + 1,
            elements: [...existing.elements, tagName]
          });
        }
        
        if (stroke && stroke !== 'none') {
          const existing = strokeMap.get(stroke) || { count: 0, elements: [] };
          strokeMap.set(stroke, {
            count: existing.count + 1,
            elements: [...existing.elements, tagName]
          });
        }
        
        // Get initial stroke width
        const strokeWidthAttr = el.getAttribute('stroke-width');
        if (strokeWidthAttr && !isNaN(Number(strokeWidthAttr))) {
          setStrokeWidth(Number(strokeWidthAttr));
        }
      });
      
      // Convert to arrays for UI
      const fills: ColorInfo[] = Array.from(fillMap.entries()).map(([color, info]) => ({
        color,
        count: info.count,
        elements: [...new Set(info.elements)]
      }));
      
      const strokes: ColorInfo[] = Array.from(strokeMap.entries()).map(([color, info]) => ({
        color,
        count: info.count,
        elements: [...new Set(info.elements)]
      }));
      
      setDetectedFills(fills);
      setDetectedStrokes(strokes);
      
      // Initialize color maps
      const initialFills = new Map(fills.map(f => [f.color, f.color]));
      const initialStrokes = new Map(strokes.map(s => [s.color, s.color]));
      setFillColors(initialFills);
      setStrokeColors(initialStrokes);
      
    } catch (error) {
      console.error('Error parsing SVG:', error);
    }
  }, [svgContent]);

  // Apply customizations to SVG
  useEffect(() => {
    if (!originalSVG) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(originalSVG, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) return;

      // Apply scale by modifying viewBox or width/height
      if (scale !== 100) {
        const scaleRatio = scale / 100;
        const currentWidth = Number(svg.getAttribute('width') || 512);
        const currentHeight = Number(svg.getAttribute('height') || 512);
        svg.setAttribute('width', String(Math.round(currentWidth * scaleRatio)));
        svg.setAttribute('height', String(Math.round(currentHeight * scaleRatio)));
      }

      // Apply color and stroke width changes
      const elements = doc.querySelectorAll('[fill], [stroke], [stroke-width]');
      elements.forEach((el) => {
        // Update fill colors
        const fill = el.getAttribute('fill');
        if (fill && fill !== 'none' && fillColors.has(fill)) {
          const newColor = fillColors.get(fill);
          if (newColor) {
            el.setAttribute('fill', newColor);
          }
        }
        
        // Update stroke colors
        const stroke = el.getAttribute('stroke');
        if (stroke && stroke !== 'none' && strokeColors.has(stroke)) {
          const newColor = strokeColors.get(stroke);
          if (newColor) {
            el.setAttribute('stroke', newColor);
          }
        }
        
        // Update stroke width
        if (el.hasAttribute('stroke-width')) {
          el.setAttribute('stroke-width', String(strokeWidth));
        } else if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
          // Add stroke-width if element has stroke but no width
          el.setAttribute('stroke-width', String(strokeWidth));
        }
      });

      const serializer = new XMLSerializer();
      const modified = serializer.serializeToString(doc);
      setModifiedSVG(modified);
      
      // Create preview URL
      const blob = new Blob([modified], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      // Clean up old URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setPreviewUrl(url);
      
    } catch (error) {
      console.error('Error applying customizations:', error);
    }
  }, [originalSVG, fillColors, strokeColors, strokeWidth, scale]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFillColorChange = (oldColor: string, newColor: string) => {
    const updated = new Map(fillColors);
    updated.set(oldColor, newColor);
    setFillColors(updated);
  };

  const handleStrokeColorChange = (oldColor: string, newColor: string) => {
    const updated = new Map(strokeColors);
    updated.set(oldColor, newColor);
    setStrokeColors(updated);
  };

  const handleReset = () => {
    setModifiedSVG(originalSVG);
    setStrokeWidth(2);
    setScale(100);
    
    // Reset to original colors
    const initialFills = new Map(detectedFills.map(f => [f.color, f.color]));
    const initialStrokes = new Map(detectedStrokes.map(s => [s.color, s.color]));
    setFillColors(initialFills);
    setStrokeColors(initialStrokes);
  };

  const handleApply = () => {
    onApply(modifiedSVG);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Customize Vector Icon
          </DialogTitle>
          <DialogDescription>
            Adjust colors, stroke widths, and size before saving your icon
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview Panel */}
            <div className="space-y-3">
              <Label>Live Preview</Label>
              <div className="border-2 rounded-lg p-8 bg-muted/30 flex items-center justify-center min-h-[300px]">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Customized preview" 
                    className="max-w-full max-h-[400px]"
                    style={{ width: 'auto', height: 'auto' }}
                  />
                ) : (
                  <div className="text-muted-foreground">Loading preview...</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Changes are applied in real-time
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              <Tabs defaultValue="colors" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="colors" className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    Colors
                  </TabsTrigger>
                  <TabsTrigger value="strokes" className="flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5" />
                    Strokes
                  </TabsTrigger>
                  <TabsTrigger value="size" className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5" />
                    Size
                  </TabsTrigger>
                </TabsList>

                {/* Colors Tab */}
                <TabsContent value="colors" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Fill Colors</Label>
                    {detectedFills.length > 0 ? (
                      <div className="space-y-3">
                        {detectedFills.map((fillInfo, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                            <div 
                              className="w-10 h-10 rounded border-2 border-border flex-shrink-0"
                              style={{ backgroundColor: fillInfo.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {fillInfo.count} element{fillInfo.count > 1 ? 's' : ''} ({fillInfo.elements.join(', ')})
                              </div>
                              <ColorPickerInput
                                value={fillColors.get(fillInfo.color) || fillInfo.color}
                                onChange={(color) => handleFillColorChange(fillInfo.color, color)}
                                showPresets={true}
                                showHexInput={true}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                        No fill colors detected
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Strokes Tab */}
                <TabsContent value="strokes" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Stroke Width</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[strokeWidth]}
                          onValueChange={([value]) => setStrokeWidth(value)}
                          min={0.5}
                          max={10}
                          step={0.5}
                          className="flex-1"
                        />
                        <div className="text-sm font-medium w-12 text-right">
                          {strokeWidth}px
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Stroke Colors</Label>
                    {detectedStrokes.length > 0 ? (
                      <div className="space-y-3">
                        {detectedStrokes.map((strokeInfo, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                            <div 
                              className="w-10 h-10 rounded border-2 flex-shrink-0"
                              style={{ 
                                backgroundColor: 'transparent',
                                borderColor: strokeInfo.color,
                                borderWidth: '3px'
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {strokeInfo.count} element{strokeInfo.count > 1 ? 's' : ''} ({strokeInfo.elements.join(', ')})
                              </div>
                              <ColorPickerInput
                                value={strokeColors.get(strokeInfo.color) || strokeInfo.color}
                                onChange={(color) => handleStrokeColorChange(strokeInfo.color, color)}
                                showPresets={true}
                                showHexInput={true}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                        No stroke colors detected
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Size Tab */}
                <TabsContent value="size" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Scale</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[scale]}
                          onValueChange={([value]) => setScale(value)}
                          min={50}
                          max={200}
                          step={5}
                          className="flex-1"
                        />
                        <div className="text-sm font-medium w-12 text-right">
                          {scale}%
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Adjust the overall size of the icon (50% - 200%)
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-primary/5 border-primary/10">
                    <div className="text-sm font-medium mb-2">Current Dimensions</div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(512 * (scale / 100))} × {Math.round(512 * (scale / 100))} pixels
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Original
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleApply}>
            <Check className="h-4 w-4 mr-2" />
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
