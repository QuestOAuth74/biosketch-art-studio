import { Path, Circle, Line as FabricLine } from "fabric";

/**
 * Point type for bezier curve manipulation
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Anchor point type - smooth or corner
 * - smooth: control handles are aligned (mirror angle)
 * - corner: control handles are independent
 */
export type AnchorPointType = 'smooth' | 'corner';

/**
 * Bezier anchor point with control points
 * Each anchor has two control points (incoming and outgoing handles)
 */
export interface BezierPoint {
  x: number;
  y: number;
  controlPoint1?: Point;  // Incoming control point (from previous segment)
  controlPoint2?: Point;  // Outgoing control point (to next segment)
  type: AnchorPointType;  // Smooth or corner
  id: string;             // Unique identifier for this point
}

/**
 * Configuration for bezier edit mode
 */
export interface BezierEditConfig {
  anchorRadius: number;          // Radius of anchor point markers
  controlHandleRadius: number;   // Radius of control handle markers
  smoothColor: string;           // Color for smooth anchor points
  cornerColor: string;           // Color for corner anchor points
  selectedColor: string;         // Color for selected anchor point
  guideLineColor: string;        // Color for guide lines
  guideLineDash: number[];       // Dash array for guide lines
}

/**
 * Custom properties added to Fabric.js Path objects for bezier editing
 */
export interface BezierPathData {
  isBezierPath: boolean;         // Flag to identify bezier paths
  bezierPoints: BezierPoint[];   // Array of anchor points with control points
  isEditMode: boolean;           // Whether path is currently in edit mode
  selectedAnchorId: string | null; // ID of currently selected anchor point
  anchorHandles: Map<string, Circle>; // Visual markers for anchor points
  controlHandles: Map<string, Circle>; // Visual markers for control points
  guideLines: Map<string, FabricLine>; // Guide lines connecting anchors to controls
  localBezierPoints: BezierPoint[];    // Local coordinate space (for transforms)
}

/**
 * Extended Path type with bezier editing properties
 */
export type BezierPath = Path & Partial<BezierPathData>;
