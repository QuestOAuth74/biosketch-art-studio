import { describe, it, expect } from 'vitest';
import { scoreSearchResults, type IconSearchResult } from '@/lib/searchUtils';

/**
 * Helper to create mock icon for testing
 */
const createMockIcon = (
  id: string,
  name: string,
  tags: string[] | null = null
): IconSearchResult => ({
  id,
  name,
  category: 'Test',
  tags,
  thumbnail: null,
});

describe('Icon Search Algorithm', () => {
  describe('scoreSearchResults', () => {
    it('should rank exact name match higher than tag match', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'antibiotic', ['biology']),
        createMockIcon('2', 'biology', ['science']),
      ];

      const scored = scoreSearchResults(icons, 'biology');

      // Exact name match (id: 2) should score 1000
      // Tag match (id: 1) should score 500
      expect(scored[0].id).toBe('2');
      expect(scored[0].matchScore).toBe(1000);
      expect(scored[0].matchType).toBe('exact-name');

      expect(scored[1].id).toBe('1');
      expect(scored[1].matchScore).toBe(500);
      expect(scored[1].matchType).toBe('tag-match');
    });

    it('should rank prefix matches higher than substring matches', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'antibiotic', null), // substring match
        createMockIcon('2', 'biology', null), // prefix match
      ];

      const scored = scoreSearchResults(icons, 'bio');

      // Prefix match (id: 2) should score 900
      // Substring match (id: 1) should score 200
      expect(scored[0].id).toBe('2');
      expect(scored[0].matchScore).toBe(900);
      expect(scored[0].matchType).toBe('exact-name');

      expect(scored[1].id).toBe('1');
      expect(scored[1].matchScore).toBe(200);
      expect(scored[1].matchType).toBe('partial-match');
    });

    it('should perform case-insensitive search', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'DNA', null),
        createMockIcon('2', 'dna', null),
        createMockIcon('3', 'Dna', null),
      ];

      // Test all different case variations
      const scoredLower = scoreSearchResults(icons, 'dna');
      const scoredUpper = scoreSearchResults(icons, 'DNA');
      const scoredMixed = scoreSearchResults(icons, 'Dna');

      // All should match with score 1000 (exact match)
      expect(scoredLower.every(icon => icon.matchScore === 1000)).toBe(true);
      expect(scoredUpper.every(icon => icon.matchScore === 1000)).toBe(true);
      expect(scoredMixed.every(icon => icon.matchScore === 1000)).toBe(true);

      // All should be exact-name match type
      expect(scoredLower.every(icon => icon.matchType === 'exact-name')).toBe(true);
    });

    it('should handle special characters correctly', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'covid-19', null),
        createMockIcon('2', 'h2o', null),
        createMockIcon('3', 'test_icon', null),
      ];

      // Test exact matches with special characters
      const covidScored = scoreSearchResults(icons, 'covid-19');
      expect(covidScored[0].id).toBe('1');
      expect(covidScored[0].matchScore).toBe(1000);

      const h2oScored = scoreSearchResults([icons[1]], 'h2o');
      expect(h2oScored[0].id).toBe('2');
      expect(h2oScored[0].matchScore).toBe(1000);

      const underscoreScored = scoreSearchResults([icons[2]], 'test_icon');
      expect(underscoreScored[0].id).toBe('3');
      expect(underscoreScored[0].matchScore).toBe(1000);
    });

    it('should handle empty or whitespace-only search with prefix match score', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'biology', ['science']),
        createMockIcon('2', 'chemistry', ['science']),
      ];

      // Empty string matches everything with startsWith (score 900)
      // This is expected behavior since ''.trim() === '' and all strings start with ''
      const emptyScored = scoreSearchResults(icons, '');
      expect(emptyScored.every(icon => icon.matchScore === 900)).toBe(true);
      expect(emptyScored.every(icon => icon.matchType === 'exact-name')).toBe(true);

      // Whitespace-only should behave the same after trim
      const whitespaceScored = scoreSearchResults(icons, '   ');
      expect(whitespaceScored.every(icon => icon.matchScore === 900)).toBe(true);
    });

    it('should handle tag prefix matches correctly', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'testicon', ['biochemistry']), // tag prefix match: 400
        createMockIcon('2', 'othericon', ['science', 'chemistry']), // no match
      ];

      const scored = scoreSearchResults(icons, 'biochem');

      // Tag prefix match (biochemistry starts with 'biochem') should score 400
      expect(scored[0].id).toBe('1');
      expect(scored[0].matchScore).toBe(400);
      expect(scored[0].matchType).toBe('tag-match');

      // Icon2 has no match, should get fallback score (100)
      expect(scored[1].matchScore).toBe(100);
    });

    it('should handle partial tag matches correctly', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'test', ['antibiotic']),
        createMockIcon('2', 'test2', ['chemistry']),
      ];

      const scored = scoreSearchResults(icons, 'bio');

      // Partial tag match (antibiotic) should score 150
      expect(scored[0].id).toBe('1');
      expect(scored[0].matchScore).toBe(150);
      expect(scored[0].matchType).toBe('tag-match');
    });

    it('should handle icons with null tags', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'biology', null),
        createMockIcon('2', 'antibiotic', null),
      ];

      const scored = scoreSearchResults(icons, 'bio');

      // Should still match by name, ignoring null tags
      expect(scored[0].id).toBe('1');
      expect(scored[0].matchScore).toBe(900); // prefix match
    });

    it('should handle icons with empty tag arrays', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'biology', []),
        createMockIcon('2', 'antibiotic', []),
      ];

      const scored = scoreSearchResults(icons, 'bio');

      // Should still match by name, ignoring empty tags
      expect(scored[0].id).toBe('1');
      expect(scored[0].matchScore).toBe(900); // prefix match
    });

    it('should return results sorted by score descending', () => {
      const icons: IconSearchResult[] = [
        createMockIcon('1', 'antibiotic', null), // 200 - partial (contains 'bio')
        createMockIcon('2', 'biology', null), // 900 - prefix (starts with 'bio')
        createMockIcon('3', 'bio', null), // 1000 - exact match ('bio' === 'bio')
        createMockIcon('4', 'test', ['science', 'education']), // fallback: 100
      ];

      const scored = scoreSearchResults(icons, 'bio');

      // Check order: exact (1000) > prefix (900) > partial (200) > fallback (100)
      expect(scored[0].id).toBe('3'); // exact name match: 1000
      expect(scored[0].matchScore).toBe(1000);

      expect(scored[1].id).toBe('2'); // name prefix match: 900
      expect(scored[1].matchScore).toBe(900);

      expect(scored[2].id).toBe('1'); // name partial match: 200
      expect(scored[2].matchScore).toBe(200);

      expect(scored[3].id).toBe('4'); // fallback: 100
      expect(scored[3].matchScore).toBe(100);

      // Verify scores are descending
      for (let i = 0; i < scored.length - 1; i++) {
        expect(scored[i].matchScore).toBeGreaterThanOrEqual(scored[i + 1].matchScore);
      }
    });
  });
});
