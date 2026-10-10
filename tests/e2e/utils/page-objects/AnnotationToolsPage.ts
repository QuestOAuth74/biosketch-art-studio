import { Page, Locator } from '@playwright/test';
import { AnnotationTestIds, CanvasEditorTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Annotation Tools
 * Handles numbered callouts, leader lines, and legend generation
 */
export class AnnotationToolsPage {
  readonly page: Page;

  readonly dropdownTrigger: Locator;
  readonly calloutTool: Locator;
  readonly leaderLineTool: Locator;
  readonly presetArrowText: Locator;
  readonly presetBracketLabel: Locator;
  readonly legendGeneratorButton: Locator;
  readonly legendOutput: Locator;
  readonly canvasElement: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dropdownTrigger = page.getByTestId(AnnotationTestIds.DROPDOWN_TRIGGER);
    this.calloutTool = page.getByTestId(AnnotationTestIds.CALLOUT_TOOL);
    this.leaderLineTool = page.getByTestId(AnnotationTestIds.LEADER_LINE_TOOL);
    this.presetArrowText = page.getByTestId(AnnotationTestIds.PRESET_ARROW_TEXT);
    this.presetBracketLabel = page.getByTestId(AnnotationTestIds.PRESET_BRACKET_LABEL);
    this.legendGeneratorButton = page.getByTestId(AnnotationTestIds.LEGEND_GENERATOR_BUTTON);
    this.legendOutput = page.getByTestId(AnnotationTestIds.LEGEND_OUTPUT);
    this.canvasElement = page.getByTestId(CanvasEditorTestIds.CANVAS_ELEMENT);
  }

  /**
   * Add numbered callout to canvas
   * @param x X coordinate relative to canvas
   * @param y Y coordinate relative to canvas
   */
  async addCallout(x: number, y: number): Promise<void> {
    // Open annotation tools dropdown
    await this.dropdownTrigger.click();
    await this.page.waitForTimeout(200);

    // Click the numbered callout tool
    await this.calloutTool.click();

    // Wait for tool to activate
    await this.page.waitForTimeout(300);

    // Wait for canvas to be visible and stable
    await this.canvasElement.waitFor({ state: 'visible' });

    const box = await this.canvasElement.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await this.page.mouse.click(box.x + x, box.y + y);
  }

  /**
   * Get callout number element
   * @param index Callout index
   */
  getCalloutNumber(index: number): Locator {
    return this.page.getByTestId(`${AnnotationTestIds.CALLOUT_NUMBER}-${index}`);
  }

  /**
   * Create leader line
   * @param startX Start x coordinate (label position)
   * @param startY Start y coordinate (label position)
   * @param endX End x coordinate (arrow destination)
   * @param endY End y coordinate (arrow destination)
   * @param text Text label for leader line (optional, not currently used as label is editable after creation)
   */
  async createLeaderLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    text: string
  ): Promise<void> {
    // Open annotation tools dropdown
    await this.dropdownTrigger.click();
    await this.page.waitForTimeout(200);

    // Click the leader line tool
    await this.leaderLineTool.click();

    // Wait for tool to activate
    await this.page.waitForTimeout(300);

    // Wait for canvas to be visible and stable
    await this.canvasElement.waitFor({ state: 'visible' });

    const box = await this.canvasElement.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Leader line tool requires TWO CLICKS:
    // 1. First click: place label
    await this.page.mouse.click(box.x + startX, box.y + startY);
    await this.page.waitForTimeout(500);

    // 2. Second click: place arrow destination
    await this.page.mouse.click(box.x + endX, box.y + endY);
    await this.page.waitForTimeout(500);
  }

  /**
   * Apply annotation preset
   * @param preset Preset type ('arrow-text' | 'bracket-label')
   */
  async applyPreset(preset: 'arrow-text' | 'bracket-label'): Promise<void> {
    if (preset === 'arrow-text') {
      await this.presetArrowText.click();
    } else {
      await this.presetBracketLabel.click();
    }
  }

  /**
   * Generate legend
   */
  async generateLegend(): Promise<void> {
    await this.legendGeneratorButton.click();
  }

  /**
   * Get legend output text
   * @returns Legend text content
   */
  async getLegendText(): Promise<string | null> {
    return await this.legendOutput.textContent();
  }

  /**
   * Count callouts on canvas
   * @returns Number of callouts
   */
  async getCalloutCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return 0;

      const objects = canvas.getObjects();
      return objects.filter((obj: any) => obj.customType === 'numbered-callout').length;
    });
  }
}
