import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { formatIconName } from "@/lib/iconNameFormatter";
import { SafeSvgRenderer } from "./SafeSvgRenderer";

interface IconCardProps {
  icon: {
    id: string;
    name: string;
    thumbnail: string | null;
    svg_content?: string;
    download_count?: number;
    like_count?: number;
  };
  index?: number;
}

export const IconCard = ({ icon, index = 0 }: IconCardProps) => {
  const displayName = formatIconName(icon.name);

  const thumbnailSrc = icon.thumbnail
    ? (icon.thumbnail.startsWith('data:') ? icon.thumbnail : `data:image/png;base64,${icon.thumbnail}`)
    : null;

  return (
    <Link
      to={`/icons/${icon.id}`}
      className="group block animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 hover:border-border hover:shadow-lg transition-all duration-300 overflow-hidden relative">
        {/* Hover dot overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none z-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Icon preview */}
        <div className="aspect-square bg-white flex items-center justify-center p-4">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={displayName}
              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          ) : icon.svg_content ? (
            <SafeSvgRenderer
              svgContent={icon.svg_content}
              className="w-full h-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg" />
          )}
        </div>

        {/* Info */}
        <div className="px-3 py-2 space-y-1 border-t border-dashed border-border/40">
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-200">
            {displayName}
          </p>
          {icon.like_count ? (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Heart className="h-2.5 w-2.5" />
                {icon.like_count}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
};
