import { FormControl, FormGroup } from '@angular/forms';

export type TransferLineForm = FormGroup<{
  key: FormControl<number>;
  partId: FormControl<number | null>;
  sourceBinContentId: FormControl<number | null>;
  toLocationId: FormControl<number | null>;
  quantity: FormControl<number | null>;
}>;
