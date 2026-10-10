import { supabase } from "@/integrations/supabase/client";

export interface VersionSnapshot {
  id: string;
  projectId: string;
  versionNumber: number;
  createdAt: string;
  isAutoSave: boolean;
  versionName?: string;
  thumbnailUrl?: string;
  canvasWidth: number;
  canvasHeight: number;
  paperSize?: string;
  restoreCount: number;
}

export interface CreateVersionParams {
  projectId: string;
  userId: string;
  canvasData: any;
  canvasWidth: number;
  canvasHeight: number;
  paperSize?: string;
  isAutoSave?: boolean;
  versionName?: string;
  thumbnailUrl?: string;
}

/**
 * Creates a new version snapshot for a project
 */
export async function createVersion(params: CreateVersionParams): Promise<void> {
  const {
    projectId,
    userId,
    canvasData,
    canvasWidth,
    canvasHeight,
    paperSize,
    isAutoSave = true,
    versionName,
    thumbnailUrl,
  } = params;

  // Retry loop to handle concurrent inserts that race on version_number
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Get the next version number
    const { data: latestVersion } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

    // Create the version
    const { error } = await supabase
      .from('project_versions')
      .insert({
        project_id: projectId,
        user_id: userId,
        version_number: nextVersionNumber,
        version_name: versionName,
        canvas_data: canvasData,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        paper_size: paperSize,
        thumbnail_url: thumbnailUrl,
        is_auto_save: isAutoSave,
      });

    if (!error) return;

    // Retry on duplicate key (concurrent version number race)
    if (error.code === '23505' && attempt < MAX_RETRIES - 1) {
      continue;
    }

    console.error('Failed to create version:', error);
    throw error;
  }
}

/**
 * Gets version metadata for a project (excludes canvas_data for performance)
 * Use getVersionData() to fetch canvas_data when restoring
 */
