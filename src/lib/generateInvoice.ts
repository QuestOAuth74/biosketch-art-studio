import jsPDF from 'jspdf';

// Business details on every generated invoice. Edit here to change global
// header/footer info on all invoices at once. Add VAT/EIN as a new field if
// you need it for reimbursement claims.
const BUSINESS = {
  name: 'BioSketch.Art',
  tagline: 'Scientific illustration platform',
  website: 'https://biosketch.art',
  supportEmail: 'support@biosketch.art',
  addressLines: [
    'BioSketch Illustrator',
    '2136 Ford Parkway, Suite B no. 5111',
    'Saint Paul, MN 55116, USA',
  ],
  logoUrl:
    'https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0',
} as const;

export interface InvoiceData {
  purchaseId: string;
  stripeSessionId: string;
  amountUsd: number;
  generations: number;
  createdAt: string;              // ISO
  customerEmail: string | null;
  customerName: string | null;
}

/**
 * Fetch an image URL and return a base64 data URL — jsPDF's `addImage`
 * accepts data URLs directly. Runs in the browser, uses fetch + FileReader.
 * Returns null on any failure so the caller can fall back to a text-only header.
 */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generate a 1-page PDF invoice for a Stripe purchase and trigger download.
 * Async because we fetch the logo — falls back to a text-only header if the
 * logo can't be loaded so we never block the user from getting their invoice.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 60;

  // ── Header row: logo + business info (left) · INVOICE label (right) ──
  const logoDataUrl = await loadImageAsDataUrl(BUSINESS.logoUrl);

  const logoSize = 44;
  let textStartX = marginX;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, y - 14, logoSize, logoSize);
      textStartX = marginX + logoSize + 14;
    } catch {
      // If jsPDF can't parse it (rare — bad blob), fall back silently.
    }
  }

  // Business name + tagline + website (right of logo)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(BUSINESS.name, textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(BUSINESS.tagline, textStartX, y + 14);
  doc.text(BUSINESS.website, textStartX, y + 26);

  // INVOICE label (right column)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text('INVOICE', pageWidth - marginX, y, { align: 'right' });

  const invoiceNumber = data.purchaseId.slice(0, 8).toUpperCase();
  const invoiceDate = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Invoice #${invoiceNumber}`, pageWidth - marginX, y + 14, { align: 'right' });
  doc.text(invoiceDate, pageWidth - marginX, y + 26, { align: 'right' });

  // Move y below the logo/text block
  y += Math.max(logoSize - 10, 40);

  // ── Business address (below header, small print) ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  BUSINESS.addressLines.forEach((line, i) => {
    doc.text(line, marginX, y + i * 10);
  });
  y += BUSINESS.addressLines.length * 10 + 10;

  // ── Divider ──
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 26;

  // ── Bill To ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('BILL TO', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const customerLine = data.customerName || data.customerEmail || 'Customer';
  doc.text(customerLine, marginX, y + 18);
  if (data.customerName && data.customerEmail) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(data.customerEmail, marginX, y + 30);
    y += 12;
  }

  // Payment status (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 130, 60);
  doc.text('PAID', pageWidth - marginX, y, { align: 'right' });

  y += 60;

  // ── Line items ──
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, y - 14, pageWidth - marginX * 2, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('DESCRIPTION', marginX + 10, y);
  doc.text('QTY', pageWidth - marginX - 130, y, { align: 'right' });
  doc.text('AMOUNT', pageWidth - marginX - 10, y, { align: 'right' });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('AI generation credits', marginX + 10, y);
  doc.text(String(data.generations), pageWidth - marginX - 130, y, { align: 'right' });
  doc.text(`$${Number(data.amountUsd).toFixed(2)}`, pageWidth - marginX - 10, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'Non-expiring credits redeemable across all BioSketch AI features.',
    marginX + 10, y + 12,
  );
  y += 40;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  // ── Total ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('TOTAL', pageWidth - marginX - 130, y, { align: 'right' });
  doc.setFontSize(14);
  doc.text(`$${Number(data.amountUsd).toFixed(2)} USD`, pageWidth - marginX - 10, y, { align: 'right' });

  y += 60;

  // ── Payment reference ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('PAYMENT REFERENCE', marginX, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(data.stripeSessionId, marginX, y + 14);

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 48;
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, footerY - 12, pageWidth - marginX, footerY - 12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Questions? Contact ${BUSINESS.supportEmail}. Thank you for supporting free scientific tooling.`,
    pageWidth / 2, footerY, { align: 'center' },
  );

  const filename = `biosketch-invoice-${invoiceNumber}.pdf`;
  doc.save(filename);
}
