// ─── Animation Persistence (Supabase) ─────────────────────────────────────────
// Handles saving/loading animation projects to/from the Supabase database.
// Falls back to localStorage when Supabase operations fail.

import { supabase } from "@/integrations/supabase/client";
import type { AnimationProject } from "./animationEngine";
import {
  saveAnimationToLocal,
  loadAnimationBySourceId as loadFromLocal,
} from "./animationEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnimationRow {
  id: string;
  user_id: string;
  source_project_id: string | null;
  name: string;
  animation_data: any;
  fps: number;
  duration_seconds: number;
  total_frames: number;
  canvas_width: number | null;
  canvas_height: number | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

function rowToProject(row: AnimationRow): AnimationProject {
  const data = row.animation_data as { tracks?: any[] };
  return {
    id: row.id,
    sourceProjectId: row.source_project_id || "",
    name: row.name,
    fps: row.fps,
    duration: Number(row.duration_seconds),
    totalFrames: row.total_frames,
    tracks: data.tracks || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectToRow(
  project: AnimationProject,
  userId: string,
  canvasWidth?: number,
  canvasHeight?: number
): Partial<AnimationRow> {
  return {
    user_id: userId,
    source_project_id: project.sourceProjectId || null,
    name: project.name,
    animation_data: { tracks: project.tracks },
    fps: project.fps,
    duration_seconds: project.duration,
    total_frames: project.totalFrames,
    canvas_width: canvasWidth ?? null,
    canvas_height: canvasHeight ?? null,
  };
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/** Save animation to Supabase. Returns the saved project ID. */
export async function saveAnimationToSupabase(
  project: AnimationProject,
  userId: string,
  canvasWidth?: number,
  canvasHeight?: number
): Promise<string> {
  const rowData = projectToRow(project, userId, canvasWidth, canvasHeight);

  // If project already has a UUID id (not a local id), try update
  const isExistingDbRecord =
    project.id &&
    !project.id.startsWith("anim_") &&
    project.id.includes("-");

  if (isExistingDbRecord) {
    const { error } = await (supabase as any)
      .from("animation_projects")
      .update(rowData)
      .eq("id", project.id);

    if (!error) return project.id!;
    // If update fails (e.g. record doesn't exist), fall through to insert
    console.warn("Animation update failed, attempting insert:", error.message);
  }

  // Insert new record
  const { data, error } = await (supabase as any)
    .from("animation_projects")
    .insert(rowData)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/** Load the most recent animation for a source project from Supabase. */
export async function loadAnimationFromSupabase(
  sourceProjectId: string
): Promise<AnimationProject | null> {
  const { data, error } = await (supabase as any)
    .from("animation_projects")
    .select("*")
    .eq("source_project_id", sourceProjectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToProject(data as AnimationRow);
}

/** Load a specific animation by its ID from Supabase. */
export async function loadAnimationById(
  animationId: string
): Promise<AnimationProject | null> {
  const { data, error } = await (supabase as any)
    .from("animation_projects")
    .select("*")
    .eq("id", animationId)
    .single();

  if (error || !data) return null;
  return rowToProject(data as AnimationRow);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Delete an animation project from Supabase. */
export async function deleteAnimationFromSupabase(
  animationId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("animation_projects")
    .delete()
    .eq("id", animationId);

  if (error) throw error;
}

// ─── List ─────────────────────────────────────────────────────────────────────

interface AnimationListEntry {
  id: string;
  name: string;
  sourceProjectId: string | null;
  fps: number;
  duration: number;
  updatedAt: string;
}

/** List all animation projects for the current user. */
export async function listUserAnimations(): Promise<AnimationListEntry[]> {
  const { data, error } = await (supabase as any)
    .from("animation_projects")
    .select("id, name, source_project_id, fps, duration_seconds, updated_at")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    sourceProjectId: row.source_project_id,
    fps: row.fps,
    duration: Number(row.duration_seconds),
    updatedAt: row.updated_at,
  }));
}

// ─── Combined Save (Supabase + localStorage fallback) ─────────────────────────

/** Save to Supabase with localStorage as fallback. Returns the project ID. */
export async function saveAnimation(
  project: AnimationProject,
  userId: string,
  canvasWidth?: number,
  canvasHeight?: number
): Promise<string> {
  try {
    const id = await saveAnimationToSupabase(project, userId, canvasWidth, canvasHeight);
    // Also save to localStorage as a backup
    try {
      saveAnimationToLocal({ ...project, id });
    } catch {
      // localStorage failure is non-critical
    }
    return id;
  } catch (err) {
    console.warn("Supabase save failed, falling back to localStorage:", err);
    return saveAnimationToLocal(project);
  }
}

/** Load from Supabase, falling back to localStorage. */
export async function loadAnimation(
  sourceProjectId: string
): Promise<AnimationProject | null> {
  try {
    const fromDb = await loadAnimationFromSupabase(sourceProjectId);
    if (fromDb) return fromDb;
  } catch (err) {
    console.warn("Supabase load failed, trying localStorage:", err);
  }

  // Fallback to localStorage
  return loadFromLocal(sourceProjectId);
}
