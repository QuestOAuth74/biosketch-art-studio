/**
 * Chart Renderer - Plotly to SVG conversion
 */

import * as Plotly from 'plotly.js-cartesian-dist-min';
import { ChartConfig, ChartStyleConfig, DEFAULT_DOSE_RESPONSE_CONFIG } from './chartTool';
import { parseNumeric } from './csvParser';
import { fit4PL, generateCurvePoints } from './doseResponseFit';

// Refined scientific color palette (Tableau/Vega-inspired, muted tones)
const SCIENTIFIC_PALETTE = [
  '#4C78A8', '#54A24B', '#E45756', '#F58518',
  '#72B7B2', '#EECA3B', '#B279A2', '#9D755D',
];

/** Map user series color to scientific palette fallback */
function seriesColor(style: ChartStyleConfig, index: number): string {
  return style.seriesColors[index] || SCIENTIFIC_PALETTE[index % SCIENTIFIC_PALETTE.length];
}

/** Shared axis styling used across all chart types */
function baseAxisStyle(style: ChartStyleConfig) {
  return {
    gridcolor: 'rgba(0,0,0,0.08)',
    gridwidth: 1,
    griddash: 'dot' as const,
    showline: true,
    linecolor: '#1A1A1A',
    linewidth: 1,
    zeroline: false,
    tickcolor: '#1A1A1A',
    ticklen: 4,
    tickfont: {
      family: style.fontFamily,
      size: style.xAxisLabelFontSize,
      color: '#1A1A1A',
    },
  };
}

/** Shared legend styling */
function baseLegendStyle(style: ChartStyleConfig) {
  return {
    font: {
      family: style.fontFamily,
      size: style.legendFontSize,
      color: '#1A1A1A',
    },
    bgcolor: 'rgba(255,255,255,0.85)',
    bordercolor: 'rgba(0,0,0,0.1)',
    borderwidth: 1,
  };
}

/** Shared background colors */
function bgColors(style: ChartStyleConfig) {
  if (style.transparentBackground) {
    return { paper: 'rgba(0,0,0,0)', plot: 'rgba(0,0,0,0)' };
  }
  return {
    paper: style.backgroundColor,
    plot: style.backgroundColor === '#FFFFFF' ? '#FAFAFA' : style.backgroundColor,
  };
}

/**
 * Render a Plotly chart to SVG string
 */
export async function renderPlotlyChartToSVG(
  config: ChartConfig,
  width: number,
  height: number
): Promise<string> {

  // Create offscreen div
  const div = document.createElement('div');
  div.style.width = `${width}px`;
  div.style.height = `${height}px`;
  div.style.position = 'absolute';
  div.style.left = '-9999px';
  document.body.appendChild(div);

  try {
    // Transform table data to Plotly format
    const { data, layout } = transformToPlotlyFormat(config, width, height);

    // Render chart
    await Plotly.newPlot(div, data, layout, {
      responsive: false,
      displayModeBar: false,
      staticPlot: false,
      editable: false
    });

    // Try using Plotly's built-in SVG export
    try {
      const svgDataUrl = await Plotly.toImage(div, {
        format: 'svg',
        width: width,
        height: height
      });

      // Extract SVG from data URL
      if (svgDataUrl.startsWith('data:image/svg+xml,')) {
        const svgString = decodeURIComponent(svgDataUrl.substring('data:image/svg+xml,'.length));
        return svgString;
      }
    } catch (toImageError) {
      console.warn('Plotly.toImage failed, falling back to manual extraction:', toImageError);
    }

    // Fallback: Manual SVG extraction
    const plotDiv = div.querySelector('.plotly');
    if (!plotDiv) {
      throw new Error('Plotly container not found');
    }

    // Get the main SVG element
    const svgElement = plotDiv.querySelector('svg.main-svg');
    if (!svgElement) {
      throw new Error('SVG element not found in Plotly chart');
    }

    // Clone and serialize the SVG
    const svgClone = svgElement.cloneNode(true) as SVGElement;

    // Preserve all SVG attributes
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      svgClone.setAttribute('viewBox', viewBox);
    }

    // Set explicit width and height on SVG
    svgClone.setAttribute('width', width.toString());
    svgClone.setAttribute('height', height.toString());
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Serialize to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    return svgString;
  } catch (error) {
    console.error('Error in renderPlotlyChartToSVG:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      Plotly.purge(div);
      document.body.removeChild(div);
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }
}

/**
 * Transform ChartConfig to Plotly data and layout format
 */
