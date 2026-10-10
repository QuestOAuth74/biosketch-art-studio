import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderForest(props: ChartRendererProps): ReactNode {
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

    // Cols: Study (string), Effect, CI Lower, CI Upper
    const studies: { name: string; effect: number; lo: number; hi: number }[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      const name = typeof r[0] === "string" ? r[0] : (typeof r[0] === "number" ? `Study ${ri + 1}` : null);
      const effect = typeof r[1] === "number" ? r[1] : null;
      const lo = typeof r[2] === "number" ? r[2] : null;
      const hi = typeof r[3] === "number" ? r[3] : null;
      if (name && effect !== null && lo !== null && hi !== null) {
        studies.push({ name, effect, lo, hi });
      }
    }

    if (studies.length === 0) {
      return <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">{svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} /><text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter Study, Effect, CI Lower, CI Upper</text></svg>;
    }

    const allVals = studies.flatMap((s) => [s.lo, s.hi, s.effect]);
    const xMin = Math.min(...allVals), xMax = Math.max(...allVals);
    const xPadF = (xMax - xMin) * 0.15 || 1;
    const xLF = xMin - xPadF, xHF = xMax + xPadF;
    const sxF = (v: number) => PAD.left + 120 + ((v - xLF) / (xHF - xLF)) * (pw - 120);
    const rowH = Math.min(36, (ph - 20) / studies.length);

    function nTicksF(lo2: number, hi2: number, n2 = 6) {
      const step = parseFloat(((hi2 - lo2) / n2).toPrecision(1));
      const start = Math.ceil(lo2 / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi2 + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xTF = nTicksF(xLF, xHF, 5);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Null line (effect = 0 or 1 depending on measure) */}
        <line x1={sxF(0)} y1={PAD.top} x2={sxF(0)} y2={PAD.top + studies.length * rowH} stroke={theme.axisColor} strokeWidth={1.5} strokeDasharray="6 4" />

        {/* X axis ticks */}
        {xTF.map((v, i) => <g key={i}>
          <line x1={sxF(v)} y1={PAD.top + studies.length * rowH} x2={sxF(v)} y2={PAD.top + studies.length * rowH + 5} stroke={theme.axisColor} />
          <text x={sxF(v)} y={PAD.top + studies.length * rowH + 18} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{v % 1 === 0 ? v : v.toFixed(2)}</text>
        </g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + 120 + (pw - 120) / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + 120 + (pw - 120) / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}

        {/* Studies */}
        {studies.map((s, i) => {
          const y = PAD.top + i * rowH + rowH / 2;
          const color = tc(0);
          const weight = 1 / Math.max(0.01, s.hi - s.lo); // inverse of CI width
          const dotR = Math.min(8, Math.max(3, weight * 2));

          return (
            <g key={i}>
              {/* Alternating row bg */}
              {i % 2 === 0 && <rect x={PAD.left} y={y - rowH / 2} width={pw + 120} height={rowH} fill="#f8fafc" />}
              {/* Study name */}
              <text x={PAD.left + 8} y={y + 4} fontSize={tickLabelSize + 1} fill={theme.axisLabelColor} fontWeight={500}>{s.name}</text>
              {/* CI line */}
              <line x1={sxF(s.lo)} y1={y} x2={sxF(s.hi)} y2={y} stroke={color} strokeWidth={2} strokeLinecap="round" />
              {/* CI caps */}
              <line x1={sxF(s.lo)} y1={y - 4} x2={sxF(s.lo)} y2={y + 4} stroke={color} strokeWidth={1.5} />
              <line x1={sxF(s.hi)} y1={y - 4} x2={sxF(s.hi)} y2={y + 4} stroke={color} strokeWidth={1.5} />
              {/* Effect size diamond */}
              <circle cx={sxF(s.effect)} cy={y} r={dotR} fill={color} opacity={0.85} stroke="white" strokeWidth={1.5} />
              {/* Value label */}
              <text x={sxF(s.hi) + 8} y={y + 4} fontSize={9} fill="#64748b">{s.effect.toFixed(2)} [{s.lo.toFixed(2)}, {s.hi.toFixed(2)}]</text>
            </g>
          );
        })}
      </svg>
    );
}
