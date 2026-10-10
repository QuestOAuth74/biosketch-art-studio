/**
 * Regression spec for Tier 0 fixes:
 *   1. Heavy-commit sliders — a simulated drag must produce exactly ONE undo
 *      entry (Ctrl+Z once reverts to the pre-drag value), not N entries.
 *   2. Preset application batched — clicking a Publication Preset, Saved Style,
 *      Color Palette, or Dimensions preset must be ONE undo entry.
 *   3. InlineTextEditor anchoring — double-clicking the title opens the editor
 *      positioned above (or near) the title's bounding rect, NOT the
 *      middle-right of the viewport (the pre-fix bad behavior).
 */

import { test, expect, Page, Locator } from "@playwright/test";

const BASE = "/chart-studio?type=column";

async function boot(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem("chartStudio_drawerOpen"); } catch {}
  });
  await page.goto(BASE);
  await page.locator(".cs-nav-item").first().waitFor({ state: "visible", timeout: 15000 });
}

async function enterSampleData(page: Page) {
  // Populate a few cells so the chart renders with real geometry
  const rows: number[][] = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = page.locator(`input[data-row="${r}"][data-col="${c}"]`).first();
      await cell.click({ force: true, timeout: 2000 }).catch(() => {});
      await page.keyboard.type(String(rows[r][c]));
      await page.keyboard.press("Tab");
    }
  }
}

async function gotoGraphTab(page: Page) {
  await page.locator(".cs-nav-item", { hasText: /^Graph$/ }).first().click();
  await page.locator("#chart-studio-svg").waitFor({ state: "visible", timeout: 10000 });
}

async function openDrawer(page: Page, title: string) {
  const header = page
    .locator("div")
    .filter({ hasText: new RegExp(`^${title}$`, "i") })
    .filter({ has: page.locator("svg") })
    .first();
  const isOpen = (await header.locator('svg.lucide-chevron-down').count()) > 0;
  if (!isOpen) await header.click();
}

/**
 * Simulate a real slider drag by firing pointerdown → N input events → pointerup.
 * This is what the Tier 0 fix is designed to batch into ONE undo entry.
 */
async function simulateSliderDrag(el: Locator, values: number[]) {
  await el.evaluate((node, vs) => {
    const input = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
    for (const v of vs) {
      setter.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }));
  }, values);
}

async function getTitleFontSize(page: Page): Promise<number | null> {
  const title = page.locator('[data-element-key="title"]').first();
  if ((await title.count()) === 0) return null;
  const fs = await title.getAttribute("font-size");
  return fs ? Number(fs) : null;
}

async function ctrlZ(page: Page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(60);
  }
}

// ────────────────────────────────────────────────────────────────────────