function transformToPlotlyFormat(
  config: ChartConfig,
  width: number,
  height: number
): { data: any[]; layout: any } {
  const { data: tableData, columnMapping, style, type, errorBarConfig } = config;

  // Handle dose-response curve
  if (type === 'dose-response') {
    return transformDoseResponse(config, width, height);
  }

  const bg = bgColors(style);
  const axisBase = baseAxisStyle(style);

  // Handle box plot data differently
  if (type === 'box') {
    const traces = columnMapping.yAxes.map((colIndex, seriesIndex) => {
      const yData = tableData.rows.map(row => {
        const value = row[colIndex] || '0';
        return parseNumeric(value);
      });

      const color = seriesColor(style, seriesIndex);
      return {
        y: yData,
        name: tableData.headers[colIndex],
        type: 'box',
        marker: { color, outliercolor: color },
        line: { color },
        fillcolor: color + '30', // 30 = ~19% opacity hex
        boxmean: true,
      };
    });

    const layout: any = {
      width,
      height,
      title: {
        text: style.title || '',
        font: { family: style.fontFamily, size: style.titleFontSize, color: '#1A1A1A' },
        xref: 'paper', x: 0.5, xanchor: 'center',
        pad: { t: 4, b: 8 },
      },
      yaxis: {
        ...axisBase,
        title: {
          text: style.yAxisLabel || 'Value',
          font: { family: style.fontFamily, size: style.yAxisLabelFontSize, color: '#1A1A1A' },
          standoff: 10,
        },
        tickfont: { ...axisBase.tickfont, size: style.yAxisLabelFontSize },
      },
      xaxis: {
        ...axisBase,
        showgrid: false,
      },
      showlegend: style.showLegend,
      legend: baseLegendStyle(style),
      paper_bgcolor: bg.paper,
      plot_bgcolor: bg.plot,
      margin: { l: 65, r: 30, t: style.title ? 60 : 30, b: 50 },
      boxmode: 'group',
      autosize: false,
      font: { family: style.fontFamily },
    };

    return { data: traces, layout };
  }

  // Extract X-axis data for non-box-plot charts
  const xData = tableData.rows.map(row => row[columnMapping.xAxis] || '');

  // Create traces for each Y-axis column
  const traces = columnMapping.yAxes.map((yIndex, seriesIndex) => {
    const yData = tableData.rows.map(row => {
      const value = row[yIndex] || '0';
      return parseNumeric(value);
    });

    const color = seriesColor(style, seriesIndex);

    const trace: any = {
      x: xData,
      y: yData,
      name: tableData.headers[yIndex] || `Series ${seriesIndex + 1}`,
      type: type === 'scatter' ? 'scatter' : type,
      marker: { color },
    };

    if (type === 'scatter') {
      trace.mode = 'markers';
      trace.marker = {
        color,
        size: 9,
        line: { color: '#FFFFFF', width: 1.5 },
        opacity: 0.85,
      };
    } else if (type === 'line') {
      trace.mode = 'lines+markers';
      trace.line = { width: 2.5, color };
      trace.marker = {
        color,
        size: 7,
        line: { color: '#FFFFFF', width: 1.5 },
      };
    } else if (type === 'bar') {
      trace.marker = {
        color,
        line: { color: color + 'CC', width: 0.5 },
      };
    }

    // Add error bars if configured
    if (errorBarConfig?.enabled && errorBarConfig.mapping[yIndex]) {
      const errorColIndex = errorBarConfig.mapping[yIndex];
      const errorValues = tableData.rows.map(row => {
        const value = row[errorColIndex] || '0';
        return parseNumeric(value);
      });

      const matchValueColor = errorBarConfig.matchValueColor[yIndex] ?? true;
      const errorBarColor = matchValueColor
        ? color
        : errorBarConfig.customColors[yIndex] || '#000000';

      trace.error_y = {
        type: 'data',
        array: errorValues,
        visible: true,
        color: errorBarColor,
        thickness: 1.5,
      };
    }

    return trace;
  });

  // Create layout
  const layout: any = {
    width,
    height,
    title: {
      text: style.title || '',
      font: { family: style.fontFamily, size: style.titleFontSize, color: '#1A1A1A' },
      xref: 'paper', x: 0.5, xanchor: 'center',
      pad: { t: 4, b: 8 },
    },
    xaxis: {
      ...axisBase,
      title: {
        text: style.xAxisLabel || '',
        font: { family: style.fontFamily, size: style.xAxisLabelFontSize, color: '#1A1A1A' },
        standoff: 8,
      },
      tickfont: { ...axisBase.tickfont, size: style.xAxisLabelFontSize },
      showgrid: type !== 'bar', // hide vertical grid for bar charts
    },
    yaxis: {
      ...axisBase,
      title: {
        text: style.yAxisLabel || '',
        font: { family: style.fontFamily, size: style.yAxisLabelFontSize, color: '#1A1A1A' },
        standoff: 10,
      },
      tickfont: { ...axisBase.tickfont, size: style.yAxisLabelFontSize },
    },
    showlegend: style.showLegend,
    legend: baseLegendStyle(style),
    paper_bgcolor: bg.paper,
    plot_bgcolor: bg.plot,
    margin: { l: 65, r: 30, t: style.title ? 60 : 30, b: 55 },
    autosize: false,
    font: { family: style.fontFamily },
  };

  // Bar chart spacing
  if (type === 'bar') {
    layout.bargap = 0.2;
    layout.bargroupgap = 0.1;
  }

  return { data: traces, layout };
}

