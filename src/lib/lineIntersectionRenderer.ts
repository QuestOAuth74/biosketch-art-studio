import { Path } from 'fabric';
import {
  findSelfIntersections,
  pathToSegments,
  LineSegment,
  IntersectionResult,
  Point
} from './lineIntersection';
import { insertJumpArcs } from './jumpArcPath';
import { LineIntersectionConfig } from '@/types/effects';

export class LineIntersectionRenderer {
  private originalPathData: any;
  private intersections: IntersectionResult[] = [];
  private segments: LineSegment[] = [];
  private cache: {
    segments?: LineSegment[];
    intersections?: IntersectionResult[];
    pathDataHash?: string;
  } = {};

  constructor(
    private path: Path,
    private config: LineIntersectionConfig
  ) {
    // Store original path data on first use, then always reuse it
    if (!(path as any)._originalPathData) {
      (path as any)._originalPathData = JSON.parse(JSON.stringify(path.path));
    }
    this.originalPathData = (path as any)._originalPathData;
    // Check cache - use ORIGINAL path hash, not current modified path
    const originalHash = this.hashPathData(this.originalPathData);

    if ((path as any)._intersectionCache?.pathDataHash === originalHash) {
      // Use cached data
      this.cache = (path as any)._intersectionCache;
      this.segments = this.cache.segments!;
      this.intersections = this.cache.intersections!;
    } else {
      // Recalculate based on ORIGINAL path data, not current modified version
      // Create temporary path with original data for intersection detection
      const tempPath = new Path(this.originalPathData, {
        strokeWidth: path.strokeWidth || 2
      });

      this.segments = pathToSegments(tempPath);
      this.intersections = findSelfIntersections(this.segments);

      // Cache results
      this.cache = {
        segments: this.segments,
        intersections: this.intersections,
        pathDataHash: originalHash
      };
      (path as any)._intersectionCache = this.cache;
    }
  }

  /**
   * Hash path data for caching
   */
  private hashPathData(pathData: any): string {
    return JSON.stringify(pathData);
  }

  /**
   * Apply the configured intersection behavior to the path
   */
  public render(): void {
    // Edge case: no segments
    if (this.segments.length === 0) {
      console.warn('[LineIntersectionRenderer] Cannot render: path has no segments');
      return;
    }

    // Edge case: no intersections
    if (this.intersections.length === 0) {
      this.renderCross();
      return;
    }

    // Edge case: too many intersections (performance limit)
    if (this.intersections.length > 100) {
      console.warn('[LineIntersectionRenderer] Too many intersections. Using default rendering.');
      this.renderCross();
      return;
    }

    switch (this.config.behavior) {
      case 'cross':
        this.renderCross();
        break;
      case 'arc':
        this.renderArc();
        break;
      case 'gap':
        this.renderGap();
        break;
      case 'bridge':
        this.renderBridge();
        break;
    }
  }

  /**
   * Cross mode: No special rendering (default behavior)
   */
  private renderCross(): void {
    // Keep original path, no modifications needed
    this.path.set({ path: this.originalPathData });

    // Clear bridge data if it exists
    delete (this.path as any).bridgeIntersections;
    delete (this.path as any).bridgeConfig;
  }

  /**
   * Arc mode: Draw small arcs that "jump over" intersections
   */
  private renderArc(): void {
    const arcRadius = this.config.arcRadius || 8;
    const newPathData = insertJumpArcs(
      this.segments,
      this.intersections,
      arcRadius
    );
    // Parse the path string back to Fabric path format
    const parsedPath = this.parsePathString(newPathData);
    this.path.set({ path: parsedPath });

    // Clear bridge data if it exists
    delete (this.path as any).bridgeIntersections;
    delete (this.path as any).bridgeConfig;
  }

