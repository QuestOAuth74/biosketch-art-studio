export const getWebApplicationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "BioSketch",
  "url": "https://biosketch.art",
  "description": "Create stunning scientific illustrations with BioSketch - a free drag-and-drop tool for scientists and researchers",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "Drag and drop interface",
    "Scientific icon library",
    "Export to multiple formats",
    "Community submissions",
    "Open source and free"
  ],
  "screenshot": "https://lovable.dev/opengraph-image-p98pqg.png",
  "softwareVersion": "1.0",
  "author": {
    "@type": "Organization",
    "name": "BioSketch",
    "url": "https://biosketch.art"
  }
});

export const getOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BioSketch",
  "url": "https://biosketch.art",
  "logo": "https://biosketch.art/favicon.ico",
  "description": "BioSketch provides free scientific illustration tools for researchers and scientists worldwide",
  "sameAs": [
    "https://github.com/biosketch"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Support",
    "url": "https://biosketch.art/contact"
  }
});

export const getSoftwareApplicationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "BioSketch",
  "applicationCategory": "GraphicsApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "150",
    "bestRating": "5",
    "worstRating": "1"
  }
});

export const getBreadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});
