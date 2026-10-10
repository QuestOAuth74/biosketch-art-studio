// Chart Studio — a collapsible drawer for the right-side properties panel.
// Each "drawer" is one property group; clicking its header toggles open/closed.
// State persists per drawer name via localStorage.

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: React.ReactNode;
  /** Unique name used as localStorage key and for identifying the drawer. */
  name: string;
  defaultOpen?: boolean;
  /** Render an action button in the header (right-aligned). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const LS_KEY = "chartStudio_drawerOpen";

function loadOpenMap(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveOpenMap(map: Record<string, boolean>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch {}
}

export function PropDrawer({ title, name, defaultOpen = false, actions, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    const map = loadOpenMap();
    return name in map ? !!map[name] : defaultOpen;
  });
  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      const map = loadOpenMap();
      map[name] = next;
      saveOpenMap(map);
      return next;
    });
  };

  return (
    <div style={{ borderBottom: "1px solid rgba(226,232,240,0.6)" }}>
      <div
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "5px 10px",
          fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.04em",
          color: "#475569",
          background: "rgba(241,245,249,0.5)",
          cursor: "default",
          userSelect: "none",
        }}
      >
        {open ? <ChevronDown className="h-3 w-3" style={{ flexShrink: 0, color: "#94a3b8" }} /> : <ChevronRight className="h-3 w-3" style={{ flexShrink: 0, color: "#94a3b8" }} />}
        <span style={{ flex: 1 }}>{title}</span>
        {actions && <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 4 }}>{actions}</span>}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
