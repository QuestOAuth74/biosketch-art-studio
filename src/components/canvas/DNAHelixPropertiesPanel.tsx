import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dna } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { toast } from "sonner";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { DNAHelixTool, DNAHelixOptions } from "@/lib/dnaHelixTool";

interface HelixTheme {
  name: string;
  strand1Color: string;
  strand2Color: string;
  rungColor: string;
}

const DNA_THEMES: HelixTheme[] = [
  { name: 'Classic',      strand1Color: '#cc0000', strand2Color: '#0000cc', rungColor: '#888888' },
  { name: 'Green/Purple', strand1Color: '#228B22', strand2Color: '#8B008B', rungColor: '#999999' },
  { name: 'Warm',         strand1Color: '#FF6B35', strand2Color: '#D4A574', rungColor: '#A0A0A0' },
  { name: 'Neon',         strand1Color: '#00FF88', strand2Color: '#FF00FF', rungColor: '#CCCCCC' },
  { name: 'Grayscale',    strand1Color: '#333333', strand2Color: '#999999', rungColor: '#BBBBBB' },
  { name: 'Teal/Orange',  strand1Color: '#008080', strand2Color: '#FF8C00', rungColor: '#888888' },
];

interface DNAHelixPropertiesPanelProps {
  helix: any;
}

