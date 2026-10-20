import { describe, expect, it } from 'vitest';

import { foldText } from './text-fold';

describe('foldText', () => {
  it('drops accents and lower-cases', () => {
    expect(foldText('Café Ñandú')).toBe('cafe nandu');
  });

  it('folds precomposed and decomposed forms to the same text', () => {
    expect(foldText('é')).toBe(foldText('é'));
  });

  it('lets an unaccented needle match accented text', () => {
    expect(foldText('Señor García').includes(foldText('garcia'))).toBe(true);
  });

  it('turns null and undefined into an empty string', () => {
    expect(foldText(null)).toBe('');
    expect(foldText(undefined)).toBe('');
  });

  it('stringifies numbers', () => {
    expect(foldText(42)).toBe('42');
  });
});
