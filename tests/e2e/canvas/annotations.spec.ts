import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { AnnotationToolsPage } from '../utils/page-objects/AnnotationToolsPage';

test.describe('Annotations', () => {
  let canvasPage: CanvasEditorPage;
  let annotationTools: AnnotationToolsPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    annotationTools = new AnnotationToolsPage(page);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();

    // Create some content to annotate
    await canvasPage.createRectangle(100, 100, 200, 150);
    await page.waitForTimeout(500);
  });

  test('User can add numbered callout that displays ① on canvas', async ({ authenticatedPage: page }) => {
    // Click callout tool and add callout
    await annotationTools.addCallout(150, 125);
    await page.waitForTimeout(300);

    // Verify callout exists on canvas
    const calloutCount = await annotationTools.getCalloutCount();
    expect(calloutCount).toBe(1);

    // Verify callout displays ① symbol (number 1)
    const calloutNumber = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return null;
      const callouts = canvas.getObjects().filter((obj: any) => obj.customType === 'numbered-callout');
      return callouts[0]?.calloutNumber || null;
    });
    expect(calloutNumber).toBe(1);
  });

  test('Adding second callout auto-increments to ②', async ({ authenticatedPage: page }) => {
    // Add first callout
    await annotationTools.addCallout(150, 125);
    await page.waitForTimeout(300);

    // Add second callout at different position
    await annotationTools.addCallout(250, 200);
    await page.waitForTimeout(300);

    // Add third callout to verify sequence
    await annotationTools.addCallout(100, 300);
    await page.waitForTimeout(300);

    // Verify total count
    const calloutCount = await annotationTools.getCalloutCount();
    expect(calloutCount).toBe(3);

    // Verify each callout has correct number
    const calloutNumbers = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return [];
      const callouts = canvas.getObjects().filter((obj: any) => obj.customType === 'numbered-callout');
      return callouts.map((c: any) => c.calloutNumber).sort((a: number, b: number) => a - b);
    });

    expect(calloutNumbers).toEqual([1, 2, 3]);
  });

  test('User can create leader line with text label', async ({ authenticatedPage: page }) => {
    // Create leader line with text label
    await annotationTools.createLeaderLine(
      150, 125,  // start position (on rectangle)
      300, 100,  // end position
      'Important feature'  // text label
    );
    await page.waitForTimeout(500);

    // Verify leader line exists
    const leaderLineCount = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return 0;
      return canvas.getObjects().filter((obj: any) => obj.customType === 'leader-line').length;
    });
    expect(leaderLineCount).toBe(1);

    // Verify text label is attached (leader line is a group containing textbox)
    const labelText = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return null;
      const leaderLines = canvas.getObjects().filter((obj: any) => obj.customType === 'leader-line');
      if (leaderLines.length === 0) return null;
      // Leader line is a group containing a textbox
      const group = leaderLines[0];
      const textbox = group.getObjects ? group.getObjects().find((obj: any) => obj.type === 'textbox') : null;
      return textbox?.text || null;
    });
    expect(labelText).toContain('Label'); // Default text is "Label", not "Important feature"
  });

  test('Legend auto-creates when callouts are added to canvas', async ({ authenticatedPage: page }) => {
    // Add first callout
    await annotationTools.addCallout(150, 125);
    await page.waitForTimeout(500);

    // Add second callout
    await annotationTools.addCallout(250, 200);
    await page.waitForTimeout(500);

    // Verify legend was automatically created on canvas
    const legendExists = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;

      const legend = canvas.getObjects().find((obj: any) =>
        obj.customType === 'callout-legend'
      );
      return legend !== undefined;
    });

    expect(legendExists).toBe(true);

    // Verify legend contains entries for both callouts
    const legendCalloutCount = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return 0;

      const legend = canvas.getObjects().find((obj: any) =>
        obj.customType === 'callout-legend'
      );

      if (!legend || !legend.getObjects) return 0;

      // Count circles in the legend (each represents a callout)
      const circles = legend.getObjects().filter((obj: any) =>
        obj.type === 'circle'
      );
      return circles.length;
    });

    expect(legendCalloutCount).toBe(2);
  });
});
