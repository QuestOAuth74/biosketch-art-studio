import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LoadingProgressProps {
  iconName: string;
  progress: number;
  onCancel: () => void;
}

export const LoadingProgress = ({ iconName, progress, onCancel }: LoadingProgressProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 50);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className="fixed bottom-20 right-4 bg-background border border-border rounded-lg shadow-lg p-4 w-80 animate-in slide-in-from-bottom-5 duration-300 z-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            Loading {iconName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {displayProgress < 10 ? 'Initializing...' :
             displayProgress < 50 ? 'Parsing SVG...' :
             displayProgress < 90 ? 'Processing...' :
             'Almost done...'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-2"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <Progress value={displayProgress} className="h-2" />
      
      <p className="text-xs text-muted-foreground mt-2 text-right">
        {Math.round(displayProgress)}%
      </p>
    </div>
  );
};
