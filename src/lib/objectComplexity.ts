import { FabricObject, Group, Path } from 'fabric';

export interface ComplexityMetrics {
  totalPoints: number;
  totalObjects: number;
  pathComplexity: number;
  groupDepth: number;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  score: number;
}

/**
 * Calculate object complexity for performance optimization
 */
export function calculateObjectComplexity(obj: FabricObject): ComplexityMetrics {
  let totalPoints = 0;
  let totalObjects = 0;
  let pathComplexity = 0;
  let groupDepth = 0;

  const analyze = (object: FabricObject, depth: number = 0) => {
    totalObjects++;
    groupDepth = Math.max(groupDepth, depth);

    if (object.type === 'path') {
      const path = object as Path;
      if (path.path) {
        // Count path commands
        pathComplexity += path.path.length;
        // Estimate points (each command can have 2-6 coordinates)
        totalPoints += path.path.length * 3;
      }
    } else if (object.type === 'group') {
      const group = object as Group;
      const objects = group.getObjects();
      objects.forEach(child => analyze(child, depth + 1));
    } else {
      // Simple shapes count as a few points
      totalPoints += 4;
    }
  };

  analyze(obj);

  // Calculate complexity score (0-1000+)
  const score = 
    totalPoints * 0.1 +          // Path points weight
    totalObjects * 5 +             // Object count weight
    pathComplexity * 0.5 +         // Path complexity weight
    groupDepth * 10;               // Nesting depth weight

  // Categorize complexity
  let complexity: 'low' | 'medium' | 'high' | 'extreme';
  if (score < 50) complexity = 'low';
  else if (score < 200) complexity = 'medium';
  else if (score < 500) complexity = 'high';
  else complexity = 'extreme';

  return {
    totalPoints,
    totalObjects,
    pathComplexity,
    groupDepth,
    complexity,
    score
  };
}

/**
 * Determine if object should have simplified controls
 */
export function shouldSimplifyControls(metrics: ComplexityMetrics): boolean {
  return metrics.complexity === 'high' || metrics.complexity === 'extreme';
}

/**
 * Get recommended simplification strategies
 */
export function getSimplificationStrategies(metrics: ComplexityMetrics): string[] {
  const strategies: string[] = [];

  if (metrics.complexity === 'extreme') {
    strategies.push('Use simplified controls during transformation');
    strategies.push('Consider rasterizing for better performance');
  } else if (metrics.complexity === 'high') {
    strategies.push('Limit control points visibility');
    strategies.push('Reduce path detail if possible');
  }

  if (metrics.groupDepth > 3) {
    strategies.push('Consider flattening nested groups');
  }

  if (metrics.totalObjects > 50) {
    strategies.push('Group similar objects for better performance');
  }

  return strategies;
}

/**
 * Apply performance optimizations to complex objects
 */
export function applyComplexityOptimizations(obj: FabricObject, metrics: ComplexityMetrics): void {
  // Disable some features for very complex objects
  if (metrics.complexity === 'extreme') {
    obj.set({
      hasRotatingPoint: true,
      hasBorders: true,
      transparentCorners: false,
      // Reduce control visibility during drag
      padding: 2,
    });
  } else if (metrics.complexity === 'high') {
    obj.set({
      padding: 3,
    });
  }

  // Cache the object for better rendering performance
  if (metrics.score > 100) {
    obj.set({
      objectCaching: true,
    });
  }
}
