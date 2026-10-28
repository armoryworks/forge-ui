import { describe, it, expect } from 'vitest';

import en from '../../../../../public/assets/i18n/en.json';
import es from '../../../../../public/assets/i18n/es.json';
import { SETTINGS_SEARCH_INDEX } from './settings-search-index.const';

function lookup(catalog: unknown, key: string): string {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog) as string;
}

function sectionsMatching(catalog: unknown, query: string): string[] {
  const term = query.toLowerCase();
  return SETTINGS_SEARCH_INDEX
    .filter(section => section.textKeys.some(key => (lookup(catalog, key) ?? '').toLowerCase().includes(term)))
    .map(section => section.key);
}

describe('SETTINGS_SEARCH_INDEX', () => {
  it('resolves every indexed label in both catalogs', () => {
    for (const section of SETTINGS_SEARCH_INDEX) {
      for (const key of section.textKeys) {
        expect(typeof lookup(en, key), `en ${key}`).toBe('string');
        expect(typeof lookup(es, key), `es ${key}`).toBe('string');
      }
    }
  });

  it('finds the company profile, where the company time zone is set, when searching for the time zone', () => {
    expect(sectionsMatching(en, 'time zone')).toContain('company-profile');
    expect(sectionsMatching(es, 'zona horaria')).toContain('company-profile');
  });
});
