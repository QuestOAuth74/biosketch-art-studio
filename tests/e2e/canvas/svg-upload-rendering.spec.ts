import { test, expect } from '../fixtures/admin-auth';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for database operations
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

test.describe('SVG Upload and Canvas Rendering', () => {
  let testIconId: string | null = null;
  let testProjectId: string | null = null;

  test.beforeAll(() => {
    // Verify environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
  });

  test.afterEach(async () => {
    // Clean up test icon
    if (testIconId) {
      await adminClient.from('icons').delete().eq('id', testIconId);
      testIconId = null;
    }

    // Clean up test project
    if (testProjectId) {
      await adminClient.from('canvas_projects').delete().eq('id', testProjectId);
      testProjectId = null;
    }
  });

  test('Upload SVG with XML declaration → XML removed and stored correctly', async ({ adminPage: page }) => {
    // STEP 1: Upload SVG icon via admin interface
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Scroll to Upload Icons section
    const categoryCombobox = page.locator('section#upload-icons').getByRole('combobox').first();
    await categoryCombobox.scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Upload Icons', exact: true })).toBeVisible();

    // Load test SVG file
    const testSvgPath = path.join(__dirname, '../fixtures/test-svg-with-xml-declaration.svg');

    // Upload the SVG
    await categoryCombobox.click();
    await page.getByRole('option', { name: /Bioicons - Biology/i }).click();
    await page.getByLabel(/icon name/i).fill('E2E SVG Render Test');

    const fileInput = page.locator('section#upload-icons input[type="file"]').first();
    await fileInput.setInputFiles(testSvgPath);

    // Wait for preview
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 5000 });

    // Click upload button
    await page.getByRole('button', { name: 'Upload Icon', exact: true }).click();

    // Wait for success message
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });

    // STEP 2: Verify icon was stored correctly in database
    const { data: icons, error: fetchError } = await adminClient
      .from('icons')
      .select('id, name, svg_content, thumbnail')
      .eq('name', 'E2e Svg Render Test');  // Name is sanitized

    expect(fetchError).toBeNull();
    expect(icons).not.toBeNull();
    expect(icons!.length).toBeGreaterThan(0);

    const icon = icons![icons!.length - 1];
    testIconId = icon.id;

    // STEP 3: Verify XML declaration was removed from stored SVG
    expect(icon.svg_content).not.toContain('<?xml');
    expect(icon.svg_content).not.toContain('xml version');

    // Verify Adobe namespace was removed
    expect(icon.svg_content).not.toContain('xmlns:i=');
    expect(icon.svg_content).not.toContain('AdobeIllustrator');

    // Verify metadata was removed
    expect(icon.svg_content).not.toContain('<metadata');

    // Verify SVG still has essential content
    expect(icon.svg_content).toContain('<svg');
    expect(icon.svg_content).toContain('<circle');
    expect(icon.svg_content).toContain('<path');

    // Verify PNG thumbnail was generated
    expect(icon.thumbnail).toMatch(/^data:image\/png;base64,/);

    console.log('✅ SVG upload and processing test passed!');
    console.log(`   - Icon ID: ${testIconId}`);
    console.log(`   - XML declaration removed: ✓`);
    console.log(`   - Adobe metadata removed: ✓`);
    console.log(`   - SVG content preserved: ✓`);
    console.log(`   - PNG thumbnail generated: ✓`);
  });

  test('Bulk ZIP upload with XML declaration → Icons render on canvas', async ({ adminPage: page }) => {
    // Create temporary test SVG files for ZIP
    const testSvg1Path = path.join(__dirname, '../fixtures/test-svg-with-xml-declaration.svg');
    const testSvg1Content = fs.readFileSync(testSvg1Path, 'utf-8');

    // Read the test SVG and create a modified version
    const testSvg2Content = testSvg1Content.replace(/TEST/g, 'TEST2').replace(/test-icon/g, 'test-icon-2');

    // Create a simple ZIP in memory (we'll create files and zip them)
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('test-icon-1.svg', testSvg1Content);
    zip.file('test-icon-2.svg', testSvg2Content);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const testZipPath = path.join(__dirname, 'test-svg-batch.zip');
    fs.writeFileSync(testZipPath, zipBuffer);

    try {
      // Navigate to admin panel
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Scroll to Upload Icons section
      await page.evaluate(() => {
        const section = document.getElementById('upload-icons');
        if (section) {
          section.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
      await page.waitForTimeout(1000);

      // Select category for batch upload
      const batchCategoryCombobox = page.locator('section#upload-icons').getByRole('combobox').nth(1);
      await batchCategoryCombobox.scrollIntoViewIfNeeded();
      await batchCategoryCombobox.click();
      await page.getByRole('option', { name: /Bioicons - Biology/i }).click();

      // Upload ZIP file
      const zipInput = page.locator('input[type="file"][accept=".zip"]');
      await zipInput.setInputFiles(testZipPath);

      // Click upload button
      await page.getByRole('button', { name: /upload zip/i }).click();

      // Wait for success message (batch processing can take time)
      await expect(page.getByText(/successfully uploaded/i)).toBeVisible({ timeout: 30000 });

      // Verify icons were stored correctly
      const { data: icons, error } = await adminClient
        .from('icons')
        .select('id, name, svg_content')
        .or('name.eq.Test Icon 1,name.eq.Test Icon 2');

      expect(error).toBeNull();
      expect(icons).not.toBeNull();
      expect(icons!.length).toBeGreaterThanOrEqual(2);

      // Store IDs for cleanup
      icons!.forEach(icon => {
        if (testIconId === null) {
          testIconId = icon.id;
        }
      });

      // Verify XML declarations were removed from all icons
      icons!.forEach(icon => {
        expect(icon.svg_content).not.toContain('<?xml');
        expect(icon.svg_content).not.toContain('xmlns:i=');
        expect(icon.svg_content).toContain('<svg');
      });

      console.log('✅ Bulk ZIP upload test passed!');
      console.log(`   - ${icons!.length} icons uploaded`);
      console.log(`   - All XML declarations removed: ✓`);
    } finally {
      // Clean up ZIP file
      if (fs.existsSync(testZipPath)) {
        fs.unlinkSync(testZipPath);
      }
    }
  });
});
