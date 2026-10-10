import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CanvasProvider, useCanvas } from '@/contexts/CanvasContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FabricCanvas } from '@/components/canvas/FabricCanvas';
import { ExportDialog } from '@/components/canvas/ExportDialog';
import { ZoomControlPopover } from '@/components/canvas/ZoomControlPopover';
import { MobileWarningDialog } from '@/components/canvas/MobileWarningDialog';
import { CanvasContextMenu } from '@/components/canvas/CanvasContextMenu';
import { ContextualToolbar } from '@/components/canvas/ContextualToolbar';
import { CropTool } from '@/components/canvas/CropTool';
import { DraggableAIGuide } from '@/components/canvas/DraggableAIGuide';
import { CanvasRulers } from '@/components/canvas/CanvasRulers';
import { GridAndRulersPopover } from '@/components/canvas/GridAndRulersPopover';
import { AIIconGenerator } from '@/components/canvas/AIIconGenerator';
import { AIDiagramGenerator } from '@/components/canvas/AIDiagramGenerator';
import { ReferenceImageOverlay } from '@/components/canvas/ReferenceImageOverlay';
import { PdbViewerDialog } from '@/components/canvas/PdbViewerDialog';
import { VersionHistory } from '@/components/canvas/VersionHistory';
import { SimpleTopBar, SimpleToolbar, SimplePropertiesPanel, SimpleRightPanel, SimpleAIBar } from '@/components/canvas/simple';
import { ImageUploadOverlay } from '@/components/canvas/simple/ImageUploadOverlay';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useAppMenuEvents } from '@/hooks/useAppMenuEvents';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { useAutosave } from '@/hooks/useAutosave';
import { useAutosaveRestore } from '@/hooks/useAutosaveRestore';
import { useSettings } from '@/stores/settingsStore';
import { withExportWatermark } from '@/lib/exportWatermark';
import { ToolRatingWidget } from '@/components/canvas/ToolRatingWidget';
import { ReportBugDialog } from '@/components/community/ReportBugDialog';
import { SuggestIconDialog } from '@/components/community/SuggestIconDialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Bug, Lightbulb, Play } from 'lucide-react';
import { toast } from 'sonner';

const glassStudioStyles = `
  .simple-canvas-glass {
    background: linear-gradient(180deg,
      hsl(210 65% 97%) 0%,
      hsl(215 55% 94%) 100%);
    font-feature-settings: 'cv11', 'ss01', 'ss03';
  }
  .dark .simple-canvas-glass {
    background: linear-gradient(180deg,
      hsl(215 40% 11%) 0%,
      hsl(220 35% 9%) 100%);
  }

  @keyframes pulse-slow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.03); }
  }
  .animate-pulse-slow {
    animation: pulse-slow 12s ease-in-out infinite;
  }

  /* Sidebars: light-blue tinted glass over the pale-sky page bg */
  .glass-surface {
    background: rgba(219, 234, 254, 0.55);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(147, 197, 253, 0.4);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.8) inset,
      0 4px 16px -4px rgba(30, 64, 175, 0.08);
  }
  .dark .glass-surface {
    background: rgba(15, 30, 50, 0.65);
    border: 1px solid rgba(59, 130, 246, 0.12);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
      0 4px 16px -4px rgba(0, 0, 0, 0.3);
  }

  /* Top bar: deep navy gradient, white-tinted text */
  .glass-topbar {
    background: linear-gradient(135deg, hsl(220 55% 20%) 0%, hsl(220 65% 12%) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.12) inset,
      0 6px 20px -6px rgba(11, 29, 58, 0.4);
    color: #ffffff;
  }
  .dark .glass-topbar {
    background: linear-gradient(135deg, hsl(220 55% 16%) 0%, hsl(220 65% 8%) 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.05) inset,
      0 6px 20px -6px rgba(0, 0, 0, 0.5);
    color: #ffffff;
  }

  /* Topbar text readability on the deep blue */
  .glass-topbar .text-foreground,
  .glass-topbar button { color: #ffffff !important; }
  .glass-topbar .text-muted-foreground { color: rgba(255, 255, 255, 0.7) !important; }
  .glass-topbar .hover\\:bg-muted\\/60:hover { background: rgba(255, 255, 255, 0.12) !important; }

  /* Topbar children that try to lighten on hover get a translucent
     white substitute — otherwise a solid white background plus the
     forced-white topbar text becomes invisible. Covers the SimpleAIBar
     (slate-100), shadcn ghost/outline (accent), and the muted hover. */
  .glass-topbar .hover\\:bg-slate-100:hover,
  .glass-topbar .dark\\:hover\\:bg-slate-800\\/60:hover,
  .glass-topbar .hover\\:bg-accent:hover {
    background: rgba(255, 255, 255, 0.15) !important;
  }
  .glass-topbar .hover\\:text-slate-900:hover,
  .glass-topbar .dark\\:hover\\:text-slate-100:hover,
  .glass-topbar .hover\\:text-accent-foreground:hover {
    color: #ffffff !important;
  }

  .glass-surface-strong {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(226, 232, 240, 0.9);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.9) inset,
      0 8px 24px -8px rgba(15, 23, 42, 0.08);
  }
  .dark .glass-surface-strong {
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Active tool: refined slate-blue */
  .glass-active-tool {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
    color: white !important;
    box-shadow:
      0 4px 12px -3px rgba(15, 23, 42, 0.3),
      0 1px 0 0 rgba(255, 255, 255, 0.15) inset !important;
  }
  .dark .glass-active-tool {
    background: linear-gradient(135deg, #475569 0%, #64748b 100%) !important;
  }

  .glass-hover-tool:hover {
    background: rgba(15, 23, 42, 0.06) !important;
    color: rgb(15, 23, 42) !important;
  }
  .dark .glass-hover-tool:hover {
    background: rgba(255, 255, 255, 0.06) !important;
    color: rgb(241, 245, 249) !important;
  }

  /* Headings — slightly tighter for modern feel */
  .glass-heading {
    letter-spacing: -0.02em;
    font-weight: 600;
  }

  /* Tabular figures for stats */
  .glass-numerals {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
`;

function SimpleCanvasContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useAppMenuEvents();
  useUnsavedWarning();
  useAutosave();
  useAutosaveRestore();

  const {
    canvas,
    loadProject,
    setCurrentProjectId,
    currentProjectId,
    isLoadingProject,
    iconLoadingProgress,
    saveProject,
    selectedObject,
    deleteSelected,
    duplicateSelected,
    undo,
    redo,
    cut,
    copy,
    paste,
    selectAll,
    hasClipboardContent,
    bringToFront,
    bringForward,
    sendBackward,
    sendToBack,
    groupSelected,
    ungroupSelected,
    toggleLockSelected,
    hideSelected,
    showAllHidden,
    zoom,
    canvasDimensions,
    cropMode,
    setCropMode,
    cropImage,
    saveState,
    exportDialogOpen,
    setExportDialogOpen,
    exportAsPNG,
    exportAsPNGTransparent,
    exportAsJPG,
    exportAsSVG,
    exportAsPDF,
    exportAsPPTX,
  } = useCanvas();

  // Wire export dialog format → context export function
  const watermarkEnabled = useSettings((s) => s.watermarkEnabled);
  const handleExportImage = useCallback(async (
    format: 'png' | 'png-transparent' | 'jpg' | 'svg' | 'pdf' | 'pptx',
    dpi: 150 | 300 | 600,
    selectionOnly?: boolean,
    pdfOptions?: { cmykMode?: boolean }
  ) => {
    if (!canvas) return;
    await withExportWatermark(canvas, watermarkEnabled, async () => {
      if (format === 'png') await exportAsPNG(dpi, selectionOnly);
      else if (format === 'png-transparent') await exportAsPNGTransparent(dpi, selectionOnly);
      else if (format === 'jpg') await exportAsJPG(dpi, selectionOnly);
      else if (format === 'svg') await exportAsSVG(selectionOnly);
      else if (format === 'pdf') await exportAsPDF(dpi, selectionOnly, pdfOptions);
      else if (format === 'pptx') await exportAsPPTX(dpi, selectionOnly);
    });
  }, [canvas, watermarkEnabled, exportAsPNG, exportAsPNGTransparent, exportAsJPG, exportAsSVG, exportAsPDF, exportAsPPTX]);

  const [hasClipboard, setHasClipboard] = useState(false);
  const [hasHiddenObjects, setHasHiddenObjects] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // AI feature state
  const [aiIconGeneratorOpen, setAiIconGeneratorOpen] = useState(false);
  // Failed icon-library searches forward their query into the AI generator
  // as the initial prompt so the user lands on a prefilled form.
  const [aiIconInitialPrompt, setAiIconInitialPrompt] = useState<string | undefined>(undefined);
  const [aiDiagramOpen, setAiDiagramOpen] = useState(false);

  // Feedback / help dialogs (mirror the advanced editor)
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [suggestIconOpen, setSuggestIconOpen] = useState(false);
  const [helpVideoOpen, setHelpVideoOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ src: string; size: 'small' | 'medium' | 'large' } | null>(null);

  // Track hidden objects
  useEffect(() => {
    if (!canvas) return;
    const check = () => {
      setHasHiddenObjects(canvas.getObjects().some((o: any) => !o.visible));
    };
    check();
    canvas.on('object:added', check);
    canvas.on('object:removed', check);
    canvas.on('object:modified', check);
    return () => {
      canvas.off('object:added', check);
      canvas.off('object:removed', check);
      canvas.off('object:modified', check);
    };
  }, [canvas]);

  const [activeTool, setActiveTool] = useState('select');
  const [rightPanelTab, setRightPanelTab] = useState('templates');
  const [pdbViewerOpen, setPdbViewerOpen] = useState(false);

  // Image upload: opens a file picker for SVG/PNG/JPG (≤2 MB) and drops the
  // result onto the canvas with real-time progress feedback. Wired to the
  // 'image' tool below via handleToolChange (never lands in activeTool state,
  // so the toolbar doesn't get stuck on Image).
  const { state: imageUploadState, openPicker: openImageUploadPicker } = useImageUpload(canvas, saveState);

  const handleToolChange = useCallback((tool: string) => {
    if (tool === 'pdb-structure') {
      setPdbViewerOpen(true);
      return;
    }
    if (tool === 'image') {
      openImageUploadPicker();
      return;
    }
    setActiveTool(tool);
  }, [openImageUploadPicker]);

  const lastLoadedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (id && canvas && lastLoadedProjectRef.current !== id) {
      lastLoadedProjectRef.current = id;
      loadProject(id);
      setCurrentProjectId(id);
    }
  }, [id, canvas, loadProject, setCurrentProjectId]);

  // Import SVG from any tool / AI Illustrator via sessionStorage
  // (mirrors the advanced canvas import effect at Canvas.tsx:733-794)
  useEffect(() => {
    if (!canvas) return;

    const toolImports = [
      { key: 'pedigree_svg_import', label: 'Pedigree', scale: 0.8 },
      { key: 'smiles_svg_import', label: 'Molecular structure', scale: 0.6 },
      { key: 'latex_svg_import', label: 'LaTeX equation', scale: 0.6 },
      { key: 'heatmap_svg_import', label: 'Heatmap', scale: 0.7 },
      { key: 'phylo_svg_import', label: 'Phylogenetic tree', scale: 0.7 },
      { key: 'gantt_svg_import', label: 'Gantt chart', scale: 0.8 },
      { key: 'gel_svg_import', label: 'Gel electrophoresis', scale: 0.6 },
      { key: 'volcano_svg_import', label: 'Volcano plot', scale: 0.7 },
      { key: 'codon_svg_import', label: 'Codon wheel', scale: 0.6 },
      { key: 'boxwhisker_svg_import', label: 'Box & whisker plot', scale: 0.7 },
      { key: 'barchart_svg_import', label: 'Bar chart', scale: 0.7 },
      { key: 'violin_svg_import', label: 'Violin plot', scale: 0.7 },
      { key: 'corrmatrix_svg_import', label: 'Correlation matrix', scale: 0.7 },
      { key: 'forest_svg_import', label: 'Forest plot', scale: 0.7 },
      { key: 'roc_svg_import', label: 'ROC curve', scale: 0.7 },
      { key: 'venn_svg_import', label: 'Venn diagram', scale: 0.7 },
      { key: 'sankey_svg_import', label: 'Sankey diagram', scale: 0.7 },
      { key: 'chart_studio_svg_import', label: 'Chart Studio chart', scale: 0.7 },
      { key: 'ai_illustrator_svg_import', label: 'AI illustration', scale: 0.5 },
      { key: 'scientific_illustrator_svg_import', label: 'Scientific illustration', scale: 0.7 },
    ];

    const found = toolImports.find(t => sessionStorage.getItem(t.key));
    if (!found) return;

    const svgData = sessionStorage.getItem(found.key)!;
    sessionStorage.removeItem(found.key);

    const timer = setTimeout(async () => {
      try {
        const fabric = await import('fabric');
        const { loadSVGFromString, util } = fabric;
        // Posters carry a data-poster="1" marker on the SVG root — signal to
        // skip grouping and rebuild <text> as IText so double-click-to-edit
        // works out of the box (matches PPT export). Other SVGs stay grouped.
        const isPoster = /<svg\b[^>]*\bdata-poster\s*=\s*(["'])1\1/i.test(svgData);
        const { objects, options } = await loadSVGFromString(svgData);
        const valid = (objects || []).filter(Boolean) as any[];
        if (valid.length === 0) return;

        // Poster path — mirrors the Scientific Illustrator flow below (Fabric
        // parses <text> as static FabricText; rebuild as IText for real edit).
        if (isPoster) {
          const { IText } = fabric as any;
          const items = valid.map((o: any) => {
            if (o.type !== 'text') return o;
            return new IText(o.text || '', {
              left: o.left, top: o.top, originX: o.originX, originY: o.originY,
              fontSize: o.fontSize, fontFamily: o.fontFamily, fontWeight: o.fontWeight,
              fontStyle: o.fontStyle, fill: o.fill, textAlign: o.textAlign,
              angle: o.angle, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity,
              charSpacing: o.charSpacing, stroke: o.stroke, strokeWidth: o.strokeWidth,
              paintFirst: o.paintFirst,
            });
          });
          const bboxes = items
            .map((o: any) => (typeof o.getBoundingRect === 'function' ? o.getBoundingRect(true, true) : null))
            .filter(Boolean) as { left: number; top: number; width: number; height: number }[];
          const minX = Math.min(...bboxes.map((b) => b.left));
          const minY = Math.min(...bboxes.map((b) => b.top));
          const maxX = Math.max(...bboxes.map((b) => b.left + b.width));
          const maxY = Math.max(...bboxes.map((b) => b.top + b.height));
          const contentW = Math.max(1, maxX - minX);
          const contentH = Math.max(1, maxY - minY);
          const cw = canvas.width || 1200;
          const ch = canvas.height || 800;
          const scale = Math.min((cw * (found.scale ?? 0.9)) / contentW, (ch * (found.scale ?? 0.9)) / contentH, 1);
          const targetLeft = cw / 2 - (contentW * scale) / 2;
          const targetTop = ch / 2 - (contentH * scale) / 2;
          for (const o of items as any[]) {
            const currentLeft = (o.left ?? 0) - minX;
            const currentTop = (o.top ?? 0) - minY;
            o.set({
              left: targetLeft + currentLeft * scale,
              top: targetTop + currentTop * scale,
              scaleX: (o.scaleX ?? 1) * scale,
              scaleY: (o.scaleY ?? 1) * scale,
            });
            o.setCoords?.();
            canvas.add(o);
          }
          canvas.requestRenderAll();
          saveState();
          toast.success('Poster imported — every element is editable');
          return;
        }

        // Scientific Illustrator: import as individual, fully-editable objects.
        // Fabric's SVG parser turns <text> into static FabricText (not editable),
        // so we rebuild each one as an interactive IText.
        if (found.key === 'scientific_illustrator_svg_import') {
          const { IText, ActiveSelection } = fabric as any;
          const items = valid.map((o: any) => {
            if (o.type !== 'text') return o;
            return new IText(o.text || '', {
              left: o.left, top: o.top, originX: o.originX, originY: o.originY,
              fontSize: o.fontSize, fontFamily: o.fontFamily, fontWeight: o.fontWeight,
              fontStyle: o.fontStyle, fill: o.fill, textAlign: o.textAlign,
              angle: o.angle, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity,
              charSpacing: o.charSpacing, stroke: o.stroke, strokeWidth: o.strokeWidth,
              paintFirst: o.paintFirst,
            });
          });
          const vbW = 920;
          const vbH = Number(svgData.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1]) || 660;
          const cw = canvas.width || 1200, ch = canvas.height || 800;
          const s = Math.min((cw * 0.82) / vbW, (ch * 0.82) / vbH, 1);
          const offX = (cw - vbW * s) / 2, offY = (ch - vbH * s) / 2;
          items.forEach((o: any) => {
            o.set({
              left: offX + (o.left || 0) * s,
              top: offY + (o.top || 0) * s,
              scaleX: (o.scaleX || 1) * s,
              scaleY: (o.scaleY || 1) * s,
            });
            o.setCoords();
            canvas.add(o);
          });
          if (items.length) canvas.setActiveObject(new ActiveSelection(items, { canvas }));
          canvas.requestRenderAll();
          saveState();
          toast.success('Scientific illustration imported — labels are editable');
          return;
        }

        // all other tools: import as a single grouped image
        const group = util.groupSVGElements(valid, options);
        const maxW = (canvas.width || 1200) * found.scale;
        const maxH = (canvas.height || 800) * found.scale;
        const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
        group.scale(scale);
        group.set({
          left: (canvas.width || 1200) / 2 - ((group.width || 0) * scale) / 2,
          top: (canvas.height || 800) / 2 - ((group.height || 0) * scale) / 2,
          lockUniScaling: true,
        });
        group.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.requestRenderAll();
        saveState();
        toast.success(`${found.label} imported to canvas`);
      } catch (err) {
        console.error(`Failed to import ${found.label} SVG:`, err);
        toast.error(`Failed to import ${found.label}`);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [canvas, saveState]);

  // Import PNG from Chart Studio via sessionStorage
  useEffect(() => {
    if (!canvas) return;
    const pngData = sessionStorage.getItem("chartStudio_pngImport");
    if (!pngData) return;
    const pngW = Number(sessionStorage.getItem("chartStudio_pngWidth") || 740);
    const pngH = Number(sessionStorage.getItem("chartStudio_pngHeight") || 520);
    sessionStorage.removeItem("chartStudio_pngImport");
    sessionStorage.removeItem("chartStudio_pngWidth");
    sessionStorage.removeItem("chartStudio_pngHeight");

    const timer = setTimeout(async () => {
      try {
        const { FabricImage } = await import('fabric');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const fabricImg = new FabricImage(img);
          // Scale to fit 70% of canvas
          const maxW = (canvas.width || 1200) * 0.7;
          const maxH = (canvas.height || 800) * 0.7;
          const scale = Math.min(maxW / (fabricImg.width || pngW), maxH / (fabricImg.height || pngH), 1);
          fabricImg.scale(scale);
          fabricImg.set({
            left: (canvas.width || 1200) / 2 - ((fabricImg.width || pngW) * scale) / 2,
            top: (canvas.height || 800) / 2 - ((fabricImg.height || pngH) * scale) / 2,
          });
          canvas.add(fabricImg);
          canvas.setActiveObject(fabricImg);
          canvas.requestRenderAll();
          saveState();
          toast.success("Chart Studio graph imported to canvas");
        };
        img.src = pngData;
      } catch (err) {
        console.error("Failed to import Chart Studio PNG:", err);
        toast.error("Failed to import chart");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [canvas, saveState]);

  const handleShapeCreated = useCallback(() => {
    setActiveTool('select');
  }, []);

  // Pin AI reference image onto the canvas (matches advanced canvas behavior)
  const handlePinReferenceToCanvas = useCallback(async (imageDataUrl: string) => {
    if (!canvas) return;
    try {
      const { FabricImage } = await import('fabric');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load reference image'));
        img.src = imageDataUrl;
      });

      const fabricImage = new FabricImage(img, {
        left: (canvas.width || 0) / 2,
        top: (canvas.height || 0) / 2,
        originX: 'center',
        originY: 'center',
        opacity: 0.4,
        lockRotation: true,
        selectable: true,
        evented: true,
      });

      // Scale to fit ~60% of canvas
      const maxW = (canvas.width || 0) * 0.6;
      const maxH = (canvas.height || 0) * 0.6;
      const scale = Math.min(maxW / fabricImage.width!, maxH / fabricImage.height!, 1);
      fabricImage.scale(scale);

      // Mark as reference guide for serialization and properties panel
      (fabricImage as any).isReferenceGuide = true;

      canvas.add(fabricImage);
      canvas.sendObjectToBack(fabricImage);
      canvas.requestRenderAll();

      toast.success('Reference image pinned — drag and drop icons to match the guide');
    } catch (err) {
      console.error('Failed to pin reference image:', err);
      toast.error('Failed to pin reference image');
    }
  }, [canvas]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
        if (e.key === 'Z') { e.preventDefault(); redo(); return; }
        if (e.key === 's') { e.preventDefault(); saveProject(true); return; }
        if (e.key === 'c') { e.preventDefault(); copy(); setActiveTool('select'); return; }
        if (e.key === 'x') { e.preventDefault(); cut(); setActiveTool('select'); return; }
        if (e.key === 'v' && !isInput) { e.preventDefault(); paste(); setActiveTool('select'); return; }
        // Any other modifier+key combination must bail out — otherwise the
        // fall-through switch below would interpret the letter as a tool
        // shortcut (Ctrl+C → setActiveTool('circle') was the original bug).
        return;
      }

      if (isInput) return;

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case 't': setActiveTool('text'); break;
        case 'r': setActiveTool('rectangle'); break;
        case 'c': setActiveTool('circle'); break;
        case 'l': setActiveTool('straight-line'); break;
        case 'p': setActiveTool('pen'); break;
        case 'e': setActiveTool('eraser'); break;
        case 'i': openImageUploadPicker(); break;
        case 'escape': setActiveTool('select'); break;
        case 'delete':
        case 'backspace':
          if (selectedObject) { deleteSelected(); }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, saveProject, deleteSelected, selectedObject, copy, cut, paste, openImageUploadPicker]);

  return (
    <div className="simple-canvas-glass h-screen flex flex-col overflow-hidden relative">
      {/* Glass Studio theme styles */}
      <style>{glassStudioStyles}</style>

      {/* Subtle ambient background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-slate-300/15 dark:bg-slate-700/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-200/10 dark:bg-blue-900/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      <MobileWarningDialog />

      {/* Top Bar with AI features centered */}
      <SimpleTopBar />

      {/* Toolbar */}
      <SimpleToolbar activeTool={activeTool} onToolChange={handleToolChange} />

      {/* Canvas area outer wrapper - relative for floating elements */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable canvas content - only the canvas itself scrolls */}
        <div ref={scrollContainerRef} className="absolute inset-0 overflow-auto">
          {/* Loading overlay */}
          {isLoadingProject && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading project...</p>
              {iconLoadingProgress && iconLoadingProgress.total > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Loading icons: {iconLoadingProgress.current}/{iconLoadingProgress.total}
                </p>
              )}
            </div>
          )}

          {/* Canvas centered */}
          <div className="min-h-full min-w-full inline-flex items-center justify-center p-8">
            <div className="inline-block">
              <CanvasContextMenu
                selectedObject={selectedObject}
                hasClipboard={hasClipboard || hasClipboardContent}
                canUndo={true}
                canRedo={true}
                hasHiddenObjects={hasHiddenObjects}
                onCopy={() => { copy(); setHasClipboard(true); }}
                onCut={() => { cut(); setHasClipboard(true); }}
                onPaste={paste}
                onDuplicate={duplicateSelected}
                onDelete={deleteSelected}
                onLock={toggleLockSelected}
                onHide={hideSelected}
                onBringToFront={bringToFront}
                onBringForward={bringForward}
                onSendBackward={sendBackward}
                onSendToBack={sendToBack}
                onGroup={groupSelected}
                onUngroup={ungroupSelected}
                onSelectAll={selectAll}
                onUndo={undo}
                onRedo={redo}
                onShowAllHidden={showAllHidden}
                onOpenProperties={() => {}}
                onCustomizeWithAI={() => {}}
                onSaveAsGroupIcon={() => {}}
              >
                <FabricCanvas
                  activeTool={activeTool}
                  onShapeCreated={handleShapeCreated}
                  onToolChange={handleToolChange}
                />
              </CanvasContextMenu>
            </div>
          </div>
        </div>

        {/* Rulers - sibling of scroll container so they stay fixed in viewport */}
        <CanvasRulers
          zoom={zoom}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
          scrollContainerRef={scrollContainerRef}
        />

        {/* Floating panels - siblings of scroll container so they don't move when canvas scrolls */}
        <SimplePropertiesPanel activeTool={activeTool} />
        <SimpleRightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onAIIconGenerate={(prompt) => {
            setAiIconInitialPrompt(prompt);
            setAiIconGeneratorOpen(true);
          }}
        />

        {/* Crop Tool overlay */}
        {cropMode !== 'none' && canvas && (() => {
          const objectToEdit = selectedObject || canvas.getActiveObject();
          if (!objectToEdit || objectToEdit.type === 'activeSelection') return null;
          return (
            <CropTool
              canvas={canvas}
              selectedObject={objectToEdit}
              cropMode={cropMode}
              onApply={cropImage}
              onCancel={() => setCropMode('none')}
            />
          );
        })()}

        {/* Zoom + grid/rulers - bottom-left aligned with properties panel column */}
        <div className="absolute bottom-3 left-3 z-30 flex flex-col items-center gap-0.5 glass-surface-strong rounded-2xl p-1">
          <GridAndRulersPopover />
          <div className="h-px w-5 bg-slate-200 dark:bg-slate-700" />
          <ZoomControlPopover />
        </div>
      </div>

      {/* Contextual Toolbar - fixed position, must be outside overflow containers */}
      <ContextualToolbar />

      {/* Image upload progress — appears above everything during file read/decode */}
      <ImageUploadOverlay state={imageUploadState} />

      {/* Feedback / rating widget — same one as the advanced canvas */}
      <ToolRatingWidget />

      {/* AI Dialogs */}
      <AIIconGenerator
        open={aiIconGeneratorOpen}
        onOpenChange={(open) => {
          setAiIconGeneratorOpen(open);
          if (!open) setAiIconInitialPrompt(undefined);
        }}
        initialPrompt={aiIconInitialPrompt}
        onIconGenerated={() => toast.success('Icon added to library!')}
      />
      <AIDiagramGenerator
        open={aiDiagramOpen}
        onClose={() => setAiDiagramOpen(false)}
        canvas={canvas}
      />

      {/* Version history — same component as the advanced editor */}
      <VersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        projectId={currentProjectId}
        onVersionRestored={() => {
          if (currentProjectId) loadProject(currentProjectId);
        }}
      />

      {/* Feedback / help dialogs */}
      <SuggestIconDialog open={suggestIconOpen} onOpenChange={setSuggestIconOpen} />
      <ReportBugDialog open={reportBugOpen} onOpenChange={setReportBugOpen} />
      <Dialog open={helpVideoOpen} onOpenChange={setHelpVideoOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-lg font-serif">Feeling Stuck? Watch This Guide</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            <div className="rounded-xl overflow-hidden border border-border/50">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                {helpVideoOpen && (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/rETbE0cX0e8?autoplay=1"
                    title="BioSketch Key Features Guide"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Reference Guide - draggable floating panel */}
      <DraggableAIGuide
        onUseAsGuide={(src, size) => setReferenceImage({ src, size })}
        onPinToCanvas={handlePinReferenceToCanvas}
      />

      {/* Reference Image Overlay - draggable guide on canvas */}
      {referenceImage && (
        <ReferenceImageOverlay
          src={referenceImage.src}
          initialSize={referenceImage.size}
          onClose={() => setReferenceImage(null)}
        />
      )}

      {/* PDB Structure Viewer */}
      <PdbViewerDialog
        canvas={canvas}
        open={pdbViewerOpen}
        onOpenChange={setPdbViewerOpen}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportImage}
        canvasWidth={canvasDimensions.width}
        canvasHeight={canvasDimensions.height}
        hasSelection={!!selectedObject}
      />
    </div>
  );
}

interface SimpleCanvasProps {
  readOnly?: boolean;
}

const SimpleCanvas = ({ readOnly = false }: SimpleCanvasProps) => {
  return (
    <CanvasProvider initialReadOnly={readOnly}>
      <TooltipProvider>
        <SimpleCanvasContent />
      </TooltipProvider>
    </CanvasProvider>
  );
};

export default SimpleCanvas;
