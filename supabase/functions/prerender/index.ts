import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Prerender Edge Function
 *
 * Generates SEO-optimized static HTML for blog posts and icon pages.
 * Called by the SPA to inject meta tags into the document head for crawlers,
 * or can be used as a middleware for bot detection.
 *
 * Usage: /functions/v1/prerender?path=/blog/my-post-slug
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pagePath = url.searchParams.get('path') || '/';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const baseUrl = 'https://biosketch.art';
    const imageBaseUrl = `${supabaseUrl}/functions/v1/icon-image`;

    let title = 'BioSketch - Free Scientific Illustration Tool for Researchers';
    let description = 'Create stunning scientific illustrations with BioSketch.';
    let ogImage = `${baseUrl}/logo.png`;
    let ogType = 'website';
    let canonical = baseUrl + pagePath;
    let structuredData = '';
    let bodyContent = '';

    // Blog post page
    const blogMatch = pagePath.match(/^\/blog\/(.+)$/);
    if (blogMatch) {
      const slug = blogMatch[1];
      const { data: post } = await supabase
        .from('blog_posts')
        .select(`
          id, title, slug, excerpt, featured_image_url, og_image,
          seo_title, seo_description, seo_keywords,
          published_at, updated_at, created_at, reading_time, view_count,
          author:profiles!blog_posts_author_id_fkey(full_name, avatar_url),
          categories:blog_post_categories(category:blog_categories(name, slug)),
          content
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (post) {
        title = post.seo_title || `${post.title} | BioSketch Blog`;
        description = post.seo_description || post.excerpt || '';
        ogImage = post.og_image || post.featured_image_url || ogImage;
        ogType = 'article';

        const authorName = (post.author as any)?.full_name || 'BioSketch Team';
        const categories = ((post.categories as any[]) || []).map((c: any) => c.category?.name).filter(Boolean);
        const keywords = post.seo_keywords || [];

        // Extract plain text from TipTap JSON content for body
        let plainText = '';
        try {
          const content = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
          if (content?.content) {
            plainText = extractTextFromTipTap(content.content);
          }
        } catch {}

        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: description,
          image: ogImage,
          datePublished: post.published_at || post.created_at,
          dateModified: post.updated_at,
          author: { '@type': 'Person', name: authorName },
          publisher: {
            '@type': 'Organization',
            name: 'BioSketch',
            url: baseUrl,
            logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          ...(categories.length > 0 ? { articleSection: categories[0] } : {}),
          ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
        });

        bodyContent = `
          <article>
            <h1>${escapeHtml(post.title)}</h1>
            <p>By ${escapeHtml(authorName)} | ${post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}</p>
            ${post.featured_image_url ? `<img src="${escapeHtml(post.featured_image_url)}" alt="${escapeHtml(post.title)}" />` : ''}
            ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''}
            ${plainText ? `<div>${escapeHtml(plainText.substring(0, 2000))}</div>` : ''}
            ${categories.length > 0 ? `<p>Categories: ${categories.map(c => escapeHtml(c)).join(', ')}</p>` : ''}
            ${keywords.length > 0 ? `<p>Keywords: ${keywords.map((k: string) => escapeHtml(k)).join(', ')}</p>` : ''}
          </article>`;
      }
    }

    // Blog listing page
    if (pagePath === '/blog') {
      title = 'BioSketch Blog | Scientific Figure Creation Tips & Tutorials';
      description = 'Learn how to create stunning scientific figures with BioSketch. Tips, tutorials, and best practices for biomedical illustration.';

      const { data: posts } = await supabase
        .from('blog_posts')
        .select('title, slug, excerpt, featured_image_url, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (posts && posts.length > 0) {
        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'BioSketch Blog',
          url: `${baseUrl}/blog`,
          blogPost: posts.map(p => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: `${baseUrl}/blog/${p.slug}`,
            datePublished: p.published_at,
            image: p.featured_image_url,
          })),
        });

        bodyContent = `
          <h1>BioSketch Blog</h1>
          <ul>${posts.map(p => `
            <li>
              <a href="${baseUrl}/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a>
              ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
            </li>`).join('')}
          </ul>`;
      }
    }

    // Icon detail page
    const iconMatch = pagePath.match(/^\/icons\/(.+)$/);
    if (iconMatch) {
      const iconId = iconMatch[1];
      const { data: icon } = await supabase
        .from('icons')
        .select('id, name, download_count, like_count')
        .eq('id', iconId)
        .single();

      if (icon) {
        const iconName = formatIconName(icon.name);
        const iconImageUrl = `${imageBaseUrl}?id=${icon.id}`;
        title = `${iconName} - Free Scientific Icon | BioSketch Icons`;
        description = `Download ${iconName} scientific icon in SVG or PNG format. Free high-quality icon for research figures and biomedical illustrations.`;
        ogImage = iconImageUrl;

        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ImageObject',
          name: iconName,
          description: description,
          contentUrl: iconImageUrl,
          thumbnailUrl: iconImageUrl,
          url: canonical,
          encodingFormat: 'image/png',
          license: `${baseUrl}/terms`,
          creator: { '@type': 'Organization', name: 'BioSketch', url: baseUrl },
        });

        bodyContent = `
          <h1>${escapeHtml(iconName)} - Scientific Icon</h1>
          <img src="${escapeHtml(iconImageUrl)}" alt="${escapeHtml(iconName)}" />
          <p>Download this free scientific icon in SVG or PNG format.</p>
          <p>${icon.download_count || 0} downloads | ${icon.like_count || 0} likes</p>
          <a href="${baseUrl}/icons">Browse all icons</a>`;
      }
    }

    // Icons listing page
    if (pagePath === '/icons') {
      title = 'BioSketch Icons | Free Scientific Icons for Research Figures';
      description = 'Browse and download free scientific icons for your research figures. High-quality SVG and PNG icons for biology, chemistry, and medical illustrations.';

      const { data: icons } = await supabase
        .from('icons')
        .select('id, name')
        .eq('category', 'ai-icons')
        .order('created_at', { ascending: false })
        .limit(100);

      if (icons && icons.length > 0) {
        bodyContent = `
          <h1>BioSketch Icon Library</h1>
          <p>Free scientific icons for your research figures.</p>
          <ul>${icons.map(i => `
            <li><a href="${baseUrl}/icons/${i.id}">${escapeHtml(formatIconName(i.name))}</a></li>`).join('')}
          </ul>`;
      }
    }

    // Author profile page
    const authorMatch = pagePath.match(/^\/author\/(.+)$/);
    if (authorMatch) {
      const authorId = authorMatch[1];
      const { data: profile } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .eq('id', authorId)
        .single();

      if (profile) {
        const authorName = profile.full_name || 'Anonymous';
        title = `${authorName} - Author Profile | BioSketch`;
        description = `View ${authorName}'s scientific diagrams and projects on BioSketch.`;

        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: authorName,
            image: profile.avatar_url || undefined,
            url: canonical,
          },
        });

        bodyContent = `
          <h1>${escapeHtml(authorName)}</h1>
          ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(authorName)}" width="96" height="96" />` : ''}
          <p>View ${escapeHtml(authorName)}'s scientific illustrations and projects on BioSketch.</p>
          <a href="${baseUrl}/community">Browse Community Gallery</a>`;
      }
    }

    // Community page — fetch actual projects for SEO
    if (pagePath === '/community') {
      title = 'Community Gallery - Free Scientific Illustrations | BioSketch';
      description = 'Discover and download free scientific illustrations created by researchers worldwide. Browse high-quality biology, chemistry, and medical diagrams.';

      const { data: projects } = await supabase
        .from('canvas_projects')
        .select('id, title, description, keywords, field_of_study, thumbnail_url, view_count, like_count, cloned_count, profiles:profiles!canvas_projects_user_id_fkey(full_name)')
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(60);

      if (projects && projects.length > 0) {
        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'BioSketch Community Gallery',
          description: description,
          url: `${baseUrl}/community`,
          numberOfItems: projects.length,
          hasPart: projects.slice(0, 20).map(p => ({
            '@type': 'CreativeWork',
            name: p.title || 'Scientific Illustration',
            description: p.description || '',
            url: `${baseUrl}/shared/${p.id}`,
            ...(p.thumbnail_url ? { thumbnailUrl: p.thumbnail_url } : {}),
            creator: { '@type': 'Person', name: (p.profiles as any)?.full_name || 'Anonymous' },
            ...(p.keywords?.length ? { keywords: p.keywords.join(', ') } : {}),
          })),
        });

        bodyContent = `
          <h1>Community Gallery — Free Scientific Illustrations</h1>
          <p>Browse ${projects.length}+ free scientific illustrations shared by researchers worldwide. Download and use as templates for your own figures.</p>
          <div>
            ${projects.map(p => `
              <article>
                <h2><a href="${baseUrl}/shared/${p.id}">${escapeHtml(p.title || 'Scientific Illustration')}</a></h2>
                ${p.thumbnail_url ? `<a href="${baseUrl}/shared/${p.id}"><img src="${escapeHtml(p.thumbnail_url)}" alt="${escapeHtml(p.title || 'Scientific illustration')}" width="400" loading="lazy" /></a>` : ''}
                ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
                ${p.field_of_study ? `<p>Field: ${escapeHtml(p.field_of_study)}</p>` : ''}
                ${p.keywords?.length ? `<p>Keywords: ${p.keywords.map((k: string) => escapeHtml(k)).join(', ')}</p>` : ''}
                <p>By ${escapeHtml((p.profiles as any)?.full_name || 'Anonymous')} | ${p.view_count || 0} views | ${p.like_count || 0} likes</p>
              </article>
            `).join('')}
          </div>
          <p><a href="${baseUrl}/community">View all community illustrations</a></p>`;
      }
    }

    // Shared project page — individual project SEO
    const sharedMatch = pagePath.match(/^\/shared\/(.+)$/);
    if (sharedMatch) {
      const projectId = sharedMatch[1];
      const { data: project } = await supabase
        .from('canvas_projects')
        .select('id, title, description, keywords, field_of_study, thumbnail_url, view_count, like_count, cloned_count, created_at, updated_at, profiles:profiles!canvas_projects_user_id_fkey(full_name, avatar_url)')
        .eq('id', projectId)
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .single();

      if (project) {
        const projectTitle = project.title || 'Scientific Illustration';
        const authorName = (project.profiles as any)?.full_name || 'Anonymous';
        title = `${projectTitle} by ${authorName} | BioSketch Community`;
        description = project.description || `View this scientific illustration by ${authorName} on BioSketch.`;
        ogImage = project.thumbnail_url || ogImage;
        ogType = 'article';
        canonical = `${baseUrl}/shared/${project.id}`;

        structuredData = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: projectTitle,
          description: description,
          url: canonical,
          ...(project.thumbnail_url ? { thumbnailUrl: project.thumbnail_url, image: project.thumbnail_url } : {}),
          dateCreated: project.created_at,
          dateModified: project.updated_at,
          creator: { '@type': 'Person', name: authorName },
          ...(project.keywords?.length ? { keywords: project.keywords.join(', ') } : {}),
          ...(project.field_of_study ? { about: { '@type': 'Thing', name: project.field_of_study } } : {}),
          interactionStatistic: [
            { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ViewAction', userInteractionCount: project.view_count || 0 },
            { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: project.like_count || 0 },
          ],
          isAccessibleForFree: true,
          provider: { '@type': 'Organization', name: 'BioSketch', url: baseUrl },
        });

        bodyContent = `
          <article>
            <h1>${escapeHtml(projectTitle)}</h1>
            <p>By <a href="${baseUrl}/author/${projectId}">${escapeHtml(authorName)}</a></p>
            ${project.thumbnail_url ? `<img src="${escapeHtml(project.thumbnail_url)}" alt="${escapeHtml(projectTitle)}" width="800" />` : ''}
            ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ''}
            ${project.field_of_study ? `<p>Field of study: ${escapeHtml(project.field_of_study)}</p>` : ''}
            ${project.keywords?.length ? `<p>Keywords: ${project.keywords.map((k: string) => escapeHtml(k)).join(', ')}</p>` : ''}
            <p>${project.view_count || 0} views | ${project.like_count || 0} likes | ${project.cloned_count || 0} clones</p>
          </article>
          <p><a href="${baseUrl}/community">Browse more scientific illustrations</a></p>`;
      }
    }

    // Static pages: tools hub, community, individual tools, site pages
    const staticPages: Record<string, { title: string; description: string; keywords: string; heading: string; body: string }> = {
      '/tools': {
        title: 'Free Scientific Tools for Researchers | BioSketch',
        description: 'Free online scientific tools: Kaplan-Meier curves, IC50 dose-response, volcano plots, scatter plots, heatmaps, gel electrophoresis, phylogenetic trees, pedigree charts, Gantt charts, protein domains, chromosome ideograms, SMILES renderer, and LaTeX equations.',
        keywords: 'free scientific tools, Kaplan-Meier survival curve, IC50 calculator, volcano plot maker, scatter plot maker, heatmap generator, gel electrophoresis simulator, phylogenetic tree viewer, pedigree chart maker, Gantt chart, protein domain viewer, chromosome ideogram, SMILES renderer, LaTeX equation editor',
        heading: 'Free Scientific Tools for Researchers',
        body: '<p>BioSketch provides free, browser-based scientific tools for researchers, students, and educators. No signup required.</p><ul><li><a href="/volcano-plot">Volcano Plot Maker</a></li><li><a href="/scatter-plot">Scatter Plot with Regression</a></li><li><a href="/dose-response">IC50/EC50 Dose-Response Curve Fitter</a></li><li><a href="/kaplan-meier">Kaplan-Meier Survival Curves</a></li><li><a href="/enzyme-kinetics">Enzyme Kinetics Plotter</a></li><li><a href="/gel-electrophoresis">Gel Electrophoresis Simulator</a></li><li><a href="/heatmap">Heatmap Generator with Clustering</a></li><li><a href="/phylo-tree">Phylogenetic Tree Viewer</a></li><li><a href="/pedigree">Pedigree Chart Maker</a></li><li><a href="/gantt">Gantt Chart Maker</a></li><li><a href="/smiles">SMILES Molecular Structure Renderer</a></li><li><a href="/latex">LaTeX Equation Renderer</a></li><li><a href="/protein-domains">Protein Domain Viewer</a></li><li><a href="/chromosome-ideogram">Chromosome Ideogram Viewer</a></li><li><a href="/genetic-code-wheel">Genetic Code Wheel</a></li></ul>',
      },
      '/community': {
        title: 'Community Gallery - Free Scientific Illustrations | BioSketch',
        description: 'Discover and download free scientific illustrations created by researchers worldwide. Browse high-quality biology, chemistry, and medical diagrams. Use as templates for your own research figures.',
        keywords: 'scientific illustrations, biology diagrams, medical figures, research templates, free scientific diagrams, BioSketch community, biomedical illustration',
        heading: 'Community Gallery',
        body: '', // dynamically populated below
      },
      '/volcano-plot': {
        title: 'Free Volcano Plot Maker - Differential Expression Visualization | BioSketch',
        description: 'Generate publication-quality volcano plots online for free. Paste RNA-seq DESeq2 or proteomics data with log2 fold-change and p-values. Customize significance thresholds, label top genes, and export as SVG or PNG. No signup required.',
        keywords: 'volcano plot maker, volcano plot generator, differential expression plot, DESeq2 volcano plot, RNA-seq visualization, proteomics volcano plot, log2 fold change plot, gene expression visualization, free volcano plot tool, publication volcano plot',
        heading: 'Free Volcano Plot Maker',
        body: '<p>Generate publication-quality volcano plots online for free. Paste RNA-seq DESeq2 or proteomics data with log2 fold-change and p-values. Customize significance thresholds, label top genes, and export as SVG or PNG.</p>',
      },
      '/scatter-plot': {
        title: 'Free Scatter Plot with Regression & Statistics | BioSketch',
        description: 'Create scatter plots with regression lines online for free. Linear, polynomial, logarithmic, exponential, and power regression with R-squared, p-value, and 95% confidence intervals. Export publication-quality plots as SVG or PNG. No signup required.',
        keywords: 'scatter plot maker, regression line calculator, R squared calculator, scatter plot with statistics, linear regression online, polynomial regression, confidence interval plot, p value regression, XY scatter plot, free scatter plot tool',
        heading: 'Free Scatter Plot with Regression',
        body: '<p>Create scatter plots with regression lines online for free. Supports linear, polynomial, logarithmic, exponential, and power regression with R-squared, p-value, and 95% confidence intervals.</p>',
      },
      '/dose-response': {
        title: 'Free IC50/EC50 Dose-Response Curve Fitter | BioSketch',
        description: 'Fit 4-parameter logistic dose-response curves online for free. Paste concentration and response data to calculate IC50/EC50, Hill slope, and R-squared. Publication-quality sigmoidal curve plots with SVG/PNG export. No signup required.',
        keywords: 'IC50 calculator, EC50 calculator, dose response curve fitter, 4PL curve fitting, Hill equation, sigmoidal curve, GraphPad alternative free, drug response curve, pharmacology tool, dose response plot maker',
        heading: 'Free IC50/EC50 Dose-Response Curve Fitter',
        body: '<p>Fit 4-parameter logistic dose-response curves online for free. Calculate IC50/EC50, Hill slope, and R-squared from your concentration and response data. Free alternative to GraphPad Prism.</p>',
      },
      '/kaplan-meier': {
        title: 'Free Kaplan-Meier Survival Curve Generator | BioSketch',
        description: 'Generate Kaplan-Meier survival curves online for free. Paste time-to-event data with censoring, compute log-rank test p-value, median survival time, and number-at-risk tables. Supports multiple groups. Export publication-quality plots as SVG or PNG. No signup required.',
        keywords: 'Kaplan-Meier survival curve, survival analysis tool, log-rank test calculator, time to event analysis, censoring survival data, median survival calculator, Kaplan-Meier plot maker, clinical trial survival curve, free survival analysis, KM curve generator',
        heading: 'Free Kaplan-Meier Survival Curve Generator',
        body: '<p>Generate Kaplan-Meier survival curves online for free. Compute log-rank test p-values, median survival, and number-at-risk tables. Supports multiple groups.</p>',
      },
      '/enzyme-kinetics': {
        title: 'Free Enzyme Kinetics Plotter - Michaelis-Menten, Lineweaver-Burk | BioSketch',
        description: 'Plot Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee enzyme kinetics curves online for free. Calculate Km, Vmax, catalytic efficiency, and R-squared from substrate concentration and velocity data. Export publication-quality plots. No signup required.',
        keywords: 'Michaelis-Menten plot, Lineweaver-Burk plot, Eadie-Hofstee plot, enzyme kinetics calculator, Km Vmax calculator, enzyme kinetics plotter, Michaelis-Menten equation, double reciprocal plot, enzyme kinetics online, biochemistry tool',
        heading: 'Free Enzyme Kinetics Plotter',
        body: '<p>Plot Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee enzyme kinetics curves online for free. Calculate Km, Vmax, and catalytic efficiency.</p>',
      },
      '/gel-electrophoresis': {
        title: 'Free Gel Electrophoresis Simulator | BioSketch',
        description: 'Simulate agarose gel electrophoresis online. Enter DNA fragment sizes, choose a DNA ladder, adjust gel percentage, and visualize band migration patterns. Export as SVG or PNG. Free, no signup.',
        keywords: 'gel electrophoresis simulator, virtual gel electrophoresis, agarose gel simulator, DNA gel electrophoresis, gel band migration, DNA ladder, restriction digest gel, PCR gel, electrophoresis education, molecular biology tool',
        heading: 'Free Gel Electrophoresis Simulator',
        body: '<p>Simulate agarose gel electrophoresis online. Enter DNA fragment sizes, choose a DNA ladder, adjust gel percentage, and visualize band migration patterns.</p>',
      },
      '/heatmap': {
        title: 'Free Heatmap Generator with Clustering | BioSketch',
        description: 'Generate publication-ready heatmaps online for free. Paste your data, choose from 9 color scales, show values in cells, and export as high-resolution PNG or SVG. No signup required.',
        keywords: 'heatmap generator, free heatmap maker, hierarchical clustering heatmap, dendrogram heatmap, gene expression heatmap, publication heatmap, scientific data visualization',
        heading: 'Free Heatmap Generator with Clustering',
        body: '<p>Generate publication-ready heatmaps online for free. Choose from 9 color scales, add hierarchical clustering dendrograms, and export as PNG or SVG.</p>',
      },
      '/phylo-tree': {
        title: 'Free Phylogenetic Tree Viewer - Newick Tree Visualizer | BioSketch',
        description: 'Visualize phylogenetic trees online from Newick format data. Rectangular cladogram and radial circular layouts with branch length scaling, tip alignment, and internal node labels. Export as SVG or PNG. Free, no signup required.',
        keywords: 'phylogenetic tree viewer, Newick tree viewer, phylogenetic tree maker, cladogram generator, radial phylogeny, evolutionary tree online, phylogenetics tool, tree of life viewer, Newick format visualizer, free phylogenetic tree',
        heading: 'Free Phylogenetic Tree Viewer',
        body: '<p>Visualize phylogenetic trees online from Newick format data. Rectangular cladogram and radial circular layouts with branch length scaling.</p>',
      },
      '/pedigree': {
        title: 'Free Pedigree Chart Maker - Genetics Pedigree Tool | BioSketch',
        description: 'Create professional genetics pedigree charts online for free. Standard pedigree symbols, connections, and export. No signup required.',
        keywords: 'pedigree chart maker, genetics pedigree tool, free pedigree diagram, family genetics chart, inheritance pattern diagram',
        heading: 'Free Pedigree Chart Maker',
        body: '<p>Create professional genetics pedigree charts online for free. Uses standard pedigree symbols and supports export to multiple formats.</p>',
      },
      '/gantt': {
        title: 'Free Gantt Chart Maker - Project Timeline Tool | BioSketch',
        description: 'Create Gantt charts and project timelines online for free. Add tasks, set dependencies, assign resources, and export as PNG or JSON. No signup required.',
        keywords: 'gantt chart maker, free gantt chart, project timeline tool, task scheduler, project management chart, gantt diagram online',
        heading: 'Free Gantt Chart Maker',
        body: '<p>Create Gantt charts and project timelines online for free. Add tasks, set dependencies, assign resources, and export as PNG.</p>',
      },
      '/smiles': {
        title: 'Free SMILES Molecular Structure Renderer | BioSketch',
        description: 'Visualize chemical structures from SMILES strings online for free. Search compounds by name, render 2D molecular diagrams, and export as PNG or SVG. No signup required.',
        keywords: 'SMILES renderer, molecular structure editor, chemical structure drawing, molecule viewer, SMILES to structure, free chemistry tool, molecular diagram maker, PubChem search',
        heading: 'Free SMILES Molecular Structure Renderer',
        body: '<p>Visualize chemical structures from SMILES strings online for free. Search compounds by name via PubChem and render 2D molecular diagrams.</p>',
      },
      '/latex': {
        title: 'Free LaTeX Equation Renderer | BioSketch',
        description: 'Type LaTeX math equations and preview them instantly. Export as high-resolution PNG or SVG. 15 built-in examples including scientific equations. Free, no signup.',
        keywords: 'LaTeX equation renderer, LaTeX to image, math equation editor, LaTeX preview, equation PNG, LaTeX online free, math formula renderer',
        heading: 'Free LaTeX Equation Renderer',
        body: '<p>Type LaTeX math equations and preview them instantly. Export as high-resolution PNG or SVG. Includes 15 built-in scientific equation examples.</p>',
      },
      '/protein-domains': {
        title: 'Free Protein Domain Viewer - Domain Architecture Map | BioSketch',
        description: 'Visualize protein domain architecture online. Draw domains, signal peptides, transmembrane regions, PTM sites, coiled coils, and disordered regions on a linear protein map. Export as SVG or PNG. Free, no signup required.',
        keywords: 'protein domain viewer, domain architecture, Pfam domain map, protein feature viewer, protein domain diagram, signal peptide, transmembrane domain, PTM site, protein structure visualization, InterPro domain, protein annotation tool',
        heading: 'Free Protein Domain Viewer',
        body: '<p>Visualize protein domain architecture online. Draw domains, signal peptides, transmembrane regions, and PTM sites on a linear protein map.</p>',
      },
      '/sankey-diagram': {
        title: 'Free Sankey Diagram Maker | BioSketch',
        description: 'Create publication-quality Sankey flow diagrams online for free. Visualize patient flow, metabolic pathways, gene regulation. Automatic node layering with curved paths. Export as SVG or PNG.',
        keywords: 'Sankey diagram maker, flow diagram, alluvial plot, patient flow, metabolic pathway, network visualization, free Sankey tool',
        heading: 'Free Sankey Diagram Maker',
        body: '<p>Create Sankey flow diagrams for patient flow, metabolic pathways, and gene regulation networks. Export as SVG or PNG.</p>',
      },
      '/chi-square': {
        title: 'Free Chi-Square Test Calculator | BioSketch',
        description: 'Chi-square goodness of fit and test of independence online. Contingency tables with expected frequencies, Yates correction, Cramér\'s V effect size. Free, no signup.',
        keywords: 'chi-square test, chi-square calculator, goodness of fit, contingency table, test of independence, Yates correction, Cramér\'s V, expected frequency',
        heading: 'Chi-Square Test Calculator',
        body: '<p>Chi-square goodness of fit and test of independence for contingency tables. Enter observed frequencies, get chi-square statistic, p-value, degrees of freedom, expected frequencies, and Cramér\'s V effect size. Supports Yates continuity correction for 2×2 tables.</p>',
      },
      '/ci-proportion': {
        title: 'Free Confidence Interval of Proportion Calculator | BioSketch',
        description: 'Calculate confidence intervals for proportions and counts online. Wilson score, Clopper-Pearson exact, Wald, Agresti-Coull, and Jeffreys methods. Compare all methods side-by-side. Free, no signup.',
        keywords: 'confidence interval calculator, proportion CI, Wilson score interval, Clopper-Pearson exact, binomial confidence interval, Wald interval, Jeffreys interval, statistics tool',
        heading: 'Confidence Interval of a Proportion Calculator',
        body: '<p>Calculate confidence intervals for proportions and counts with 5 methods: Wilson score, Clopper-Pearson exact, Wald normal approximation, Agresti-Coull, and Jeffreys Bayesian. Compare all methods side-by-side. Also supports Poisson CI for counts.</p>',
      },
      '/free-ai-credits': {
        title: 'How to Get Free AI Generation Credits | BioSketch',
        description: 'Earn free AI generation credits on BioSketch by sharing scientific illustrations with the community. No subscriptions, no paywalls. 3 approved projects = 20 credits/month. Every additional project = +10 more.',
        keywords: 'free AI credits, BioSketch AI, free scientific illustration AI, no subscription, earn AI credits, open science, BioRender alternative',
        heading: 'How to Get Free AI Generation Credits',
        body: '<p>BioSketch is a free, open-source scientific illustration platform. Earn AI credits by sharing your work with the community.</p><h2>How It Works</h2><ol><li>Create scientific illustrations on the BioSketch canvas</li><li>Share your projects with the community gallery</li><li>Get approved — 3 projects unlocks 20 AI credits per month</li><li>Every additional project earns 10 more credits</li></ol><h2>Credit Structure</h2><ul><li>3 approved projects = 20 credits/month</li><li>4 projects = 30/month</li><li>5 projects = 40/month</li><li>10 projects = 90/month</li></ul><p>Credits reset monthly. Shared across all AI tools: Icon Generator, Photo to 2D, Text to Figure, Illustration Enhancer, and more.</p>',
      },
      '/ai-illustrator': {
        title: 'BioSketch AI Illustrator | AI-Powered Scientific Illustration Tool',
        description: 'Create scientific illustrations with AI. Generate icons, convert photos to 2D, transform sketches to illustrations, create figures from text, enhance illustrations, and convert reference images to vector figures. Free for researchers.',
        keywords: 'AI scientific illustration, AI icon generator, photo to 2D illustration, sketch to illustration, text to figure, image enhancer, BioSketch AI, free scientific illustration tool, AI figure generator',
        heading: 'BioSketch AI Illustrator',
        body: '<p>AI-powered scientific illustration tool. Generate icons, convert photos to flat 2D, transform sketches, create figures from text descriptions, enhance illustrations, and convert references to vector figures.</p><ul><li>Icon Generator — create scientific icons from text</li><li>Photo to 2D — convert photographs to flat illustrations</li><li>Sketch to Illustration — transform hand-drawn sketches</li><li>Text to Figure — generate schematics from descriptions</li><li>Image to Figure — convert images to publication figures</li><li>Illustration Enhancer — sharpen and refine with AI</li><li>Reference to Figure — recreate references as 2D vectors</li></ul>',
      },
      '/venn-diagram': {
        title: 'Free Venn Diagram Maker | BioSketch',
        description: 'Create publication-quality 2 or 3-set Venn diagrams online for free. Paste gene lists, protein sets, or any items. Automatic overlap calculation with counts and item lists. Export as SVG or PNG.',
        keywords: 'Venn diagram maker, set overlap, gene list comparison, 2 circle Venn, 3 circle Venn, set intersection, protein overlap, free Venn diagram tool',
        heading: 'Free Venn Diagram Maker',
        body: '<p>Create 2 or 3-set Venn diagrams with automatic overlap calculation. Compare gene lists, protein sets, or any items. Export as SVG or PNG.</p>',
      },
      '/roc-curve': {
        title: 'Free ROC Curve Maker | BioSketch',
        description: 'Create publication-quality ROC curves online for free. Calculate AUC, compare multiple classifiers, find optimal cutoffs with Youden index. Export as SVG or PNG.',
        keywords: 'ROC curve maker, AUC calculator, receiver operating characteristic, sensitivity specificity, Youden index, diagnostic test, classifier evaluation, free ROC tool',
        heading: 'Free ROC Curve Maker',
        body: '<p>Create ROC curves with AUC calculation. Compare multiple models, find optimal cutoffs with Youden index. Export as SVG or PNG.</p>',
      },
      '/forest-plot': {
        title: 'Free Forest Plot Maker - Meta-Analysis | BioSketch',
        description: 'Create publication-quality forest plots for meta-analyses online for free. Odds ratios, hazard ratios, risk ratios, mean differences with pooled estimates and confidence intervals. Export as SVG or PNG.',
        keywords: 'forest plot maker, meta-analysis, odds ratio, hazard ratio, risk ratio, confidence interval, pooled estimate, systematic review, free forest plot',
        heading: 'Free Forest Plot Maker',
        body: '<p>Create forest plots for meta-analyses with pooled estimates, confidence intervals, and study weights. Supports OR, RR, HR, MD, and SMD.</p>',
      },
      '/correlation-matrix': {
        title: 'Free Correlation Matrix Maker | BioSketch',
        description: 'Generate publication-quality correlation matrices online for free. Pearson and Spearman correlations with 8 color scales. Upper triangle, absolute scale, value annotations. Export as SVG or PNG.',
        keywords: 'correlation matrix, Pearson correlation, Spearman correlation, heatmap, pairwise correlation, data analysis, scientific figure, free correlation tool',
        heading: 'Free Correlation Matrix Maker',
        body: '<p>Generate Pearson or Spearman correlation heatmaps with customizable color scales. Export as SVG or PNG.</p>',
      },
      '/violin-plot': {
        title: 'Free Violin Plot Maker | BioSketch',
        description: 'Create publication-quality violin plots online for free. Gaussian kernel density estimation with inner box plots, quartile markers, jittered data points. Multiple journal color themes. Export as SVG or PNG.',
        keywords: 'violin plot maker, kernel density plot, KDE, data distribution visualization, box plot alternative, scientific figure, free violin plot tool',
        heading: 'Free Violin Plot Maker',
        body: '<p>Create violin plots with kernel density estimation, inner box plots, and data overlays. Visualize the full shape of your data distribution.</p>',
      },
      '/bar-chart': {
        title: 'Free Bar Chart with Error Bars | BioSketch',
        description: 'Create publication-quality bar charts with SEM, SD, or 95% CI error bars online for free. Grouped bars, significance brackets, multiple journal color themes. Export as SVG or PNG.',
        keywords: 'bar chart maker, error bars, SEM, standard deviation, grouped bar chart, significance brackets, scientific figure, free bar chart tool',
        heading: 'Free Bar Chart with Error Bars',
        body: '<p>Create grouped bar charts with SEM, SD, or 95% CI error bars. Add significance brackets and export as SVG or PNG.</p>',
      },
      '/box-whisker-plot': {
        title: 'Free Box & Whisker Plot Maker | BioSketch',
        description: 'Create publication-quality box and whisker plots online for free. Paste grouped data, calculate quartiles, IQR, whiskers, and detect outliers. Multiple color themes and export as SVG or PNG. No signup required.',
        keywords: 'box plot maker, box and whisker plot, quartile plot, IQR calculator, outlier detection, data visualization, statistics tool, free box plot',
        heading: 'Free Box & Whisker Plot Maker',
        body: '<p>Create box and whisker plots from grouped data. Calculate quartiles, IQR, whiskers, and detect outliers. Multiple color themes and styles with data point overlay.</p>',
      },
      '/chromosome-ideogram': {
        title: 'Free Chromosome Ideogram Viewer - Karyotype with Gene Annotations | BioSketch',
        description: 'Visualize chromosome ideograms online with G-banding patterns at multiple resolutions. Annotate gene loci, GWAS hits, and cytogenetic markers on human, mouse, rat, Drosophila, and more. Export as SVG or PNG. Free, no signup required.',
        keywords: 'chromosome ideogram, karyotype viewer, chromosome banding, G-banding, cytogenetics, gene locus map, chromosome map maker, GWAS visualization, chromosome annotation, karyotype diagram, chromosome viewer online, free ideogram tool',
        heading: 'Free Chromosome Ideogram Viewer',
        body: '<p>Visualize chromosome ideograms with G-banding patterns. Annotate gene loci, GWAS hits, and cytogenetic markers. Supports human, mouse, rat, and Drosophila genomes.</p>',
      },
      '/genetic-code-wheel': {
        title: 'Interactive Genetic Code Wheel - Codon Game | BioSketch',
        description: 'Interactive genetic code wheel quiz. Spin the codon wheel and identify amino acids from mRNA triplet sequences. Learn the genetic code through play. Free, no signup.',
        keywords: 'genetic code wheel, codon wheel, mRNA translation, amino acid identification, genetic code learning game, codon table interactive',
        heading: 'Interactive Genetic Code Wheel',
        body: '<p>Interactive genetic code wheel quiz. Spin the codon wheel and identify amino acids from mRNA triplet sequences.</p>',
      },
      '/buffer-calculator': {
        title: 'Free Buffer Calculator - Henderson-Hasselbalch | BioSketch',
        description: 'Calculate buffer recipes using the Henderson-Hasselbalch equation. Select buffer system, enter target pH and concentration, get exact amounts. Free, no signup.',
        keywords: 'buffer calculator, Henderson-Hasselbalch equation, buffer recipe, pH calculator, buffer preparation, laboratory buffer, Tris buffer, phosphate buffer',
        heading: 'Free Buffer Calculator',
        body: '<p>Calculate buffer recipes using the Henderson-Hasselbalch equation. Select buffer system, enter target pH and concentration, get exact amounts.</p>',
      },
      '/punnett-square': {
        title: 'Free Punnett Square Calculator - Genetics Cross Tool | BioSketch',
        description: 'Generate Punnett squares for monohybrid, dihybrid, and trihybrid crosses. Calculate genotype and phenotype ratios with complete, incomplete, and codominant inheritance. Free, no signup.',
        keywords: 'Punnett square calculator, genetics cross, monohybrid cross, dihybrid cross, genotype ratio, phenotype ratio, Hardy-Weinberg, inheritance patterns',
        heading: 'Free Punnett Square Calculator',
        body: '<p>Generate Punnett squares for monohybrid, dihybrid, and trihybrid crosses. Calculate genotype and phenotype ratios.</p>',
      },
      '/molecular-weight': {
        title: 'Free Molecular Weight Calculator | BioSketch',
        description: 'Calculate molecular weight, elemental composition, and percent composition from any chemical formula. Supports all common elements. Free, no signup.',
        keywords: 'molecular weight calculator, molar mass calculator, chemical formula calculator, elemental composition, molecular mass',
        heading: 'Free Molecular Weight Calculator',
        body: '<p>Calculate molecular weight, elemental composition, and percent composition from any chemical formula.</p>',
      },
      '/unit-converter': {
        title: 'Free Scientific Unit Converter | BioSketch',
        description: 'Convert between scientific units: concentration, temperature, pressure, mass, volume, length, and energy. Includes OD600 to cell count, ng/µL to nM DNA, and Beer-Lambert calculator. Free, no signup.',
        keywords: 'scientific unit converter, concentration converter, molarity calculator, temperature converter, OD600 cell count, Beer-Lambert calculator',
        heading: 'Free Scientific Unit Converter',
        body: '<p>Convert between scientific units: concentration, temperature, pressure, mass, volume, length, and energy.</p>',
      },
      '/plasmid-viewer': {
        title: 'Free Plasmid Map Viewer - GenBank Visualizer | BioSketch',
        description: 'Visualize plasmid maps online from GenBank format files. Circular and linear views with annotated features, gene labels, and sequence browser. Free, no signup.',
        keywords: 'plasmid map viewer, GenBank visualizer, plasmid diagram, circular plasmid map, restriction sites, gene annotation, molecular cloning',
        heading: 'Free Plasmid Map Viewer',
        body: '<p>Visualize plasmid maps online from GenBank format files. Circular and linear views with annotated features and gene labels.</p>',
      },
      '/dna-tools': {
        title: 'Free DNA Sequence Tools - Reverse Complement, Translation, ORF Finder | BioSketch',
        description: 'Analyze DNA sequences online: reverse complement, 6-frame translation, ORF finder, GC content, melting temperature, and molecular weight. Free, no signup.',
        keywords: 'DNA sequence tools, reverse complement, DNA translation, ORF finder, GC content, melting temperature, nucleotide composition, FASTA',
        heading: 'Free DNA Sequence Tools',
        body: '<p>Analyze DNA sequences online: reverse complement, 6-frame translation, ORF finder, GC content, melting temperature, and molecular weight.</p>',
      },
      '/dilution-calculator': {
        title: 'Free Dilution & Molarity Calculator | BioSketch',
        description: 'C1V1=C2V2 dilution calculator, molarity from mass/volume/MW, and serial dilution series generator. Free online tool for researchers. No signup required.',
        keywords: 'dilution calculator, C1V1 C2V2, molarity calculator, serial dilution, concentration calculator, laboratory dilution',
        heading: 'Free Dilution & Molarity Calculator',
        body: '<p>C1V1=C2V2 dilution calculator, molarity from mass/volume/MW, and serial dilution series generator.</p>',
      },
      '/': {
        title: 'BioSketch - Free Scientific Illustration Tool for Researchers',
        description: 'Create stunning scientific illustrations with BioSketch - a free drag-and-drop tool for scientists and researchers. Build publication-ready figures with our extensive biomedical icon library.',
        keywords: 'scientific illustration, biomedical graphics, research illustration software, free science graphics, publication figures, scientific diagrams, biology illustration, medical graphics creator',
        heading: 'BioSketch — Free Scientific Illustration Tool',
        body: '<p>Create stunning scientific illustrations with BioSketch. A free drag-and-drop tool for scientists and researchers to build publication-ready figures.</p><ul><li><a href="/tools">Scientific Tools</a></li><li><a href="/icons">Icon Library</a></li><li><a href="/community">Community Gallery</a></li><li><a href="/blog">Blog</a></li></ul>',
      },
      '/contact': {
        title: 'Contact Us - BioSketch',
        description: 'Get in touch with the BioSketch team. Send us your questions, feedback, or suggestions for improving our scientific illustration tool.',
        keywords: 'contact BioSketch, scientific illustration support, BioSketch feedback',
        heading: 'Contact Us',
        body: '<p>Get in touch with the BioSketch team. Send us your questions, feedback, or suggestions.</p>',
      },
      '/testimonials': {
        title: 'Testimonials - BioSketch',
        description: 'What scientists and researchers say about BioSketch. Read reviews from our community of users who create scientific illustrations with BioSketch.',
        keywords: 'BioSketch reviews, scientific illustration testimonials, researcher feedback',
        heading: 'Testimonials',
        body: '<p>What scientists and researchers say about BioSketch. Read reviews from our community of users.</p>',
      },
      '/release-notes': {
        title: "What's New - BioSketch Release Notes",
        description: 'Latest features and improvements in BioSketch. Discover new tools for creating scientific illustrations including community gallery, icon suggestions, and advanced connectors.',
        keywords: 'BioSketch updates, new features, release notes, scientific illustration tool updates',
        heading: "What's New in BioSketch",
        body: '<p>Latest features and improvements in BioSketch. Discover new tools for creating scientific illustrations.</p>',
      },
      '/terms': {
        title: 'Terms and Conditions - BioSketch',
        description: 'Terms of service and usage guidelines for BioSketch scientific illustration tool. Learn about licensing, usage rights, and community guidelines.',
        keywords: 'BioSketch terms of service, usage guidelines, licensing',
        heading: 'Terms and Conditions',
        body: '<p>Terms of service and usage guidelines for BioSketch scientific illustration tool.</p>',
      },
    };

    const staticPage = staticPages[pagePath];
    if (staticPage) {
      title = staticPage.title;
      description = staticPage.description;
      canonical = baseUrl + pagePath;
      structuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: staticPage.title.split(' | ')[0],
        description: staticPage.description,
        url: canonical,
        applicationCategory: 'ScienceApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        creator: { '@type': 'Organization', name: 'BioSketch', url: baseUrl },
      });
      bodyContent = `<h1>${escapeHtml(staticPage.heading)}</h1>${staticPage.body}`;
    }

    // Generate full HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="BioSketch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImage}">
  ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
</head>
<body>
  <nav>
    <a href="${baseUrl}">Home</a> |
    <a href="${baseUrl}/icons">Icons</a> |
    <a href="${baseUrl}/blog">Blog</a> |
    <a href="${baseUrl}/community">Community</a> |
    <a href="${baseUrl}/contact">Contact</a>
  </nav>
  ${bodyContent}
  <footer>
    <p>&copy; BioSketch - Free Scientific Illustration Tool</p>
    <a href="${baseUrl}/terms">Terms</a> | <a href="${baseUrl}/contact">Contact</a>
  </footer>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Prerender error:', error);
    return new Response('Error generating page', {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatIconName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTextFromTipTap(nodes: any[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    if (node.content) {
      text += extractTextFromTipTap(node.content);
    }
  }
  return text.trim();
}
