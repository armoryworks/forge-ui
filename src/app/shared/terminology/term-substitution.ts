import {
  TERM_CATALOG, TERM_EXCLUDED_KEY_PREFIXES, TermGender, genderKey, pluralKey, singularKey,
} from './term-catalog';

export type TermOverrideMap = ReadonlyMap<string, string>;

export interface ResolvedTerm {
  one?: string;
  other?: string;
  gender?: TermGender;
}

export type TranslationTree = { [key: string]: TranslationNode };
type TranslationNode = string | TranslationNode[] | TranslationTree | null | number | boolean;

interface FormInfo {
  termId: string | null;
  plural: boolean;
  gender?: TermGender;
}

interface CompiledPattern {
  regex: RegExp;
  lookup: Map<string, FormInfo>;
}

export interface TermSubstituter {
  readonly lang: string;
  readonly termIds: ReadonlySet<string>;
  substitute(text: string, allowed?: ReadonlySet<string>): string;
}

const PROTECTED_SEGMENT = /(\{\{[^}]*\}\}|<[^>]*>)/;
const WORD_CHAR = '[\\p{L}\\p{N}_]';

export function resolveTerms(overrides: TermOverrideMap, lang: string): Map<string, ResolvedTerm> {
  const resolved = new Map<string, ResolvedTerm>();
  for (const term of TERM_CATALOG) {
    if (!term.locales[lang]) continue;
    const one = clean(overrides.get(singularKey(term, lang)));
    const other = clean(overrides.get(pluralKey(term, lang))) ?? (one ? pluralize(one, lang) : undefined);
    if (!one && !other) continue;
    const genderValue = lang === 'en' ? undefined : overrides.get(genderKey(term, lang));
    const gender = genderValue === 'm' || genderValue === 'f' ? genderValue : undefined;
    resolved.set(term.id, { one, other, gender });
  }
  return resolved;
}

export function pluralize(singular: string, lang: string): string {
  const words = singular.trim().split(/\s+/);
  if (lang === 'es') {
    words[0] = pluralizeEs(words[0]);
    return words.join(' ');
  }
  words[words.length - 1] = pluralizeEn(words[words.length - 1]);
  return words.join(' ');
}

export function createSubstituter(overrides: TermOverrideMap, lang: string): TermSubstituter {
  const resolved = resolveTerms(overrides, lang);
  const termIds = new Set(resolved.keys());
  const renamed = [...resolved.values()].flatMap(term => [term.one, term.other]).filter((label): label is string => !!label);
  const pattern = compilePattern(lang, termIds, renamed);

  const substitute = (text: string, allowed?: ReadonlySet<string>): string => {
    if (!pattern || !text) return text;
    pattern.regex.lastIndex = 0;
    const hit = pattern.regex.test(text);
    pattern.regex.lastIndex = 0;
    if (!hit) return text;
    const segments = text.split(PROTECTED_SEGMENT);
    for (let i = 0; i < segments.length; i += 2) {
      segments[i] = replaceSegment(segments[i], pattern, resolved, lang, allowed);
    }
    return segments.join('');
  };

  return { lang, termIds, substitute };
}

export function transformCatalog(
  catalog: TranslationTree,
  substituter: TermSubstituter,
  gate?: { catalog: TranslationTree; lang: string },
): TranslationTree {
  if (substituter.termIds.size === 0) return catalog;
  const gatePattern = gate ? compilePattern(gate.lang, substituter.termIds) : null;

  const allowedFor = (gateText: unknown): ReadonlySet<string> | undefined | null => {
    if (!gate) return undefined;
    if (typeof gateText !== 'string' || !gatePattern) return null;
    const found = new Set<string>();
    for (const match of gateText.matchAll(gatePattern.regex)) {
      const info = gatePattern.lookup.get(normalize(match[0], gate.lang));
      if (info?.termId) found.add(info.termId);
    }
    return found.size ? found : null;
  };

  const walk = (node: TranslationNode, gateNode: unknown, path: string): TranslationNode => {
    if (typeof node === 'string') {
      if (TERM_EXCLUDED_KEY_PREFIXES.some(prefix => path.startsWith(prefix))) return node;
      const allowed = allowedFor(gateNode);
      if (allowed === null) return node;
      return substituter.substitute(node, allowed);
    }
    if (Array.isArray(node)) {
      return node.map((child, i) => walk(child, Array.isArray(gateNode) ? gateNode[i] : undefined, `${path}${i}.`));
    }
    if (node && typeof node === 'object') {
      const out: TranslationTree = {};
      const gateTree = gateNode && typeof gateNode === 'object' ? gateNode as Record<string, unknown> : undefined;
      for (const [key, child] of Object.entries(node)) {
        out[key] = walk(child, gateTree?.[key], typeof child === 'string' ? `${path}${key}` : `${path}${key}.`);
      }
      return out;
    }
    return node;
  };

  return walk(catalog, gate?.catalog, '') as TranslationTree;
}