export async function getVersions(
  projectId: string,
  limit = 50
): Promise<VersionSnapshot[]> {
  const { data, error } = await supabase
    .from('project_versions')
    .select(`
      id,
      project_id,
      version_number,
      created_at,
      is_auto_save,
      version_name,
      thumbnail_url,
      canvas_width,
      canvas_height,
      paper_size,
      restore_count
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch versions:', error);
    throw error;
  }

  return (data || []).map((v) => ({
    id: v.id,
    projectId: v.project_id,
    versionNumber: v.version_number,
    createdAt: v.created_at,
    isAutoSave: v.is_auto_save,
    versionName: v.version_name || undefined,
    thumbnailUrl: v.thumbnail_url || undefined,
    canvasWidth: v.canvas_width,
    canvasHeight: v.canvas_height,
    paperSize: v.paper_size || undefined,
    restoreCount: v.restore_count,
  }));
}

/**
 * Gets full version data including canvas_data (for restore operations)
 */
export async function getVersionData(versionId: string): Promise<{
  canvas_data: any;
  canvas_width: number;
  canvas_height: number;
  paper_size: string | null;
  restore_count: number;
} | null> {
  const { data, error } = await supabase
    .from('project_versions')
    .select('canvas_data, canvas_width, canvas_height, paper_size, restore_count')
    .eq('id', versionId)
    .single();

  if (error) {
    console.error('Failed to fetch version data:', error);
    throw error;
  }

  return data;
}

/**
 * Restores a specific version by updating the main project
 */
export async function restoreVersion(
  projectId: string,
  versionId: string
): Promise<any> {
  // Get the version data (only fields needed for restore)
  const version = await getVersionData(versionId);

  if (!version) {
    throw new Error('Version not found');
  }

  // Update the main project with the version data
  const { error: updateError } = await supabase
    .from('canvas_projects')
    .update({
      canvas_data: version.canvas_data,
      canvas_width: version.canvas_width,
      canvas_height: version.canvas_height,
      paper_size: version.paper_size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  if (updateError) {
    console.error('Failed to restore version:', updateError);
    throw updateError;
  }

  // Increment restore count
  await supabase
    .from('project_versions')
    .update({ restore_count: version.restore_count + 1 })
    .eq('id', versionId);

  return version.canvas_data;
}

/**
 * Deletes a specific version
 */
export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase
    .from('project_versions')
    .delete()
    .eq('id', versionId);

  if (error) {
    console.error('Failed to delete version:', error);
    throw error;
  }
}

/**
 * Names or renames a version
 */
export async function nameVersion(versionId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('project_versions')
    .update({ version_name: name })
    .eq('id', versionId);

  if (error) {
    console.error('Failed to name version:', error);
    throw error;
  }
}

/**
 * Cleans up old versions based on retention policy
 * - Keep all versions from last 7 days
 * - Keep 1 version per day for days 8-30
 * - Keep 1 version per week for 30+ days
 * - Always keep named versions
 * - Keep maximum 50 versions per project
 */
export async function cleanupVersions(projectId: string): Promise<void> {
  const { data: versions, error } = await supabase
    .from('project_versions')
    .select('id, created_at, version_name, is_auto_save')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !versions) {
    console.error('Failed to fetch versions for cleanup:', error);
    return;
  }

  // If we have 50 or fewer versions, no cleanup needed
  if (versions.length <= 50) {
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const versionsToKeep = new Set<string>();
  const versionsByDay = new Map<string, any[]>();
  const versionsByWeek = new Map<string, any[]>();

  for (const version of versions) {
    const createdAt = new Date(version.created_at);
    const dayKey = createdAt.toISOString().split('T')[0];
    const weekKey = `${createdAt.getFullYear()}-W${Math.ceil((createdAt.getDate()) / 7)}`;

    // Always keep named versions
    if (version.version_name) {
      versionsToKeep.add(version.id);
      continue;
    }

    // Keep all versions from last 7 days
    if (createdAt >= sevenDaysAgo) {
      versionsToKeep.add(version.id);
      continue;
    }

    // For days 8-30: group by day
    if (createdAt >= thirtyDaysAgo) {
      if (!versionsByDay.has(dayKey)) {
        versionsByDay.set(dayKey, []);
      }
      versionsByDay.get(dayKey)!.push(version);
      continue;
    }

    // For 30+ days: group by week
    if (!versionsByWeek.has(weekKey)) {
      versionsByWeek.set(weekKey, []);
    }
    versionsByWeek.get(weekKey)!.push(version);
  }

  // Keep one version per day for days 8-30
  for (const dayVersions of versionsByDay.values()) {
    if (dayVersions.length > 0) {
      versionsToKeep.add(dayVersions[0].id);
    }
  }

  // Keep one version per week for 30+ days
  for (const weekVersions of versionsByWeek.values()) {
    if (weekVersions.length > 0) {
      versionsToKeep.add(weekVersions[0].id);
    }
  }

  // Delete versions not in the keep set
  const versionsToDelete = versions
    .filter((v) => !versionsToKeep.has(v.id))
    .map((v) => v.id);

  if (versionsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('project_versions')
      .delete()
      .in('id', versionsToDelete);

    if (deleteError) {
      console.error('Failed to cleanup versions:', deleteError);
    } else {
    }
  }
}

/**
 * Checks if changes are significant enough to warrant creating a new version
 */
export function isSignificantChange(prevData: any, currentData: any): boolean {
  if (!prevData || !currentData) {
    return true;
  }

  const prevObjects = prevData.objects || [];
  const currentObjects = currentData.objects || [];

  // Object count changed by more than 5% or by at least 1 object
  const objectCountDiff = Math.abs(currentObjects.length - prevObjects.length);
  const percentChange = (objectCountDiff / Math.max(prevObjects.length, 1)) * 100;
  
  if (objectCountDiff > 0 || percentChange > 5) {
    return true;
  }

  // Background color changed
  if (prevData.background !== currentData.background) {
    return true;
  }

  // Canvas dimensions changed
  if (prevData.width !== currentData.width || prevData.height !== currentData.height) {
    return true;
  }

  // For existing objects, check for major position/size changes
  const significantMoves = currentObjects.some((obj: any, idx: number) => {
    if (!prevObjects[idx]) return false;
    
    const prevObj = prevObjects[idx];
    const positionChange = Math.abs((obj.left || 0) - (prevObj.left || 0)) +
                          Math.abs((obj.top || 0) - (prevObj.top || 0));
    
    // Position change > 10% of canvas width/height
    const canvasSize = Math.max(currentData.width || 800, currentData.height || 600);
    return positionChange > (canvasSize * 0.1);
  });

  return significantMoves;
}

/**
 * Gets the count of versions for a project
 */
export async function getVersionCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('project_versions')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    console.error('Failed to get version count:', error);
    return 0;
  }

  return count || 0;
}
