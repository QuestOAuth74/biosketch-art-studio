// Chart Studio — Fabric.js editor overlay (Phase Fabric prototype).
//
// Mounts a Fabric canvas on top of the SVG chart during "edit mode." Editable
// elements (title, x-label, y-label) are rendered as Fabric Textboxes at the
// same positions/styles as the SVG. Selection, drag, resize, rotate, and
// inline text editing are handled natively by Fabric.
//
// On commit, we walk the Fabric objects, pull their current values, and round-trip
// back to GraphSettings (settings.title/xLabel/yLabel for text; elementStyles[key]
// for position, font, color, rotation). Fabric canvas is then unmounted and the
// SVG re-renders with the new state.

import React, { useEffect, useRef } from "react";
import { Canvas, Textbox } from "fabric";
import type { GraphSettings } from "../types";

interface Props {
  /** Chart dimensions (SVG pixel units). Fabric canvas matches. */
  W: number;
  H: number;
  settings: GraphSettings;
  /** Optional theme colors used as fallback when elementStyles has no color. */
  defaultColors: { title: string; axisLabel: string };
  onCommit: (updates: Partial<GraphSettings>) => void;
  onCancel: () => void;
}

type ElementSpec = {
  key: "title" | "xlabel" | "ylabel";
  text: string;
  // Default SVG-space position for this element (no override applied).
  defaultX: number;
  defaultY: number;
  textAlign: "left" | "center" | "right";
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  // For ylabel: rotation baked in (-90). We'll add user rotation on top.
  baseAngle: number;
};

function buildSpecs(settings: GraphSettings, W: number, H: number, defaultColors: Props["defaultColors"]): ElementSpec[] {
  const ff = settings.fontFamily || "Inter, sans-serif";
  const specs: ElementSpec[] = [];
  if (settings.title) {
    specs.push({
      key: "title", text: settings.title,
      defaultX: W / 2, defaultY: 28,
      textAlign: "center",
      fontSize: settings.titleSize, fontWeight: settings.titleBold ? 700 : 400,
      fontFamily: ff, fontStyle: "normal",
      fill: defaultColors.title, baseAngle: 0,
    });
  }
  if (settings.xLabel) {
    const PAD_L = settings.marginLeft || 62;
    const PAD_R = settings.marginRight || 36;
    const pw = W - PAD_L - PAD_R;
    specs.push({
      key: "xlabel", text: settings.xLabel,
      defaultX: PAD_L + pw / 2, defaultY: H - 8,
      textAlign: "center",
      fontSize: settings.axisLabelSize, fontWeight: settings.axisLabelBold ? 600 : 400,
      fontFamily: ff, fontStyle: "normal",
      fill: defaultColors.axisLabel, baseAngle: 0,
    });
  }
  if (settings.yLabel) {
    const PAD_T = settings.marginTop || 48;
    const PAD_B = settings.marginBottom || 56;
    const ph = H - PAD_T - PAD_B;
    specs.push({
      key: "ylabel", text: settings.yLabel,
      defaultX: 16, defaultY: PAD_T + ph / 2,
      textAlign: "center",
      fontSize: settings.axisLabelSize, fontWeight: settings.axisLabelBold ? 600 : 400,
      fontFamily: ff, fontStyle: "normal",
      fill: defaultColors.axisLabel, baseAngle: -90,
    });
  }
  return specs;
}

