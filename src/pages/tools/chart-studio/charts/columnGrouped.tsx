import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderColumnGrouped(props: ChartRendererProps): ReactNode {
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
    renderAxes, renderGrid, renderThemedLegend, renderTooltip, renderAnnotations, renderReferenceLines,
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
    const means = colStats.map((s) => s.mean);
    const autoMax = Math.max(...means.map((m, i) => m + (showErrorBars ? colStats[i][errorBarType === "sd" ? "sd" : "sem"] : 0)), ...pBrackets.map((b) => b.y)) * 1.2 || 1;
    const yLo = yAutoRange ? 0 : (yMinManual ?? 0);
    const yHi = yAutoRange ? autoMax : (yMaxManual ?? autoMax);
    const yRange = yHi - yLo || 1;

    const syC = yLogScale
      ? (v: number) => { const logV = Math.log10(Math.max(v, 1e-10)); const logLo = Math.log10(Math.max(yLo, 1e-10)); const logHi = Math.log10(yHi); return PAD.top + ph - ((logV - logLo) / (logHi - logLo || 1)) * ph; }
      : (v: number) => PAD.top + ph - ((v - yLo) / yRange) * ph;

    const barWidth = Math.min(80, (pw / groups.length) * 0.55);
    const gap = pw / groups.length;

    function yTicksC() {
      if (yLogScale) {
        const logLo = Math.floor(Math.log10(Math.max(yLo, 1e-10)));
        const logHi = Math.ceil(Math.log10(yHi));
        const t: number[] = [];
        for (let e = logLo; e <= logHi; e++) t.push(Math.pow(10, e));
        return t;
      }
      const step = parseFloat((yRange / 5).toPrecision(1));
      const start = Math.ceil(yLo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= yHi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const yT = yTicksC();
    const fmtC = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + "k" : v % 1 === 0 ? String(v) : v.toFixed(1);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {renderGrid([], yT, (v) => v, syC)}
        {renderAxes()}

        {/* Y ticks */}
        {yT.map((v, i) => <g key={i}>
          <line x1={PAD.left - theme.tickLength} y1={syC(v)} x2={PAD.left} y2={syC(v)} stroke={theme.axisColor} strokeLinecap={theme.axisLinecap as any} />
          <text x={PAD.left - theme.tickLength - 4} y={syC(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtC(v)}</text>
        </g>)}

        {/* Right Y-axis ticks (dual axis) */}
        {settings.showDualYAxis && yT.map((v, i) => <g key={`rt${i}`}>
          <line x1={PAD.left + pw} y1={syC(v)} x2={PAD.left + pw + theme.tickLength} y2={syC(v)} stroke={theme.axisColor} strokeLinecap={theme.axisLinecap as any} />
          <text x={PAD.left + pw + theme.tickLength + 4} y={syC(v) + 4} textAnchor="start" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtC(v)}</text>
        </g>)}

        {/* Bars — clipped to plot area */}
        <g clipPath="url(#cs-clip)">
        {groups.map((name, gi) => {
          const cx = PAD.left + gap * (gi + 0.5);
          const mean = means[gi];
          const barY = syC(Math.max(mean, yLo));
          const baseY = syC(Math.max(yLo, 0));
          const color = tc(gi);
          const errVal = showErrorBars ? colStats[gi][errorBarType === "sd" ? "sd" : "sem"] : 0;
          const vals = colData[gi];

          return (
            <g key={gi}>
              {/* Bar */}
              <rect x={cx - barWidth / 2} y={Math.min(barY, baseY)} width={barWidth} height={Math.abs(baseY - barY)} fill={barFill(color, gi)} opacity={theme.barOpacity * to(gi)} rx={theme.barCornerRadius} />

              {/* Data points (below error bars) */}
              {showDataPoints && vals.map((v, j) => {
                const jitter = (Math.sin(j * 7.13 + gi * 3.7) * 0.5) * barWidth * 0.4;
                return renderThemedPoint(cx + jitter, syC(v), settings.pointSize, color, `dp${gi}-${j}`);
              })}

              {/* Error bars (on top of everything) */}
              {showErrorBars && errVal > 0 && colStats[gi].n >= 2 && (
                <g stroke={theme.errorBarColor} strokeWidth={errorBarWeight || theme.errorBarWidth} strokeLinecap="round">
                  <line x1={cx} y1={syC(mean + errVal)} x2={cx} y2={syC(mean - errVal)} />
                  <line x1={cx - theme.errorBarCapWidth} y1={syC(mean + errVal)} x2={cx + theme.errorBarCapWidth} y2={syC(mean + errVal)} />
                  <line x1={cx - theme.errorBarCapWidth} y1={syC(mean - errVal)} x2={cx + theme.errorBarCapWidth} y2={syC(mean - errVal)} />
                </g>
              )}

              {/* Mean value label */}
              {settings.showMeanValues && colStats[gi].n >= 1 && (
                <text x={cx} y={barY - 4} textAnchor="middle" fontSize={tickLabelSize - 1} fontWeight={600} fill={theme.titleColor} opacity={0.7}>
                  {mean.toFixed(mean >= 100 ? 0 : 1)}
                </text>
              )}

              {/* Error value label */}
              {settings.showErrorValues && showErrorBars && errVal > 0 && colStats[gi].n >= 2 && (
                <text x={cx} y={syC(mean + errVal) - 4} textAnchor="middle" fontSize={tickLabelSize - 2} fill={theme.errorBarColor} opacity={0.6}>
                  ±{errVal.toFixed(errVal >= 10 ? 1 : 2)}
                </text>
              )}

              {renderXTickLabel(cx, PAD.top + ph + 18, name, resolveTickAngle(groups, pw), `cl${gi}`, { fontSize: tickLabelSize, fontWeight: 500, fill: theme.axisLabelColor })}
            </g>
          );
        })}

        </g>
        {/* Legend */}
        {renderThemedLegend(groups.map((name, i) => ({ color: tc(i), label: name })))}
        {/* P-value brackets */}
        {pBrackets.map((b, bi) => {
          const cxA = PAD.left + gap * (b.colA + 0.5);
          const cxB = PAD.left + gap * (b.colB + 0.5);
          const bracketY = syC(b.y);
          const tipLen = 6;
          return (
            <g key={`pb${bi}`}>
              <line x1={cxA} y1={bracketY + tipLen} x2={cxA} y2={bracketY} stroke={theme.titleColor} strokeWidth={1} />
              <line x1={cxA} y1={bracketY} x2={cxB} y2={bracketY} stroke={theme.titleColor} strokeWidth={1} />
              <line x1={cxB} y1={bracketY} x2={cxB} y2={bracketY + tipLen} stroke={theme.titleColor} strokeWidth={1} />
              <text x={(cxA + cxB) / 2} y={bracketY - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={theme.titleColor}>{b.pValue}</text>
            </g>
          );
        })}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {renderReferenceLines(() => NaN, syC)}
        {renderAnnotations()}
        {renderTooltip()}
      </svg>
    );
}
