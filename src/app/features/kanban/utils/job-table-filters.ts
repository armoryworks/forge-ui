import { ColumnDef } from '../../../shared/models/column-def.model';

/**
 * Translates the data table's column filters into the `filter=field:operator:value`
 * entries `GET /jobs` takes. Columns the server cannot filter, and empty filters, are left out.
 */
export function toServerFilters(filters: Record<string, unknown>, columns: readonly ColumnDef[]): string[] {
  const byField = new Map(columns.map(c => [c.field, c]));
  const entries: string[] = [];
  for (const [field, value] of Object.entries(filters)) {
    const col = byField.get(field);
    if (!col || col.filterable === false || col.serverFilterable === false || value == null) continue;
    const entry = serverFilter(field, col.type ?? 'text', value);
    if (entry) entries.push(entry);
  }
  return entries;
}

function serverFilter(field: string, type: NonNullable<ColumnDef['type']>, value: unknown): string | null {
  switch (type) {
    case 'enum': {
      const values = (Array.isArray(value) ? value : []).filter(v => v !== null && v !== undefined && v !== '');
      return values.length ? `${field}:in:${values.map(v => String(v)).join('|')}` : null;
    }
    case 'number':
    case 'currency': {
      const range = value as { min?: number | null; max?: number | null };
      const min = range.min ?? null;
      const max = range.max ?? null;
      return min === null && max === null ? null : `${field}:range:${min ?? ''}..${max ?? ''}`;
    }
    case 'date': {
      const range = value as { from?: Date | string | null; to?: Date | string | null };
      const from = calendarDay(range.from);
      const to = calendarDay(range.to);
      return from === null && to === null ? null : `${field}:range:${from ?? ''}..${to ?? ''}`;
    }
    default: {
      const text = typeof value === 'string'
        ? { mode: 'contains', value }
        : value as { mode?: string; value?: string };
      const needle = (text.value ?? '').trim();
      return needle ? `${field}:${text.mode ?? 'contains'}:${needle}` : null;
    }
  }
}

function calendarDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
