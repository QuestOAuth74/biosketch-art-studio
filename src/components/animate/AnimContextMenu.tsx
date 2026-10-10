import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/*  Lightweight context-menu primitives for the animation page         */
/* ------------------------------------------------------------------ */

interface AnimContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  children: ReactNode;
}

export function AnimContextMenu({ position, onClose, children }: AnimContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!position) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [position, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!position) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use a microtask so the opening right-click doesn't immediately close it
    const id = requestAnimationFrame(() => {
      window.addEventListener("mousedown", handler);
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("mousedown", handler);
    };
  }, [position, onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = useCallback(() => {
    if (!position || !menuRef.current) return { top: 0, left: 0 };
    const rect = menuRef.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    return { top: y, left: x };
  }, [position]);

  if (!position) return null;

  // Portal escapes .anim-workspace scope, so we must set CSS vars explicitly
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] py-1 rounded-lg border anim-workspace"
      style={{
        top: position.y,
        left: position.x,
        background: "rgba(22, 17, 35, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(139,92,246,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.08)",
        fontSize: "12px",
        color: "rgba(255, 255, 255, 0.95)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */

interface AnimContextMenuItemProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  shortcut?: string;
}

export function AnimContextMenuItem({ onClick, disabled, children, shortcut }: AnimContextMenuItemProps) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-[5px] text-left transition-colors"
      style={{
        color: disabled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.95)",
        cursor: disabled ? "default" : "pointer",
        background: "transparent",
        border: "none",
        fontSize: "12px",
        lineHeight: "16px",
      }}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "rgba(139,92,246,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span>{children}</span>
      {shortcut && (
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginLeft: "16px" }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function AnimContextMenuSeparator() {
  return (
    <div
      className="my-1 mx-2"
      style={{
        height: "1px",
        background: "rgba(139,92,246,0.15)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Submenu support                                                    */
/* ------------------------------------------------------------------ */

interface AnimContextMenuSubProps {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

export function AnimContextMenuSub({ label, disabled, children }: AnimContextMenuSubProps) {
  const ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  // Position sub-menu to the right; flip left if no space
  useEffect(() => {
    if (!ref.current || !subRef.current) return;
    const trigger = ref.current.getBoundingClientRect();
    const sub = subRef.current;
    // Default: open to the right
    sub.style.top = "0px";
    sub.style.left = `${trigger.width}px`;

    // After render, check overflow
    requestAnimationFrame(() => {
      const subRect = sub.getBoundingClientRect();
      if (subRect.right > window.innerWidth - 8) {
        sub.style.left = `${-subRect.width}px`;
      }
      if (subRect.bottom > window.innerHeight - 8) {
        sub.style.top = `${-(subRect.height - trigger.height)}px`;
      }
    });
  });

  return (
    <div ref={ref} className="relative group">
      <button
        className="w-full flex items-center justify-between px-3 py-[5px] text-left transition-colors"
        style={{
          color: disabled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.95)",
          cursor: disabled ? "default" : "pointer",
          background: "transparent",
          border: "none",
          fontSize: "12px",
          lineHeight: "16px",
        }}
        disabled={disabled}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.background = "rgba(139,92,246,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginLeft: "16px" }}>&#9656;</span>
      </button>
      {!disabled && (
        <div
          ref={subRef}
          className="absolute hidden group-hover:block min-w-[160px] py-1 rounded-lg border z-[10000]"
          style={{
            background: "rgba(22, 17, 35, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(139,92,246,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.08)",
            color: "rgba(255, 255, 255, 0.95)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
