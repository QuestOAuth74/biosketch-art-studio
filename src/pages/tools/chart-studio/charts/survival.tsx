import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderSurvival(props: ChartRendererProps): ReactNode {
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

    // Data format: pairs of columns (Time, Event) per group
    // Event: 1 = event occurred, 0 = censored
    const nGroups = Math.floor(columns.length / 2);
    if (nGroups === 0) {
      return (
        <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
          {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Need paired Time/Event columns</text>
        </svg>
      );
    }

    // Compute KM curves per group
    type KMPoint = { time: number; survival: number; censored: boolean };

    const kmCurves: { name: string; points: KMPoint[]; color: string }[] = [];

    for (let g = 0; g < nGroups; g++) {
      const timeCol = colData[g * 2];
      const eventCol = colData[g * 2 + 1];
      const n = Math.min(timeCol.length, eventCol.length);
      if (n === 0) continue;

      // Build subject list
      const subjects: { time: number; event: boolean }[] = [];
      for (let i = 0; i < n; i++) {
        subjects.push({ time: timeCol[i], event: eventCol[i] === 1 });
      }
      subjects.sort((a, b) => a.time - b.time);

      // KM estimator
      const points: KMPoint[] = [{ time: 0, survival: 1, censored: false }];
      let atRisk = subjects.length;
      let survival = 1;

      let i = 0;
      while (i < subjects.length) {
        const t = subjects[i].time;
        let events = 0;
        let censored = 0;

        // Count all events and censorings at this time
        while (i < subjects.length && subjects[i].time === t) {
          if (subjects[i].event) events++;
          else censored++;
          i++;
        }

        if (events > 0) {
          survival *= (atRisk - events) / atRisk;
          points.push({ time: t, survival, censored: false });
        }

        // Mark censored observations
        if (censored > 0) {
          points.push({ time: t, survival, censored: true });
        }

        atRisk -= (events + censored);
      }

      const groupName = columns[g * 2].replace(/^Time\s*\(?/, "").replace(/\)?\s*$/, "") || `Group ${g + 1}`;
      kmCurves.push({ name: groupName, points, color: tc(g) });
    }

    if (kmCurves.length === 0 || kmCurves.every((c) => c.points.length <= 1)) {
      return (
        <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
          {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Enter Time and Event data (1=event, 0=censored)</text>
        </svg>
      );
    }

    const maxTime = Math.max(...kmCurves.flatMap((c) => c.points.map((p) => p.time))) * 1.1 || 1;
    const sx = (t: number) => PAD.left + (t / maxTime) * pw;
    const sy = (s: number) => PAD.top + ph - s * ph; // survival 0–1

    function nTicks(lo: number, hi: number, n = 6) {
      const step = parseFloat(((hi - lo) / n).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xT = nTicks(0, maxTime);
    const yT = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const fmtS = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* Grid */}
        {showGrid && <g>
          {xT.map((v, i) => <line key={`xg${i}`} x1={sx(v)} y1={PAD.top} x2={sx(v)} y2={PAD.top + ph} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
          {yT.map((v, i) => <line key={`yg${i}`} x1={PAD.left} y1={sy(v)} x2={PAD.left + pw} y2={sy(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
        </g>}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {/* X ticks */}
        {xT.map((v, i) => <g key={i}>
          <line x1={sx(v)} y1={PAD.top + ph} x2={sx(v)} y2={PAD.top + ph + 5} stroke={theme.axisColor} />
          <text x={sx(v)} y={PAD.top + ph + 20} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmtS(v)}</text>
        </g>)}

        {/* Y ticks */}
        {yT.map((v, i) => <g key={i}>
          <line x1={PAD.left - 4} y1={sy(v)} x2={PAD.left} y2={sy(v)} stroke={theme.axisColor} />
          <text x={PAD.left - 8} y={sy(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{(v * 100).toFixed(0)}%</text>
        </g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(false); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {/* KM curves — clipped */}
        <g clipPath="url(#cs-clip)">
        {kmCurves.map((curve, ci) => {
          const pts = curve.points;
          // Build step path
          let pathD = `M ${sx(pts[0].time)} ${sy(pts[0].survival)}`;
          for (let i = 1; i < pts.length; i++) {
            if (!pts[i].censored) {
              // Horizontal line to new time, then vertical drop
              pathD += ` H ${sx(pts[i].time)} V ${sy(pts[i].survival)}`;
            }
          }
          // Extend to max time
          const lastSurvival = pts[pts.length - 1].survival;
          pathD += ` H ${sx(maxTime)}`;

          return (
            <g key={ci}>
              {/* Step function line */}
              <path d={pathD} fill="none" stroke={curve.color} strokeWidth={lw} strokeLinecap="round" />

              {/* Censored marks (small vertical ticks) */}
              {pts.filter((p) => p.censored).map((p, j) => (
                <line key={j} x1={sx(p.time)} y1={sy(p.survival) - 5} x2={sx(p.time)} y2={sy(p.survival) + 5} stroke={curve.color} strokeWidth={2} strokeLinecap="round" />
              ))}
            </g>
          );
        })}

        {/* Legend */}
        </g>
        {kmCurves.length > 1 && <g>
          {kmCurves.map((c, i) => <g key={i} transform={`translate(${PAD.left + pw - 130}, ${PAD.top + 14 + i * 22})`}>
            <rect x={-6} y={-10} width={130} height={22} fill={theme.legendBgColor} opacity={theme.legendBgOpacity} rx={theme.legendCornerRadius} />
            <line x1={0} y1={0} x2={16} y2={0} stroke={c.color} strokeWidth={2.5} strokeLinecap="round" />
            <text x={22} y={4} fontSize={tickLabelSize + 1} fill={theme.axisLabelColor} fontWeight={500}>{c.name}</text>
          </g>)}
        </g>}

        {/* 50% survival reference line */}
        <line x1={PAD.left} y1={sy(0.5)} x2={PAD.left + pw} y2={sy(0.5)} stroke={theme.axisColor} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
      </svg>
    );
}
