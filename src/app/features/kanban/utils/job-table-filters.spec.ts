import { describe, expect, it } from 'vitest';

import { ColumnDef } from '../../../shared/models/column-def.model';
import { toServerFilters } from './job-table-filters';

const columns: ColumnDef[] = [
  { field: 'title', header: 'Title' },
  { field: 'jobNumber', header: 'Job', type: 'text' },
  { field: 'currentStageId', header: 'Stage', type: 'enum' },
  { field: 'isOverdue', header: 'Overdue', type: 'enum' },
  { field: 'quantity', header: 'Qty', type: 'number' },
  { field: 'quotedPrice', header: 'Price', type: 'currency' },
  { field: 'dueDate', header: 'Due', type: 'date' },
  { field: 'operationsProgress', header: 'Ops', type: 'number', serverFilterable: false },
];

describe('toServerFilters', () => {
  it('writes each filter kind in the field:operator:value form GET /jobs takes', () => {
    expect(toServerFilters({
      title: 'bracket',
      jobNumber: { mode: 'startsWith', value: ' J-1 ' },
      currentStageId: [3, 4],
      isOverdue: [true],
      quantity: { min: 5, max: null },
      quotedPrice: { min: null, max: 9.5 },
      dueDate: { from: new Date(2026, 2, 1), to: new Date(2026, 2, 31) },
    }, columns)).toEqual([
      'title:contains:bracket',
      'jobNumber:startsWith:J-1',
      'currentStageId:in:3|4',
      'isOverdue:in:true',
      'quantity:range:5..',
      'quotedPrice:range:..9.5',
      'dueDate:range:2026-03-01..2026-03-31',
    ]);
  });

  it('reads dates restored from saved preferences as calendar days in local time', () => {
    const from = new Date(2026, 0, 15).toISOString();
    expect(toServerFilters({ dueDate: { from, to: null } }, columns)).toEqual(['dueDate:range:2026-01-15..']);
  });

  it('drops empty filters, unknown columns and columns the server cannot filter', () => {
    expect(toServerFilters({
      title: '   ',
      currentStageId: [],
      quantity: { min: null, max: null },
      dueDate: { from: null, to: null },
      operationsProgress: { min: 1 },
      nope: 'x',
    }, columns)).toEqual([]);
  });
});
