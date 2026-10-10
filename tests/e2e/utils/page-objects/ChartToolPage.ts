import { Page, Locator } from '@playwright/test';
import { ChartTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Chart Tool
 * Handles chart creation, data editing, configuration, and styling
 */
export class ChartToolPage {
  readonly page: Page;

  // Toolbar
  readonly chartTool: Locator;

  // Data Dialog
  readonly editDataButton: Locator;
  readonly dataDialog: Locator;
  readonly pasteCSVButton: Locator;
  readonly uploadCSVButton: Locator;
  readonly dataDialogClose: Locator;

  // Type & Mapping
  readonly chartTypeSelect: Locator;
  readonly xAxisSelect: Locator;

  // Style
  readonly titleInput: Locator;
  readonly xAxisLabelInput: Locator;
  readonly yAxisLabelInput: Locator;
  readonly showLegendCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize all locators using test IDs
    this.chartTool = page.getByTestId(ChartTestIds.CHART_TOOL);

    this.editDataButton = page.getByTestId(ChartTestIds.EDIT_DATA_BUTTON);
    this.dataDialog = page.getByTestId(ChartTestIds.DATA_DIALOG);
    this.pasteCSVButton = page.getByTestId(ChartTestIds.PASTE_CSV_BUTTON);
    this.uploadCSVButton = page.getByTestId(ChartTestIds.UPLOAD_CSV_BUTTON);
    this.dataDialogClose = page.getByTestId(ChartTestIds.DATA_DIALOG_CLOSE);

    this.chartTypeSelect = page.getByTestId(ChartTestIds.CHART_TYPE_SELECT);
    this.xAxisSelect = page.getByTestId(ChartTestIds.X_AXIS_SELECT);

    this.titleInput = page.getByTestId(ChartTestIds.TITLE_INPUT);
    this.xAxisLabelInput = page.getByTestId(ChartTestIds.X_AXIS_LABEL_INPUT);
    this.yAxisLabelInput = page.getByTestId(ChartTestIds.Y_AXIS_LABEL_INPUT);
    this.showLegendCheckbox = page.getByTestId(ChartTestIds.SHOW_LEGEND_CHECKBOX);
  }

  /**
   * Click the chart tool button in the toolbar
   */
  async selectChartTool(): Promise<void> {
    await this.chartTool.click();
  }

  /**
   * Insert a chart by clicking at specified coordinates on the canvas
   */
  async insertChartAt(x: number, y: number): Promise<void> {
    await this.selectChartTool();

    // Dismiss any overlays that might intercept clicks
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);

    // Dismiss any visible dialogs or notifications
    const dismissButton = this.page.getByRole('button', { name: /got it|don't show again|dismiss/i });
    if (await dismissButton.isVisible({ timeout: 300 }).catch(() => false)) {
      await dismissButton.click();
      await this.page.waitForTimeout(200);
    }

    // Click on canvas to insert chart using force to bypass overlay checks
    const canvas = this.page.locator('canvas').first();
    await canvas.click({ position: { x, y }, force: true });
    // Wait for chart to be created
    await this.page.waitForTimeout(500);
  }

  /**
   * Open the data editing dialog
   */
  async openDataDialog(): Promise<void> {
    await this.editDataButton.click();
    await this.dataDialog.waitFor({ state: 'visible' });
  }

  /**
   * Close the data editing dialog
   */
  async closeDataDialog(): Promise<void> {
    await this.dataDialogClose.click();
    await this.dataDialog.waitFor({ state: 'hidden' });
  }

  /**
   * Paste CSV data into the chart
   */
  async pasteCSVData(csvText: string): Promise<void> {
    await this.pasteCSVButton.click();

    // Wait for the paste CSV dialog
    const pasteDialog = this.page.locator('[role="dialog"]').last();
    await pasteDialog.waitFor({ state: 'visible' });

    // Find and fill the textarea
    const textarea = pasteDialog.locator('textarea');
    await textarea.fill(csvText);

    // Click the import button
    const importButton = pasteDialog.getByRole('button', { name: /import data/i });
    await importButton.click();

    // Wait for dialog to close
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload a CSV file
   */
  async uploadCSV(filePath: string): Promise<void> {
    // Click the upload button to trigger file input
    await this.uploadCSVButton.click();

    // Set the file in the hidden file input
    const fileInput = this.page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(filePath);

    // Wait for file to be processed
    await this.page.waitForTimeout(500);
  }

  /**
   * Set a cell value in the data table
   */
  async setCellValue(row: number, col: number, value: string): Promise<void> {
    const cellInput = this.page.getByTestId(`${ChartTestIds.DATA_CELL}-${row}-${col}`);
    await cellInput.click();
    await cellInput.fill(value);
    await cellInput.blur();
  }

  /**
   * Select a chart type
   */
  async selectChartType(type: 'bar' | 'line' | 'scatter' | 'box'): Promise<void> {
    await this.chartTypeSelect.click();

    const typeMap = {
      bar: 'Bar Chart',
      line: 'Line Chart',
      scatter: 'Scatter Plot',
      box: 'Box Plot',
    };

    await this.page.getByRole('option', { name: typeMap[type] }).click();
    await this.page.waitForTimeout(500); // Wait for chart to re-render
  }

  /**
   * Select X-axis column
   */
  async selectXAxis(columnName: string): Promise<void> {
    await this.xAxisSelect.click();
    await this.page.getByRole('option', { name: columnName }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle a Y-axis column
   */
  async toggleYAxis(columnIndex: number, checked: boolean): Promise<void> {
    const checkbox = this.page.getByTestId(`${ChartTestIds.Y_AXIS_CHECKBOX}-${columnIndex}`);

    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Enable or disable error bars
   */
  async enableErrorBars(enabled: boolean): Promise<void> {
    const checkbox = this.page.getByTestId(ChartTestIds.ERROR_BARS_CHECKBOX);

    const isChecked = await checkbox.isChecked();
    if (isChecked !== enabled) {
      await checkbox.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Select error bar column for a specific series
   */
  async selectErrorBarColumn(seriesIndex: number, errorColName: string): Promise<void> {
    const select = this.page.getByTestId(`${ChartTestIds.ERROR_BAR_SELECT}-${seriesIndex}`);
    await select.waitFor({ state: 'visible', timeout: 10000 });
    await select.click();
    await this.page.getByRole('option', { name: errorColName }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Set chart title
   */
  async setTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
    await this.page.waitForTimeout(300);
  }

  /**
   * Set axis labels
   */
  async setAxisLabels(xLabel: string, yLabel: string): Promise<void> {
    await this.xAxisLabelInput.fill(xLabel);
    await this.yAxisLabelInput.fill(yLabel);
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle legend visibility
   */
  async toggleLegend(show: boolean): Promise<void> {
    const isChecked = await this.showLegendCheckbox.isChecked();
    if (isChecked !== show) {
      await this.showLegendCheckbox.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get the number of charts on the canvas
   */
  async getChartCount(): Promise<number> {
    // Count chart objects by looking for chart-specific attributes
    const count = await this.page.evaluate(() => {
      const fabricCanvas = (window as any).fabricCanvas;
      if (!fabricCanvas) return 0;

      return fabricCanvas.getObjects().filter((obj: any) => {
        return obj.customType === 'chart';
      }).length;
    });

    return count;
  }

  /**
   * Select a chart at specific coordinates
   */
  async selectChartAt(x: number, y: number): Promise<void> {
    const canvas = this.page.locator('canvas').first();
    await canvas.click({ position: { x, y }, force: true });
    await this.page.waitForTimeout(300);
  }

  /**
   * Wait for chart to render
   */
  async waitForChartRender(): Promise<void> {
    await this.page.waitForTimeout(1000);
  }
}
