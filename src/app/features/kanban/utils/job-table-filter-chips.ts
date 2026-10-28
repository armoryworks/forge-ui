import { ColumnDef } from '../../../shared/models/column-def.model';
import { formatDate } from '../../../shared/utils/date.utils';

/** A readable summary of one column filter's value, for the filter chips above the jobs table. */
export function describeColumnFilter(col: ColumnDef, value: unknown, booleanLabel: (v: boolean) => string): string {
  switch (col.type ?? 'text') {
    case 'enum':
      return (Array.isArray(value) ? value : [])
        .map(v => col.filterOptions?.find(o => o.value === v)?.label ?? (typeof v === 'boolean' ? booleanLabel(v) : String(v)))
        .join(', ');
    case 'number':
    case 'currency': {
      const range = value as { min?: number | null; max?: number | null };
      return `${range.min ?? ''} – ${range.max ?? ''}`.trim();
    }
    case 'date': {
      const range = value as { from?: Date | string | null; to?: Date | string | null };
      return `${formatDate(range.from ?? null)} – ${formatDate(range.to ?? null)}`.trim();
    }
    default:
      return typeof value === 'string' ? value : (value as { value?: string })?.value ?? '';
  }
}
