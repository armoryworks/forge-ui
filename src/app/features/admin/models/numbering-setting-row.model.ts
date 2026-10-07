import { FormControl } from '@angular/forms';

export interface NumberingSettingRow {
  key: string;
  labelKey: string | null;
  displayName: string;
  control: FormControl<boolean>;
}
