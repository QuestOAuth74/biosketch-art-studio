import { mdToPdf } from 'md-to-pdf';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function convertMarkdownToPdf() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run md-to-pdf <markdown-file>');
    process.exit(1);
  }

  const inputPath = resolve(args[0]);
  const outputPath = args[1]
    ? resolve(args[1])
    : inputPath.replace(/\.md$/, '.pdf');

  console.log(`Converting: ${inputPath}`);
  console.log(`Output: ${outputPath}`);

  try {
    const pdf = await mdToPdf(
      { path: inputPath },
      {
        dest: outputPath,
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            bottom: '20mm',
            left: '20mm',
            right: '20mm'
          }
        },
        stylesheet: [],
        css: `
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 15px;
            line-height: 1.6;
          }
          h1 { font-size: 30px; }
          h2 { font-size: 24px; }
          h3 { font-size: 20px; }
          table {
            font-size: 14px;
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
          }
          code {
            font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
            font-size: 14px;
            background-color: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
          }
        `
      }
    );

    if (pdf) {
      console.log('PDF created successfully!');
    }
  } catch (error) {
    console.error('Error converting markdown to PDF:', error.message);
    process.exit(1);
  }
}

convertMarkdownToPdf();
