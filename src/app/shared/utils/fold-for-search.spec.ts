import { describe, expect, it } from 'vitest';

import { foldForSearch, matchesSearch } from './fold-for-search';

describe('foldForSearch', () => {
  it('strips accents and lower-cases', () => {
    expect(foldForSearch('José Ñúñez')).toBe('jose nunez');
  });

  it('treats null and undefined as empty', () => {
    expect(foldForSearch(null)).toBe('');
    expect(foldForSearch(undefined)).toBe('');
  });
});

describe('matchesSearch', () => {
  it('matches an unaccented term against accented text', () => {
    expect(matchesSearch('José García', 'garcia')).toBe(true);
  });

  it('matches an accented term against unaccented text', () => {
    expect(matchesSearch('Jose Garcia', 'GARCÍA')).toBe(true);
  });

  it('matches everything for a blank term', () => {
    expect(matchesSearch('anything', '  ')).toBe(true);
  });

  it('rejects text that does not contain the term', () => {
    expect(matchesSearch('Floor', 'ofi')).toBe(false);
  });
});
