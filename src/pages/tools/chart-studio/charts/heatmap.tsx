import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderHeatmap(props: ChartRendererProps): ReactNode {
  const {
    columns, rows, settings, theme,
    colData, colStats,
    isXY, xVals, yTraces, allY,
    W, H, PAD, pw, ph,
    chartType,
    title, xLabel, yLabel,
    showGrid, showErrorBars, errorBarType,
    showDataPoints, showRegression,
    xAutoRange, xMinManual, xMaxManual,
    yAutoRange, yMinManual, yMaxManual,
    xLogScale, yLogScale,
    pBrackets,
    titleSize, axisLabelSize, tickLabelSize,
    titleBold, axisLabelBold,
    legendPosition, legendBorder,
    pointShape,
    lw, dashArray, axisLineWeight, errorBarWeight, ff,
    tc, to,
    svgDefs, svgStyle,
    resolveTickAngle, renderXTickLabel, renderThemedPoint, renderPoint, barFill,
    renderAxes, renderGrid, renderThemedLegend, renderTooltip, renderAnnotations,
    seriesOpacity, plotClipDef,
    hoveredSeries, setHoveredSeries, tooltip, setTooltip,
    editingTitle, setEditingTitle, editingXLabel, setEditingXLabel, editingYLabel, setEditingYLabel,
    onSettingChange, onColumnRename, onPrompt, activeTextInputRef,
  } = props;
  // Unused destructured vars (kept for verbatim body compatibility)
  void columns; void rows; void settings; void theme; void colData; void colStats;
  void isXY; void xVals; void yTraces; void allY;
  void W; void H; void PAD; void pw; void ph; void chartType;
  void title; void xLabel; void yLabel;
  void showGrid; void showErrorBars; void errorBarType;
  void showDataPoints; void showRegression;
  void xAutoRange; void xMinManual; void xMaxManual;
  void yAutoRange; void yMinManual; void yMaxManual;
  void xLogScale; void yLogScale; void pBrackets;
  void titleSize; void axisLabelSize; void tickLabelSize;
  void titleBold; void axisLabelBold;
  void legendPosition; void legendBorder; void pointShape;
  void lw; void dashArray; void axisLineWeight; void errorBarWeight; void ff;
  void tc; void to; void svgDefs; void svgStyle;
  void resolveTickAngle; void renderXTickLabel; void renderThemedPoint; void renderPoint; void barFill;
  void renderAxes; void renderGrid; void renderThemedLegend; void renderTooltip; void renderAnnotations;
  void seriesOpacity; void plotClipDef;
  void hoveredSeries; void setHoveredSeries; void tooltip; void setTooltip;
  void editingTitle; void setEditingTitle; void editingXLabel; void setEditingXLabel; void editingYLabel; void setEditingYLabel;
  void onSettingChange; void onColumnRename; void onPrompt; void activeTextInputRef;

  // ── Editor per-element overrides (Phase E1 offsets + E2 font/color/rotation) ──
  const _es = props.elementStyles;
  const _titleOv = _es?.["title"];
  const _xLabelOv = _es?.["xlabel"];
  const _yLabelOv = _es?.["ylabel"];
  const _titleDx = _titleOv?.offsetX ?? 0;
  const _titleDy = _titleOv?.offsetY ?? 0;
  const _xLabelDx = _xLabelOv?.offsetX ?? 0;
  const _xLabelDy = _xLabelOv?.offsetY ?? 0;
  const _yLabelDx = _yLabelOv?.offsetX ?? 0;
  const _yLabelDy = _yLabelOv?.offsetY ?? 0;
  const _titleFamily = ff;
  const _titleSize = titleSize;
  const _titleWeight = titleBold ? 700 : 400;
  const _titleStyle = "normal";
  const _titleColor = theme.titleColor;
  const _titleRot = _titleOv?.rotation ?? 0;
  const _xLabelFamily = ff;
  const _xLabelSize = axisLabelSize;
  const _xLabelWeight = axisLabelBold ? 600 : 400;
  const _xLabelStyle = "normal";
  const _xLabelColor = theme.axisLabelColor;
  const _xLabelRot = _xLabelOv?.rotation ?? 0;
  const _yLabelFamily = ff;
  const _yLabelSize = axisLabelSize;
  const _yLabelWeight = axisLabelBold ? 600 : 400;
  const _yLabelStyle = "normal";
  const _yLabelColor = theme.axisLabelColor;
  const _yLabelRot = _yLabelOv?.rotation ?? 0;

    const nRows = rows.length;
    const nCols = columns.length;
    const numericRows = rows.filter((r) => r.some((c) => typeof c === "number"));
    if (numericRows.length === 0) {
      return <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">{svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} /><text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter numeric values to see heatmap</text></svg>;
    }

    const allNums = rows.flat().filter((v): v is number => typeof v === "number");
    const vMin = Math.min(...allNums), vMax = Math.max(...allNums);
    const vRange = vMax - vMin || 1;

    // Heatmap colormap — uses trace colors for low/mid/high
    const lowColor = tc(0);  // first trace color = low
    const highColor = tc(1); // second trace color = high
    // Parse hex to RGB
    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return { r: parseInt(h.substring(0, 2), 16) || 0, g: parseInt(h.substring(2, 4), 16) || 0, b: parseInt(h.substring(4, 6), 16) || 0 };
    };
    const cLow = hexToRgb(lowColor);
    const cHigh = hexToRgb(highColor);
    function heatColor(v: number | null): string {
      if (v === null || typeof v !== "number") return "#f1f5f9";
      const t = (v - vMin) / vRange; // 0–1
      if (t < 0.5) {
        const s = t * 2;
        return `rgb(${Math.round(cLow.r + s * (255 - cLow.r))},${Math.round(cLow.g + s * (255 - cLow.g))},${Math.round(cLow.b + s * (255 - cLow.b))})`;
      } else {
        const s = (t - 0.5) * 2;
        return `rgb(${Math.round(255 - s * (255 - cHigh.r))},${Math.round(255 - s * (255 - cHigh.g))},${Math.round(255 - s * (255 - cHigh.b))})`;
      }
    }

    // Compute header rotation & extra top space needed
    const hmAngle = resolveTickAngle(columns, (pw - 40));
    const hmLongest = Math.max(...columns.map((c) => c.length), 1);
    const hmCharW = tickLabelSize * 0.55;
    const hmHeaderExtra = hmAngle === 90 ? Math.min(hmLongest * hmCharW * 0.9, 100)
                        : hmAngle === 45 ? Math.min(hmLongest * hmCharW * 0.6, 70)
                        : 0;

    const cellW = Math.min(80, (pw - 40) / nCols);
    const cellH = Math.min(40, (ph - hmHeaderExtra - 20) / numericRows.length);
    const gridW = cellW * nCols;
    const gridH = cellH * numericRows.length;
    const offsetX = PAD.left + (pw - gridW) / 2;
    const hmTopBase = PAD.top + hmHeaderExtra + 10;
    const offsetY = hmTopBase + ((ph - hmHeaderExtra - 20) - gridH) / 2;

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Column headers — rotated labels extend upward, so anchor at offsetY - 6 */}
        {columns.map((col, ci) => {
          const cx = offsetX + ci * cellW + cellW / 2;
          const labelY = offsetY - 6;
          if (hmAngle === 0) {
            return <text key={`hm-c${ci}`} x={cx} y={labelY} textAnchor="middle" fontSize={tickLabelSize} fontWeight={600} fill={theme.axisLabelColor}>{col}</text>;
          }
          if (hmAngle === 45) {
            return <text key={`hm-c${ci}`} x={cx} y={labelY} textAnchor="start" fontSize={tickLabelSize} fontWeight={600} fill={theme.axisLabelColor} transform={`rotate(-45,${cx},${labelY})`}>{col}</text>;
          }
          // 90°
          return <text key={`hm-c${ci}`} x={cx} y={labelY} textAnchor="start" fontSize={tickLabelSize} fontWeight={600} fill={theme.axisLabelColor} transform={`rotate(-90,${cx},${labelY})`} dominantBaseline="central">{col}</text>;
        })}

        {/* Row headers */}
        {numericRows.map((_, ri) => (
          <text key={ri} x={offsetX - 6} y={offsetY + ri * cellH + cellH / 2 + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.axisLabelColor} fontWeight={500}>R{ri + 1}</text>
        ))}

        {/* Cells */}
        {numericRows.map((row, ri) => row.map((cell, ci) => (
          <g key={`${ri}-${ci}`}>
            <rect x={offsetX + ci * cellW} y={offsetY + ri * cellH} width={cellW} height={cellH} fill={heatColor(typeof cell === "number" ? cell : null)} stroke="white" strokeWidth={1.5} rx={2} />
            {settings.heatmapShowValues !== false && typeof cell === "number" && (
              <text x={offsetX + ci * cellW + cellW / 2} y={offsetY + ri * cellH + cellH / 2 + 4} textAnchor="middle" fontSize={9} fill={((cell - vMin) / vRange > 0.3 && (cell - vMin) / vRange < 0.7) ? "#1a1a1a" : "white"} fontWeight={600}>
                {cell % 1 === 0 ? cell : cell.toFixed(1)}
              </text>
            )}
          </g>
        )))}

        {/* Color scale legend */}
        <defs>
          <linearGradient id="hm-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={highColor} />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={lowColor} />
          </linearGradient>
        </defs>
        <rect x={offsetX + gridW + 16} y={offsetY} width={12} height={gridH} fill="url(#hm-grad)" rx={3} />
        <text x={offsetX + gridW + 34} y={offsetY + 6} fontSize={9} fill={theme.tickLabelColor}>{vMax.toFixed(1)}</text>
        <text x={offsetX + gridW + 34} y={offsetY + gridH} fontSize={9} fill={theme.tickLabelColor}>{vMin.toFixed(1)}</text>
      </svg>
    );
}