const patternCache = new Map<string, CompiledPattern | null>();

function compilePattern(lang: string, termIds: ReadonlySet<string>, renamed: readonly string[] = []): CompiledPattern | null {
  if (termIds.size === 0) return null;
  const cacheKey = `${lang}|${[...termIds].sort().join(',')}|${[...renamed].map(r => normalize(r, lang)).sort().join('\u0000')}`;
  const cached = patternCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const lookup = new Map<string, FormInfo>();
  const protectedForms: string[] = [];
  for (const term of TERM_CATALOG) {
    if (!termIds.has(term.id)) continue;
    const locale = term.locales[lang];
    if (!locale) continue;
    for (const form of locale.forms) {
      lookup.set(normalize(form.text, lang), { termId: term.id, plural: form.plural, gender: form.gender });
    }
    protectedForms.push(...(locale.protect ?? []));
  }
  for (const phrase of [...protectedForms, ...renamed]) {
    const key = normalize(phrase, lang);
    if (!lookup.has(key)) lookup.set(key, { termId: null, plural: false });
  }

  const alternatives = [...lookup.keys()]
    .sort((a, b) => b.length - a.length)
    .map(form => form.split(' ').map(escapeRegex).join('\\s+'));
  const compiled = alternatives.length
    ? { regex: new RegExp(`(?<!${WORD_CHAR})(?:${alternatives.join('|')})(?!${WORD_CHAR})`, 'giu'), lookup }
    : null;
  patternCache.set(cacheKey, compiled);
  return compiled;
}

function replaceSegment(
  segment: string,
  pattern: CompiledPattern,
  resolved: Map<string, ResolvedTerm>,
  lang: string,
  allowed?: ReadonlySet<string>,
): string {
  let out = '';
  let last = 0;
  for (const match of segment.matchAll(pattern.regex)) {
    const matched = match[0];
    const start = match.index ?? 0;
    out += segment.slice(last, start);
    last = start + matched.length;

    const info = pattern.lookup.get(normalize(matched, lang));
    const term = info?.termId ? resolved.get(info.termId) : undefined;
    const replacement = term ? (info!.plural ? term.other : term.one) : undefined;
    if (!info?.termId || !term || !replacement || (allowed && !allowed.has(info.termId))) {
      out += matched;
      continue;
    }
    out = fixDeterminer(out, lang, info, term.gender ?? info.gender, replacement);
    out += applyCase(matched, replacement, lang);
  }
  return out + segment.slice(last);
}

function applyCase(matched: string, replacement: string, lang: string): string {
  const upper = matched.toLocaleUpperCase(lang);
  if (matched.length > 1 && matched === upper && matched !== matched.toLocaleLowerCase(lang)) {
    return replacement.toLocaleUpperCase(lang);
  }
  const first = matched.charAt(0);
  if (first !== first.toLocaleLowerCase(lang)) {
    return replacement.charAt(0).toLocaleUpperCase(lang) + replacement.slice(1);
  }
  return replacement
    .split(/(\s+)/)
    .map(word => (/^\p{Lu}\p{Ll}*$/u.test(word) ? word.toLocaleLowerCase(lang) : word))
    .join('');
}

const EN_ARTICLE = /(?<![\p{L}\p{N}_])(a|an)(\s+)$/iu;

