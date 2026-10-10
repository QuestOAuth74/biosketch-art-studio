/**
 * Chart Tool - Core chart creation and management for Fabric.js canvas
 */

import { Group, Rect, Text, loadSVGFromString, util } from "fabric";
import { renderPlotlyChartToSVG } from "./chartRenderer";

export type ChartType = 'bar' | 'line' | 'scatter' | 'box' | 'dose-response';

export interface ChartTableData {
  headers: string[];
  rows: string[][];
}

export interface ChartColumnMapping {
  xAxis: number;
  yAxes: number[];
}

export interface ChartStyleConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  fontFamily: string;
  titleFontSize: number;
  xAxisLabelFontSize: number;
  yAxisLabelFontSize: number;
  legendFontSize: number;
  seriesColors: string[];
  showLegend: boolean;
  backgroundColor: string;
  transparentBackground?: boolean;
}

export interface ErrorBarConfig {
  enabled: boolean;
  mapping: { [dataColumn: number]: number }; // Maps data column index to error column index
  matchValueColor: { [dataColumn: number]: boolean }; // Whether error bars match their series color
  customColors: { [dataColumn: number]: string }; // Custom color for error bars when not matching
}

export interface DoseResponseConfig {
  dotColor: string;
  dotSize: number;
  curveColor: string;
  curveWidth: number;
  showEC50: boolean;
  logScale: boolean;
}

export interface ChartConfig {
  type: ChartType;
  data: ChartTableData;
  columnMapping: ChartColumnMapping;
  style: ChartStyleConfig;
  errorBarConfig?: ErrorBarConfig;
  doseResponseConfig?: DoseResponseConfig;
  /** Stashed config from before switching to dose-response, restored on switch back */
  _savedConfig?: {
    data: ChartTableData;
    columnMapping: ChartColumnMapping;
    style: ChartStyleConfig;
  };
}

/**
 * Default chart configuration with sample data
 */
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar',
  data: {
    headers: ['Category', 'Value 1', 'Value 2'],
    rows: [
      ['A', '10', '15'],
      ['B', '20', '25'],
      ['C', '15', '30'],
      ['D', '25', '20']
    ]
  },
  columnMapping: {
    xAxis: 0,
    yAxes: [1, 2]
  },
  style: {
    title: 'Sample Chart',
    xAxisLabel: 'Category',
    yAxisLabel: 'Value',
    fontFamily: 'Open Sans',
    titleFontSize: 16,
    xAxisLabelFontSize: 12,
    yAxisLabelFontSize: 12,
    legendFontSize: 10,
    seriesColors: ['#4C78A8', '#54A24B', '#E45756', '#F58518', '#72B7B2', '#EECA3B', '#B279A2', '#9D755D'],
    showLegend: true,
    backgroundColor: '#FFFFFF',
    transparentBackground: false
  },
  errorBarConfig: {
    enabled: false,
    mapping: {},
    matchValueColor: {},
    customColors: {}
  }
};

export const DEFAULT_DOSE_RESPONSE_CONFIG: DoseResponseConfig = {
  dotColor: '#4C78A8',
  dotSize: 8,
  curveColor: '#EF4444',
  curveWidth: 2,
  showEC50: true,
  logScale: true,
};

export const DEFAULT_DOSE_RESPONSE_DATA: ChartTableData = {
  headers: ['Concentration', 'Response (%)'],
  rows: [
    ['0.001', '98'],
    ['0.01', '95'],
    ['0.1', '82'],
    ['1', '55'],
    ['10', '22'],
    ['100', '5'],
  ],
};

/**
 * Chart Tool class for creating and managing charts
 */
export class ChartTool {
  // Track charts currently being updated to prevent concurrent updates
  private static updatingCharts = new WeakSet<Group>();

  /**
   * Create a placeholder chart at the specified position
   */
  static async createPlaceholderChart(x: number, y: number): Promise<Group> {
    const config = { ...DEFAULT_CHART_CONFIG };

    const chartGroup = await this.renderChartToFabric(config, 400, 300);

    chartGroup.set({
      left: x,
      top: y,
      originX: 'center',
      originY: 'center'
    });

    // Store chart metadata
    (chartGroup as any).customType = 'chart';
    (chartGroup as any).chartConfig = config;

    return chartGroup;
  }

