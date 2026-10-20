import { SelectOption } from '../components/select/select.component';

export type TextMatchMode =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'notContains'
  | 'notEquals';

export interface TextFilterValue {
  mode: TextMatchMode;
  value: string;
}

export interface ColumnDef {
  field: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'number' | 'date' | 'enum';
  filterOptions?: SelectOption[];
  width?: string;
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Property to sort by when `field` is composed/display-only and doesn't exist on the row. */
  sortField?: string;
  /** Value resolver for sort when the sort key isn't a direct property (multi-field compositions, derived status, etc.). Takes precedence over `sortField`. */
  sortValue?: (row: unknown) => unknown;
  /** Value resolver for CSV/Excel export, used instead of rendering the cell template (templates that load data per row, composed cells, etc.). */
  exportValue?: (row: unknown) => unknown;
  /** Set to `false` to leave the column out of CSV/Excel exports. */
  exportable?: boolean;
}
