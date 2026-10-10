/**
 * Search utility functions for icon search with relevance scoring
 */

export interface IconSearchResult {
  id: string;
  name: string;
  category: string;
  tags: string[] | null;
  thumbnail: string | null;
  uploaded_by?: string;
}

export type MatchType = 'exact-name' | 'tag-match' | 'partial-match';

export interface ScoredIcon extends IconSearchResult {
  matchType: MatchType;
  matchScore: number;
}

/**
 * Score and sort search results based on relevance
 * Priority: exact name match > tag match > partial match
 *
 * @param results - Array of icon search results from database
 * @param searchQuery - The search query string
 * @returns Scored and sorted array of icons
 */
export function scoreSearchResults(
  results: IconSearchResult[],
  searchQuery: string
): ScoredIcon[] {
  const query = searchQuery.toLowerCase().trim();

  return results.map(icon => {
    const name = icon.name.toLowerCase();
    const tags = (icon.tags || []).map(t => t.toLowerCase());

    let matchType: MatchType;
    let matchScore: number;

    // Exact name match (highest priority)
    if (name === query) {
      matchType = 'exact-name';
      matchScore = 1000;
    }
    // Name starts with query
    else if (name.startsWith(query)) {
      matchType = 'exact-name';
      matchScore = 900;
    }
    // Tag exact match
    else if (tags.includes(query)) {
      matchType = 'tag-match';
      matchScore = 500;
    }
    // Tag starts with query
    else if (tags.some(tag => tag.startsWith(query))) {
      matchType = 'tag-match';
      matchScore = 400;
    }
    // Partial name match
    else if (name.includes(query)) {
      matchType = 'partial-match';
      matchScore = 200;
    }
    // Partial tag match
    else if (tags.some(tag => tag.includes(query))) {
      matchType = 'tag-match';
      matchScore = 150;
    }
    // Fallback (textSearch found it via stemming)
    // Note: Since category is removed from search_vector,
    // any remaining matches are from stemmed name/tag words
    else {
      matchType = 'partial-match';
      matchScore = 100;
    }

    return { ...icon, matchType, matchScore };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
