import { describe, expect, it } from 'vitest';

import { stockLoadRowErrors } from './stock-load-row-errors';

describe('stockLoadRowErrors', () => {
  it('places lines[i] errors on row i + 1 and the rest on the load', () => {
    expect(stockLoadRowErrors([
      { field: 'lines[2].location', message: 'no location', code: 'stock-load-unknown-location' },
      { field: 'stockLoad', message: 'connected', code: null },
    ])).toEqual([
      { row: 3, code: 'stock-load-unknown-location', message: 'no location' },
      { row: 0, code: null, message: 'connected' },
    ]);
  });
});
