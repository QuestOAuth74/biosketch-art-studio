import type { VercelRequest, VercelResponse } from '@vercel/node';

const PRERENDER_URL = 'https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/prerender';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pagePath = req.query.path as string || '/';

  try {
    const response = await fetch(`${PRERENDER_URL}?path=${encodeURIComponent(pagePath)}`);
    const html = await response.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send('Error generating prerendered page');
  }
}
