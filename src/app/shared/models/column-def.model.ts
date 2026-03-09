import { SelectOption } from '../components/select/select.component';

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
}