  /**
   * Render a chart configuration to a Fabric.js Group
   */
  static async renderChartToFabric(
    config: ChartConfig,
    width: number,
    height: number
  ): Promise<Group> {
    try {
      const svgString = await renderPlotlyChartToSVG(config, width, height);

      // Load SVG using Fabric.js v6 async pattern
      const { objects, options } = await loadSVGFromString(svgString);

      if (!objects || objects.length === 0) {
        throw new Error('Failed to load SVG - no objects found');
      }

      // Group the SVG elements using Fabric's utility
      const group = util.groupSVGElements(objects, options);

      // Set additional properties
      group.set({
        width,
        height,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        lockScalingFlip: true
      });

      return group as Group;
    } catch (error) {
      console.error('Error rendering chart:', error);
      // Return a placeholder rectangle on error
      const errorRect = new Rect({
        width,
        height,
        fill: '#f0f0f0',
        stroke: '#999',
        strokeWidth: 2
      });

      const errorText = new Text('Error rendering chart', {
        fontSize: 16,
        fill: '#666',
        originX: 'center',
        originY: 'center',
        left: width / 2,
        top: height / 2
      });

      return new Group([errorRect, errorText], {
        width,
        height,
        selectable: true
      });
    }
  }

  /**
   * Update an existing chart with new configuration
   */
  static async updateChart(
    chartGroup: Group,
    canvas: any,
    newConfig: ChartConfig
  ): Promise<Group> {
    // Prevent concurrent updates on the same chart
    if (this.updatingCharts.has(chartGroup)) {
      console.warn('Chart update already in progress, skipping');
      return chartGroup;
    }

    // Double-check that the chart is still on the canvas and selected
    // (in case multiple rapid updates are happening)
    const allObjects = canvas.getObjects();
    if (!allObjects.includes(chartGroup)) {
      console.warn('Chart to update is no longer on canvas, aborting update');
      // Return the current active object if it's a chart, or the original chartGroup
      const activeObj = canvas.getActiveObject();
      return (activeObj && isChart(activeObj)) ? activeObj : chartGroup;
    }

    // Mark this chart as being updated
    this.updatingCharts.add(chartGroup);

    try {
      const currentWidth = chartGroup.width || 400;
      const currentHeight = chartGroup.height || 300;
      const currentLeft = chartGroup.left || 0;
      const currentTop = chartGroup.top || 0;
      const currentAngle = chartGroup.angle || 0;
      const currentScaleX = chartGroup.scaleX || 1;
      const currentScaleY = chartGroup.scaleY || 1;

      // Get the index of the old chart to maintain z-order
      const oldIndex = allObjects.indexOf(chartGroup);

      // Render new chart first
      const newGroup = await this.renderChartToFabric(
        newConfig,
        currentWidth,
        currentHeight
      );

      // Preserve position and transformation
      newGroup.set({
        left: currentLeft,
        top: currentTop,
        angle: currentAngle,
        scaleX: currentScaleX,
        scaleY: currentScaleY,
        originX: chartGroup.originX,
        originY: chartGroup.originY
      });

      // Store updated config
      (newGroup as any).customType = 'chart';
      (newGroup as any).chartConfig = newConfig;

      // Only remove the old chart if it's still on the canvas
      const objectsBeforeRemove = canvas.getObjects();
      if (objectsBeforeRemove.includes(chartGroup)) {
        canvas.remove(chartGroup);
      }

      // Add new chart
      canvas.add(newGroup);

      // Move to the same z-index if we had a valid old index
      if (oldIndex >= 0) {
        const currentObjects = canvas.getObjects();
        const currentIndex = currentObjects.indexOf(newGroup);
        if (currentIndex !== -1 && currentIndex !== oldIndex) {
          canvas.moveObjectTo(newGroup, oldIndex);
        }
      }

      canvas.setActiveObject(newGroup);
      canvas.requestRenderAll();

      return newGroup;
    } finally {
      // Always remove from updating set, even if there was an error
      this.updatingCharts.delete(chartGroup);
    }
  }
}

/**
 * Check if a Fabric object is a chart
 */
export function isChart(obj: any): boolean {
  return obj && obj.customType === 'chart';
}

/**
 * Get chart configuration from a Fabric object
 */
export function getChartConfig(obj: any): ChartConfig | null {
  if (!isChart(obj)) return null;
  return obj.chartConfig || null;
}
