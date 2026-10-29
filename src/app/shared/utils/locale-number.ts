const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-US' };

export interface NumberSeparators { decimal: string; group: string }

const separatorCache = new Map<string, NumberSeparators>();

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The decimal and group separators of the given app language (`en`, `es`) or Intl locale, as
 * `parseLocaleNumber` and `formatLocaleNumber` use them.
 */
export function numberSeparators(lang: string): NumberSeparators {
  const locale = LOCALES[lang] ?? lang;
  let separators = separatorCache.get(locale);
  if (!separators) {
    const parts = new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts(10000.5);
    separators = {
      decimal: parts.find(p => p.type === 'decimal')?.value ?? '.',
      group: parts.find(p => p.type === 'group')?.value ?? ',',
    };
    separatorCache.set(locale, separators);
  }
  return separators;
}

/**
 * Parse number text typed in the given app language (`en`, `es`). Accepts an optional sign, the
 * language's decimal separator and correctly placed group separators (`1,500.25` in en and in
 * es, which keeps US conventions as es-US). Returns null for blank text and NaN for anything else that is not a whole
 * number in that form (`1,5`, `-`, `1e3`), so a separator typed in the wrong place is reported
 * instead of being dropped.
 */
export function parseLocaleNumber(text: string | null | undefined, lang: string): number | null {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return null;
  const { decimal, group } = numberSeparators(lang);
  const d = escapeRegExp(decimal);
  const g = escapeRegExp(group);
  const pattern = new RegExp(`^([+-]?)(\\d+|[1-9]\\d{0,2}(?:${g}\\d{3})+)?(?:${d}(\\d*))?$`);
  const m = pattern.exec(trimmed);
  if (!m || (!m[2] && !m[3])) return NaN;
  const whole = (m[2] ?? '0').split(group).join('');
  const value = Number(`${m[1]}${whole}.${m[3] || '0'}`);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Format a number for display in the given app language without rounding it. Group separators
 * are added only when `grouping` is true, so quantity fields read `1500.25`.
 * `minimumFractionDigits` pads with zeros (`42.50` for money) and never rounds.
 */
export function formatLocaleNumber(value: number, lang: string, grouping = false, minimumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang] ?? lang, {
    useGrouping: grouping,
    minimumFractionDigits,
    maximumFractionDigits: 20,
  }).format(value);
}

/** Number of digits after the decimal point in a number or numeric attribute such as a step. */
export function decimalPlaces(value: number | string): number {
  const text = String(value).toLowerCase();
  const exp = text.match(/e-(\d+)$/);
  if (exp) return Number(exp[1]) + (text.split('e')[0].split('.')[1]?.length ?? 0);
  return text.split('.')[1]?.length ?? 0;
}
