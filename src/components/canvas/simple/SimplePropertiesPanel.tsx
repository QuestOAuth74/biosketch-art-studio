import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PropertiesPanel } from '@/components/canvas/PropertiesPanel';
import { LayersPanel } from '@/components/canvas/LayersPanel';
import { useCanvas } from '@/contexts/CanvasContext';
import { cn } from '@/lib/utils';

interface SimplePropertiesPanelProps {
  activeTool?: string;
}

type LeftTab = 'style' | 'layers';

export function SimplePropertiesPanel({ activeTool }: SimplePropertiesPanelProps) {
  const { selectedObject, deleteSelected, duplicateSelected } = useCanvas();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<LeftTab>('style');
  const hasSelection = !!selectedObject;

  const tabClass = (isActive: boolean) =>
    cn(
      "py-4 px-3 text-base font-extrabold tracking-wide uppercase rounded-l-xl rounded-r-none transition-all duration-200 border-0",
      isActive
        ? "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-900 shadow-[0_0_16px_4px_rgba(253,224,71,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] border border-amber-200/50 dark:from-amber-900/40 dark:to-amber-800/30 dark:text-amber-100 dark:shadow-[0_0_16px_4px_rgba(253,224,71,0.25)]"
        : "bg-white/70 text-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-amber-50/80 hover:text-amber-800 hover:shadow-[0_0_12px_2px_rgba(253,224,71,0.25)] dark:bg-white/15 dark:text-slate-300 dark:hover:bg-amber-900/25 dark:hover:text-amber-200",
    );

  return (
    <div className="absolute left-3 top-3 bottom-3 z-30 flex pointer-events-none">
      {/* Tab strip on the left side */}
      <div className="flex flex-col gap-1 pointer-events-auto pt-4">
        {/* Pill open/close button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="py-3 px-3 rounded-l-xl rounded-r-none flex items-center justify-center bg-white/80 text-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-amber-50 hover:text-amber-800 hover:shadow-[0_0_10px_2px_rgba(253,224,71,0.3)] dark:bg-white/15 dark:text-slate-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-200 transition-all duration-200 pointer-events-auto"
        >
          {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>

        {/* Style tab */}
        <button
          onClick={() => { setActiveTab('style'); setExpanded(true); }}
          className={tabClass(expanded && activeTab === 'style')}
        >
          <span className="block" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Style</span>
        </button>

        {/* Layers tab */}
        <button
          onClick={() => { setActiveTab('layers'); setExpanded(true); }}
          className={tabClass(expanded && activeTab === 'layers')}
        >
          <span className="block" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Layers</span>
        </button>

        {/* Quick actions below the tab */}
        {hasSelection && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={duplicateSelected}
                  className="h-9 w-9 rounded-l-xl rounded-r-none flex items-center justify-center bg-white/40 text-muted-foreground hover:text-slate-900 dark:bg-white/10 dark:hover:text-slate-100 transition-all"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Duplicate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={deleteSelected}
                  className="h-9 w-9 rounded-l-xl rounded-r-none flex items-center justify-center bg-white/40 text-rose-500 hover:text-rose-600 dark:bg-white/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Delete</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Panel content */}
      {expanded && (
        <div className="flex-1 min-h-0 w-[280px] glass-surface-strong rounded-r-3xl rounded-l-none pointer-events-auto animate-in slide-in-from-left-2 duration-200 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col rounded-r-3xl rounded-l-none overflow-hidden">
            {activeTab === 'style' ? <PropertiesPanel activeTool={activeTool} /> : <LayersPanel />}
          </div>
        </div>
      )}
    </div>
  );
}