export const DNAHelixPropertiesPanel = ({ helix }: DNAHelixPropertiesPanelProps) => {
  const { canvas } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-dna-helix'] ?? true);

  const opts: DNAHelixOptions = (helix as any).dnaHelixOptions || {
    strand1Color: '#cc0000',
    strand2Color: '#0000cc',
    rungColor: '#888888',
    strandWidth: 3,
    rungWidth: 2,
    amplitude: 15,
    wavelength: 60,
    forkType: 'none',
    forkPosition: 0.8,
    forkLength: 0.2,
    forkSpread: 30,
  };

  const [strand1Color, setStrand1Color] = useState(opts.strand1Color);
  const [strand2Color, setStrand2Color] = useState(opts.strand2Color);
  const [rungColor, setRungColor] = useState(opts.rungColor);
  const [strandWidth, setStrandWidth] = useState(opts.strandWidth);
  const [rungWidth, setRungWidth] = useState(opts.rungWidth);
  const [amplitude, setAmplitude] = useState(opts.amplitude);
  const [wavelength, setWavelength] = useState(opts.wavelength);
  const [forkType, setForkType] = useState<'none' | 'end' | 'middle'>(opts.forkType);
  const [forkPosition, setForkPosition] = useState(opts.forkPosition);
  const [forkLength, setForkLength] = useState(opts.forkLength);
  const [forkSpread, setForkSpread] = useState(opts.forkSpread);

  useEffect(() => {
    const o: DNAHelixOptions = (helix as any).dnaHelixOptions;
    if (!o) return;
    setStrand1Color(o.strand1Color);
    setStrand2Color(o.strand2Color);
    setRungColor(o.rungColor);
    setStrandWidth(o.strandWidth);
    setRungWidth(o.rungWidth);
    setAmplitude(o.amplitude);
    setWavelength(o.wavelength);
    setForkType(o.forkType);
    setForkPosition(o.forkPosition);
    setForkLength(o.forkLength);
    setForkSpread(o.forkSpread);
  }, [helix]);

  const buildCurrentOptions = (): DNAHelixOptions => ({
    strand1Color,
    strand2Color,
    rungColor,
    strandWidth,
    rungWidth,
    amplitude,
    wavelength,
    forkType,
    forkPosition,
    forkLength,
    forkSpread,
  });

  const handleApplyTheme = async (theme: HelixTheme) => {
    setStrand1Color(theme.strand1Color);
    setStrand2Color(theme.strand2Color);
    setRungColor(theme.rungColor);
    if (!canvas) return;
    try {
      const opts = buildCurrentOptions();
      opts.strand1Color = theme.strand1Color;
      opts.strand2Color = theme.strand2Color;
      opts.rungColor = theme.rungColor;
      (helix as any).dnaHelixOptions = opts;
      const result = await DNAHelixTool.regenerate(canvas, helix);
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
      (helix as any).dnaHelixOptions = buildCurrentOptions();
      const result = await DNAHelixTool.regenerate(canvas, helix);
      canvas.fire('object:modified', { target: result });
      toast.success("DNA helix updated!");
    } catch (err) {
      console.error("Error updating DNA helix:", err);
      toast.error("Failed to update DNA helix");
    }
  };

  return (
    <div id="section-dna-helix" className="relative">
      {/* Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-dna-helix')}
      >
        <div className="flex items-center gap-2">
          <Dna className="h-4 w-4 text-primary" weight="duotone" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            DNA Helix
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
              {DNA_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleApplyTheme(theme)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
                  title={theme.name}
                >
                  <div className="flex-shrink-0 flex gap-px">
                    <span className="w-2.5 h-5 rounded-sm" style={{ backgroundColor: theme.strand1Color }} />
                    <span className="w-2.5 h-5 rounded-sm" style={{ backgroundColor: theme.strand2Color }} />
                  </div>
                  <span className="text-[10px] text-slate-600 truncate leading-tight">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Strand 1 Color */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Strand 1 Color</Label>
            <input
              type="color"
              value={strand1Color}
              onChange={(e) => setStrand1Color(e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
            />
          </div>

          {/* Strand 2 Color */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Strand 2 Color</Label>
            <input
              type="color"
              value={strand2Color}
              onChange={(e) => setStrand2Color(e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
            />
          </div>

          {/* Rung Color */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Rung Color</Label>
            <input
              type="color"
              value={rungColor}
              onChange={(e) => setRungColor(e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
            />
          </div>

          {/* Strand Width */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Strand Width</Label>
              <span className="text-sm text-muted-foreground">{strandWidth}px</span>
            </div>
            <Slider value={[strandWidth]} onValueChange={(v) => setStrandWidth(v[0])} min={1} max={8} step={0.5} />
          </div>

          {/* Rung Width */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Rung Width</Label>
              <span className="text-sm text-muted-foreground">{rungWidth}px</span>
            </div>
            <Slider value={[rungWidth]} onValueChange={(v) => setRungWidth(v[0])} min={1} max={6} step={0.5} />
          </div>

          {/* Amplitude */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Amplitude</Label>
              <span className="text-sm text-muted-foreground">{amplitude}px</span>
            </div>
            <Slider value={[amplitude]} onValueChange={(v) => setAmplitude(v[0])} min={5} max={50} step={1} />
          </div>

          {/* Wavelength */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Wavelength</Label>
              <span className="text-sm text-muted-foreground">{wavelength}px</span>
            </div>
            <Slider value={[wavelength]} onValueChange={(v) => setWavelength(v[0])} min={30} max={200} step={5} />
          </div>

          {/* Replication Fork Section */}
          <div className="pt-2 border-t space-y-3">
            <Label className="text-sm font-semibold">Replication Fork</Label>

            {/* Fork Type */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Type</Label>
              <div className="flex gap-1">
                <Button
                  variant={forkType === 'none' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setForkType('none')}
                  className="text-xs h-7 px-2"
                >
                  None
                </Button>
                <Button
                  variant={forkType === 'end' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setForkType('end')}
                  className="text-xs h-7 px-2"
                >
                  End
                </Button>
                <Button
                  variant={forkType === 'middle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setForkType('middle')}
                  className="text-xs h-7 px-2"
                >
                  Middle
                </Button>
              </div>
            </div>

            {forkType !== 'none' && (
              <>
                {/* Fork Position */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm">Fork Position</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(forkPosition * 100)}%</span>
                  </div>
                  <Slider value={[forkPosition]} onValueChange={(v) => setForkPosition(v[0])} min={0.05} max={0.95} step={0.05} />
                </div>

                {/* Fork Length (middle only) */}
                {forkType === 'middle' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm">Fork Length</Label>
                      <span className="text-sm text-muted-foreground">{Math.round(forkLength * 100)}%</span>
                    </div>
                    <Slider value={[forkLength]} onValueChange={(v) => setForkLength(v[0])} min={0.05} max={0.5} step={0.05} />
                  </div>
                )}

                {/* Fork Spread */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm">Fork Spread</Label>
                    <span className="text-sm text-muted-foreground">{forkSpread}px</span>
                  </div>
                  <Slider value={[forkSpread]} onValueChange={(v) => setForkSpread(v[0])} min={10} max={80} step={5} />
                </div>
              </>
            )}
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
