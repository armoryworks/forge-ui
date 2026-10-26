import { ColumnDef } from '../models/column-def.model';

/**
 * Adds the functional-currency "Total (base)" column a multi-currency list shows beside each
 * row's own-currency total, ahead of a trailing actions column. The cell template reads
 * `totalFunctional`.
 */
export function withFunctionalTotal(columns: ColumnDef[], header: string): ColumnDef[] {
  const column: ColumnDef = { field: 'totalFunctional', header, width: '120px', align: 'right' };
  const actionsIndex = columns.findIndex(c => c.field === 'actions');
  return actionsIndex < 0
    ? [...columns, column]
    : [...columns.slice(0, actionsIndex), column, ...columns.slice(actionsIndex)];
}
