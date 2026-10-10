import { Loader2 } from 'lucide-react';
import noPreviewImage from '@/assets/no_preview.png';

interface ThumbnailWithSpinnerProps {
  src: string | null;
  alt: string;
  isRegenerating: boolean;
  hasError: boolean;
  className?: string;
}

export function ThumbnailWithSpinner({
  src,
  alt,
  isRegenerating,
  hasError,
  className = ''
}: ThumbnailWithSpinnerProps) {
  return (
    <div className="relative w-full h-full">
      <img
        src={src || noPreviewImage}
        alt={alt}
        className={`${className} ${isRegenerating ? 'opacity-70' : ''}`}
      />

      {isRegenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white/90 dark:bg-gray-900/90 rounded-full p-3 shadow-lg">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        </div>
      )}

      {hasError && !isRegenerating && (
        <div className="absolute bottom-2 right-2 bg-destructive/90 text-destructive-foreground text-xs px-2 py-1 rounded-md shadow-lg">
          Update failed
        </div>
      )}
    </div>
  );
}
