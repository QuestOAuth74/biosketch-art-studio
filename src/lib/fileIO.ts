import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import type { Canvas as FabricCanvas } from 'fabric';
import { CANVAS_CUSTOM_PROPS } from '@/contexts/CanvasContext';

const FILTER = { name: 'Biosketch Project', extensions: ['biosketch'] };

export interface ProjectFile {
  version: 1;
  app: 'Biosketch.Art Studio';
  projectName: string;
  canvas: any;
  dimensions: { width: number; height: number };
  savedAt: string;
}

interface SaveArgs {
  canvas: FabricCanvas;
  projectName: string;
  dimensions: { width: number; height: number };
  /** If provided, writes to this path without prompting. Otherwise opens a Save As dialog. */
  path?: string | null;
}

export async function saveProjectToFile(args: SaveArgs): Promise<string | null> {
  let path = args.path ?? null;
  if (!path) {
    const suggested = `${(args.projectName || 'untitled').replace(/\.biosketch$/i, '')}.biosketch`;
    path = await save({ defaultPath: suggested, filters: [FILTER] });
    if (!path) return null;
  }
  const payload: ProjectFile = {
    version: 1,
    app: 'Biosketch.Art Studio',
    projectName: args.projectName,
    canvas: args.canvas.toJSON(CANVAS_CUSTOM_PROPS),
    dimensions: args.dimensions,
    savedAt: new Date().toISOString(),
  };
  await writeTextFile(path, JSON.stringify(payload));
  return path;
}

export async function openProjectFromFile(explicitPath?: string): Promise<{ file: ProjectFile; path: string } | null> {
  let path: string | null = explicitPath ?? null;
  if (!path) {
    const picked = await open({ multiple: false, filters: [FILTER] });
    if (!picked || Array.isArray(picked)) return null;
    path = picked as string;
  }
  const text = await readTextFile(path);
  const parsed = JSON.parse(text);
  if (parsed.app !== 'Biosketch.Art Studio' || parsed.version !== 1) {
    throw new Error('Unrecognized file format');
  }
  return { file: parsed as ProjectFile, path };
}
