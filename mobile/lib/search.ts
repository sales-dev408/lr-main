// Shared search matching for the app's directory screens.
// - Case/diacritic/punctuation-insensitive ("Denū" -> "denu", "&" -> "and")
// - Every word in the query must match somewhere (AND), in any order/field
// - A score ranks name hits first, then address/category/station

export function normalizeSearchText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function queryTokens(term: string): string[] {
  return normalizeSearchText(term).split(' ').filter(Boolean);
}

/**
 * Returns a match score (lower is better) or null when the query doesn't
 * match. `fields` should be ordered most-important first.
 */
export function searchScore(fields: (string | null | undefined)[], term: string): number | null {
  const tokens = queryTokens(term);
  if (!tokens.length) return 0;
  const normalized = fields.map((f) => ` ${normalizeSearchText(f)} `);
  let score = 0;
  for (const token of tokens) {
    const idx = normalized.findIndex((f) => f.includes(` ${token} `) || f.includes(` ${token}`) || f.includes(token));
    if (idx < 0) return null;
    score += idx;
  }
  // Exact-name bonus so 'Fry's' beats 'Fry's Pharmacy' for a 'frys' query.
  if (normalized[0] && normalized[0].trim() === tokens.join(' ')) score -= 2;
  return score;
}

export function matchesSearch(fields: (string | null | undefined)[], term: string): boolean {
  return searchScore(fields, term) !== null;
}
