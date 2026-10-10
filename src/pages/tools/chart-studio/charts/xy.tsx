import React from "react";
import type { ReactNode } from "react";
import type { ChartRendererProps } from "./types";
import { renderRichText } from "../editor/richText";

export function renderXy(props: ChartRendererProps): ReactNode {
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
    renderAxes, renderGrid, renderThemedLegend, renderTooltip, renderAnnotations, renderReferenceLines, sampleContinuousPalette,
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

    const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
    const yMin = Math.min(...allY), yMax = Math.max(...allY);
    const xPd = (xMax - xMin) * 0.1 || 1, yPd = (yMax - yMin) * 0.1 || 1;
    const xL = xMin - xPd, xH = xMax + xPd, yL = yMin - yPd, yH = yMax + yPd;
    const sx = (v: number) => PAD.left + ((v - xL) / (xH - xL)) * pw;
    const sy = (v: number) => PAD.top + ph - ((v - yL) / (yH - yL)) * ph;

    function nTicks(lo: number, hi: number, n = 6) {
      const step = parseFloat(((hi - lo) / n).toPrecision(1));
      const start = Math.ceil(lo / step) * step;
      const t: number[] = [];
      for (let v = start; v <= hi + step * 0.001; v += step) t.push(parseFloat(v.toPrecision(6)));
      return t;
    }
    const xT = nTicks(xL, xH), yT = nTicks(yL, yH);
    const fmt = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

    function linReg(xs: number[], ys: number[]) {
      const n = Math.min(xs.length, ys.length);
      if (n < 2) return null;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
      const denom = n * sxx - sx * sx;
      if (denom === 0) return null;
      const m = (n * sxy - sx * sy) / denom;
      const b = (sy - m * sx) / n;
      const meanX = sx / n;
      // Sum of squared residuals and SSxx (centered)
      let ssRes = 0, ssXX = 0;
      for (let i = 0; i < n; i++) {
        const fit = m * xs[i] + b;
        ssRes += (ys[i] - fit) ** 2;
        ssXX += (xs[i] - meanX) ** 2;
      }
      const dfRes = n - 2;
      const s = dfRes > 0 ? Math.sqrt(ssRes / dfRes) : 0;
      // Pointwise 95% CI half-width on the mean response ŷ(x):
      //   s * sqrt(1/n + (x − x̄)² / SSxx), scaled by t_{α/2, n−2} ≈ 1.96 for large n
      const tCrit = dfRes >= 30 ? 1.96 : dfRes > 0 ? 1.96 + 2.5 / dfRes : 1.96;
      const ciAt = (x: number) => tCrit * s * Math.sqrt(1 / n + (ssXX > 0 ? (x - meanX) ** 2 / ssXX : 0));
      return { m, b, meanX, s, n, ssXX, ciAt };
    }

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        {title && !editingTitle && <text data-element-key="title" x={W / 2 + _titleDx} y={28 + _titleDy} textAnchor="middle" fontSize={_titleSize} fontWeight={_titleWeight} fill={_titleColor} fontFamily={_titleFamily} fontStyle={_titleStyle} letterSpacing="-0.01em" transform={`rotate(${_titleRot}, ${W / 2 + _titleDx}, ${28 + _titleDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingTitle(e.currentTarget.getBoundingClientRect())}>{renderRichText(title)}</text>}
        {editingTitle && <foreignObject x={W / 2 - 120} y={8} width={240} height={30}><input autoFocus defaultValue={title} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: titleSize, fontWeight: titleBold ? 700 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "2px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("title", e.target.value); setEditingTitle(null); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        {showGrid && <g>
          {xT.map((v, i) => <line key={`xg${i}`} x1={sx(v)} y1={PAD.top} x2={sx(v)} y2={PAD.top + ph} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
          {yT.map((v, i) => <line key={`yg${i}`} x1={PAD.left} y1={sy(v)} x2={PAD.left + pw} y2={sy(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} opacity={theme.gridOpacity} strokeDasharray={theme.gridDash} />)}
        </g>}

        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={theme.axisWidth} />

        {xT.map((v, i) => <g key={`xt${i}`}><line x1={sx(v)} y1={PAD.top + ph} x2={sx(v)} y2={PAD.top + ph + 5} stroke={theme.axisColor} /><text x={sx(v)} y={PAD.top + ph + 20} textAnchor="middle" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmt(v)}</text></g>)}
        {yT.map((v, i) => <g key={`yt${i}`}><line x1={PAD.left - 5} y1={sy(v)} x2={PAD.left} y2={sy(v)} stroke={theme.axisColor} /><text x={PAD.left - 9} y={sy(v) + 4} textAnchor="end" fontSize={tickLabelSize} fill={theme.tickLabelColor} fontWeight={500}>{fmt(v)}</text></g>)}

        {xLabel && !editingXLabel && <text data-element-key="xlabel" x={PAD.left + pw / 2 + _xLabelDx} y={H - 8 + _xLabelDy} textAnchor="middle" fontSize={_xLabelSize} fontWeight={_xLabelWeight} fill={_xLabelColor} fontFamily={_xLabelFamily} fontStyle={_xLabelStyle} transform={`rotate(${_xLabelRot}, ${PAD.left + pw / 2 + _xLabelDx}, ${H - 8 + _xLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingXLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(xLabel)}</text>}
        {editingXLabel && <foreignObject x={PAD.left + pw / 2 - 100} y={H - 24} width={200} height={24}><input autoFocus defaultValue={xLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: "100%", textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white" }} onBlur={(e) => { onSettingChange?.("xLabel", e.target.value); setEditingXLabel(null); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}
        {yLabel && !editingYLabel && <text data-element-key="ylabel" x={16 + _yLabelDx} y={PAD.top + ph / 2 + _yLabelDy} textAnchor="middle" fontSize={_yLabelSize} fontWeight={_yLabelWeight} fill={_yLabelColor} fontFamily={_yLabelFamily} fontStyle={_yLabelStyle} transform={`rotate(${-90 + _yLabelRot}, ${16 + _yLabelDx}, ${PAD.top + ph / 2 + _yLabelDy})`} style={{ cursor: "text" }} onDoubleClick={(e) => setEditingYLabel(e.currentTarget.getBoundingClientRect())}>{renderRichText(yLabel)}</text>}
        {editingYLabel && <foreignObject x={2} y={PAD.top + ph / 2 - 12} width={24} height={ph}><input autoFocus defaultValue={yLabel} ref={(el) => { if (el) activeTextInputRef.current = el; }} onFocus={(e) => { activeTextInputRef.current = e.target as HTMLInputElement; }} style={{ width: ph, textAlign: "center", fontSize: axisLabelSize, fontWeight: axisLabelBold ? 600 : 400, fontFamily: ff, border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", outline: "none", background: "white", transform: "rotate(-90deg)", transformOrigin: "0 0", position: "absolute", top: ph, left: 0 }} onBlur={(e) => { onSettingChange?.("yLabel", e.target.value); setEditingYLabel(null); activeTextInputRef.current = null; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></foreignObject>}

        <g clipPath="url(#cs-clip)">
        {settings.errorBand && yTraces.length > 1 && (() => {
          // Aggregate mean + error across Y traces (treated as replicates at each x)
          const n = Math.min(xVals.length, ...yTraces.map((ys) => ys.length));
          const rows: { x: number; mean: number; err: number }[] = [];
          for (let j = 0; j < n; j++) {
            const vals = yTraces.map((ys) => ys[j]).filter((v) => typeof v === "number" && isFinite(v));
            if (vals.length < 2) continue;
            const m = vals.reduce((s, v) => s + v, 0) / vals.length;
            const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
            const errValue = settings.errorBarType === "sd" ? sd : sd / Math.sqrt(vals.length);
            rows.push({ x: xVals[j], mean: m, err: errValue });
          }
          if (rows.length < 2) return null;
          rows.sort((a, b) => a.x - b.x);
          const up = rows.map((r, i) => `${i === 0 ? "M" : "L"}${sx(r.x)},${sy(r.mean + r.err)}`).join(" ");
          const dn = rows.slice().reverse().map((r) => `L${sx(r.x)},${sy(r.mean - r.err)}`).join(" ");
          const ribbon = `${up} ${dn} Z`;
          const line = rows.map((r, i) => `${i === 0 ? "M" : "L"}${sx(r.x)},${sy(r.mean)}`).join(" ");
          const color = tc(0);
          return (
            <g>
              <path d={ribbon} fill={color} opacity={0.2} />
              <path d={line} fill="none" stroke={color} strokeWidth={lw} strokeLinejoin={theme.lineLinejoin as any} strokeLinecap={theme.lineLinecap as any} />
            </g>
          );
        })()}
        {!(settings.errorBand && yTraces.length > 1) && yTraces.map((ys, ti) => {
          const color = tc(ti);
          const n = Math.min(xVals.length, ys.length);
          // Continuous color-by setup
          const cbCol = settings.colorByColumn;
          const cbValues = typeof cbCol === "number" && cbCol >= 0 && cbCol < colData.length
            ? colData[cbCol]
            : null;
          const cbMin = cbValues && cbValues.length > 0 ? Math.min(...cbValues) : 0;
          const cbMax = cbValues && cbValues.length > 0 ? Math.max(...cbValues) : 1;
          const cbRange = cbMax - cbMin || 1;
          const colorOf = (j: number): string => {
            if (!cbValues) return color;
            const v = cbValues[j];
            if (typeof v !== "number" || !isFinite(v)) return color;
            return sampleContinuousPalette(settings.colorByPalette, (v - cbMin) / cbRange);
          };
          const pts = Array.from({ length: n }).map((_, j) => ({ x: xVals[j], y: ys[j], idx: j })).sort((a, b) => a.x - b.x);
          return <g key={ti} opacity={seriesOpacity(ti) * to(ti)}>
            {pts.length > 1 && !cbValues && <polyline points={pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={lw} strokeLinejoin={theme.lineLinejoin as any} strokeLinecap={theme.lineLinecap as any} opacity={theme.lineOpacity} strokeDasharray={dashArray} />}
            {pts.map((p, j) => (
              <g key={j}
                onMouseEnter={() => setTooltip({ x: sx(p.x), y: sy(p.y), label: `(${p.x}, ${p.y})` })}
                onMouseLeave={() => setTooltip(null)}
              >
                {renderThemedPoint(sx(p.x), sy(p.y), settings.pointSize, colorOf(p.idx), `pt${j}`)}
              </g>
            ))}
            {showRegression && (() => {
              const r = linReg(xVals.slice(0, n), ys.slice(0, n));
              if (!r) return null;
              // Sample the fit across the x domain so the ribbon curves with the CI width
              const N = 48;
              const xs: number[] = [];
              for (let k = 0; k <= N; k++) xs.push(xL + (xH - xL) * (k / N));
              const upper: string[] = [];
              const lower: string[] = [];
              xs.forEach((x, k) => {
                const fit = r.b + r.m * x;
                const w = r.ciAt(x);
                const xi = sx(x);
                upper.push(`${k === 0 ? "M" : "L"}${xi},${sy(fit + w)}`);
                lower.unshift(`L${xi},${sy(fit - w)}`);
              });
              const ribbon = upper.join(" ") + " " + lower.join(" ") + " Z";
              return (
                <g>
                  <path d={ribbon} fill={color} opacity={0.12} />
                  <line x1={sx(xL)} y1={sy(r.b + r.m * xL)} x2={sx(xH)} y2={sy(r.b + r.m * xH)} stroke={color} strokeWidth={1.5} strokeDasharray="8 5" opacity={0.55} />
                </g>
              );
            })()}
          </g>;
        })}

        </g>
        {yTraces.length > 1 && legendPosition !== "none" && (() => {
          const lx = legendPosition.includes("right") ? PAD.left + pw - 130 : PAD.left + 10;
          const ly = legendPosition.includes("bottom") ? PAD.top + ph - yTraces.length * 22 - 8 : PAD.top + 14;
          return <g>
            {legendBorder && <rect x={lx - 10} y={ly - 14} width={140} height={yTraces.length * 22 + 8} fill="white" stroke="#d1d5db" rx={4} />}
            {yTraces.map((_, i) => <g key={i} transform={`translate(${lx}, ${ly + i * 22})`}>
              {!legendBorder && <rect x={-6} y={-10} width={130} height={22} fill={theme.legendBgColor} opacity={theme.legendBgOpacity} rx={theme.legendCornerRadius} />}
              <circle cx={6} cy={0} r={5} fill={tc(i)} />
              <text x={18} y={4} fontSize={tickLabelSize + 1} fill={theme.axisLabelColor} fontWeight={500}>{columns[i + 1]}</text>
            </g>)}
          </g>;
        })()}
        {renderReferenceLines(sx, sy)}
        {renderAnnotations()}
        {renderTooltip()}
      </svg>
    );
}
