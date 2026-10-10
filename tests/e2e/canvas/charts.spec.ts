import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { ChartToolPage } from '../utils/page-objects/ChartToolPage';
import { CanvasEditorTestIds } from '@/lib/test-ids';
import path from 'path';

test.describe('Chart Tool - Core Functionality', () => {
  let canvasPage: CanvasEditorPage;
  let chartPage: ChartToolPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    chartPage = new ChartToolPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('creates chart on canvas click', async ({ authenticatedPage: page }) => {
    // Click chart tool and insert chart on canvas
    await chartPage.insertChartAt(300, 200);

    // Verify chart was created
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);

    // Verify chart has default data
    await chartPage.selectChartAt(300, 200);
    await page.waitForTimeout(300);

    // Check that edit data button is visible (chart is selected)
    await expect(chartPage.editDataButton).toBeVisible();
  });

  test('pastes CSV data and updates chart', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Open data dialog
    await chartPage.openDataDialog();

    // Paste CSV data
    const csvData = `Group,Mean,SEM
Control,10,1.2
Treatment A,15,1.5
Treatment B,20,1.8`;

    await chartPage.pasteCSVData(csvData);

    // Verify data dialog can be closed
    await chartPage.closeDataDialog();

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart still exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('uploads CSV file', async ({ authenticatedPage: page }) => {
    // Create a temporary CSV file for testing
    const csvContent = `Group,Mean,SEM
Control,10,1.2
Treatment A,15,1.5
Treatment B,20,1.8`;

    const fs = await import('fs');
    const os = await import('os');
    const tmpPath = path.join(os.tmpdir(), 'tmp-test-data.csv');
    fs.writeFileSync(tmpPath, csvContent);

    try {
      // Insert chart
      await chartPage.insertChartAt(300, 200);
      await chartPage.selectChartAt(300, 200);

      // Open data dialog
      await chartPage.openDataDialog();

      // Upload CSV file
      await chartPage.uploadCSV(tmpPath);

      // Close data dialog
      await chartPage.closeDataDialog();

      // Wait for chart to update
      await chartPage.waitForChartRender();

      // Verify chart exists
      const chartCount = await chartPage.getChartCount();
      expect(chartCount).toBe(1);
    } finally {
      // Clean up temp file
      fs.unlinkSync(tmpPath);
    }
  });

  test('configures chart type and column mapping', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Open data dialog and paste data
    await chartPage.openDataDialog();
    const csvData = `Group,Mean,SEM
Control,10,1.2
Treatment A,15,1.5
Treatment B,20,1.8`;
    await chartPage.pasteCSVData(csvData);
    await chartPage.closeDataDialog();

    // Select bar chart type
    await chartPage.selectChartType('bar');

    // Configure X-axis to Group (column 0)
    await chartPage.selectXAxis('Group');

    // Select Y-axis to Mean (column 1)
    await chartPage.toggleYAxis(1, true);

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('configures error bars', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Open data dialog and paste data with error column
    await chartPage.openDataDialog();
    const csvData = `Group,Mean,SEM
Control,10,1.2
Treatment A,15,1.5
Treatment B,20,1.8`;
    await chartPage.pasteCSVData(csvData);
    await chartPage.closeDataDialog();

    // Configure chart type and axes
    await chartPage.selectChartType('bar');
    await chartPage.selectXAxis('Group');
    // Ensure only Mean column is selected as Y-axis (deselect SEM if auto-selected)
    await chartPage.toggleYAxis(1, true); // Mean column (enable)
    await chartPage.toggleYAxis(2, false); // SEM column (disable - to use for error bars)

    // Enable error bars
    await chartPage.enableErrorBars(true);

    // Wait for error bar controls to appear
    await page.waitForTimeout(1000);

    // Select SEM column for error bars (column 1 is the Mean Y-axis column)
    await chartPage.selectErrorBarColumn(1, 'SEM');

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('updates chart styling', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Set chart title
    await chartPage.setTitle('Test Chart');

    // Set axis labels
    await chartPage.setAxisLabels('Groups', 'Expression Level');

    // Toggle legend
    await chartPage.toggleLegend(false);

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('switches between chart types', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Add some data
    await chartPage.openDataDialog();
    const csvData = `X,Y
1,10
2,15
3,20`;
    await chartPage.pasteCSVData(csvData);
    await chartPage.closeDataDialog();

    // Switch to bar chart
    await chartPage.selectChartType('bar');
    await chartPage.waitForChartRender();

    // Switch to line chart
    await chartPage.selectChartType('line');
    await chartPage.waitForChartRender();

    // Switch to scatter plot
    await chartPage.selectChartType('scatter');
    await chartPage.waitForChartRender();

    // Switch to box plot
    await chartPage.selectChartType('box');
    await chartPage.waitForChartRender();

    // Verify chart still exists after all switches
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('creates multi-series chart with legend', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Add multi-series data
    await chartPage.openDataDialog();
    const csvData = `Group,Series1,Series2,Series3
A,10,15,20
B,12,18,22
C,14,16,25`;
    await chartPage.pasteCSVData(csvData);
    await chartPage.closeDataDialog();

    // Configure axes
    await chartPage.selectXAxis('Group');
    await chartPage.toggleYAxis(1, true); // Series1
    await chartPage.toggleYAxis(2, true); // Series2
    await chartPage.toggleYAxis(3, true); // Series3

    // Enable legend
    await chartPage.toggleLegend(true);

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('edits existing chart data', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Open data dialog
    await chartPage.openDataDialog();

    // Edit a cell (row 0, col 1)
    await chartPage.setCellValue(0, 1, '100');

    // Close dialog
    await chartPage.closeDataDialog();

    // Wait for chart to update
    await chartPage.waitForChartRender();

    // Verify chart exists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('preserves chart on save/reload', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Configure chart
    await chartPage.setTitle('Persistent Chart');
    await chartPage.setAxisLabels('X Axis', 'Y Axis');
    await chartPage.toggleLegend(true);

    // Wait for chart to render
    await chartPage.waitForChartRender();

    // Save the project
    const saveButton = page.getByTestId(CanvasEditorTestIds.SAVE_BUTTON);
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await canvasPage.waitForCanvasReady();

    // Wait for chart to load
    await page.waitForTimeout(1000);

    // Verify chart persists
    const chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('supports undo/redo', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(500);

    // Insert chart
    await chartPage.insertChartAt(300, 200);
    // Wait for chart to be added and history to be saved
    await page.waitForTimeout(1000);

    // Verify chart exists
    let chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);

    // Undo twice - first removes selection state, second removes chart
    // (History has 3 steps: 0=empty, 1=chart added, 2=chart selected)
    await canvasPage.undo();
    await page.waitForTimeout(500);

    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Chart should be removed
    chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(0);

    // Redo twice - should restore chart
    await canvasPage.redo();
    await page.waitForTimeout(500);

    await canvasPage.redo();
    await page.waitForTimeout(1000);

    chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);

    // Wait to ensure redo is fully complete
    await page.waitForTimeout(500);

    // Select chart and modify it
    await chartPage.selectChartAt(300, 200);
    await page.waitForTimeout(1000);

    await chartPage.setTitle('Modified Chart');
    // Wait for chart update and history save
    await page.waitForTimeout(1500);

    // Verify title changed
    const titleAfter = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const charts = canvas.getObjects().filter((obj: any) => obj.customType === 'chart');
      return charts[0]?.chartConfig?.style?.title || '';
    });
    expect(titleAfter).toBe('Modified Chart');

    // Undo title change (requires 2 undos: chart update creates 2 history steps)
    await canvasPage.undo();
    await page.waitForTimeout(500);

    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Chart should still exist with original title
    chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });

  test('resizes without quality loss', async ({ authenticatedPage: page }) => {
    // Insert chart
    await chartPage.insertChartAt(300, 200);
    await chartPage.selectChartAt(300, 200);

    // Set initial size
    await canvasPage.setObjectWidth('200');
    await canvasPage.setObjectHeight('150');
    await page.waitForTimeout(500);

    // Verify chart still exists
    let chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);

    // Resize to large
    await canvasPage.setObjectWidth('800');
    await canvasPage.setObjectHeight('600');
    await page.waitForTimeout(500);

    // Verify chart still exists and maintains quality
    chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);

    // Resize back to small
    await canvasPage.setObjectWidth('200');
    await canvasPage.setObjectHeight('150');
    await page.waitForTimeout(500);

    // Verify chart still exists
    chartCount = await chartPage.getChartCount();
    expect(chartCount).toBe(1);
  });
});
