import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELDS_OF_STUDY } from '@/lib/constants';

interface CommunityFiltersProps {
  sortBy: 'recent' | 'popular' | 'cloned' | 'liked';
  onSortChange: (value: 'recent' | 'popular' | 'cloned' | 'liked') => void;
  fieldFilter: string;
  onFieldChange: (value: string) => void;
}

export function CommunityFilters({ sortBy, onSortChange, fieldFilter, onFieldChange }: CommunityFiltersProps) {
  const filters = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'liked', label: 'Most Liked' },
    { value: 'popular', label: 'Most Viewed' },
    { value: 'cloned', label: 'Most Used' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto items-center">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onSortChange(filter.value as any)}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-xl border-2 border-dashed transition-all duration-200 ${
            sortBy === filter.value
              ? 'bg-primary text-primary-foreground border-primary/40 shadow-sm'
              : 'bg-card/60 text-muted-foreground border-border/60 hover:border-border hover:shadow-sm'
          }`}
        >
          {filter.label}
        </button>
      ))}
      <Select value={fieldFilter} onValueChange={onFieldChange}>
        <SelectTrigger className="h-9 w-44 rounded-xl text-sm border-2 border-dashed border-border/60 bg-card/60 hover:border-border transition-all duration-200">
          <SelectValue placeholder="All Fields" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Fields</SelectItem>
          {FIELDS_OF_STUDY.map((field) => (
            <SelectItem key={field} value={field}>
              {field}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