export function FabricEditor({ W, H, settings, defaultColors, onCommit, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  // Stable reference to the specs we used to initialise the canvas — needed for commit.
  const specsRef = useRef<ElementSpec[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const fab = new Canvas(canvasRef.current, {
      width: W,
      height: H,
      backgroundColor: "rgba(0,0,0,0)",
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: false,
    });
    fabricRef.current = fab;

    const specs = buildSpecs(settings, W, H, defaultColors);
    specsRef.current = specs;

    for (const spec of specs) {
      const ov = settings.elementStyles?.[spec.key] ?? {};
      const dx = ov.offsetX ?? 0, dy = ov.offsetY ?? 0;
      const fontSize = ov.fontSize ?? spec.fontSize;
      const fontWeight = ov.fontWeight ?? spec.fontWeight;
      const fontStyle = ov.fontStyle ?? spec.fontStyle;
      const fontFamily = ov.fontFamily ?? spec.fontFamily;
      const fill = ov.color ?? spec.fill;
      const userRotation = ov.rotation ?? 0;
      const totalAngle = spec.baseAngle + userRotation;

      const tb = new Textbox(spec.text, {
        // Fabric positions by top-left corner by default. originX:"center" centers horizontally.
        left: spec.defaultX + dx,
        top: spec.defaultY + dy - fontSize * 0.6, // rough vertical center match to SVG baseline
        originX: "center",
        originY: "center",
        angle: totalAngle,
        fontSize,
        fontWeight: fontWeight as any,
        fontStyle: fontStyle as any,
        fontFamily,
        fill,
        textAlign: spec.textAlign,
        editable: true,
        borderColor: "#2563eb",
        cornerColor: "#2563eb",
        cornerSize: 8,
        transparentCorners: false,
        padding: 4,
      });
      (tb as any).data = { key: spec.key };
      fab.add(tb);
    }
    fab.requestRenderAll();

    return () => {
      fab.dispose();
      fabricRef.current = null;
    };
  }, [W, H, settings, defaultColors]);

  const commit = () => {
    const fab = fabricRef.current;
    if (!fab) return;
    const updates: Partial<GraphSettings> = {};
    const newElementStyles: NonNullable<GraphSettings["elementStyles"]> = { ...(settings.elementStyles ?? {}) };
    for (const spec of specsRef.current) {
      const obj = fab.getObjects().find((o) => (o as any).data?.key === spec.key) as Textbox | undefined;
      if (!obj) continue;
      const newText = (obj.text ?? "") as string;
      // Round-trip field
      if (spec.key === "title") updates.title = newText;
      else if (spec.key === "xlabel") updates.xLabel = newText;
      else if (spec.key === "ylabel") updates.yLabel = newText;

      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const fontSize = obj.fontSize ?? spec.fontSize;
      // Inverse of our initial mapping: defaultY + dy - fontSize*0.6 → dy = top + fontSize*0.6 - defaultY
      const offsetX = left - spec.defaultX;
      const offsetY = top + fontSize * 0.6 - spec.defaultY;
      const userRotation = (obj.angle ?? 0) - spec.baseAngle;

      const style: NonNullable<GraphSettings["elementStyles"]>[string] = {
        offsetX: Math.round(offsetX),
        offsetY: Math.round(offsetY),
        fontSize: Math.round(fontSize),
        fontWeight: obj.fontWeight as any,
        fontStyle: obj.fontStyle as any,
        fontFamily: obj.fontFamily as string,
        color: obj.fill as string,
        rotation: Math.round(userRotation),
      };
      // Drop no-op fields to keep the override minimal
      const cleaned: any = {};
      for (const [k, v] of Object.entries(style)) {
        if (v === undefined || v === null) continue;
        if (k === "offsetX" && v === 0) continue;
        if (k === "offsetY" && v === 0) continue;
        if (k === "rotation" && v === 0) continue;
        cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) {
        newElementStyles[spec.key] = cleaned;
      } else {
        delete newElementStyles[spec.key];
      }
    }
    updates.elementStyles = newElementStyles;
    onCommit(updates);
  };

  return (
    <>
      {/* Fabric canvas overlay — sits on top of the SVG. */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: W, height: H,
          zIndex: 25,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
      {/* Done / Cancel bar */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: -44,
          transform: "translateX(-50%)",
          zIndex: 30,
          display: "flex", gap: 6,
          padding: "6px 10px",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          boxShadow: "0 6px 18px -4px rgba(15,23,42,0.18)",
          fontFamily: "Inter, sans-serif", fontSize: 11,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ alignSelf: "center", color: "#475569", fontWeight: 600, marginRight: 4 }}>Editing</span>
        <button
          onClick={commit}
          style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#fff", background: "#16a34a", border: "none", borderRadius: 5, cursor: "default" }}
        >Done</button>
        <button
          onClick={onCancel}
          style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 5, cursor: "default" }}
        >Cancel</button>
      </div>
    </>
  );
}
