import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { COLORS } from "../constants";
import { renderRichText } from "../editor/richText";

export function renderDoseResponse(props: ChartRendererProps): ReactNode {
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

    const xRaw = colData[0] || [];
    const yRaw = colData[1] || [];
    const n = Math.min(xRaw.length, yRaw.length);
    if (n < 3) {
      return (
        <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
          {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter concentration and response data (min 3 points)</text>
        </svg>
      );
    }

    const pts = Array.from({ length: n }, (_, i) => ({ x: xRaw[i], y: yRaw[i] })).sort((a, b) => a.x - b.x);

    // 4-parameter logistic (Hill equation) fit: y = Bottom + (Top - Bottom) / (1 + (IC50/x)^Hill)
    // Simple iterative estimation
    const yVals = pts.map((p) => p.y);
    const bottom = Math.min(...yVals);
    const top = Math.max(...yVals);
    const midY = (top + bottom) / 2;
    // Estimate IC50 as x where y is closest to midpoint
    let ic50Est = pts[0].x;
    let minDist = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.y - midY);
      if (d < minDist) { minDist = d; ic50Est = p.x; }
    }
    const hillSlope = 1; // default

    const fourPL = (x: number) => {
      if (x <= 0) return bottom;
      return bottom + (top - bottom) / (1 + Math.pow(ic50Est / x, hillSlope));
    };

    // Generate smooth curve
    const xMin = Math.min(...pts.map((p) => p.x));
    const xMax = Math.max(...pts.map((p) => p.x));
    const useLog = xMin > 0;
    const curvePoints: { x: number; y: number }[] = [];
    const nCurve = 80;
    for (let i = 0; i < nCurve; i++) {
      const t = i / (nCurve - 1);
      const x = useLog
        ? Math.pow(10, Math.log10(xMin) + t * (Math.log10(xMax) - Math.log10(xMin)))
        : xMin + t * (xMax - xMin);
      curvePoints.push({ x, y: fourPL(x) });
    }

    const allXForAxis = [...pts.map((p) => p.x), ...curvePoints.map((p) => p.x)];
    const allYForAxis = [...pts.map((p) => p.y), ...curvePoints.map((p) => p.y)];
    const axXMin = Math.min(...allXForAxis), axXMax = Math.max(...allXForAxis);
    const axYMin = Math.min(...allYForAxis), axYMax = Math.max(...allYForAxis);
    const xPd = (axXMax - axXMin) * 0.1 || 1, yPd = (axYMax - axYMin) * 0.1 || 1;
    const xL = axXMin - xPd, xH = axXMax + xPd, yL2 = axYMin - yPd, yH2 = axYMax + yPd;

    const sxDR = useLog
      ? (v: number) => PAD.left + ((Math.log10(Math.max(v, xL)) - Math.log10(Math.max(xL, 1e-10))) / (Math.log10(xH) - Math.log10(Math.max(xL, 1e-10)))) * pw
      : (v: number) => PAD.left + ((v - xL) / (xH - xL)) * pw;
    const syDR = (v: number) => PAD.top + ph - ((v - yL2) / (yH2 - yL2)) * ph;

    function nTicksDR(lo: number, hi: number, n2 = 6) {
      const step = parseFloat(((hi - lo) / n2).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const yTicksDR = nTicksDR(yL2, yH2);
    const fmtDR = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {showGrid && yTicksDR.map((v, i) => <line key={i} x1={PAD.left} y1={syDR(v)} x2={PAD.left + pw} y2={syDR(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {yTicksDR.map((v, i) => <g key={i}><line x1={PAD.left - 4} y1={syDR(v)} x2={PAD.left} y2={syDR(v)} stroke={theme.axisColor} /><text x={PAD.left - 8} y={syDR(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtDR(v)}</text></g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        <g clipPath="url(#cs-clip)">
        {/* Fitted curve */}
        <polyline points={curvePoints.map((p) => `${sxDR(p.x)},${syDR(p.y)}`).join(" ")} fill="none" stroke={tc(0)} strokeWidth={lw} strokeLinejoin="round" />

        {/* Data points */}
        {pts.map((p, i) => <circle key={i} cx={sxDR(p.x)} cy={syDR(p.y)} r={5} fill={COLORS[0]} stroke="white" strokeWidth={2} />)}

        </g>
        {/* IC50 annotation */}
        <line x1={sxDR(ic50Est)} y1={syDR(midY)} x2={sxDR(ic50Est)} y2={PAD.top + ph} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        <text x={sxDR(ic50Est) + 4} y={PAD.top + ph - 8} fontSize={10} fill="#dc2626" fontWeight={600}>IC₅₀ ≈ {ic50Est.toPrecision(3)}</text>
      </svg>
    );
}
