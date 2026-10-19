/**
 * Fold text for case- and accent-insensitive matching: decomposes to NFD, drops combining marks
 * and lower-cases, so 'Café', 'CAFE' and 'cafe' all fold to 'cafe'. Use on both the haystack and
 * the needle of a search.
 */
export function foldText(value: unknown): string {
  if (value == null) return '';
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
