import { useState, useRef, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type { IconTag } from '@/types/tags';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  suggestions?: IconTag[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TagInput({
  value = [],
  onChange,
  maxTags = 3,
  suggestions = [],
  placeholder = 'Add tags...',
  disabled = false,
  className = ''
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    s =>
      s.tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(s.tag)
  ).slice(0, 10);

  // Validate tag
  const isValidTag = (tag: string): boolean => {
    const trimmed = tag.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;
    // Allow alphanumeric, spaces, hyphens, underscores
    return /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
  };

  // Add tag
  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();

    if (!trimmed) return;

    if (!isValidTag(trimmed)) {
      return;
    }

    if (value.includes(trimmed)) {
      return;
    }

    if (value.length >= maxTags) {
      return;
    }

    onChange([...value, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Remove tag
  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(newValue.length > 0 && value.length < maxTags);
  };

  // Handle key down
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap gap-2 p-2 border rounded-lg min-h-[42px] bg-background">
        {value.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="ml-1 hover:bg-destructive/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {value.length < maxTags && (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] border-0 focus-visible:ring-0 shadow-none p-0 h-auto"
          />
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-lg shadow-lg bg-popover">
          {filteredSuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion.tag);
              }}
              className="px-3 py-2 hover:bg-accent cursor-pointer flex justify-between items-center"
            >
              <span>{suggestion.tag}</span>
              <span className="text-xs text-muted-foreground">
                {suggestion.count} {suggestion.count === 1 ? 'icon' : 'icons'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
