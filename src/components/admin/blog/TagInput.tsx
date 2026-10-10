import { useState, useEffect } from "react";
import { useBlogTags, useCreateTag } from "@/hooks/useBlogTags";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export const TagInput = ({ selectedTags, onChange }: TagInputProps) => {
  const { data: allTags } = useBlogTags();
  const createTag = useCreateTag();
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  const selectedTagObjects = allTags?.filter((tag) =>
    selectedTags.includes(tag.id)
  );

  const handleSelectTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onChange([...selectedTags, tagId]);
    }
    setInputValue("");
    setOpen(false);
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter((id) => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!inputValue.trim()) return;

    const slug = inputValue
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .trim();

    const newTag = await createTag.mutateAsync({
      name: inputValue.trim(),
      slug,
    });

    if (newTag) {
      handleSelectTag(newTag.id);
    }
  };

  const filteredTags = allTags?.filter(
    (tag) =>
      !selectedTags.includes(tag.id) &&
      tag.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2">
        {selectedTagObjects?.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Tag Input with Autocomplete */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            placeholder="Type to add tags..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filteredTags && filteredTags.length > 0) {
                  handleSelectTag(filteredTags[0].id);
                } else {
                  handleCreateTag();
                }
              }
            }}
          />
        </PopoverTrigger>
        {open && inputValue && (
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandList>
                {filteredTags && filteredTags.length > 0 ? (
                  <CommandGroup>
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        onSelect={() => handleSelectTag(tag.id)}
                      >
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <CommandEmpty>
                    <button
                      onClick={handleCreateTag}
                      className="w-full text-left px-2 py-1 hover:bg-accent rounded"
                    >
                      Create "{inputValue}"
                    </button>
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};
