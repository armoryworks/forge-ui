import { describe, expect, it } from 'vitest';

import { defaultBomSourceFor } from './bom-source-default.util';

describe('defaultBomSourceFor', () => {
  it('maps a Make child to Make', () => {
    expect(defaultBomSourceFor('Make')).toBe('Make');
  });

  it('maps Buy and Subcontract children to Buy', () => {
    expect(defaultBomSourceFor('Buy')).toBe('Buy');
    expect(defaultBomSourceFor('Subcontract')).toBe('Buy');
  });

  it('returns null for Phantom or a missing procurement source', () => {
    expect(defaultBomSourceFor('Phantom')).toBeNull();
    expect(defaultBomSourceFor(undefined)).toBeNull();
    expect(defaultBomSourceFor(null)).toBeNull();
  });

  it('never defaults to Stock', () => {
    for (const ps of ['Make', 'Buy', 'Subcontract', 'Phantom']) {
      expect(defaultBomSourceFor(ps)).not.toBe('Stock');
    }
  });
});
