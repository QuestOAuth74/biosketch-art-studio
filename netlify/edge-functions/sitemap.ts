import type { Context } from "https://edge.netlify.com";

const SITEMAP_URL = "https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/sitemap";

export default async function handler(_request: Request, context: Context) {
  try {
    const response = await fetch(SITEMAP_URL);

    if (!response.ok) {
      // Fall through to static file if dynamic sitemap fails
      return context.next();
    }

    const xml = await response.text();

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return context.next();
  }
}
