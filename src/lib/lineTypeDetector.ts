import { FabricObject } from "fabric";

/**
 * Detect the type of a line object
 */
export function detectLineType(lineObj: any): 'straight' | 'curved' | 'orthogonal' | 'bezier' | null {
  if (!lineObj) return null;

  // Check custom properties first
  if ((lineObj as any).isStraightLine) {
    return 'straight';
  }

  if ((lineObj as any).isCurvedLine) {
    return 'curved';
  }

  if ((lineObj as any).isOrthogonalLine) {
    return 'orthogonal';
  }

  if ((lineObj as any).isBezierPath) {
    return 'bezier';
  }

  // Fallback: check object type
  if (lineObj.type === 'line') {
    return 'straight';
  }

  if (lineObj.type === 'path') {
    // Try to detect based on path structure
    const pathData = lineObj.path;
    if (!pathData || pathData.length === 0) return null;

    // Check if path has quadratic or cubic bezier commands
    const hasBezierCommands = pathData.some((cmd: any) =>
      cmd[0] === 'Q' || cmd[0] === 'C'
    );

    if (hasBezierCommands) {
      // Could be bezier or curved
      // If it has control points visible, it's bezier
      if ((lineObj as any).bezierPoints) {
        return 'bezier';
      }
      return 'curved';
    }

    // Check if path has only L (line) commands in orthogonal pattern
    const hasOnlyLines = pathData.every((cmd: any) =>
      cmd[0] === 'M' || cmd[0] === 'L'
    );

    if (hasOnlyLines) {
      // Check if lines are orthogonal (horizontal or vertical)
      let isOrthogonal = true;
      for (let i = 1; i < pathData.length; i++) {
        const prev = pathData[i - 1];
        const curr = pathData[i];

        if (prev[0] === 'M' || prev[0] === 'L') {
          if (curr[0] === 'L') {
            const dx = Math.abs(curr[1] - prev[1]);
            const dy = Math.abs(curr[2] - prev[2]);

            // Not purely horizontal or vertical
            if (dx > 1 && dy > 1) {
              isOrthogonal = false;
              break;
            }
          }
        }
      }

      if (isOrthogonal && pathData.length > 2) {
        return 'orthogonal';
      }
    }
  }

  return null;
}

/**
 * Check if an object is a line
 */
export function isLine(obj: any): boolean {
  if (!obj) return false;

  return (
    obj.type === 'line' ||
    obj.type === 'path' ||
    (obj as any).isFreeformLine ||
    (obj as any).isConnector ||
    (obj as any).isCurvedLine ||
    (obj as any).isOrthogonalLine ||
    (obj as any).isStraightLine ||
    (obj as any).isBezierPath
  );
}