/**
 * Transform dose-response config to Plotly format with 4PL curve fit.
 *
 * Avoids Plotly annotations (they extend beyond the SVG bounds and cause
 * Fabric.js group bounding-box mismatches on re-render). EC50 is shown
 * in the legend name and via dashed crosshair traces that stay within
 * the plot area.
 */
function transformDoseResponse(
  config: ChartConfig,
  width: number,
  height: number
): { data: any[]; layout: any } {
  const { data: tableData, columnMapping, style } = config;
  const dr = config.doseResponseConfig || DEFAULT_DOSE_RESPONSE_CONFIG;

  const bg = bgColors(style);
  const axisBase = baseAxisStyle(style);

  const xRaw = tableData.rows.map(row => parseNumeric(row[columnMapping.xAxis] || '0'));
  const traces: any[] = [];

  columnMapping.yAxes.forEach((yIndex, seriesIndex) => {
    const yRaw = tableData.rows.map(row => parseNumeric(row[yIndex] || '0'));
    const seriesName = tableData.headers[yIndex] || `Response ${seriesIndex + 1}`;
    const dotColor = seriesColor(style, seriesIndex);

    // Data points
    traces.push({
      x: xRaw,
      y: yRaw,
      name: seriesName,
      type: 'scatter',
      mode: 'markers',
      marker: {
        color: dotColor,
        size: dr.dotSize,
        line: { color: '#FFFFFF', width: 1.5 },
        opacity: 0.9,
      },
      showlegend: true,
    });

    // Fit 4PL curve
    const validPairs = xRaw
      .map((x, i) => ({ x, y: yRaw[i] }))
      .filter(p => p.x > 0 && isFinite(p.y));

    if (validPairs.length >= 3) {
      const xFit = validPairs.map(p => p.x);
      const yFit = validPairs.map(p => p.y);
      const { params, rSquared } = fit4PL(xFit, yFit);

      const xMin = Math.min(...xFit) * 0.3;
      const xMax = Math.max(...xFit) * 3;
      const curve = generateCurvePoints(params, xMin, xMax);

      const ec50Display = params.ec50 >= 0.01 && params.ec50 < 10000
        ? params.ec50.toFixed(2)
        : params.ec50.toExponential(2);

      const curveName = dr.showEC50
        ? `Fit R\u00B2=${rSquared.toFixed(3)}, EC50=${ec50Display}`
        : `Fit R\u00B2=${rSquared.toFixed(3)}`;

      traces.push({
        x: curve.x,
        y: curve.y,
        name: curveName,
        type: 'scatter',
        mode: 'lines',
        line: { color: dr.curveColor, width: dr.curveWidth },
        showlegend: true,
      });

      // EC50 dashed crosshair lines
      if (dr.showEC50 && params.ec50 > 0) {
        const ec50Y = (params.top + params.bottom) / 2;
        const yBottom = Math.min(...yRaw, params.bottom);

        traces.push({
          x: [params.ec50, params.ec50],
          y: [yBottom, ec50Y],
          type: 'scatter', mode: 'lines',
          line: { color: 'rgba(0,0,0,0.25)', width: 1, dash: 'dash' },
          showlegend: false, hoverinfo: 'skip',
        });
        traces.push({
          x: [xMin, params.ec50],
          y: [ec50Y, ec50Y],
          type: 'scatter', mode: 'lines',
          line: { color: 'rgba(0,0,0,0.25)', width: 1, dash: 'dash' },
          showlegend: false, hoverinfo: 'skip',
        });
      }
    }
  });

  const layout: any = {
    width,
    height,
    title: {
      text: style.title || '',
      font: { family: style.fontFamily, size: style.titleFontSize, color: '#1A1A1A' },
      xref: 'paper', x: 0.5, xanchor: 'center',
      pad: { t: 4, b: 8 },
    },
    xaxis: {
      ...axisBase,
      title: {
        text: style.xAxisLabel || 'Concentration',
        font: { family: style.fontFamily, size: style.xAxisLabelFontSize, color: '#1A1A1A' },
        standoff: 8,
      },
      tickfont: { ...axisBase.tickfont, size: style.xAxisLabelFontSize },
      type: dr.logScale ? 'log' : 'linear',
    },
    yaxis: {
      ...axisBase,
      title: {
        text: style.yAxisLabel || 'Response (%)',
        font: { family: style.fontFamily, size: style.yAxisLabelFontSize, color: '#1A1A1A' },
        standoff: 10,
      },
      tickfont: { ...axisBase.tickfont, size: style.yAxisLabelFontSize },
    },
    showlegend: style.showLegend,
    legend: baseLegendStyle(style),
    paper_bgcolor: bg.paper,
    plot_bgcolor: bg.plot,
    margin: { l: 65, r: 30, t: style.title ? 60 : 30, b: 55 },
    autosize: false,
    font: { family: style.fontFamily },
  };

  return { data: traces, layout };
}
