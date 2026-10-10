/**
 * Export data to CSV file and trigger browser download
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string
): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV header row
  const csvHeaders = headers.join(',');

  // Create CSV data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Convert to string
      let cellValue = String(value);

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
        cellValue = `"${cellValue.replace(/"/g, '""')}"`;
      }

      return cellValue;
    }).join(',');
  });

  // Combine headers and rows
  const csv = [csvHeaders, ...csvRows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL object
  URL.revokeObjectURL(url);
}

/**
 * Generate timestamped filename for CSV export
 */
export function generateCSVFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.csv`;
}

/**
 * Export icon tags to CSV file
 */
export function exportIconTagsToCSV(icons: Array<{
  id: string;
  name: string;
  category: string;
  tags: string[] | null;
}>): void {
  const exportData = icons.map(icon => ({
    id: icon.id,
    name: icon.name,
    category: icon.category,
    tag1: icon.tags?.[0] || '',
    tag2: icon.tags?.[1] || '',
    tag3: icon.tags?.[2] || '',
    current_tags: JSON.stringify(icon.tags || [])
  }));

  const filename = generateCSVFilename('icon-tags');
  exportToCSV(exportData, filename);
}