  /**
   * Gap mode: Break the line at intersections
   */
  private renderGap(): void {
    const gapSize = this.config.gapSize || 10;
    const pathParts: string[] = [];

    let lastEndPoint: Point | null = null;

    this.segments.forEach((segment, index) => {
      // Check if this segment has intersections
      const segmentInters = this.intersections.filter(
        inter => inter.segment1Index === index || inter.segment2Index === index
      );

      if (segmentInters.length === 0) {
        // No gaps, draw full segment
        if (
          !lastEndPoint ||
          lastEndPoint.x !== segment.x1 ||
          lastEndPoint.y !== segment.y1
        ) {
          pathParts.push(`M ${segment.x1} ${segment.y1}`);
        }
        pathParts.push(`L ${segment.x2} ${segment.y2}`);
        lastEndPoint = { x: segment.x2, y: segment.y2 };
      } else {
        // Split segment with gaps at intersections
        let currentStart = { x: segment.x1, y: segment.y1 };

        // Only process intersections where this is segment1
        const relevantInters = segmentInters.filter(
          inter => inter.segment1Index === index
        );

        relevantInters
          .sort((a, b) => {
            const t1 = a.segment1Index === index ? a.t1 : a.t2;
            const t2 = b.segment1Index === index ? b.t1 : b.t2;
            return t1 - t2;
          })
          .forEach(inter => {
            const t = inter.segment1Index === index ? inter.t1 : inter.t2;
            const distance = Math.sqrt(
              Math.pow(segment.x2 - segment.x1, 2) +
                Math.pow(segment.y2 - segment.y1, 2)
            );

            // Point before gap
            const gapStart = {
              x: segment.x1 + (t - gapSize / (2 * distance)) * (segment.x2 - segment.x1),
              y: segment.y1 + (t - gapSize / (2 * distance)) * (segment.y2 - segment.y1)
            };

            // Point after gap
            const gapEnd = {
              x: segment.x1 + (t + gapSize / (2 * distance)) * (segment.x2 - segment.x1),
              y: segment.y1 + (t + gapSize / (2 * distance)) * (segment.y2 - segment.y1)
            };

            // Draw line to gap start
            if (
              !lastEndPoint ||
              lastEndPoint.x !== currentStart.x ||
              lastEndPoint.y !== currentStart.y
            ) {
              pathParts.push(`M ${currentStart.x} ${currentStart.y}`);
            }
            pathParts.push(`L ${gapStart.x} ${gapStart.y}`);

            // Move to gap end (creates the gap)
            pathParts.push(`M ${gapEnd.x} ${gapEnd.y}`);
            currentStart = gapEnd;
            lastEndPoint = gapEnd;
          });

        // Draw remaining segment after last gap or full segment if no relevant inters
        if (relevantInters.length > 0) {
          pathParts.push(`L ${segment.x2} ${segment.y2}`);
          lastEndPoint = { x: segment.x2, y: segment.y2 };
        } else {
          // No gaps on this segment, draw it fully
          if (
            !lastEndPoint ||
            lastEndPoint.x !== currentStart.x ||
            lastEndPoint.y !== currentStart.y
          ) {
            pathParts.push(`M ${currentStart.x} ${currentStart.y}`);
          }
          pathParts.push(`L ${segment.x2} ${segment.y2}`);
          lastEndPoint = { x: segment.x2, y: segment.y2 };
        }
      }
    });

    const newPathData = pathParts.join(' ');
    const parsedPath = this.parsePathString(newPathData);
    this.path.set({ path: parsedPath });

    // Clear bridge data if it exists
    delete (this.path as any).bridgeIntersections;
    delete (this.path as any).bridgeConfig;
  }

