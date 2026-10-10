import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Starfish SVG icon used as the premium creator badge. */
const StarfishIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Five-arm starfish shape */}
    <path d="M12 1.5l2.4 6.8 6.6.6-5.1 4.4 1.7 6.7L12 16.2 6.4 20l1.7-6.7-5.1-4.4 6.6-.6z" />
    {/* Small center dot for organic starfish feel */}
    <circle cx="12" cy="11" r="1.5" opacity="0.3" />
  </svg>
);

interface VerifiedBadgeProps {
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
}

export const VerifiedBadge = ({
  size = 'sm',
  showTooltip = true,
  className
}: VerifiedBadgeProps) => {
  const badge = (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 text-white shadow-sm",
        size === 'sm' ? "w-5 h-5" : "w-6 h-6",
        className
      )}
    >
      <StarfishIcon className={cn(
        "drop-shadow-sm",
        size === 'sm' ? "w-3.5 h-3.5" : "w-4 h-4"
      )} />
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Premium Creator - 3+ approved projects</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
