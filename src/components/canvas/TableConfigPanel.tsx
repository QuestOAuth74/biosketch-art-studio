import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Upload } from "lucide-react";
import { TableTool, TableConfig, DEFAULT_TABLE_CONFIG, TableStyle } from "@/lib/tableTool";
import { toast } from "sonner";
import type { Canvas as FabricCanvas, Group } from "fabric";

interface TableConfigPanelProps {
  canvas: FabricCanvas;
  selectedObject: any;
  saveState: () => void;
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

export function TableConfigPanel({ canvas, selectedObject, saveState }: TableConfigPanelProps) {
  const [config, setConfig] = useState<TableConfig>(
    selectedObject?.tableConfig ? { ...selectedObject.tableConfig } : { ...DEFAULT_TABLE_CONFIG }
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedObject?.tableConfig) {
      setConfig({ ...selectedObject.tableConfig });
    }
  }, [selectedObject]);

  const applyConfig = (updated: TableConfig) => {
    if (!canvas || !selectedObject) return;

    const newGroup = TableTool.updateTable(selectedObject as Group, updated);

    const idx = canvas.getObjects().indexOf(selectedObject);
    canvas.remove(selectedObject);
    if (idx >= 0) {
      canvas.insertAt(idx, newGroup);
    } else {
      canvas.add(newGroup);
    }
    canvas.setActiveObject(newGroup);
    canvas.requestRenderAll();
    saveState();
  };

  const update = (partial: Partial<TableConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    applyConfig(updated);
  };

  const handleStyleChange = (style: TableStyle) => {
    const updated = TableTool.applyStyle(config, style);
    setConfig(updated);
    applyConfig(updated);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const data = parseCSV(text);
      if (data.length === 0) {
        toast.error("CSV file is empty");
        return;
      }

      const rows = Math.min(data.length, 20);
      const cols = Math.min(Math.max(...data.map(r => r.length)), 10);

      // Pad rows to uniform column count
      const cellData = data.slice(0, rows).map(row => {
        const padded = [...row];
        while (padded.length < cols) padded.push('');
        return padded.slice(0, cols);
      });

      const updated: TableConfig = {
        ...config,
        rows,
        cols,
        cellData,
        headerRow: true,
      };
      setConfig(updated);
      applyConfig(updated);
      toast.success(`Imported ${rows} rows x ${cols} columns from CSV`);
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table</h3>

        {/* CSV Import */}
        <div className="space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleCSVImport}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
        </div>

        <Separator />

        {/* Style preset */}
        <div className="space-y-1.5">
          <Label className="text-xs">Style</Label>
          <Select value={config.style} onValueChange={(v) => handleStyleChange(v as TableStyle)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scientific">Scientific</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="bordered">Bordered</SelectItem>
              <SelectItem value="striped">Striped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Table title (optional)"
            value={config.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>

        <Separator />

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Rows</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={1}
              max={20}
              value={config.rows}
              onChange={(e) => update({ rows: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Columns</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={1}
              max={10}
              value={config.cols}
              onChange={(e) => update({ cols: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
            />
          </div>
        </div>

        {/* Cell size */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Cell Width</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={40}
              max={300}
              step={10}
              value={config.cellWidth}
              onChange={(e) => update({ cellWidth: Math.max(40, parseInt(e.target.value) || 100) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cell Height</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={20}
              max={100}
              step={4}
              value={config.cellHeight}
              onChange={(e) => update({ cellHeight: Math.max(20, parseInt(e.target.value) || 32) })}
            />
          </div>
        </div>

        <Separator />

        {/* Headers */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Header Row</Label>
          <Switch
            checked={config.headerRow}
            onCheckedChange={(v) => update({ headerRow: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Header Column</Label>
          <Switch
            checked={config.headerCol}
            onCheckedChange={(v) => update({ headerCol: v })}
          />
        </div>

        <Separator />

        {/* Typography */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Font Size</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={8}
              max={24}
              value={config.fontSize}
              onChange={(e) => update({ fontSize: Math.max(8, parseInt(e.target.value) || 12) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Size</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={8}
              max={24}
              value={config.headerFontSize}
              onChange={(e) => update({ headerFontSize: Math.max(8, parseInt(e.target.value) || 12) })}
            />
          </div>
        </div>

        <Separator />

        {/* Colors */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Border</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-7 h-7 rounded border cursor-pointer"
                value={config.borderColor}
                onChange={(e) => update({ borderColor: e.target.value })}
              />
              <Input
                className="h-7 text-[10px] flex-1"
                value={config.borderColor}
                onChange={(e) => update({ borderColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header BG</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-7 h-7 rounded border cursor-pointer"
                value={config.headerBgColor === 'transparent' ? '#ffffff' : config.headerBgColor}
                onChange={(e) => update({ headerBgColor: e.target.value })}
              />
              <Input
                className="h-7 text-[10px] flex-1"
                value={config.headerBgColor}
                onChange={(e) => update({ headerBgColor: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Header Text</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-7 h-7 rounded border cursor-pointer"
                value={config.headerTextColor}
                onChange={(e) => update({ headerTextColor: e.target.value })}
              />
              <Input
                className="h-7 text-[10px] flex-1"
                value={config.headerTextColor}
                onChange={(e) => update({ headerTextColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cell Text</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-7 h-7 rounded border cursor-pointer"
                value={config.cellTextColor}
                onChange={(e) => update({ cellTextColor: e.target.value })}
              />
              <Input
                className="h-7 text-[10px] flex-1"
                value={config.cellTextColor}
                onChange={(e) => update({ cellTextColor: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <Label className="text-xs">Border Width</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            min={0.5}
            max={4}
            step={0.5}
            value={config.borderWidth}
            onChange={(e) => update({ borderWidth: Math.max(0.5, parseFloat(e.target.value) || 1) })}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            const reset = { ...DEFAULT_TABLE_CONFIG };
            setConfig(reset);
            applyConfig(reset);
          }}
        >
          Reset to Default
        </Button>
      </div>
    </div>
  );
}