  /**
   * Bridge mode: Create gaps in the path at intersections to simulate over/under effect
   * Similar to gap mode but creates the illusion of depth
   */
  private renderBridge(): void {
    const gapSize = this.config.bridgeWidth || 8; // Slightly larger than gap mode
    const pathParts: string[] = [];

    let lastEndPoint: Point | null = null;

    this.segments.forEach((segment, index) => {
      // Check if this segment has intersections
      const segmentInters = this.intersections.filter(
        inter => inter.segment1Index === index || inter.segment2Index === index
      );

      if (segmentInters.length === 0) {
        // No gaps, draw full segment
        if (
          !lastEndPoint ||
          lastEndPoint.x !== segment.x1 ||
          lastEndPoint.y !== segment.y1
        ) {
          pathParts.push(`M ${segment.x1} ${segment.y1}`);
        }
        pathParts.push(`L ${segment.x2} ${segment.y2}`);
        lastEndPoint = { x: segment.x2, y: segment.y2 };
      } else {
        // Create bridge effect by adding small gaps at intersections
        let currentStart = { x: segment.x1, y: segment.y1 };

        // Only process intersections where this is segment2 (goes "under")
        const relevantInters = segmentInters.filter(
          inter => inter.segment2Index === index
        );

        relevantInters
          .sort((a, b) => a.t2 - b.t2)
          .forEach(inter => {
            const t = inter.t2;
            const distance = Math.sqrt(
              Math.pow(segment.x2 - segment.x1, 2) +
                Math.pow(segment.y2 - segment.y1, 2)
            );

            // Point before gap
            const gapStart = {
              x: segment.x1 + (t - gapSize / (2 * distance)) * (segment.x2 - segment.x1),
              y: segment.y1 + (t - gapSize / (2 * distance)) * (segment.y2 - segment.y1)
            };

            // Point after gap
            const gapEnd = {
              x: segment.x1 + (t + gapSize / (2 * distance)) * (segment.x2 - segment.x1),
              y: segment.y1 + (t + gapSize / (2 * distance)) * (segment.y2 - segment.y1)
            };

            // Draw line to gap start
            if (
              !lastEndPoint ||
              lastEndPoint.x !== currentStart.x ||
              lastEndPoint.y !== currentStart.y
            ) {
              pathParts.push(`M ${currentStart.x} ${currentStart.y}`);
            }
            pathParts.push(`L ${gapStart.x} ${gapStart.y}`);

            // Move to gap end (creates the gap)
            pathParts.push(`M ${gapEnd.x} ${gapEnd.y}`);
            currentStart = gapEnd;
            lastEndPoint = gapEnd;
          });

        // Draw remaining segment after last gap or full segment if no relevant inters
        if (relevantInters.length > 0) {
          pathParts.push(`L ${segment.x2} ${segment.y2}`);
          lastEndPoint = { x: segment.x2, y: segment.y2 };
        } else {
          // No gaps on this segment, draw it fully
          if (
            !lastEndPoint ||
            lastEndPoint.x !== currentStart.x ||
            lastEndPoint.y !== currentStart.y
          ) {
            pathParts.push(`M ${currentStart.x} ${currentStart.y}`);
          }
          pathParts.push(`L ${segment.x2} ${segment.y2}`);
          lastEndPoint = { x: segment.x2, y: segment.y2 };
        }
      }
    });

    const newPathData = pathParts.join(' ');
    const parsedPath = this.parsePathString(newPathData);
    this.path.set({ path: parsedPath });
  }

  /**
   * Parse SVG path string to Fabric path command array
   */
  private parsePathString(pathString: string): any[] {
    const commands: any[] = [];
    const matches = pathString.match(/[MLQCZmlqcz][^MLQCZmlqcz]*/g);

    if (!matches) return this.originalPathData;

    matches.forEach(cmd => {
      const type = cmd[0];
      const coords = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      switch (type) {
        case 'M':
          commands.push(['M', coords[0], coords[1]]);
          break;
        case 'L':
          commands.push(['L', coords[0], coords[1]]);
          break;
        case 'Q':
          commands.push(['Q', coords[0], coords[1], coords[2], coords[3]]);
          break;
        case 'C':
          commands.push(['C', coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]]);
          break;
        case 'Z':
        case 'z':
          commands.push(['Z']);
          break;
      }
    });

    return commands.length > 0 ? commands : this.originalPathData;
  }

  /**
   * Get intersection count (for UI feedback)
   */
  public getIntersectionCount(): number {
    return this.intersections.length;
  }

  /**
   * Clear intersection rendering and restore original path
   */
  public clear(): void {
    this.path.set({ path: this.originalPathData });
    delete (this.path as any).bridgeIntersections;
    delete (this.path as any).bridgeConfig;
    delete (this.path as any)._intersectionCache;
    delete (this.path as any)._originalPathData;
  }
}
