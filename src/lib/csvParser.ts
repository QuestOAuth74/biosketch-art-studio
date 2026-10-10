/**
 * CSV Parser and Statistical Utilities for Chart Tool
 */

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse CSV text into headers and rows
 * Supports quoted fields and escaped quotes
 */
export function parseCSV(csvText: string): ParsedCSV {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate standard error of the mean
 */
function calculateSEM(values: number[]): number {
  if (values.length === 0) return 0;

  const sd = calculateStandardDeviation(values);
  return sd / Math.sqrt(values.length);
}

/**
 * Calculate error bars for a dataset
 * @param values Array of numeric values
 * @param type Type of error bar calculation ('sd' | 'sem')
 */
export function calculateErrorBars(values: number[], type: 'sd' | 'sem'): number[] {
  if (type === 'sd') {
    const sd = calculateStandardDeviation(values);
    return values.map(() => sd);
  } else {
    const sem = calculateSEM(values);
    return values.map(() => sem);
  }
}

/**
 * Calculate quartiles for box plot
 */
export function calculateQuartiles(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const getQuartile = (position: number): number => {
    const index = position * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    min: sorted[0],
    q1: getQuartile(0.25),
    median: getQuartile(0.5),
    q3: getQuartile(0.75),
    max: sorted[n - 1]
  };
}

/**
 * Parse numeric value from string, handling various formats
 */
export function parseNumeric(value: string): number {
  const cleaned = value.replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Validate that a column contains numeric data
 */
export function isNumericColumn(rows: string[][], columnIndex: number): boolean {
  if (rows.length === 0) return false;

  return rows.every(row => {
    if (!row[columnIndex]) return true; // Empty values are ok
    const num = parseNumeric(row[columnIndex]);
    return !isNaN(num);
  });
}
