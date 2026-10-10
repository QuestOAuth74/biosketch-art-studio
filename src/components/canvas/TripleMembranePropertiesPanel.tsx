import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Circle, RectangleHorizontal, Minus, ArrowBigUp, Zap } from "lucide-react";
import { StackSimple } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { toast } from "sonner";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { TripleMembranePathTool, TripleMembraneOptions } from "@/lib/tripleMembranePathTool";

interface MembraneTheme {
  name: string;
  outerBandColor: string;
  middleBandColor: string;
  icColor: string;
}

const MEMBRANE_THEMES: MembraneTheme[] = [
  { name: 'Classic Cell',   outerBandColor: '#1e3a5f', middleBandColor: '#a8c8e8', icColor: '#fde68a' },
  { name: 'Plasma',         outerBandColor: '#5c1a1a', middleBandColor: '#d4a574', icColor: '#f5d0d0' },
  { name: 'Nuclear',        outerBandColor: '#3b1f6e', middleBandColor: '#c4b5e0', icColor: '#e8dff5' },
  { name: 'ER Membrane',    outerBandColor: '#1a5c2a', middleBandColor: '#8fcc9f', icColor: '#d4f0db' },
  { name: 'Mitochondrial',  outerBandColor: '#8b2500', middleBandColor: '#e8916d', icColor: '#fde0cc' },
  { name: 'Golgi',          outerBandColor: '#1a4d5c', middleBandColor: '#7ec8d4', icColor: '#d0f0f5' },
];

interface TripleMembranePropertiesPanelProps {
  membrane: any;
}

