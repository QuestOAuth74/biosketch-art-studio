/**
 * Table Tool - Creates editable data tables on the Fabric.js canvas
 */

import { Group, Rect, IText, Text, Line, FabricObject } from "fabric";

export type TableStyle = 'minimal' | 'bordered' | 'striped' | 'scientific';

export interface TableConfig {
  rows: number;
  cols: number;
  title: string;
  style: TableStyle;
  cellWidth: number;
  cellHeight: number;
  headerRow: boolean;
  headerCol: boolean;
  fontSize: number;
  fontFamily: string;
  headerFontSize: number;
  borderColor: string;
  headerBgColor: string;
  headerTextColor: string;
  cellTextColor: string;
  stripedColor: string;
  borderWidth: number;
  cellData: string[][];
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  rows: 4,
  cols: 3,
  title: '',
  style: 'scientific',
  cellWidth: 100,
  cellHeight: 32,
  headerRow: true,
  headerCol: false,
  fontSize: 12,
  fontFamily: 'Arial',
  headerFontSize: 12,
  borderColor: '#374151',
  headerBgColor: '#e5e7eb',
  headerTextColor: '#111827',
  cellTextColor: '#374151',
  stripedColor: '#f3f4f6',
  borderWidth: 1,
  cellData: [],
};

const STYLE_PRESETS: Record<TableStyle, Partial<TableConfig>> = {
  minimal: {
    borderColor: '#d1d5db',
    headerBgColor: 'transparent',
    headerTextColor: '#111827',
    cellTextColor: '#374151',
    stripedColor: 'transparent',
    borderWidth: 1,
  },
  bordered: {
    borderColor: '#374151',
    headerBgColor: '#374151',
    headerTextColor: '#ffffff',
    cellTextColor: '#374151',
    stripedColor: 'transparent',
    borderWidth: 1.5,
  },
  striped: {
    borderColor: '#d1d5db',
    headerBgColor: '#374151',
    headerTextColor: '#ffffff',
    cellTextColor: '#374151',
    stripedColor: '#f9fafb',
    borderWidth: 1,
  },
  scientific: {
    borderColor: '#111827',
    headerBgColor: 'transparent',
    headerTextColor: '#111827',
    cellTextColor: '#374151',
    stripedColor: 'transparent',
    borderWidth: 1.5,
  },
};

export class TableTool {
  /**
   * Apply a style preset to a config, preserving user-set values for rows/cols/title etc.
   */
  static applyStyle(config: TableConfig, style: TableStyle): TableConfig {
    return { ...config, ...STYLE_PRESETS[style], style };
  }

  /**
   * Build a cellData grid of the right size, preserving existing content.
   */
  static ensureCellData(config: TableConfig): string[][] {
    const { rows, cols, headerRow, headerCol, cellData } = config;
    const grid: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        // Preserve existing data if available
        if (cellData && cellData[r] && cellData[r][c] !== undefined) {
          row.push(cellData[r][c]);
        } else {
          // Default labels for new cells
          const isHR = headerRow && r === 0;
          const isHC = headerCol && c === 0;
          if (isHR && isHC) {
            row.push('');
          } else if (isHR) {
            row.push(`Col ${c}`);
          } else if (isHC) {
            row.push(`Row ${r}`);
          } else {
            row.push(' ');
          }
        }
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Create a table Group on the canvas at the given position.
   */
  static createTable(x: number, y: number, config: TableConfig): Group {
    const { rows, cols, title, style, cellWidth, cellHeight,
      headerRow, headerCol, fontSize, fontFamily, headerFontSize,
      borderColor, headerBgColor, headerTextColor, cellTextColor,
      stripedColor, borderWidth } = config;

    // Ensure cellData is populated
    const cellData = this.ensureCellData(config);
    config = { ...config, cellData };

    const objects: FabricObject[] = [];

    const tableWidth = cols * cellWidth;
    const titleHeight = title ? 28 : 0;
    const tableHeight = rows * cellHeight;

    // ── Title ──
    if (title) {
      objects.push(new Text(title, {
        left: tableWidth / 2,
        top: titleHeight / 2,
        fontSize: headerFontSize + 2,
        fontFamily,
        fontWeight: 'bold',
        fill: headerTextColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      }));
    }

    // ── Cell backgrounds (full grid for hit-testing) ──
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isHeaderRow = headerRow && r === 0;
        const isHeaderCol = headerCol && c === 0;
        const isHeader = isHeaderRow || isHeaderCol;
        const isStriped = !isHeader && stripedColor !== 'transparent' && r % 2 === 0;

        let fill = 'transparent';
        if (isHeader && headerBgColor !== 'transparent') {
          fill = headerBgColor;
        } else if (isStriped) {
          fill = stripedColor;
        }

        // Always create a rect for every cell (even transparent) so hit-testing works
        objects.push(new Rect({
          left: c * cellWidth,
          top: titleHeight + r * cellHeight,
          width: cellWidth,
          height: cellHeight,
          fill,
          stroke: '',
          strokeWidth: 0,
          selectable: false,
          evented: false,
        }));
      }
    }

