import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { COLORS } from "../constants";
import { renderRichText } from "../editor/richText";

export function renderBlandAltman(props: ChartRendererProps): ReactNode {
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

    const methodA = colData[0] || [];
    const methodB = colData[1] || [];
    const n = Math.min(methodA.length, methodB.length);
    if (n < 3) {
      return <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">{svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} /><text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter paired measurements for both methods</text></svg>;
    }

    const means: number[] = [], diffs: number[] = [];
    for (let i = 0; i < n; i++) {
      means.push((methodA[i] + methodB[i]) / 2);
      diffs.push(methodA[i] - methodB[i]);
    }
    const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
    const sdDiff = Math.sqrt(diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / (n - 1));
    const upperLoA = meanDiff + 1.96 * sdDiff;
    const lowerLoA = meanDiff - 1.96 * sdDiff;

    const xMin = Math.min(...means), xMax = Math.max(...means);
    const yMin = Math.min(...diffs, lowerLoA), yMax = Math.max(...diffs, upperLoA);
    const xPdBA = (xMax - xMin) * 0.1 || 1, yPdBA = (yMax - yMin) * 0.15 || 1;
    const xLBA = xMin - xPdBA, xHBA = xMax + xPdBA, yLBA = yMin - yPdBA, yHBA = yMax + yPdBA;
    const sxBA = (v: number) => PAD.left + ((v - xLBA) / (xHBA - xLBA)) * pw;
    const syBA = (v: number) => PAD.top + ph - ((v - yLBA) / (yHBA - yLBA)) * ph;

    function nTicksBA(lo2: number, hi2: number, n2 = 6) {
      const step = parseFloat(((hi2 - lo2) / n2).toPrecision(1));
      const start = Math.ceil(lo2 / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi2 + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xTBA = nTicksBA(xLBA, xHBA), yTBA = nTicksBA(yLBA, yHBA);
    const fmtBA = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {showGrid && <g>
          {xTBA.map((v, i) => <line key={`xg${i}`} x1={sxBA(v)} y1={PAD.top} x2={sxBA(v)} y2={PAD.top + ph} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
          {yTBA.map((v, i) => <line key={`yg${i}`} x1={PAD.left} y1={syBA(v)} x2={PAD.left + pw} y2={syBA(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
        </g>}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {xTBA.map((v, i) => <g key={i}><line x1={sxBA(v)} y1={PAD.top + ph} x2={sxBA(v)} y2={PAD.top + ph + 5} stroke={theme.axisColor} /><text x={sxBA(v)} y={PAD.top + ph + 20} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtBA(v)}</text></g>)}
        {yTBA.map((v, i) => <g key={i}><line x1={PAD.left - 4} y1={syBA(v)} x2={PAD.left} y2={syBA(v)} stroke={theme.axisColor} /><text x={PAD.left - 8} y={syBA(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtBA(v)}</text></g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        <g clipPath="url(#cs-clip)">
        {/* Mean difference line */}
        <line x1={PAD.left} y1={syBA(meanDiff)} x2={PAD.left + pw} y2={syBA(meanDiff)} stroke="#2563eb" strokeWidth={1.5} />
        <text x={PAD.left + pw + 4} y={syBA(meanDiff) + 4} fontSize={9} fill="#2563eb" fontWeight={600}>Mean: {meanDiff.toFixed(2)}</text>

        {/* Limits of agreement */}
        <line x1={PAD.left} y1={syBA(upperLoA)} x2={PAD.left + pw} y2={syBA(upperLoA)} stroke="#dc2626" strokeWidth={1} strokeDasharray="6 3" />
        <text x={PAD.left + pw + 4} y={syBA(upperLoA) + 4} fontSize={9} fill="#dc2626" fontWeight={500}>+1.96 SD</text>
        <line x1={PAD.left} y1={syBA(lowerLoA)} x2={PAD.left + pw} y2={syBA(lowerLoA)} stroke="#dc2626" strokeWidth={1} strokeDasharray="6 3" />
        <text x={PAD.left + pw + 4} y={syBA(lowerLoA) + 4} fontSize={9} fill="#dc2626" fontWeight={500}>-1.96 SD</text>

        {/* Zero line */}
        <line x1={PAD.left} y1={syBA(0)} x2={PAD.left + pw} y2={syBA(0)} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />

        {/* Data points */}
        {means.map((m, i) => <circle key={i} cx={sxBA(m)} cy={syBA(diffs[i])} r={5} fill={COLORS[0]} stroke="white" strokeWidth={2} opacity={0.8} />)}
        </g>
      </svg>
    );
}
