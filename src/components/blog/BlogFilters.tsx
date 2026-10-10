import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";

export const BlogFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isSearching, setIsSearching] = useState(false);

  // Debounced auto-search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() !== (searchParams.get('search') || '')) {
        setIsSearching(true);
        if (searchQuery.trim()) {
          searchParams.set('search', searchQuery.trim());
        } else {
          searchParams.delete('search');
        }
        setSearchParams(searchParams);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchParams.set('search', searchQuery.trim());
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchParams.delete('search');
    setSearchParams(searchParams);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input
        type="text"
        placeholder="Search articles..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        className="pl-11 pr-11 h-12 text-sm rounded-full border bg-white/90 backdrop-blur-md shadow-sm focus:shadow-md focus:border-slate-300 transition-all"
        style={{ fontFamily: "Inter, sans-serif" }}
      />
      {searchQuery && !isSearching && (
        <Button
          variant="ghost"
          size="icon"
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-slate-100"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
};
