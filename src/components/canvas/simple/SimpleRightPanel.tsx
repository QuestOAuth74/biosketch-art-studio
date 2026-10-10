import { useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { SimpleIconLibrary } from './SimpleIconLibrary';
import { TemplatesBrowser } from '@/components/canvas/TemplatesBrowser';
import { UserAssetsLibrary } from '@/components/canvas/UserAssetsLibrary';
import { useCanvas } from '@/contexts/CanvasContext';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'library', label: 'Icons' },
  { id: 'assets', label: 'Assets' },
  { id: 'templates', label: 'Templates' },
] as const;

type TabId = typeof TABS[number]['id'];

interface SimpleRightPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAIIconGenerate?: (initialPrompt?: string) => void;
}

export function SimpleRightPanel({ activeTab, onTabChange, onAIIconGenerate }: SimpleRightPanelProps) {
  const { importProjectToCanvas } = useCanvas();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="absolute right-3 top-3 bottom-3 z-30 flex pointer-events-none">
      {/* Panel content */}
      {expanded && (
        <div className="flex-1 min-h-0 w-[270px] glass-surface-strong rounded-l-3xl rounded-r-none overflow-hidden pointer-events-auto animate-in slide-in-from-right-2 duration-200 flex flex-col">
          {activeTab === 'library' && (
            <div className="flex-1 overflow-hidden">
              <SimpleIconLibrary onAIIconGenerate={onAIIconGenerate} />
            </div>
          )}
          {activeTab === 'assets' && (
            <div className="flex-1 overflow-hidden">
              <UserAssetsLibrary
                onAssetSelect={(assetId, content) => {
                  // Mirrors Canvas.tsx — FabricCanvas listens for this event
                  // and handles both SVG (text content) and raster (data URL) payloads.
                  window.dispatchEvent(
                    new CustomEvent('addAssetToCanvas', {
                      detail: { content, assetId },
                    })
                  );
                }}
              />
            </div>
          )}
          {activeTab === 'templates' && (
            <div className="flex-1 overflow-hidden">
              <TemplatesBrowser onImport={importProjectToCanvas} />
            </div>
          )}
        </div>
      )}

      {/* Tab strip on the right side */}
      <div className="flex flex-col gap-1 pointer-events-auto pt-4">
        {/* Pill open/close button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="py-3 px-3 rounded-r-xl rounded-l-none flex items-center justify-center bg-white/80 text-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-amber-50 hover:text-amber-800 hover:shadow-[0_0_10px_2px_rgba(253,224,71,0.3)] dark:bg-white/15 dark:text-slate-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-200 transition-all duration-200 pointer-events-auto"
        >
          {expanded ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </button>

        {/* Tab buttons */}
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { onTabChange(id); setExpanded(true); }}
            className={cn(
              "py-4 px-3 text-base font-extrabold tracking-wide uppercase rounded-r-xl rounded-l-none transition-all duration-200 border-0",
              activeTab === id && expanded
                ? "bg-gradient-to-l from-amber-100 to-amber-50 text-amber-900 shadow-[0_0_16px_4px_rgba(253,224,71,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] border border-amber-200/50 dark:from-amber-900/40 dark:to-amber-800/30 dark:text-amber-100 dark:shadow-[0_0_16px_4px_rgba(253,224,71,0.25)]"
                : "bg-white/70 text-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-amber-50/80 hover:text-amber-800 hover:shadow-[0_0_12px_2px_rgba(253,224,71,0.25)] dark:bg-white/15 dark:text-slate-300 dark:hover:bg-amber-900/25 dark:hover:text-amber-200"
            )}
          >
            <span className="block" style={{ writingMode: 'vertical-rl' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
