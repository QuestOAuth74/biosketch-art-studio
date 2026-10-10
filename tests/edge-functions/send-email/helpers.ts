/**
 * Helper utilities for send-email edge function tests
 * Provides functions to validate email templates and extract data
 */

/**
 * Extract confirmation URL from HTML email
 */
export function extractConfirmationUrl(html: string): string | null {
  // Match href attribute in anchor tags
  const hrefMatch = html.match(/href="([^"]+)"/);
  if (hrefMatch && hrefMatch[1]) {
    return hrefMatch[1];
  }

  // Match raw URLs
  const urlMatch = html.match(/https?:\/\/[^\s<>"]+/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Parse confirmation URL to extract token and type
 */
export function parseConfirmationUrl(url: string): {
  token: string | null;
  type: string | null;
  redirectTo: string | null;
} {
  try {
    const urlObj = new URL(url);
    return {
      token: urlObj.searchParams.get('token'),
      type: urlObj.searchParams.get('type'),
      redirectTo: urlObj.searchParams.get('redirect_to'),
    };
  } catch {
    return {
      token: null,
      type: null,
      redirectTo: null,
    };
  }
}

/**
 * Validate email HTML contains expected content
 */
export function validateEmailHtml(html: string, expectedContent: {
  heading?: string;
  buttonText?: string;
  email?: string;
  brandName?: string;
}): boolean {
  let isValid = true;

  if (expectedContent.heading) {
    const headingRegex = new RegExp(expectedContent.heading, 'i');
    if (!headingRegex.test(html)) {
      console.error(`Missing expected heading: ${expectedContent.heading}`);
      isValid = false;
    }
  }

  if (expectedContent.buttonText) {
    const buttonRegex = new RegExp(expectedContent.buttonText, 'i');
    if (!buttonRegex.test(html)) {
      console.error(`Missing expected button text: ${expectedContent.buttonText}`);
      isValid = false;
    }
  }

  if (expectedContent.email) {
    if (!html.includes(expectedContent.email)) {
      console.error(`Missing expected email: ${expectedContent.email}`);
      isValid = false;
    }
  }

  if (expectedContent.brandName) {
    const brandRegex = new RegExp(expectedContent.brandName, 'i');
    if (!brandRegex.test(html)) {
      console.error(`Missing expected brand name: ${expectedContent.brandName}`);
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Check if HTML email has proper structure
 */
export function hasValidEmailStructure(html: string): boolean {
  // Check for DOCTYPE
  if (!html.includes('<!DOCTYPE html>')) {
    console.error('Missing DOCTYPE declaration');
    return false;
  }

  // Check for html tags
  if (!html.includes('<html>') || !html.includes('</html>')) {
    console.error('Missing html tags');
    return false;
  }

  // Check for head tags
  if (!html.includes('<head>') || !html.includes('</head>')) {
    console.error('Missing head tags');
    return false;
  }

  // Check for body tags
  if (!html.includes('<body') || !html.includes('</body>')) {
    console.error('Missing body tags');
    return false;
  }

  return true;
}

/**
 * Check if email HTML contains a clickable link
 */
export function hasClickableLink(html: string): boolean {
  return /<a\s+[^>]*href=["'][^"']+["'][^>]*>/.test(html);
}

/**
 * Extract all links from email HTML
 */
export function extractAllLinks(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * Check if email HTML contains logo image
 */
export function hasLogoImage(html: string): boolean {
  return /<img[^>]+src=["'][^"']*logo[^"']*["'][^>]*>/i.test(html);
}

/**
 * Validate email contains proper branding elements
 */
export function hasProperBranding(html: string, brandName: string = 'BioSketch'): boolean {
  const hasBrandName = html.includes(brandName);
  const hasLogo = hasLogoImage(html);

  return hasBrandName && hasLogo;
}

/**
 * Extract email address from HTML text
 */
export function extractEmailFromHtml(html: string): string | null {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const match = html.match(emailRegex);
  return match ? match[0] : null;
}

/**
 * Validate confirmation URL format
 */
export function isValidConfirmationUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Should have token parameter
    const hasToken = urlObj.searchParams.has('token');

    // Should have type parameter
    const hasType = urlObj.searchParams.has('type');

    // Should be from supabase domain
    const isSupabaseUrl = urlObj.hostname.includes('supabase.co') || urlObj.hostname.includes('localhost');

    return hasToken && hasType && isSupabaseUrl;
  } catch {
    return false;
  }
}