export const TripleMembranePropertiesPanel = ({ membrane }: TripleMembranePropertiesPanelProps) => {
  const { canvas } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-triple-membrane'] ?? true);

  const rawOpts = (membrane as any).tripleMembraneOptions || {};
  const opts: TripleMembraneOptions = {
    bandWidth: rawOpts.bandWidth ?? 6,
    bandGap: rawOpts.bandGap ?? 2,
    outerBandColor: rawOpts.outerBandColor ?? '#1e3a5f',
    middleBandColor: rawOpts.middleBandColor ?? '#a8c8e8',
    outerBandOpacity: rawOpts.outerBandOpacity ?? 1,
    middleBandOpacity: rawOpts.middleBandOpacity ?? 0.8,
    intracellular: { enabled: false, color: '#fde68a', depth: 40, opacity: 0.15, side: 'left' as const, ...rawOpts.intracellular },
  };

  const [bandWidth, setBandWidth] = useState(opts.bandWidth);
  const [bandGap, setBandGap] = useState(opts.bandGap);
  const [outerColor, setOuterColor] = useState(opts.outerBandColor);
  const [middleColor, setMiddleColor] = useState(opts.middleBandColor);
  const [outerOpacity, setOuterOpacity] = useState(opts.outerBandOpacity);
  const [middleOpacity, setMiddleOpacity] = useState(opts.middleBandOpacity);
  const [icEnabled, setIcEnabled] = useState(opts.intracellular.enabled);
  const [icColor, setIcColor] = useState(opts.intracellular.color);
  const [icDepth, setIcDepth] = useState(opts.intracellular.depth);
  const [icOpacity, setIcOpacity] = useState(opts.intracellular.opacity);
  const [icSide, setIcSide] = useState<'left' | 'right'>(opts.intracellular.side);
  const [cornerRadius, setCornerRadius] = useState(20);

  const isClosed = !!(membrane as any).isClosed;

  // Sync state when membrane selection changes
  useEffect(() => {
    const o: TripleMembraneOptions = (membrane as any).tripleMembraneOptions;
    if (!o) return;
    setBandWidth(o.bandWidth);
    setBandGap(o.bandGap);
    setOuterColor(o.outerBandColor);
    setMiddleColor(o.middleBandColor);
    setOuterOpacity(o.outerBandOpacity);
    setMiddleOpacity(o.middleBandOpacity);
    setIcEnabled(o.intracellular.enabled);
    setIcColor(o.intracellular.color);
    setIcDepth(o.intracellular.depth);
    setIcOpacity(o.intracellular.opacity);
    setIcSide(o.intracellular.side);
  }, [membrane]);

  const buildCurrentOptions = (): TripleMembraneOptions => ({
    bandWidth,
    bandGap,
    outerBandColor: outerColor,
    middleBandColor: middleColor,
    outerBandOpacity: outerOpacity,
    middleBandOpacity: middleOpacity,
    intracellular: {
      enabled: icEnabled,
      color: icColor,
      depth: icDepth,
      opacity: icOpacity,
      side: icSide,
    },
  });

  const handleApplyTheme = async (theme: MembraneTheme) => {
    setOuterColor(theme.outerBandColor);
    setMiddleColor(theme.middleBandColor);
    setIcColor(theme.icColor);
    if (!canvas) return;
    try {
      const opts = buildCurrentOptions();
      opts.outerBandColor = theme.outerBandColor;
      opts.middleBandColor = theme.middleBandColor;
      opts.intracellular.color = theme.icColor;
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane);
      canvas.fire('object:modified', { target: result });
      toast.success(`Applied "${theme.name}" theme`);
    } catch (err) {
      console.error("Error applying theme:", err);
      toast.error("Failed to apply theme");
    }
  };

  const handleApply = async () => {
    if (!canvas) return;
    try {
      (membrane as any).tripleMembraneOptions = buildCurrentOptions();
      const result = await TripleMembranePathTool.regenerate(canvas, membrane);
      canvas.fire('object:modified', { target: result });
      toast.success("Triple membrane updated!");
    } catch (err) {
      console.error("Error updating triple membrane:", err);
      toast.error("Failed to update triple membrane");
    }
  };

  const handleConvertToCircle = async () => {
    if (!canvas) return;
    try {
      const { cx, cy, width, height } = TripleMembranePathTool.computeBezierBounds(membrane);
      const radius = Math.max(width, height) / 2 || 50;
      const newPoints = TripleMembranePathTool.generateCirclePoints(cx, cy, radius);
      setIcEnabled(true);
      const opts = buildCurrentOptions();
      opts.intracellular.enabled = true;
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, true);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to circle");
    } catch (err) {
      console.error("Error converting to circle:", err);
      toast.error("Failed to convert to circle");
    }
  };

  const handleConvertToEllipse = async () => {
    if (!canvas) return;
    try {
      const { cx, cy, width, height } = TripleMembranePathTool.computeBezierBounds(membrane);
      const rx = (width / 2) || 60;
      const ry = (height / 2) || 40;
      const newPoints = TripleMembranePathTool.generateEllipsePoints(cx, cy, rx, ry);
      setIcEnabled(true);
      const opts = buildCurrentOptions();
      opts.intracellular.enabled = true;
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, true);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to ellipse");
    } catch (err) {
      console.error("Error converting to ellipse:", err);
      toast.error("Failed to convert to ellipse");
    }
  };

  const handleConvertToRoundedRect = async () => {
    if (!canvas) return;
    try {
      const { cx, cy, width, height } = TripleMembranePathTool.computeBezierBounds(membrane);
      const w = width || 120;
      const h = height || 80;
      const newPoints = TripleMembranePathTool.generateRoundedRectPoints(cx, cy, w, h, cornerRadius);
      setIcEnabled(true);
      const opts = buildCurrentOptions();
      opts.intracellular.enabled = true;
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, true);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to rounded rectangle");
    } catch (err) {
      console.error("Error converting to rounded rectangle:", err);
      toast.error("Failed to convert to rounded rectangle");
    }
  };

  const handleConvertToStraight = async () => {
    if (!canvas) return;
    try {
      const endpoints = TripleMembranePathTool.getWorldEndpoints(membrane);
      if (!endpoints) { toast.error("Cannot determine endpoints"); return; }
      const newPoints = TripleMembranePathTool.generateStraightLinePoints(endpoints.start, endpoints.end);
      const opts = buildCurrentOptions();
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, false);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to straight line");
    } catch (err) {
      console.error("Error converting to straight:", err);
      toast.error("Failed to convert to straight line");
    }
  };

  const handleConvertToArc = async () => {
    if (!canvas) return;
    try {
      const endpoints = TripleMembranePathTool.getWorldEndpoints(membrane);
      if (!endpoints) { toast.error("Cannot determine endpoints"); return; }
      const newPoints = TripleMembranePathTool.generateArcPoints(endpoints.start, endpoints.end);
      const opts = buildCurrentOptions();
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, false);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to arc");
    } catch (err) {
      console.error("Error converting to arc:", err);
      toast.error("Failed to convert to arc");
    }
  };

  const handleConvertToSynapse = async () => {
    if (!canvas) return;
    try {
      const { cx, cy, width, height } = TripleMembranePathTool.computeBezierBounds(membrane);
      // Default synapse bbox is 176×52 (axonLength + taperLength + boutonRadius
      // = 110 + 40 + 26 wide; 2*boutonRadius = 52 tall). Scale proportionally
      // from the current shape's larger dimension.
      const longSide = Math.max(width, height) || 176;
      const scale = longSide / 176;
      const orientation: 'horizontal' | 'vertical' = height > width ? 'vertical' : 'horizontal';
      const newPoints = TripleMembranePathTool.generateNeuronSynapsePoints(
        cx, cy,
        110 * scale,  // axonLength
        14 * scale,   // axonWidth
        26 * scale,   // boutonRadius
        40 * scale,   // taperLength
        orientation,
      );
      setIcEnabled(true);
      const opts = buildCurrentOptions();
      opts.intracellular.enabled = true;
      (membrane as any).tripleMembraneOptions = opts;
      const result = await TripleMembranePathTool.regenerate(canvas, membrane, newPoints, true);
      canvas.fire('object:modified', { target: result });
      toast.success("Converted to neuron synapse");
    } catch (err) {
      console.error("Error converting to synapse:", err);
      toast.error("Failed to convert to synapse");
    }
  };

  return (
    <div id="section-triple-membrane" className="relative">
      {/* Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-triple-membrane')}
      >
        <div className="flex items-center gap-2">
          <StackSimple className="h-4 w-4 text-primary" weight="duotone" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Triple Membrane
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3 space-y-4">
          {/* Color Themes */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Color Theme</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {MEMBRANE_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleApplyTheme(theme)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
                  title={theme.name}
                >
                  <div className="flex-shrink-0 flex gap-px">
                    <span className="w-2.5 h-5 rounded-sm" style={{ backgroundColor: theme.outerBandColor }} />
                    <span className="w-2.5 h-5 rounded-sm" style={{ backgroundColor: theme.middleBandColor }} />
                    <span className="w-2.5 h-5 rounded-sm" style={{ backgroundColor: theme.icColor }} />
                  </div>
                  <span className="text-[10px] text-slate-600 truncate leading-tight">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Band Width */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Band Width</Label>
              <span className="text-sm text-muted-foreground">{bandWidth}px</span>
            </div>
            <Slider value={[bandWidth]} onValueChange={(v) => setBandWidth(v[0])} min={2} max={20} step={1} />
          </div>

          {/* Band Gap */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Band Gap</Label>
              <span className="text-sm text-muted-foreground">{bandGap}px</span>
            </div>
            <Slider value={[bandGap]} onValueChange={(v) => setBandGap(v[0])} min={0} max={10} step={1} />
          </div>

          {/* Outer Band Color */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Outer Band Color</Label>
            <input
              type="color"
              value={outerColor}
              onChange={(e) => setOuterColor(e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
            />
          </div>

          {/* Middle Band Color */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Middle Band Color</Label>
            <input
              type="color"
              value={middleColor}
              onChange={(e) => setMiddleColor(e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
            />
          </div>

          {/* Outer Opacity */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Outer Opacity</Label>
              <span className="text-sm text-muted-foreground">{Math.round(outerOpacity * 100)}%</span>
            </div>
            <Slider value={[outerOpacity]} onValueChange={(v) => setOuterOpacity(v[0])} min={0.1} max={1} step={0.05} />
          </div>

          {/* Middle Opacity */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Middle Opacity</Label>
              <span className="text-sm text-muted-foreground">{Math.round(middleOpacity * 100)}%</span>
            </div>
            <Slider value={[middleOpacity]} onValueChange={(v) => setMiddleOpacity(v[0])} min={0.1} max={1} step={0.05} />
          </div>

          {/* Intracellular / Interior Fill Section */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{isClosed ? 'Interior Fill' : 'Intracellular Region'}</Label>
              <Switch checked={icEnabled} onCheckedChange={setIcEnabled} />
            </div>

            {icEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Fill Color</Label>
                  <input
                    type="color"
                    value={icColor}
                    onChange={(e) => setIcColor(e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                </div>

                {!isClosed && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm">Depth</Label>
                      <span className="text-sm text-muted-foreground">{icDepth}px</span>
                    </div>
                    <Slider value={[icDepth]} onValueChange={(v) => setIcDepth(v[0])} min={10} max={600} step={5} />
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm">Opacity</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(icOpacity * 100)}%</span>
                  </div>
                  <Slider value={[icOpacity]} onValueChange={(v) => setIcOpacity(v[0])} min={0.05} max={1} step={0.05} />
                </div>

                {!isClosed && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Side</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={icSide === 'left' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIcSide('left')}
                        className="text-xs h-7 px-3"
                      >
                        Left
                      </Button>
                      <Button
                        variant={icSide === 'right' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIcSide('right')}
                        className="text-xs h-7 px-3"
                      >
                        Right
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Shape Conversion Section */}
          <div className="pt-2 border-t space-y-3">
            <Label className="text-sm font-semibold">Convert to Shape</Label>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToCircle}
                className="text-xs h-8"
              >
                <Circle className="h-3 w-3 mr-1" />
                Circle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToEllipse}
                className="text-xs h-8"
              >
                <Circle className="h-3 w-3 mr-1" style={{ transform: 'scaleX(1.4)' }} />
                Ellipse
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToRoundedRect}
                className="text-xs h-8"
              >
                <RectangleHorizontal className="h-3 w-3 mr-1" />
                Rect
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToStraight}
                className="text-xs h-8"
              >
                <Minus className="h-3 w-3 mr-1" />
                Straight
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToArc}
                className="text-xs h-8"
              >
                <ArrowBigUp className="h-3 w-3 mr-1" style={{ transform: 'rotate(-90deg)' }} />
                Arc
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToSynapse}
                className="text-xs h-8"
              >
                <Zap className="h-3 w-3 mr-1" />
                Synapse
              </Button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm">Corner Radius</Label>
                <span className="text-sm text-muted-foreground">{cornerRadius}px</span>
              </div>
              <Slider
                value={[cornerRadius]}
                onValueChange={(v) => setCornerRadius(v[0])}
                min={5}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
};
