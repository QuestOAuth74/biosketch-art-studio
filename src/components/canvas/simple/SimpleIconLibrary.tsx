/**
 * Wrapper around IconLibrary with restyled category groups for the simple canvas.
 * Uses CSS overrides to change accordion appearance without duplicating the component.
 */
import { useState } from 'react';
import { IconLibrary } from '@/components/canvas/IconLibrary';

const simpleIconStyles = `
  /* ── Simple Canvas Icon Library Overrides ── */

  .simple-icon-lib [data-radix-collection-item] {
    /* Category items: pill-style with rounded corners, no harsh borders */
    border: none !important;
    border-radius: 10px !important;
    background: hsl(var(--muted) / 0.4) !important;
    margin-bottom: 6px !important;
    overflow: hidden !important;
    transition: all 0.2s ease !important;
  }

  .simple-icon-lib [data-radix-collection-item]:hover {
    background: hsl(var(--muted) / 0.7) !important;
  }

  .simple-icon-lib [data-radix-collection-item][data-state="open"] {
    background: hsl(var(--card)) !important;
    box-shadow: 0 1px 3px hsl(var(--foreground) / 0.06), 0 0 0 1px hsl(var(--border) / 0.5) !important;
  }

  /* Special categories (AI, BioSketch, Pinned) keep their gradient but softer */
  .simple-icon-lib [data-radix-collection-item][class*="border-purple"],
  .simple-icon-lib [data-radix-collection-item][class*="border-blue"],
  .simple-icon-lib [data-radix-collection-item][class*="border-yellow"],
  .simple-icon-lib [data-radix-collection-item][class*="border-emerald"] {
    border: 1px solid hsl(var(--border) / 0.3) !important;
  }

  /* Trigger: smaller, cleaner text */
  .simple-icon-lib button[data-radix-collection-item] > div > button,
  .simple-icon-lib [data-radix-collection-item] > h3 > button {
    padding: 8px 10px !important;
    font-size: 12px !important;
  }

  /* Replace default chevron caret with a custom rotation */
  .simple-icon-lib [data-radix-collection-item] h3 button > svg:last-child {
    width: 14px !important;
    height: 14px !important;
    opacity: 0.4;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  .simple-icon-lib [data-radix-collection-item][data-state="open"] h3 button > svg:last-child {
    opacity: 0.8;
    color: hsl(var(--primary));
  }

  /* Category name text */
  .simple-icon-lib [data-radix-collection-item] h3 button span {
    font-size: 12px !important;
    font-weight: 500 !important;
    letter-spacing: 0.01em;
  }

  /* Icon count badge */
  .simple-icon-lib [data-radix-collection-item] h3 button .text-xs.text-muted-foreground {
    font-size: 10px !important;
    background: hsl(var(--muted) / 0.6);
    padding: 1px 6px;
    border-radius: 8px;
  }

  /* Content area when expanded */
  .simple-icon-lib [data-radix-collection-item] > div[role="region"] > div {
    padding: 6px 8px 8px !important;
  }

  /* Icon grid: slightly larger icons, tighter gaps */
  .simple-icon-lib .grid.grid-cols-4 {
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 6px !important;
  }

  /* Icon buttons: rounder, subtler */
  .simple-icon-lib .grid button[title] {
    border-radius: 8px !important;
    border-width: 1px !important;
    border-color: hsl(var(--border) / 0.3) !important;
  }

  .simple-icon-lib .grid button[title]:hover {
    border-color: hsl(var(--primary) / 0.5) !important;
    transform: scale(1.05) !important;
  }

  /* Pagination: more compact */
  .simple-icon-lib .flex.items-center.justify-center.gap-2 button {
    height: 24px !important;
    width: 24px !important;
    border-radius: 6px !important;
  }

  .simple-icon-lib .flex.items-center.justify-center.gap-2 span {
    font-size: 10px !important;
  }

  /* Search: softer */
  .simple-icon-lib input[type="text"] {
    border-radius: 8px !important;
    height: 32px !important;
    font-size: 12px !important;
  }

  /* Section headers (Pinned, etc.) */
  .simple-icon-lib .text-xs.font-semibold.uppercase {
    font-size: 9px !important;
    letter-spacing: 0.08em;
    opacity: 0.6;
  }

  /* Hide native scrollbar on Radix scroll viewport (Radix renders its own custom scrollbar) */
  .simple-icon-lib [data-radix-scroll-area-viewport] {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  .simple-icon-lib [data-radix-scroll-area-viewport]::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;

interface SimpleIconLibraryProps {
  onAIIconGenerate?: (initialPrompt?: string) => void;
}

export function SimpleIconLibrary({ onAIIconGenerate }: SimpleIconLibraryProps = {}) {
  const [selectedCategory, setSelectedCategory] = useState('');

  return (
    <div className="simple-icon-lib h-full">
      <style>{simpleIconStyles}</style>
      <IconLibrary
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        onAIIconGenerate={onAIIconGenerate}
      />
    </div>
  );
}
