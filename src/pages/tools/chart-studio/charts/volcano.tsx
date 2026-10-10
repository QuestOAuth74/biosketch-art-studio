import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderVolcano(props: ChartRendererProps): ReactNode {
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

    const fc = colData[0] || []; // log2 fold change
    const pvals = colData[1] || []; // p-values
    const n = Math.min(fc.length, pvals.length);
    if (n < 2) {
      return (
        <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
          {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter log2(FC) and p-values</text>
        </svg>
      );
    }

    const negLogP = pvals.slice(0, n).map((p) => p > 0 ? -Math.log10(p) : 0);
    const fcSlice = fc.slice(0, n);

    const fcThreshold = 1; // |log2FC| > 1
    const pThreshold = 1.301; // -log10(0.05) ≈ 1.301

    const fcMin = Math.min(...fcSlice), fcMax = Math.max(...fcSlice);
    const nlpMax = Math.max(...negLogP);
    const xPad2 = Math.max(Math.abs(fcMin), Math.abs(fcMax)) * 1.15 || 2;
    const xL2 = -xPad2, xH2 = xPad2;
    const yL3 = 0, yH3 = nlpMax * 1.15 || 3;

    const sxV = (v: number) => PAD.left + ((v - xL2) / (xH2 - xL2)) * pw;
    const syV = (v: number) => PAD.top + ph - ((v - yL3) / (yH3 - yL3)) * ph;

    function nTicksV(lo: number, hi: number, n3 = 6) {
      const step = parseFloat(((hi - lo) / n3).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xTV = nTicksV(xL2, xH2);
    const yTV = nTicksV(yL3, yH3, 5);
    const fmtVP = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {showGrid && <g>
          {xTV.map((v, i) => <line key={`xg${i}`} x1={sxV(v)} y1={PAD.top} x2={sxV(v)} y2={PAD.top + ph} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
          {yTV.map((v, i) => <line key={`yg${i}`} x1={PAD.left} y1={syV(v)} x2={PAD.left + pw} y2={syV(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
        </g>}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {xTV.map((v, i) => <g key={i}><line x1={sxV(v)} y1={PAD.top + ph} x2={sxV(v)} y2={PAD.top + ph + 5} stroke={theme.axisColor} /><text x={sxV(v)} y={PAD.top + ph + 20} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtVP(v)}</text></g>)}
        {yTV.map((v, i) => <g key={i}><line x1={PAD.left - 4} y1={syV(v)} x2={PAD.left} y2={syV(v)} stroke={theme.axisColor} /><text x={PAD.left - 8} y={syV(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtVP(v)}</text></g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        <g clipPath="url(#cs-clip)">
        {/* Threshold lines */}
        <line x1={sxV(-fcThreshold)} y1={PAD.top} x2={sxV(-fcThreshold)} y2={PAD.top + ph} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        <line x1={sxV(fcThreshold)} y1={PAD.top} x2={sxV(fcThreshold)} y2={PAD.top + ph} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        <line x1={PAD.left} y1={syV(pThreshold)} x2={PAD.left + pw} y2={syV(pThreshold)} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />

        {/* Data points */}
        {Array.from({ length: n }).map((_, i) => {
          const x = fcSlice[i], y = negLogP[i];
          const isUp = x > fcThreshold && y > pThreshold;
          const isDown = x < -fcThreshold && y > pThreshold;
          const color = isUp ? "#dc2626" : isDown ? "#2563eb" : "#cbd5e1";
          const opacity = (isUp || isDown) ? 0.8 : 0.4;
          const r = (isUp || isDown) ? 4.5 : 3;
          return <circle key={i} cx={sxV(x)} cy={syV(y)} r={r} fill={color} opacity={opacity} />;
        })}

        </g>
        {/* Legend */}
        <g transform={`translate(${PAD.left + 10}, ${PAD.top + 10})`}>
          <rect x={-4} y={-4} width={100} height={60} fill={theme.legendBgColor} opacity={theme.legendBgOpacity} rx={theme.legendCornerRadius} />
          <circle cx={8} cy={8} r={4} fill="#dc2626" opacity={0.8} /><text x={18} y={12} fontSize={tickLabelSize} fill={theme.axisLabelColor} fontWeight={500}>Up-regulated</text>
          <circle cx={8} cy={26} r={4} fill="#2563eb" opacity={0.8} /><text x={18} y={30} fontSize={tickLabelSize} fill={theme.axisLabelColor} fontWeight={500}>Down-regulated</text>
          <circle cx={8} cy={44} r={3} fill="#cbd5e1" opacity={0.5} /><text x={18} y={48} fontSize={10} fill="#94a3b8" fontWeight={500}>Not significant</text>
        </g>
      </svg>
    );
}
