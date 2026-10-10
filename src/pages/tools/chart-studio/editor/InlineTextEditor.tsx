// Chart Studio — inline text editor overlay with a Prism-style formatting toolbar
// and a special-characters palette that mirrors the Simple Canvas text tool.

import React, { useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Omega } from "lucide-react";
import { SPECIAL_CHARACTERS, CHARACTER_NAMES, type CategoryKey } from "./symbolPalette";

interface Props {
  /** Target element's bounding rect in viewport coords, captured at double-click time. */
  anchorRect: DOMRect;
  elementKey: string;
  /** Current value — HTML fragment with <sub>/<sup>/<i>/<b> plus Unicode. */
  value: string;
  style: { fontFamily: string; fontSize: number; fontWeight: number; color: string; italic?: boolean };
  onCommit: (next: string) => void;
  onCancel: () => void;
}

// Editor width is fixed so we can center it on the target reliably.
const EDITOR_WIDTH = 320;

export function InlineTextEditor({ anchorRect, elementKey, value, style, onCommit, onCancel }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Compute position directly from anchorRect. No DOM queries, no timing, no
  // fallback paths. The rect was captured when the element was definitely visible.
  const centerX = anchorRect.left + anchorRect.width / 2;
  const isY = elementKey === "ylabel";
  // Rough editor height for the above/below flip decision.
  const approxH = 32 + 4 + Math.max(32, style.fontSize * 1.7) + 8;
  const placeAbove = !isY && anchorRect.top > approxH + 8;

  const left = isY
    ? Math.max(8, Math.min(window.innerWidth - EDITOR_WIDTH - 8, anchorRect.right + 12))
    : Math.max(8, Math.min(window.innerWidth - EDITOR_WIDTH - 8, centerX - EDITOR_WIDTH / 2));
  const top = isY
    ? anchorRect.top + anchorRect.height / 2 - approxH / 2
    : placeAbove ? anchorRect.top - 6 : anchorRect.bottom + 6;
  const transform = !isY && placeAbove ? "translateY(-100%)" : "translateY(0)";

  // Mount the current value, autofocus, select all.
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = value || "";
    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [value]);

  // Preserve selection across toolbar clicks.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(r.commonAncestorContainer)) {
      savedRange.current = r.cloneRange();
    }
  };
  const restoreSelection = () => {
    if (!savedRange.current || !editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange.current);
  };

  const wrapSelection = (tag: "sup" | "sub" | "i" | "b") => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const el = document.createElement(tag);
      el.appendChild(document.createTextNode("\u200B"));
      range.insertNode(el);
      const r2 = document.createRange();
      r2.selectNodeContents(el);
      r2.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r2);
    } else {
      const contents = range.extractContents();
      const wrapper = document.createElement(tag);
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
      const r2 = document.createRange();
      r2.selectNodeContents(wrapper);
      sel.removeAllRanges();
      sel.addRange(r2);
    }
    saveSelection();
  };

  const insertText = (text: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
    saveSelection();
  };

  const commit = () => {
    const html = editorRef.current?.innerHTML ?? "";
    const cleaned = html.replace(/\u200B/g, "");
    onCommit(cleaned);
  };

  return (
    <div
      data-editor-inline=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left,
        top,
        width: EDITOR_WIDTH,
        transform,
        zIndex: 50,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Formatting toolbar */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: "4px 6px",
          marginBottom: 4,
          background: "rgba(255,255,255,0.98)",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          boxShadow: "0 6px 18px -4px rgba(15,23,42,0.18)",
          fontSize: 11,
        }}
      >
        <TbButton onClick={() => wrapSelection("b")} title="Bold"><b>B</b></TbButton>
        <TbButton onClick={() => wrapSelection("i")} title="Italic"><i>I</i></TbButton>
        <TbButton onClick={() => wrapSelection("sup")} title="Superscript">X<sup style={{ fontSize: 8 }}>2</sup></TbButton>
        <TbButton onClick={() => wrapSelection("sub")} title="Subscript">X<sub style={{ fontSize: 8 }}>2</sub></TbButton>
        <div style={{ width: 1, height: 16, background: "#e2e8f0", margin: "0 3px" }} />
        {/* Special characters popover — mirrors the canvas tool's SpecialCharactersPalette */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                  style={tbBtn()}
                  aria-label="Special characters"
                ><Omega style={{ width: 14, height: 14 }} /></button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Special Characters</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80 p-3" align="start">
            <Tabs defaultValue="greek" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="greek" className="text-xs">Greek</TabsTrigger>
                <TabsTrigger value="math" className="text-xs">Math</TabsTrigger>
                <TabsTrigger value="arrows" className="text-xs">Arrows</TabsTrigger>
                <TabsTrigger value="common" className="text-xs">Common</TabsTrigger>
              </TabsList>
              {(Object.keys(SPECIAL_CHARACTERS) as CategoryKey[]).map((key) => (
                <TabsContent key={key} value={key} className="mt-2">
                  <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
                    {SPECIAL_CHARACTERS[key].symbols.map((sym) => (
                      <Tooltip key={sym}>
                        <TooltipTrigger asChild>
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertText(sym)}
                            className="h-8 w-8 p-0 text-base rounded border border-slate-200 bg-white hover:bg-blue-500 hover:text-white transition-colors"
                          >{sym}</button>
                        </TooltipTrigger>
                        <TooltipContent><p className="capitalize">{CHARACTER_NAMES[sym] || sym}</p></TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </PopoverContent>
        </Popover>
        <div style={{ flex: 1 }} />
        <TbButton onClick={commit} title="Commit (Enter)" color="#16a34a">✓</TbButton>
        <TbButton onClick={onCancel} title="Cancel (Esc)" color="#dc2626">✕</TbButton>
      </div>

      {/* The editable text area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onBlur={(e) => {
          // Don't blur-commit if focus moved to a sibling control inside this component.
          const next = e.relatedTarget as HTMLElement | null;
          if (next && editorRef.current?.parentElement?.contains(next)) return;
          // Also ignore blurs when a popover child (Radix portals elsewhere) took focus.
          const popoverOpen = document.querySelector("[data-state=\"open\"][role=\"dialog\"]");
          if (popoverOpen) return;
          commit();
        }}
        style={{
          padding: "4px 10px",
          background: "rgba(255,255,255,0.98)",
          border: "2px solid #2563eb",
          borderRadius: 4,
          outline: "none",
          minHeight: style.fontSize * 1.7,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.italic ? "italic" : "normal",
          color: style.color,
          textAlign: "center",
          whiteSpace: "nowrap",
          boxShadow: "0 6px 18px -4px rgba(15,23,42,0.18)",
        }}
      />
    </div>
  );
}

function TbButton({ children, onClick, title, color }: { children: React.ReactNode; onClick: () => void; title: string; color?: string }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      style={{ ...tbBtn(), color: color ?? "#334155" }}
    >{children}</button>
  );
}

function tbBtn(): React.CSSProperties {
  return {
    padding: "2px 6px",
    minWidth: 24, height: 22,
    fontSize: 11,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    borderRadius: 4,
    cursor: "default",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