test.describe("Chart Studio — Tier 0 regressions", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
    await enterSampleData(page);
    await gotoGraphTab(page);
  });

  // ─ Heavy-commit slider batching ────────────────────────────────────────

  test("Title Size slider drag creates exactly ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Typography");
    const initial = await getTitleFontSize(page);
    expect(initial).not.toBeNull();

    const slider = page.locator('input[type="range"]').filter({ hasNot: page.locator("foo") }).nth(0);
    // The Typography drawer has multiple range inputs — find the one tied to Title Size
    // by matching the label's sibling.
    const titleSizeSlider = page
      .locator('text="Title Size"')
      .first()
      .locator("xpath=following::input[@type='range'][1]");

    // Drag through 5 different values in one "gesture"
    await simulateSliderDrag(titleSizeSlider, [18, 20, 23, 25, 27]);
    const afterDrag = await getTitleFontSize(page);
    expect(afterDrag).toBe(27);

    // A single Ctrl+Z must revert to the pre-drag value, proving only one
    // undo entry was pushed by the whole drag.
    await ctrlZ(page, 1);
    const afterUndo = await getTitleFontSize(page);
    expect(afterUndo).toBe(initial);
  });

  test("Point Size slider drag creates exactly ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Appearance");
    // Make sure data points are on so the chart uses pointSize
    const dataPointsSwitch = page.locator('button[role="switch"]').filter({ hasText: "" }).nth(3);
    // Fallback: find "Data Points" row
    const dpRow = page.locator('text="Data Points"').first().locator("xpath=following::button[@role='switch'][1]");
    if ((await dpRow.getAttribute("data-state").catch(() => null)) !== "checked") {
      await dpRow.click().catch(() => {});
    }

    await openDrawer(page, "Points & Lines");
    const initialSize = await page.locator('text=/\\d+px/').nth(0).innerText();
    const pointSizeSlider = page
      .locator('text="Point Size"').first()
      .locator("xpath=following::input[@type='range'][1]");

    await simulateSliderDrag(pointSizeSlider, [4, 6, 8, 10, 11]);
    const final = await page.locator('text=/\\d+px/').nth(0).innerText();
    expect(final).toMatch(/11px/);

    await ctrlZ(page, 1);
    const reverted = await page.locator('text=/\\d+px/').nth(0).innerText();
    expect(reverted).toBe(initialSize);
  });

  test("Axis Line Weight slider drag creates exactly ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Appearance");
    const label = page.locator('text="Axis Line Weight"').first();
    const slider = label.locator("xpath=following::input[@type='range'][1]");

    const readBefore = await slider.inputValue();
    await simulateSliderDrag(slider, [1, 1.5, 2, 2.5, 3]);
    expect(await slider.inputValue()).toBe("3");
    await ctrlZ(page, 1);
    expect(await slider.inputValue()).toBe(readBefore);
  });

  // ─ Preset batching ─────────────────────────────────────────────────────

  test("Dimension 'Square' preset is ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Dimensions");
    const svg = page.locator("#chart-studio-svg");
    const w0 = await svg.getAttribute("width");
    const h0 = await svg.getAttribute("height");

    await page.locator(".cs-tool-btn", { hasText: /Square/i }).click();
    await expect(svg).toHaveAttribute("width", "600");
    await expect(svg).toHaveAttribute("height", "600");

    await ctrlZ(page, 1);
    await expect(svg).toHaveAttribute("width", w0 || "");
    await expect(svg).toHaveAttribute("height", h0 || "");
  });

  test("Color Palette switch is ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Colors");
    const firstRect = page
      .locator('#chart-studio-svg rect[fill]:not([fill="none"]):not([fill="white"]):not([fill="#fff"])')
      .first();
    const before = await firstRect.getAttribute("fill");

    const altPalette = page
      .locator(".cs-tool-btn")
      .filter({ hasText: /Pastel|Vibrant|Muted|Viridis|Colorblind/i })
      .first();
    await altPalette.click();

    const after = await firstRect.getAttribute("fill");
    expect(after).not.toBe(before);

    await ctrlZ(page, 1);
    const reverted = await firstRect.getAttribute("fill");
    expect(reverted).toBe(before);
  });

  test("Publication Preset click is ONE undo entry", async ({ page }) => {
    await openDrawer(page, "Publication Preset");
    const svg = page.locator("#chart-studio-svg");
    const w0 = await svg.getAttribute("width");

    const preset = page
      .locator(".cs-tool-btn")
      .filter({ hasText: /Nature|Cell|Science|Lancet/i })
      .first();
    if ((await preset.count()) === 0) test.skip();
    await preset.click();

    // The preset changes something visible — at minimum the active-button state.
    await expect(preset).toHaveClass(/cs-tool-btn-active/);

    await ctrlZ(page, 1);
    // After one undo, the preset should no longer be marked active.
    await expect(preset).not.toHaveClass(/cs-tool-btn-active/);
    // SVG width should also have reverted to its original value.
    await expect(svg).toHaveAttribute("width", w0 || "");
  });

  // ─ InlineTextEditor rect-anchored positioning ─────────────────────────

  test("Double-click title → editor appears near the title, not middle-right of viewport", async ({ page }) => {
    const titleEl = page.locator('[data-element-key="title"]').first();
    await titleEl.waitFor({ state: "visible" });
    const titleBox = await titleEl.boundingBox();
    expect(titleBox).not.toBeNull();

    // Trigger double-click (the handler captures e.currentTarget.getBoundingClientRect)
    await titleEl.dblclick();

    const editor = page.locator('[data-editor-inline]');
    await editor.waitFor({ state: "visible", timeout: 3000 });
    const editorBox = await editor.boundingBox();
    expect(editorBox).not.toBeNull();

    // Horizontal: editor's center must be within a reasonable distance of the
    // title's center. (Editor is 320px wide; title is shorter, so the editor
    // center should be within ~160px of title center, assuming no clamp.)
    const titleCenterX = titleBox!.x + titleBox!.width / 2;
    const editorCenterX = editorBox!.x + editorBox!.width / 2;
    const dx = Math.abs(editorCenterX - titleCenterX);
    expect(dx).toBeLessThan(200); // very loose — just rule out "middle-right" failure mode

    // Vertical: editor must be NEAR the title — either placed above (editor
    // bottom edge is just above title top) OR just below it. Not hundreds of
    // pixels away in either direction.
    const editorBottom = editorBox!.y + editorBox!.height;
    const nearAbove = Math.abs(editorBottom - titleBox!.y) < 80;
    const nearBelow = Math.abs(editorBox!.y - (titleBox!.y + titleBox!.height)) < 80;
    expect(nearAbove || nearBelow).toBe(true);
  });

  test("Double-click title → editor dismisses on Escape without committing", async ({ page }) => {
    // First, set a known starting title via the Chart drawer
    await openDrawer(page, "Chart");
    const titleInput = page.locator('input.cs-props-input').first();
    await titleInput.fill("Original Title");
    await expect(page.locator('[data-element-key="title"]')).toContainText("Original Title");

    const titleEl = page.locator('[data-element-key="title"]').first();
    await titleEl.dblclick();
    const editor = page.locator('[data-editor-inline] [contenteditable]');
    await editor.waitFor({ state: "visible" });
    await editor.click();
    await page.keyboard.type(" DRAFT");
    await page.keyboard.press("Escape");

    // Escape should cancel — title should still say "Original Title"
    await expect(page.locator('[data-element-key="title"]')).toContainText("Original Title");
    await expect(page.locator('[data-element-key="title"]')).not.toContainText("DRAFT");
  });

  test("Double-click title → Enter commits new value and closes editor", async ({ page }) => {
    await openDrawer(page, "Chart");
    await page.locator('input.cs-props-input').first().fill("Baseline");
    await expect(page.locator('[data-element-key="title"]')).toContainText("Baseline");

    const titleEl = page.locator('[data-element-key="title"]').first();
    await titleEl.dblclick();
    const editable = page.locator('[data-editor-inline] [contenteditable]');
    await editable.waitFor({ state: "visible" });
    await editable.click();
    // Select-all then type replaces, then Enter commits
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Committed");
    await page.keyboard.press("Enter");

    await expect(page.locator('[data-editor-inline]')).toHaveCount(0);
    await expect(page.locator('[data-element-key="title"]')).toContainText("Committed");
  });
});