    // ── Cell text (editable IText) ──
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isHeaderRow = headerRow && r === 0;
        const isHeaderCol = headerCol && c === 0;
        const isHeader = isHeaderRow || isHeaderCol;

        const cellText = cellData[r][c];

        const itext = new IText(cellText, {
          left: c * cellWidth + cellWidth / 2,
          top: titleHeight + r * cellHeight + cellHeight / 2,
          fontSize: isHeader ? headerFontSize : fontSize,
          fontFamily,
          fontWeight: isHeader ? 'bold' : 'normal',
          fill: isHeader ? headerTextColor : cellTextColor,
          originX: 'center',
          originY: 'center',
          textAlign: 'center',
          selectable: true,
          evented: true,
          hasBorders: false,
          hasControls: false,
        });

        // Store cell position for syncing edits back to cellData
        (itext as any).cellRow = r;
        (itext as any).cellCol = c;
        (itext as any).isTableCell = true;

        objects.push(itext);
      }
    }

    // ── Grid lines ──
    if (style === 'scientific') {
      objects.push(this.hLine(0, titleHeight, tableWidth, borderColor, borderWidth + 0.5));
      if (headerRow) {
        objects.push(this.hLine(0, titleHeight + cellHeight, tableWidth, borderColor, borderWidth + 0.5));
      }
      objects.push(this.hLine(0, titleHeight + tableHeight, tableWidth, borderColor, borderWidth + 0.5));
    } else {
      for (let r = 0; r <= rows; r++) {
        const y1 = titleHeight + r * cellHeight;
        const w = (r === 0 || r === rows) ? borderWidth : borderWidth * 0.7;
        objects.push(this.hLine(0, y1, tableWidth, borderColor, w));
      }
      for (let c = 0; c <= cols; c++) {
        const x1 = c * cellWidth;
        const w = (c === 0 || c === cols) ? borderWidth : borderWidth * 0.7;
        objects.push(this.vLine(x1, titleHeight, tableHeight, borderColor, w));
      }
    }

    const group = new Group(objects, {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      subTargetCheck: true,
    });

    // Store metadata
    (group as any).customType = 'table';
    (group as any).tableConfig = config;

    // Custom toObject to persist table config
    const origToObject = group.toObject.bind(group);
    (group as any).toObject = (props?: string[]) =>
      origToObject([
        ...(props || []),
        'customType',
        'tableConfig',
      ]);

    return group;
  }

  /**
   * Create a table with default config at a position.
   */
  static createDefaultTable(x: number, y: number): Group {
    return this.createTable(x, y, { ...DEFAULT_TABLE_CONFIG });
  }

  /**
   * Re-render a table group with updated config, preserving position.
   * Reads current cell text from the existing group before rebuilding.
   */
  static updateTable(existingGroup: Group, config: TableConfig): Group {
    const left = existingGroup.left || 0;
    const top = existingGroup.top || 0;
    const angle = existingGroup.angle || 0;
    const scaleX = existingGroup.scaleX || 1;
    const scaleY = existingGroup.scaleY || 1;

    // Harvest current cell text from the existing group's IText objects
    const currentData = this.harvestCellData(existingGroup);
    if (currentData.length > 0) {
      config = { ...config, cellData: currentData };
    }

    const newGroup = this.createTable(left, top, config);
    newGroup.set({ angle, scaleX, scaleY, originX: existingGroup.originX, originY: existingGroup.originY });
    newGroup.setCoords();
    return newGroup;
  }

  /**
   * Read current cell text from the IText objects in a table group.
   */
  static harvestCellData(group: Group): string[][] {
    const objects = (group as any)._objects || group.getObjects();
    const grid: string[][] = [];
    for (const obj of objects) {
      if ((obj as any).isTableCell && obj instanceof IText) {
        const r = (obj as any).cellRow as number;
        const c = (obj as any).cellCol as number;
        if (!grid[r]) grid[r] = [];
        grid[r][c] = obj.text || '';
      }
    }
    return grid;
  }

  // ── Helper: horizontal line ──
  private static hLine(x: number, y: number, width: number, color: string, strokeWidth: number): Line {
    return new Line([x, y, x + width, y], {
      stroke: color,
      strokeWidth,
      selectable: false,
      evented: false,
    });
  }

  // ── Helper: vertical line ──
  private static vLine(x: number, y: number, height: number, color: string, strokeWidth: number): Line {
    return new Line([x, y, x, y + height], {
      stroke: color,
      strokeWidth,
      selectable: false,
      evented: false,
    });
  }
}
