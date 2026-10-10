import type { Context } from "https://edge.netlify.com";

const BOT_UA = /Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|Applebot|PinterestBot|Bytespider|GPTBot|ClaudeBot/i;

const PRERENDER_URL = "https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/prerender";

export default async function handler(request: Request, context: Context) {
  const ua = request.headers.get("user-agent") || "";

  // Only intercept bots — real users get the normal SPA
  if (!BOT_UA.test(ua)) {
    return context.next();
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const response = await fetch(`${PRERENDER_URL}?path=${encodeURIComponent(path)}`);

    // If Supabase returned an error, fall through to the SPA
    if (!response.ok) {
      return context.next();
    }

    const html = await response.text();

    // Sanity check: ensure we got actual HTML, not an error string
    if (!html || !html.includes("<!DOCTYPE html>")) {
      return context.next();
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Robots-Tag": "index, follow",
      },
    });
  } catch {
    // On failure, fall through to the SPA
    return context.next();
  }
}

export const config = {
  path: [
    "/",
    "/tools",
    "/community",
    "/icons",
    "/icons/*",
    "/blog",
    "/blog/*",
    "/contact",
    "/testimonials",
    "/release-notes",
    "/terms",
    "/author/*",
    "/volcano-plot",
    "/scatter-plot",
    "/dose-response",
    "/kaplan-meier",
    "/enzyme-kinetics",
    "/gel-electrophoresis",
    "/heatmap",
    "/phylo-tree",
    "/pedigree",
    "/gantt",
    "/smiles",
    "/latex",
    "/protein-domains",
    "/chromosome-ideogram",
    "/genetic-code-wheel",
    "/buffer-calculator",
    "/punnett-square",
    "/molecular-weight",
    "/unit-converter",
    "/plasmid-viewer",
    "/dna-tools",
    "/dilution-calculator",
    "/box-whisker-plot",
    "/bar-chart",
    "/violin-plot",
    "/correlation-matrix",
    "/forest-plot",
    "/roc-curve",
    "/venn-diagram",
    "/sankey-diagram",
    "/ai-illustrator",
    "/free-ai-credits",
    "/ci-proportion",
    "/chi-square",
    "/chart-studio-intro",
    "/shared/*",
  ],
};
