import { useState } from "react";
import { ImageZoomModal } from "./ImageZoomModal";

interface BlogContentRendererProps {
  content: any; // TipTap JSON content
}

export const BlogContentRenderer = ({ content }: BlogContentRendererProps) => {
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [firstParagraphRendered, setFirstParagraphRendered] = useState(false);

  if (!content || !content.content) {
    return null;
  }

  const renderNode = (node: any, index: number): JSX.Element | null => {
    switch (node.type) {
      case 'paragraph':
        // Detect CTA button: paragraph with a single text child that has only a link mark
        if (
          node.content?.length === 1 &&
          node.content[0].type === 'text' &&
          node.content[0].marks?.length === 1 &&
          node.content[0].marks[0].type === 'link'
        ) {
          const linkMark = node.content[0].marks[0];
          const linkText = node.content[0].text;
          const href = linkMark.attrs?.href || '#';
          return (
            <div key={index} className="my-8 text-center font-sans">
              <a
                href={href}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary !text-white font-semibold text-sm tracking-wide shadow-sm hover:bg-primary/90 transition-colors no-underline visited:!text-white"
              >
                {linkText}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </a>
            </div>
          );
        }

        // Add drop-cap class to first paragraph only
        const isFirstParagraph = !firstParagraphRendered && node.content?.some((n: any) => n.text);
        if (isFirstParagraph) {
          setFirstParagraphRendered(true);
          return (
            <p key={index} className="drop-cap">
              {node.content?.map((child: any, i: number) => renderNode(child, i))}
            </p>
          );
        }
        return (
          <p key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </p>
        );

      case 'heading':
        const HeadingTag = `h${node.attrs?.level || 2}` as any;
        const headingText = node.content?.map((n: any) => (n.text ? n.text : '')).join('');
        const headingId = headingText?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || '';
        return (
          <HeadingTag key={index} id={headingId} className="scroll-mt-20">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </HeadingTag>
        );

      case 'text':
        let text = node.text;
        let element: JSX.Element = <span>{text}</span>;
        
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            switch (mark.type) {
              case 'bold':
                element = <strong>{element}</strong>;
                break;
              case 'italic':
                element = <em>{element}</em>;
                break;
              case 'underline':
                element = <u>{element}</u>;
                break;
              case 'link':
                element = (
                  <a href={mark.attrs?.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {element}
                  </a>
                );
                break;
              case 'code':
                element = <code className="bg-muted px-1 rounded">{element}</code>;
                break;
            }
          });
        }
        
        return element;

      case 'bulletList':
        return (
          <ul key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol key={index} className="list-decimal ml-8 space-y-3">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ol>
        );

      case 'listItem':
        return (
          <li key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </li>
        );

      case 'blockquote':
        return (
          <blockquote key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </blockquote>
        );

      case 'codeBlock':
        return (
          <pre key={index}>
            <code>
              {node.content?.map((child: any) => child.text).join('')}
            </code>
          </pre>
        );

      case 'image':
        return (
          <figure key={index}>
            <img
              src={node.attrs?.src}
              alt={node.attrs?.alt || ''}
              title={node.attrs?.title}
              className="max-w-full h-auto cursor-zoom-in hover:opacity-90 transition-opacity rounded-lg shadow-lg ring-1 ring-border/10"
              onClick={() => setZoomImage({ src: node.attrs?.src, alt: node.attrs?.alt || '' })}
            />
            {node.attrs?.title && (
              <figcaption>{node.attrs.title}</figcaption>
            )}
          </figure>
        );

      case 'youtube':
        const getYouTubeEmbedUrl = (url: string) => {
          if (!url) return '';
          
          // Extract video ID from various YouTube URL formats
          const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          const videoId = videoIdMatch ? videoIdMatch[1] : '';
          
          return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
        };

        const embedUrl = getYouTubeEmbedUrl(node.attrs?.src);
        
        return (
          <div key={index} className="my-8">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg ring-1 ring-border/10"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              />
            </div>
          </div>
        );

      case 'horizontalRule':
        return <hr key={index} />;

      case 'table':
        return (
          <div key={index} className="overflow-x-auto my-6">
            <table className="border-collapse table-auto w-full">
              <tbody>
                {node.content?.map((child: any, i: number) => renderNode(child, i))}
              </tbody>
            </table>
          </div>
        );

      case 'tableRow':
        const isEvenRow = index % 2 === 0;
        return (
          <tr 
            key={index} 
            className={isEvenRow ? "bg-muted/50" : "bg-background"}
          >
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </tr>
        );

      case 'tableHeader':
        return (
          <th 
            key={index} 
            className="border border-border px-4 py-2 text-left font-bold bg-muted"
          >
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </th>
        );

      case 'tableCell':
        return (
          <td 
            key={index} 
            className="border border-border px-4 py-2"
          >
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </td>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="blog-content-modern prose-enhanced">
        {content.content.map((node: any, index: number) => renderNode(node, index))}
      </div>
      
      {zoomImage && (
        <ImageZoomModal
          src={zoomImage.src}
          alt={zoomImage.alt}
          isOpen={!!zoomImage}
          onClose={() => setZoomImage(null)}
        />
      )}
    </>
  );
};
