import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

export interface SlideTab {
  label: string;
  value: string;
}

interface SlideTabsProps {
  tabs: SlideTab[];
  activeValue?: string;
  onTabClick?: (value: string) => void;
}

export const SlideTabs = ({ tabs, activeValue, onTabClick }: SlideTabsProps) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const activeIndex = tabs.findIndex((t) => t.value === activeValue);
  const [selected, setSelected] = useState(activeIndex >= 0 ? activeIndex : -1);
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  // Sync selected index when activeValue changes (e.g. route change)
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.value === activeValue);
    setSelected(idx);
  }, [activeValue, tabs]);

  // Position the cursor on the selected tab
  useEffect(() => {
    if (selected >= 0 && tabsRef.current[selected]) {
      const el = tabsRef.current[selected]!;
      const { width } = el.getBoundingClientRect();
      setPosition({ left: el.offsetLeft, width, opacity: 1 });
    } else {
      setPosition((p) => ({ ...p, opacity: 0 }));
    }
  }, [selected]);

  return (
    <ul
      onMouseLeave={() => {
        // Reset cursor to selected tab on mouse leave
        if (selected >= 0 && tabsRef.current[selected]) {
          const el = tabsRef.current[selected]!;
          const { width } = el.getBoundingClientRect();
          setPosition({ left: el.offsetLeft, width, opacity: 1 });
        } else {
          setPosition((p) => ({ ...p, opacity: 0 }));
        }
      }}
      className="relative flex w-fit rounded-full border-2 border-border bg-background p-1"
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.value}
          ref={(el) => {
            tabsRef.current[i] = el;
          }}
          setPosition={setPosition}
          onClick={() => {
            setSelected(i);
            onTabClick?.(tab.value);
          }}
        >
          {tab.label}
        </Tab>
      ))}
      <Cursor position={position} />
    </ul>
  );
};

interface TabProps {
  children: React.ReactNode;
  setPosition: React.Dispatch<
    React.SetStateAction<{ left: number; width: number; opacity: number }>
  >;
  onClick: () => void;
}

const Tab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ children, setPosition, onClick }, ref) => {
    return (
      <li
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => {
          if (!ref || typeof ref === "function" || !ref.current) return;
          const { width } = ref.current.getBoundingClientRect();
          setPosition({
            left: ref.current.offsetLeft,
            width,
            opacity: 1,
          });
        }}
        className="relative z-10 block cursor-pointer select-none px-3 py-1.5 text-xs font-medium uppercase text-white mix-blend-difference md:px-4 md:py-2 md:text-sm"
      >
        {children}
      </li>
    );
  }
);

Tab.displayName = "Tab";

const Cursor = ({
  position,
}: {
  position: { left: number; width: number; opacity: number };
}) => {
  return (
    <motion.li
      animate={position}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="absolute z-0 h-7 rounded-full bg-foreground md:h-9"
    />
  );
};
