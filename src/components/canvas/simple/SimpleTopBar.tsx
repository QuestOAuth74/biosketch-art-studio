import { useState, useRef, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Sparkles, Check, Save, FolderOpen, FilePlus, ChevronDown } from 'lucide-react';
import { useCanvas } from '@/contexts/CanvasContext';
import { useFileSession } from '@/stores/fileSessionStore';
import { useFileActions } from '@/hooks/useFileActions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SimpleTopBarProps {
  centerSlot?: ReactNode;
}

export function SimpleTopBar({ centerSlot }: SimpleTopBarProps) {
  const navigate = useNavigate();
  const { projectName, setProjectName, saveStatus, setExportDialogOpen } = useCanvas();
  const { currentFilePath, recentFiles, clearRecentFiles } = useFileSession();
  const { newProject, openProject, saveProject, saveProjectAs } = useFileActions();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameValue(projectName); }, [projectName]);

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setNameValue(projectName);
    }
    setEditingName(false);
  };

  const saveLabel = currentFilePath ? 'Save' : 'Save As';

  return (
    <div className="h-12 glass-topbar flex items-center gap-2 px-3 shrink-0 relative z-20 rounded-none border-x-0 border-t-0">
      {/* Project name */}
      {editingName ? (
        <Input
          ref={inputRef}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setNameValue(projectName); setEditingName(false); }
          }}
          className="h-7 text-sm font-medium w-48 px-2"
          autoFocus
        />
      ) : (
        <button
          onClick={() => { setEditingName(true); setTimeout(() => inputRef.current?.select(), 0); }}
          className="text-sm font-semibold text-foreground hover:text-slate-600 dark:hover:text-slate-300 truncate max-w-[200px] px-1 glass-heading transition-colors"
        >
          {projectName}
        </button>
      )}

      {/* File ops */}
      <div className="flex items-center gap-1 ml-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={newProject} className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1.5">
              <FilePlus className="h-3.5 w-3.5" />
              <span>New</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New project (Ctrl+N)</TooltipContent>
        </Tooltip>

        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => openProject()} className="h-8 px-2.5 rounded-l-xl rounded-r-none text-xs font-semibold gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                <span>Open</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open .biosketch file (Ctrl+O)</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-1 rounded-l-none rounded-r-xl border-l border-border/40">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
              <DropdownMenuLabel>Recent files</DropdownMenuLabel>
              {recentFiles.length === 0 ? (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground text-xs">No recent files yet</span>
                </DropdownMenuItem>
              ) : (
                <>
                  {recentFiles.map((p) => {
                    const basename = p.split(/[\\/]/).pop() || p;
                    return (
                      <DropdownMenuItem key={p} onClick={() => openProject(p)} className="flex flex-col items-start gap-0.5">
                        <span className="font-medium text-sm truncate w-full">{basename}</span>
                        <span className="text-[10px] text-muted-foreground truncate w-full">{p}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={clearRecentFiles} className="text-xs text-muted-foreground">
                    Clear recent files
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveProject()}
              className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1.5"
            >
              {saveStatus === 'unsaved' ? (
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <Save className="h-3.5 w-3.5" />
              <span>{saveLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{currentFilePath ? 'Save (Ctrl+S)' : 'Save As (Ctrl+S)'}</TooltipContent>
        </Tooltip>

        {currentFilePath && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={saveProjectAs} className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1.5">
                <span>Save As</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save As (Ctrl+Shift+S)</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center slot — absolutely centered */}
      {centerSlot && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="pointer-events-auto">{centerSlot}</div>
        </div>
      )}

      {/* Right: Export + Advanced */}
      <button
        onClick={() => setExportDialogOpen(true)}
        className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white shadow-md shadow-slate-900/15 hover:shadow-lg hover:shadow-slate-900/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>

      <button
        onClick={() => navigate('/advanced-canvas')}
        className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white shadow-md shadow-slate-900/15 hover:shadow-lg hover:shadow-slate-900/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Switch to Advanced Editor
      </button>
    </div>
  );
}
