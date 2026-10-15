import { FormControl } from '@angular/forms';

export interface CatalogToggleRow {
  key: string;
  labelKey: string | null;
  displayName: string;
  description: string | null;
  control: FormControl<boolean>;
}
