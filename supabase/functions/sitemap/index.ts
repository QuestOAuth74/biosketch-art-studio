import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const baseUrl = 'https://biosketch.art';
    const today = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/community', changefreq: 'daily', priority: '0.8' },
      { loc: '/icons', changefreq: 'daily', priority: '0.9' },
      { loc: '/blog', changefreq: 'daily', priority: '0.9' },
      { loc: '/testimonials', changefreq: 'weekly', priority: '0.6' },
      { loc: '/release-notes', changefreq: 'monthly', priority: '0.5' },
      { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
      { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
      // Scientific tools
      { loc: '/tools', changefreq: 'weekly', priority: '0.9' },
      { loc: '/chart-studio-intro', changefreq: 'weekly', priority: '0.9' },
      { loc: '/volcano-plot', changefreq: 'monthly', priority: '0.8' },
      { loc: '/scatter-plot', changefreq: 'monthly', priority: '0.8' },
      { loc: '/dose-response', changefreq: 'monthly', priority: '0.8' },
      { loc: '/kaplan-meier', changefreq: 'monthly', priority: '0.8' },
      { loc: '/enzyme-kinetics', changefreq: 'monthly', priority: '0.7' },
      { loc: '/gel-electrophoresis', changefreq: 'monthly', priority: '0.7' },
      { loc: '/heatmap', changefreq: 'monthly', priority: '0.7' },
      { loc: '/phylo-tree', changefreq: 'monthly', priority: '0.8' },
      { loc: '/pedigree', changefreq: 'monthly', priority: '0.8' },
      { loc: '/gantt', changefreq: 'monthly', priority: '0.8' },
      { loc: '/smiles', changefreq: 'monthly', priority: '0.8' },
      { loc: '/latex', changefreq: 'monthly', priority: '0.7' },
      { loc: '/protein-domains', changefreq: 'monthly', priority: '0.7' },
      { loc: '/chromosome-ideogram', changefreq: 'monthly', priority: '0.8' },
      { loc: '/genetic-code-wheel', changefreq: 'monthly', priority: '0.8' },
      { loc: '/buffer-calculator', changefreq: 'monthly', priority: '0.7' },
      { loc: '/punnett-square', changefreq: 'monthly', priority: '0.7' },
      { loc: '/molecular-weight', changefreq: 'monthly', priority: '0.7' },
      { loc: '/unit-converter', changefreq: 'monthly', priority: '0.7' },
      { loc: '/plasmid-viewer', changefreq: 'monthly', priority: '0.8' },
      { loc: '/dna-tools', changefreq: 'monthly', priority: '0.8' },
      { loc: '/dilution-calculator', changefreq: 'monthly', priority: '0.7' },
      { loc: '/box-whisker-plot', changefreq: 'monthly', priority: '0.8' },
      { loc: '/bar-chart', changefreq: 'monthly', priority: '0.8' },
      { loc: '/violin-plot', changefreq: 'monthly', priority: '0.8' },
      { loc: '/correlation-matrix', changefreq: 'monthly', priority: '0.8' },
      { loc: '/forest-plot', changefreq: 'monthly', priority: '0.8' },
      { loc: '/roc-curve', changefreq: 'monthly', priority: '0.8' },
      { loc: '/venn-diagram', changefreq: 'monthly', priority: '0.8' },
      { loc: '/sankey-diagram', changefreq: 'monthly', priority: '0.8' },
      { loc: '/ai-illustrator', changefreq: 'weekly', priority: '0.9' },
      { loc: '/free-ai-credits', changefreq: 'monthly', priority: '0.7' },
      { loc: '/ci-proportion', changefreq: 'monthly', priority: '0.7' },
      { loc: '/chi-square', changefreq: 'monthly', priority: '0.7' },
    ];

    // Fetch all published blog posts
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    // Fetch all icons (just id and updated date)
    const { data: icons } = await supabase
      .from('icons')
      .select('id, name, created_at')
      .eq('category', 'ai-icons')
      .order('created_at', { ascending: false });

    // Fetch approved public community projects (for shared pages + author profiles)
    const { data: communityProjects } = await supabase
      .from('canvas_projects')
      .select('id, user_id, title, thumbnail_url, updated_at')
      .eq('is_public', true)
      .eq('approval_status', 'approved')
      .order('updated_at', { ascending: false });

    const uniqueAuthors = [...new Set((communityProjects || []).map(a => a.user_id))];

    // Build XML
    const supabaseFnUrl = `${supabaseUrl}/functions/v1`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static pages
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Blog posts
    for (const post of blogPosts || []) {
      const lastmod = (post.updated_at || post.published_at || today).split('T')[0];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Icon detail pages with image entries for Google Images
    for (const icon of icons || []) {
      const lastmod = (icon.created_at || today).split('T')[0];
      const imageUrl = `${supabaseFnUrl}/icon-image?id=${icon.id}`;
      const iconName = (icon.name || 'icon').replace(/[<>&"']/g, '');
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/icons/${icon.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${imageUrl}</image:loc>\n`;
      xml += `      <image:title>${iconName} - BioSketch Scientific Icon</image:title>\n`;
      xml += `      <image:caption>Free ${iconName} scientific icon for research figures and publications</image:caption>\n`;
      xml += `    </image:image>\n`;
      xml += `  </url>\n`;
    }

    // Community shared project pages
    for (const project of communityProjects || []) {
      const lastmod = (project.updated_at || today).split('T')[0];
      const projectTitle = (project.title || 'Scientific Illustration').replace(/[<>&"']/g, '');
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/shared/${project.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      if (project.thumbnail_url) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${project.thumbnail_url}</image:loc>\n`;
        xml += `      <image:title>${projectTitle} - BioSketch Scientific Illustration</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    // Author profile pages
    for (const authorId of uniqueAuthors) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/author/${authorId}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.5</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response('Error generating sitemap', {
      status: 500,
      headers: corsHeaders,
    });
  }
});
