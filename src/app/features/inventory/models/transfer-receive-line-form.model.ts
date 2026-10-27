import { FormControl, FormGroup } from '@angular/forms';

export type TransferReceiveLineForm = FormGroup<{
  partId: FormControl<number>;
  receivedQuantity: FormControl<number | null>;
  toLocationId: FormControl<number | null>;
}>;
