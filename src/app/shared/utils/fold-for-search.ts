/**
 * Normalise text for a case- and accent-insensitive "contains" match: NFD-decomposes,
 * strips combining marks and lower-cases, so "José" and "jose" fold to the same value.
 * Apply it to both the haystack and the typed term.
 */
export function foldForSearch(text: string | null | undefined): string {
  return (text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** True when `term` is empty or its folded form occurs in the folded `text`. */
export function matchesSearch(text: string | null | undefined, term: string | null | undefined): boolean {
  const needle = foldForSearch(term).trim();
  return !needle || foldForSearch(text).includes(needle);
}
