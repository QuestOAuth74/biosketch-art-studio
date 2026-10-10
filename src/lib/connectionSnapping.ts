import { Canvas } from "fabric";
import { ConnectionPoint } from "@/types/effects";
import { findNearestConnectionPoint } from "./connectionPoints";

/**
 * Snap result containing the final position and optional connection point
 */
export interface SnapResult {
  x: number;
  y: number;
  connectionPoint?: ConnectionPoint;
}

/**
 * Snap a point to the nearest connection point if within threshold
 *
 * @param canvas - The Fabric canvas
 * @param x - X coordinate to snap
 * @param y - Y coordinate to snap
 * @param threshold - Maximum distance in pixels to trigger snap (default: 15)
 * @param enabled - Whether snapping is enabled (default: true)
 * @returns SnapResult with final position and optional connection point
 */
export function snapToConnection(
  canvas: Canvas,
  x: number,
  y: number,
  threshold: number = 15,
  enabled: boolean = true
): SnapResult {
  // If snapping is disabled, return original position
  if (!enabled) {
    return { x, y };
  }

  // Find nearest connection point
  const nearest = findNearestConnectionPoint(canvas, x, y, threshold);

  // If found, snap to it
  if (nearest && nearest.point) {
    return {
      x: nearest.point.x,
      y: nearest.point.y,
      connectionPoint: nearest.point,
    };
  }

  // No connection point found, return original position
  return { x, y };
}

/**
 * Check if a point is close to a connection point
 * Useful for highlighting during preview
 */
export function isNearConnectionPoint(
  canvas: Canvas,
  x: number,
  y: number,
  threshold: number = 15
): boolean {
  const nearest = findNearestConnectionPoint(canvas, x, y, threshold);
  return nearest !== null;
}

/**
 * Get the connection point at a specific position (if any)
 */
export function getConnectionPointAt(
  canvas: Canvas,
  x: number,
  y: number,
  threshold: number = 2
): ConnectionPoint | null {
  const nearest = findNearestConnectionPoint(canvas, x, y, threshold);
  return nearest ? nearest.point : null;
}
