import { useBlogCategories } from "@/hooks/useBlogCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryManagerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export const CategoryManager = ({
  selectedCategories,
  onChange,
}: CategoryManagerProps) => {
  const { data: categories, isLoading } = useBlogCategories();

  const handleToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onChange([...selectedCategories, categoryId]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories?.map((category) => (
        <div key={category.id} className="flex items-center space-x-2">
          <Checkbox
            id={category.id}
            checked={selectedCategories.includes(category.id)}
            onCheckedChange={() => handleToggle(category.id)}
          />
          <Label
            htmlFor={category.id}
            className="text-sm font-normal cursor-pointer"
          >
            {category.name}
          </Label>
        </div>
      ))}
      {categories?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No categories available. Create one first.
        </p>
      )}
    </div>
  );
};
