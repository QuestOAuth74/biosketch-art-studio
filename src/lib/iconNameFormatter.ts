const ABBREVIATIONS = new Set([
  'dna', 'rna', 'pcr', 'atp', 'adp', 'gdp', 'gtp', 'nad', 'fad',
  'mrna', 'trna', 'rrna', 'sirna', 'crispr', 'cas9',
  'hiv', 'hpv', 'covid', 'sars',
  'nmr', 'ms', 'hplc', 'gc', 'uv', 'ir', 'sem', 'tem',
  'ph', 'edta', 'dmso', 'pbs', 'bsa',
  'elisa', 'facs', 'fret', 'gfp', 'yfp', 'rfp',
  'ii', 'iii', 'iv',
]);

/**
 * Format an icon name for display:
 * - Strip common prefixes
 * - Replace hyphens/underscores with spaces
 * - Title case, preserving known abbreviations as uppercase
 */
export function formatIconName(rawName: string): string {
  let name = rawName;

  // Strip common prefixes
  name = name.replace(/^(bioicons?[-_]|icon[-_]|ic[-_])/i, '');

  // Replace separators with spaces
  name = name.replace(/[-_]+/g, ' ').trim();

  // Title case each word, uppercase known abbreviations
  return name
    .split(/\s+/)
    .map(word => {
      if (ABBREVIATIONS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
