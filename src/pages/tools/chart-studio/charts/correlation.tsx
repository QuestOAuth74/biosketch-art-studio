import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderCorrelation(props: ChartRendererProps): ReactNode {
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

    const xs = colData[0] || [], ys = colData[1] || [];
    const n = Math.min(xs.length, ys.length);
    if (n < 3) {
      return <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">{svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} /><text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15}>Enter at least 3 X,Y data points</text></svg>;
    }

    const xPaired = xs.slice(0, n), yPaired = ys.slice(0, n);
    const xMin0 = Math.min(...xPaired), xMax0 = Math.max(...xPaired);
    const yMin0 = Math.min(...yPaired), yMax0 = Math.max(...yPaired);
    const xPad = (xMax0 - xMin0) * 0.1 || 1, yPadV = (yMax0 - yMin0) * 0.1 || 1;
    const xL = xAutoRange ? xMin0 - xPad : (xMinManual ?? xMin0 - xPad);
    const xH = xAutoRange ? xMax0 + xPad : (xMaxManual ?? xMax0 + xPad);
    const yL = yAutoRange ? yMin0 - yPadV : (yMinManual ?? yMin0 - yPadV);
    const yH = yAutoRange ? yMax0 + yPadV : (yMaxManual ?? yMax0 + yPadV);
    const sx = (v: number) => PAD.left + ((v - xL) / (xH - xL || 1)) * pw;
    const sy = (v: number) => PAD.top + ph - ((v - yL) / (yH - yL || 1)) * ph;

    // Linear regression
    const xMean = xPaired.reduce((s, v) => s + v, 0) / n;
    const yMean = yPaired.reduce((s, v) => s + v, 0) / n;
    const ssxx = xPaired.reduce((s, v) => s + (v - xMean) ** 2, 0);
    const ssyy = yPaired.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const ssxy = xPaired.reduce((s, v, i) => s + (v - xMean) * (yPaired[i] - yMean), 0);
    const slope = ssxx > 0 ? ssxy / ssxx : 0;
    const intercept = yMean - slope * xMean;
    const rSquared = ssxx > 0 && ssyy > 0 ? (ssxy ** 2) / (ssxx * ssyy) : 0;
    const r = ssxy >= 0 ? Math.sqrt(rSquared) : -Math.sqrt(rSquared);

    // Prediction & 95% CI band
    const residuals = xPaired.map((x, i) => yPaired[i] - (slope * x + intercept));
    const sse = residuals.reduce((s, e) => s + e ** 2, 0);
    const mse = n > 2 ? sse / (n - 2) : 0;
    const tCrit = n > 30 ? 1.96 : n > 10 ? 2.1 : 2.3; // approximate t for 95% CI

    // Generate tick marks
    function nTicksC2(lo: number, hi: number, cnt = 6) {
      const step = parseFloat(((hi - lo) / cnt).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xTicks = nTicksC2(xL, xH);
    const yTicks = nTicksC2(yL, yH);
    const fmtC2 = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    // CI band points
    const bandX: number[] = [];
    for (let px = xL; px <= xH; px += (xH - xL) / 50) bandX.push(px);
    const bandUpper = bandX.map((x) => {
      const yPred = slope * x + intercept;
      const se = Math.sqrt(mse * (1 / n + (x - xMean) ** 2 / ssxx));
      return yPred + tCrit * se;
    });
    const bandLower = bandX.map((x) => {
      const yPred = slope * x + intercept;
      const se = Math.sqrt(mse * (1 / n + (x - xMean) ** 2 / ssxx));
      return yPred - tCrit * se;
    });
    const bandPath = `M ${bandX.map((x, i) => `${sx(x)},${sy(bandUpper[i])}`).join(" L ")} L ${[...bandX].reverse().map((x, i) => `${sx(x)},${sy(bandLower[bandX.length - 1 - i])}`).join(" L ")} Z`;

    // Equation string
    const eqStr = `y = ${slope >= 0 ? "" : "−"}${Math.abs(slope).toFixed(3)}x ${intercept >= 0 ? "+" : "−"} ${Math.abs(intercept).toFixed(3)}`;

    // P-value for correlation (t-test on r)
    const tStat = r * Math.sqrt((n - 2) / (1 - rSquared + 1e-10));
    const pApprox = n > 2 ? Math.exp(-0.717 * Math.abs(tStat) - 0.416 * tStat * tStat / Math.max(n - 2, 1)) : 1;
    const pStr = pApprox < 0.001 ? "p < 0.001" : `p = ${pApprox.toFixed(3)}`;

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />

        {/* Title */}
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Axes */}
        {renderAxes()}

        {/* Grid */}
        {showGrid && renderGrid(xTicks, yTicks, sx, sy)}

        {/* Tick labels */}
        {xTicks.map((v, i) => <g key={`xt${i}`}><line x1={sx(v)} y1={PAD.top + ph} x2={sx(v)} y2={PAD.top + ph + theme.tickLength} stroke={theme.axisColor} /><text x={sx(v)} y={PAD.top + ph + 18} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtC2(v)}</text></g>)}
        {yTicks.map((v, i) => <g key={`yt${i}`}><line x1={PAD.left - theme.tickLength} y1={sy(v)} x2={PAD.left} y2={sy(v)} stroke={theme.axisColor} /><text x={PAD.left - theme.tickLength - 4} y={sy(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtC2(v)}</text></g>)}

        <g clipPath="url(#cs-clip)">
          {/* 95% CI band */}
          <path d={bandPath} fill={tc(0)} opacity={0.1} />

          {/* Line of best fit */}
          <line x1={sx(xL)} y1={sy(slope * xL + intercept)} x2={sx(xH)} y2={sy(slope * xH + intercept)} stroke={tc(0)} strokeWidth={lw + 0.5} strokeLinecap="round" />

          {/* Data points */}
          {showDataPoints && xPaired.map((x, i) => renderThemedPoint(sx(x), sy(yPaired[i]), settings.pointSize, tc(0), `cp${i}`))}
        </g>

        {/* Stats box */}
        <g transform={`translate(${PAD.left + 14}, ${PAD.top + 16})`}>
          <rect x={-8} y={-12} width={180} height={68} rx={8} fill={theme.bgColor} stroke={theme.axisColor} strokeWidth={0.5} opacity={0.9} />
          <text x={0} y={2} fontSize={11} fontWeight={700} fill={theme.titleColor}>{eqStr}</text>
          <text x={0} y={18} fontSize={11} fontWeight={600} fill={tc(0)}>R² = {rSquared.toFixed(4)}</text>
          <text x={0} y={34} fontSize={11} fontWeight={600} fill={theme.tickLabelColor}>r = {r.toFixed(4)} ({r > 0 ? "positive" : "negative"})</text>
          <text x={0} y={50} fontSize={10} fontWeight={500} fill={pApprox < 0.05 ? "#16a34a" : "#94a3b8"}>{pStr} {pApprox < 0.05 ? "★" : "(ns)"} n={n}</text>
        </g>

        {/* Axis labels */}
        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={200} style={{ overflow: "visible" }}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: 180, textAlign: "center", fontSize: axisLabelSize, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transformOrigin: "0 0", transform: "rotate(-90deg) translateX(-180px)" }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {renderReferenceLines(sx, sy)}
        {renderAnnotations()}
      </svg>
    );
}
