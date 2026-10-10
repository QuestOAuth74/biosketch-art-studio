import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Palette, Check } from 'lucide-react';

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenuLabel className="flex items-center">
        <Palette className="mr-2 h-4 w-4" />
        Theme Color
      </DropdownMenuLabel>
      <DropdownMenuItem onClick={() => setTheme('purple')}>
        <div className="flex items-center gap-2 w-full">
          <div className="w-4 h-4 rounded-full bg-[hsl(260,60%,65%)] border border-border" />
          <span className="flex-1">Purple Theme</span>
          {theme === 'purple' && <Check className="h-4 w-4" />}
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('blue')}>
        <div className="flex items-center gap-2 w-full">
          <div className="w-4 h-4 rounded-full bg-[hsl(210,70%,55%)] border border-border" />
          <span className="flex-1">Blue Theme</span>
          {theme === 'blue' && <Check className="h-4 w-4" />}
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('fall')}>
        <div className="flex items-center gap-2 w-full">
          <div className="w-4 h-4 rounded-full bg-[hsl(38,85%,55%)] border border-border" />
          <span className="flex-1">Fall Theme</span>
          {theme === 'fall' && <Check className="h-4 w-4" />}
        </div>
      </DropdownMenuItem>
    </>
  );
};
