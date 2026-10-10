import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderBox(props: ChartRendererProps): ReactNode {
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

    const groups = columns;
    const allVals = colData.flat();
    if (allVals.length === 0) {
      return (
        <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
          {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Add numeric data to see box plots</text>
        </svg>
      );
    }

    const globalMin = Math.min(...allVals), globalMax = Math.max(...allVals);
    const rangePad = (globalMax - globalMin) * 0.12 || 1;
    const yL = globalMin - rangePad, yH = globalMax + rangePad;
    const sy = (v: number) => PAD.top + ph - ((v - yL) / (yH - yL)) * ph;

    function nTicks(lo: number, hi: number, n = 6) {
      const step = parseFloat(((hi - lo) / n).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const yT = nTicks(yL, yH);
    const fmt = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    function quartiles(vals: number[]) {
      const s = [...vals].sort((a, b) => a - b);
      const n = s.length;
      const q = (p: number) => {
        const pos = (n - 1) * p;
        const lo = Math.floor(pos), hi = Math.ceil(pos);
        return s[lo] + (s[hi] - s[lo]) * (pos - lo);
      };
      const q1 = q(0.25), median = q(0.5), q3 = q(0.75);
      const iqr = q3 - q1;
      // Tukey whiskers: 1.5 * IQR from Q1/Q3
      const whiskerLo = Math.max(s[0], q1 - 1.5 * iqr);
      const whiskerHi = Math.min(s[n - 1], q3 + 1.5 * iqr);
      const outliers = s.filter((v) => v < whiskerLo || v > whiskerHi);
      return { q1, median, q3, whiskerLo, whiskerHi, min: s[0], max: s[n - 1], outliers };
    }

    const gap = pw / groups.length;
    const boxW = Math.min(70, gap * 0.5);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Grid */}
        {showGrid && yT.map((v, i) => <line key={i} x1={PAD.left} y1={sy(v)} x2={PAD.left + pw} y2={sy(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {/* Y ticks */}
        {yT.map((v, i) => <g key={i}>
          <line x1={PAD.left - 4} y1={sy(v)} x2={PAD.left} y2={sy(v)} stroke={theme.axisColor} />
          <text x={PAD.left - 8} y={sy(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmt(v)}</text>
        </g>)}

        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Boxes — clipped to plot area */}
        <g clipPath="url(#cs-clip)">
        {groups.map((name, gi) => {
          const vals = colData[gi];
          if (vals.length < 3) return null;
          const color = tc(gi);
          const cx = PAD.left + gap * (gi + 0.5);
          const q = quartiles(vals);

          return (
            <g key={gi}>
              {/* Whisker lines */}
              <line x1={cx} y1={sy(q.whiskerHi)} x2={cx} y2={sy(q.q3)} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
              <line x1={cx} y1={sy(q.q1)} x2={cx} y2={sy(q.whiskerLo)} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />

              {/* Whisker caps */}
              <line x1={cx - boxW * 0.3} y1={sy(q.whiskerHi)} x2={cx + boxW * 0.3} y2={sy(q.whiskerHi)} stroke={color} strokeWidth={2} strokeLinecap="round" />
              <line x1={cx - boxW * 0.3} y1={sy(q.whiskerLo)} x2={cx + boxW * 0.3} y2={sy(q.whiskerLo)} stroke={color} strokeWidth={2} strokeLinecap="round" />

              {/* Box (Q1–Q3) */}
              <rect
                x={cx - boxW / 2} y={sy(q.q3)} width={boxW} height={sy(q.q1) - sy(q.q3)}
                fill={color} opacity={0.1 * to(gi)} stroke={color} strokeWidth={2} rx={5} strokeOpacity={to(gi)}
              />

              {/* Median line */}
              <line x1={cx - boxW / 2 + 2} y1={sy(q.median)} x2={cx + boxW / 2 - 2} y2={sy(q.median)} stroke={color} strokeWidth={3} strokeLinecap="round" />

              {/* Individual data points (jittered) */}
              {showDataPoints && vals.map((v, j) => {
                const jitter = (Math.sin(j * 7.13 + gi * 3.7) * 0.5) * boxW * 0.35;
                return renderThemedPoint(cx + jitter, sy(v), settings.pointSize, color, `bp${gi}-${j}`);
              })}

              {/* Outliers */}
              {q.outliers.map((v, j) => (
                <g key={`o${j}`}>
                  <circle cx={cx} cy={sy(v)} r={4} fill="none" stroke={color} strokeWidth={1.5} />
                  <circle cx={cx} cy={sy(v)} r={1.5} fill={color} />
                </g>
              ))}

              {/* Median value label */}
              <text x={cx + boxW / 2 + 6} y={sy(q.median) + 3} fontSize={9} fill={color} fontWeight={600} opacity={0.7}>
                {q.median.toFixed(1)}
              </text>
            </g>
          );
        })}
        </g>
        {/* Group labels — outside clip */}
        {groups.map((name, gi) => {
          const cx = PAD.left + gap * (gi + 0.5);
          return renderXTickLabel(cx, PAD.top + ph + 20, name, resolveTickAngle(groups, pw), `bl${gi}`, { fontSize: tickLabelSize + 1, fontWeight: 600, fill: theme.axisLabelColor });
        })}
        {renderThemedLegend(groups.map((name, i) => ({ color: tc(i), label: name })))}
        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
      </svg>
    );
}
