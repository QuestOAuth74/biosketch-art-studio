import { test, expect } from '../fixtures/admin-auth';
import { AdminTestIds } from '@/lib/test-ids';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Icon Tagging CSV Import/Export', () => {
  test.describe.configure({ timeout: 180000 });
  const testCSVPath = path.join(__dirname, '../fixtures/test-tags.csv');

  test.beforeEach(async ({ adminPage }) => {
    // Navigate to admin page
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(1000);

    // Navigate to Manage Icons section by clicking it in the sidebar
    const manageIconsLink = adminPage.getByRole('button', { name: 'Manage Icons' });
    await manageIconsLink.click();
    await adminPage.waitForTimeout(1500);
  });

  test.afterEach(async () => {
    // Clean up any test CSV files
    if (fs.existsSync(testCSVPath)) {
      fs.unlinkSync(testCSVPath);
    }
  });

  test('CSV Export downloads file with correct format', async ({ adminPage }) => {
    // Click Export Tags CSV button using test ID
    const downloadPromise = adminPage.waitForEvent('download', { timeout: 60000 });
    const exportButton = adminPage.getByTestId(AdminTestIds.CSV_EXPORT_BUTTON);
    await exportButton.click();
    const download = await downloadPromise;

    // Verify download occurred
    expect(download).toBeTruthy();

    // Verify filename format: icon-tags-YYYY-MM-DDTHH-mm-ss.csv
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^icon-tags-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);

    // Save and parse CSV
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const csvContent = fs.readFileSync(downloadPath!, 'utf-8');
    const lines = csvContent.split('\n');

    // Verify headers
    const headers = lines[0].split(',');
    expect(headers).toContain('id');
    expect(headers).toContain('name');
    expect(headers).toContain('category');
    expect(headers.some(h => h.includes('tag'))).toBe(true);

    // Verify at least one data row exists
    expect(lines.length).toBeGreaterThan(1);
  });

  test('CSV Import updates database', async ({ adminPage }) => {
    // First export to get baseline
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.getByTestId(AdminTestIds.CSV_EXPORT_BUTTON).click();
    const exportDownload = await downloadPromise;
    const exportPath = await exportDownload.path();
    const csvContent = fs.readFileSync(exportPath!, 'utf-8');

    // Modify CSV: add unique test tag
    const uniqueTag = `e2e_test_${Date.now()}`;
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Parse CSV properly (handle quoted fields)
    const parseCSVLine = (line: string) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current);
      return fields;
    };

    // Modify first data row to replace tag1 with test tag
    if (lines.length > 1) {
      const headers = parseCSVLine(lines[0]);
      const firstRow = parseCSVLine(lines[1]);

      // Find tag1 column index
      const tag1Index = headers.findIndex(h => h.trim().toLowerCase() === 'tag1');

      if (tag1Index !== -1) {
        firstRow[tag1Index] = uniqueTag;
      }

      // Rebuild CSV
      const modifiedCSV = `${lines[0]}\n${firstRow.map(f => f.includes(',') ? `"${f}"` : f).join(',')}`;
      fs.writeFileSync(testCSVPath, modifiedCSV);

      console.log('Modified CSV content:', modifiedCSV);

      // Import the modified CSV - clicking the button triggers file chooser
      const fileChooserPromise = adminPage.waitForEvent('filechooser');
      const importButton = adminPage.getByTestId(AdminTestIds.CSV_IMPORT_BUTTON);
      await importButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(testCSVPath);
      await adminPage.waitForTimeout(1000);

      // Navigate through column mapping - click "Continue to Preview"
      const continueButton = adminPage.getByRole('button', { name: /continue.*preview/i });
      await continueButton.click();

      // Check for error toasts
      const errorToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /error|fail/i });
      const hasError = await errorToast.isVisible().catch(() => false);
      if (hasError) {
        const errorMsg = await errorToast.textContent();
        console.log('Error toast:', errorMsg);
      }

      // Wait for preview dialog (validation can take time)
      await adminPage.getByText('Preview CSV Import').waitFor({ state: 'visible', timeout: 45000 });
      await adminPage.waitForTimeout(1000);

      // Confirm import from preview dialog - button says "Import X Update(s)"
      const confirmButton = adminPage.getByRole('button', { name: /import.*update/i });
      await confirmButton.click();
      await adminPage.waitForTimeout(3000);

      // Verify success message shows the update count
      const successToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /success/i });
      await successToast.waitFor({ state: 'visible', timeout: 5000 });
      const successMsg = await successToast.textContent();
      expect(successMsg).toBeTruthy();
      expect(successMsg?.toLowerCase()).toContain('1');
    }
  });

  test('Invalid CSV format shows error', async ({ adminPage }) => {
    // Create invalid CSV (wrong headers - no id/name column)
    const invalidCSV = 'wrong,headers,only\ndata1,data2,data3';
    fs.writeFileSync(testCSVPath, invalidCSV);

    // Try to import
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    const importButton = adminPage.getByTestId(AdminTestIds.CSV_IMPORT_BUTTON);
    await importButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testCSVPath);
    await adminPage.waitForTimeout(1000);

    // Verify column mapping dialog appears
    const mappingDialog = adminPage.getByRole('dialog', { name: /map csv columns/i });
    await mappingDialog.waitFor({ state: 'visible', timeout: 5000 });

    // Verify error alert in dialog
    const errorAlert = mappingDialog.locator('[role="alert"]');
    await errorAlert.waitFor({ state: 'visible', timeout: 5000 });
    const errorMsg = await errorAlert.textContent();
    expect(errorMsg).toBeTruthy();
    expect(errorMsg?.toLowerCase()).toMatch(/select.*id.*name.*column/i);

    // Verify Continue button is disabled
    const continueButton = mappingDialog.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeDisabled();
  });

  test('Preview shows changes before import', async ({ adminPage }) => {
    // Export baseline
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.getByTestId(AdminTestIds.CSV_EXPORT_BUTTON).click();
    const exportDownload = await downloadPromise;
    const exportPath = await exportDownload.path();
    const csvContent = fs.readFileSync(exportPath!, 'utf-8');

    // Modify 3 icons
    const lines = csvContent.split('\n').filter(line => line.trim());

    const parseCSVLine = (line: string) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current);
      return fields;
    };

    const headers = parseCSVLine(lines[0]);
    const tag1Index = headers.findIndex(h => h.trim().toLowerCase() === 'tag1');

    // Modify first 3 data rows
    const modifiedRows = [];
    for (let i = 1; i <= 3 && i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (tag1Index !== -1) {
        row[tag1Index] = `preview_test_${i}_${Date.now()}`;
      }
      modifiedRows.push(row.map(f => f.includes(',') ? `"${f}"` : f).join(','));
    }

    const modifiedCSV = `${lines[0]}\n${modifiedRows.join('\n')}`;
    fs.writeFileSync(testCSVPath, modifiedCSV);

    // Import
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    const importButton = adminPage.getByTestId(AdminTestIds.CSV_IMPORT_BUTTON);
    await importButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testCSVPath);
    await adminPage.waitForTimeout(1000);

    // Navigate column mapping
    const continueButton = adminPage.getByRole('button', { name: /continue.*preview/i });
    await continueButton.click();

    // Check for error toasts
    const errorToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /error|fail/i });
    const hasError = await errorToast.isVisible().catch(() => false);
    if (hasError) {
      const errorMsg = await errorToast.textContent();
      console.log('Error toast:', errorMsg);
    }

    // Wait for preview dialog (validation can take time)
    const previewDialog = adminPage.getByRole('dialog').filter({ hasText: /preview csv import/i });
    await previewDialog.waitFor({ state: 'visible', timeout: 75000 });
    await adminPage.waitForTimeout(1000);

    // Verify preview shows "3" updates - look for the button with count
    const validUpdatesButton = previewDialog.getByRole('button', { name: /3.*valid.*update/i });
    await expect(validUpdatesButton).toBeVisible();
    const buttonText = await validUpdatesButton.textContent();
    expect(buttonText).toBeTruthy();
    expect(buttonText?.toLowerCase()).toContain('3');

    // Cancel without importing
    const cancelButton = adminPage.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
  });

  test('Success message shows update count', async ({ adminPage }) => {
    // Export baseline
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.getByTestId(AdminTestIds.CSV_EXPORT_BUTTON).click();
    const exportDownload = await downloadPromise;
    const exportPath = await exportDownload.path();
    const csvContent = fs.readFileSync(exportPath!, 'utf-8');

    // Modify 2 icons
    const lines = csvContent.split('\n').filter(line => line.trim());

    const parseCSVLine = (line: string) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current);
      return fields;
    };

    const headers = parseCSVLine(lines[0]);
    const tag1Index = headers.findIndex(h => h.trim().toLowerCase() === 'tag1');

    // Modify first 2 data rows
    const modifiedRows = [];
    for (let i = 1; i <= 2 && i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (tag1Index !== -1) {
        row[tag1Index] = `success_count_${i}_${Date.now()}`;
      }
      modifiedRows.push(row.map(f => f.includes(',') ? `"${f}"` : f).join(','));
    }

    const modifiedCSV = `${lines[0]}\n${modifiedRows.join('\n')}`;
    fs.writeFileSync(testCSVPath, modifiedCSV);

    // Import
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    const importButton = adminPage.getByTestId(AdminTestIds.CSV_IMPORT_BUTTON);
    await importButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testCSVPath);
    await adminPage.waitForTimeout(1000);

    // Navigate column mapping
    const continueButton = adminPage.getByRole('button', { name: /continue.*preview/i });
    await continueButton.click();

    // Wait for preview dialog (validation can take time)
    await adminPage.getByText('Preview CSV Import').waitFor({ state: 'visible', timeout: 75000 });
    await adminPage.waitForTimeout(1000);

    // Confirm import
    const confirmButton = adminPage.getByRole('button', { name: /import.*update/i });
    await confirmButton.click();
    await adminPage.waitForTimeout(3000);

    // Verify success toast shows "2"
    const successToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /success/i });
    await successToast.waitFor({ state: 'visible', timeout: 5000 });
    const successMsg = await successToast.textContent();
    expect(successMsg).toBeTruthy();
    expect(successMsg?.toLowerCase()).toContain('2');
  });

  test('Tags appear in search immediately after import', async ({ adminPage }) => {
    // Export baseline
    const uniqueTag = `immediate_search_${Date.now()}`;
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.getByTestId(AdminTestIds.CSV_EXPORT_BUTTON).click();
    const exportDownload = await downloadPromise;
    const exportPath = await exportDownload.path();
    const csvContent = fs.readFileSync(exportPath!, 'utf-8');

    // Modify 1 icon with unique tag
    const lines = csvContent.split('\n').filter(line => line.trim());

    const parseCSVLine = (line: string) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current);
      return fields;
    };

    const headers = parseCSVLine(lines[0]);
    const firstRow = parseCSVLine(lines[1]);
    const tag1Index = headers.findIndex(h => h.trim().toLowerCase() === 'tag1');

    if (tag1Index !== -1) {
      firstRow[tag1Index] = uniqueTag;
    }

    const modifiedCSV = `${lines[0]}\n${firstRow.map(f => f.includes(',') ? `"${f}"` : f).join(',')}`;
    fs.writeFileSync(testCSVPath, modifiedCSV);

    // Import
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    const importButton = adminPage.getByTestId(AdminTestIds.CSV_IMPORT_BUTTON);
    await importButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testCSVPath);
    await adminPage.waitForTimeout(1000);

    // Navigate column mapping
    const continueButton = adminPage.getByRole('button', { name: /continue.*preview/i });
    await continueButton.click();

    // Check for error toasts
    const errorToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /error|fail/i });
    const hasError = await errorToast.isVisible().catch(() => false);
    if (hasError) {
      const errorMsg = await errorToast.textContent();
      console.log('Error toast:', errorMsg);
    }

    // Wait for preview dialog (validation can take time)
    await adminPage.getByText('Preview CSV Import').waitFor({ state: 'visible', timeout: 75000 });
    await adminPage.waitForTimeout(1000);

    // Confirm import
    const confirmButton = adminPage.getByRole('button', { name: /import.*update/i });
    await confirmButton.click();
    await adminPage.waitForTimeout(3000);

    // Wait for success
    const successToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /success/i });
    await successToast.waitFor({ state: 'visible', timeout: 5000 });

    // Navigate to canvas and search
    await adminPage.goto('/canvas');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(2000);

    // Search for the unique tag
    const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
    await searchInput.click();
    await searchInput.fill(uniqueTag);
    await adminPage.waitForTimeout(2000);

    // Verify "1 result" appears
    const resultText = adminPage.getByText(/1 result/i);
    await expect(resultText).toBeVisible({ timeout: 5000 });
  });
});
