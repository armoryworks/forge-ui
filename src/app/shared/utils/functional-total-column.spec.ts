import { describe, expect, it } from 'vitest';

import { ColumnDef } from '../models/column-def.model';
import { withFunctionalTotal } from './functional-total-column';

describe('withFunctionalTotal', () => {
  const total: ColumnDef = { field: 'total', header: 'Total' };

  it('appends the functional total when there is no actions column', () => {
    const columns = withFunctionalTotal([total], 'Total (USD)');
    expect(columns.map(c => c.field)).toEqual(['total', 'totalFunctional']);
    expect(columns[1].header).toBe('Total (USD)');
  });

  it('keeps a trailing actions column last', () => {
    const columns = withFunctionalTotal([total, { field: 'actions', header: '' }], 'Total (USD)');
    expect(columns.map(c => c.field)).toEqual(['total', 'totalFunctional', 'actions']);
  });
});