const ES_DETERMINERS: Record<string, string> = {
  el: 'la', del: 'de la', al: 'a la', un: 'una', 'ningún': 'ninguna', este: 'esta', ese: 'esa', nuevo: 'nueva', otro: 'otra',
  todo: 'toda', aquel: 'aquella', primer: 'primera', 'último': 'última',
  los: 'las', unos: 'unas', estos: 'estas', esos: 'esas', nuevos: 'nuevas', otros: 'otras', todos: 'todas', aquellos: 'aquellas',
};
const ES_DETERMINERS_REVERSED: Record<string, string> = Object.fromEntries(
  Object.entries(ES_DETERMINERS).map(([m, f]) => [f, m]),
);
const ES_DETERMINER_TAIL = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${[...Object.keys(ES_DETERMINERS), ...Object.values(ES_DETERMINERS)]
    .sort((a, b) => b.length - a.length)
    .map(d => d.split(' ').map(escapeRegex).join('\\s+'))
    .join('|')})(\\s+)$`,
  'iu',
);

function fixDeterminer(out: string, lang: string, info: FormInfo, targetGender: TermGender | undefined, replacement: string): string {
  if (lang === 'en') {
    if (info.plural) return out;
    const match = EN_ARTICLE.exec(out);
    if (!match) return out;
    const wanted = takesAn(replacement) ? 'an' : 'a';
    return out.slice(0, match.index) + matchCase(match[1], wanted, lang) + match[2];
  }
  if (lang === 'es') {
    if (!info.gender || !targetGender || info.gender === targetGender) return out;
    const table = targetGender === 'f' ? ES_DETERMINERS : ES_DETERMINERS_REVERSED;
    let result = out;
    let end = out.length;
    for (let i = 0; i < 3; i++) {
      const match = ES_DETERMINER_TAIL.exec(result.slice(0, end));
      const swapped = match ? table[normalize(match[1], lang)] : undefined;
      if (!match || !swapped) break;
      result = result.slice(0, match.index) + matchCase(match[1], swapped, lang) + match[2] + result.slice(end);
      end = match.index;
    }
    return result;
  }
  return out;
}

function takesAn(word: string): boolean {
  const first = word.split(/\s+/)[0] ?? '';
  if (first.length > 1 && /^\p{Lu}+$/u.test(first)) return /^[AEFHILMNORSX]/.test(first);
  return /^[aeiou]/i.test(first);
}

function matchCase(original: string, wanted: string, lang: string): string {
  if (original.length > 1 && original === original.toLocaleUpperCase(lang)) return wanted.toLocaleUpperCase(lang);
  const first = original.charAt(0);
  return first !== first.toLocaleLowerCase(lang) ? wanted.charAt(0).toLocaleUpperCase(lang) + wanted.slice(1) : wanted;
}

function pluralizeEn(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}${word.endsWith('Y') ? 'IES' : 'ies'}`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

const ES_ACCENTED: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const ES_PLAIN: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

function pluralizeEs(word: string): string {
  const upper = word.length > 1 && word === word.toLocaleUpperCase('es');
  const suffix = (text: string) => (upper ? text.toLocaleUpperCase('es') : text);
  if (/[áéíóú][ns]$/i.test(word)) return `${word.slice(0, -2)}${swapVowel(word.charAt(word.length - 2), ES_PLAIN)}${word.slice(-1)}${suffix('es')}`;
  if (/[aeiouáéó]$/i.test(word)) return `${word}${suffix('s')}`;
  if (/z$/i.test(word)) return `${word.slice(0, -1)}${suffix('ces')}`;
  const multisyllable = (word.match(/[aeiouáéíóúü]+/gi)?.length ?? 0) > 1;
  if (multisyllable && /[sx]$/i.test(word)) return word;
  if (multisyllable && /n$/i.test(word) && !/[áéíóú]/i.test(word)) return `${accentPenultimate(word)}${suffix('es')}`;
  return `${word}${suffix('es')}`;
}

function accentPenultimate(word: string): string {
  const stem = word.replace(/[aeiouü]+n$/i, '');
  const group = /[aeiouü]+(?=[^aeiouü]*$)/i.exec(stem);
  if (!group) return word;
  const strong = Math.max(...['a', 'e', 'o'].map(v => group[0].toLowerCase().lastIndexOf(v)));
  const index = group.index + (strong >= 0 ? strong : group[0].length - 1);
  return word.slice(0, index) + swapVowel(word.charAt(index), ES_ACCENTED) + word.slice(index + 1);
}

function swapVowel(vowel: string, table: Record<string, string>): string {
  const swapped = table[vowel.toLowerCase()];
  if (!swapped) return vowel;
  return vowel === vowel.toLowerCase() ? swapped : swapped.toUpperCase();
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalize(text: string, lang: string): string {
  return text.replace(/\s+/g, ' ').toLocaleLowerCase(lang);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

