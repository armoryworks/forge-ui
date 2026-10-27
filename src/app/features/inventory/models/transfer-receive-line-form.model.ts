import { FormControl, FormGroup } from '@angular/forms';

export type TransferReceiveLineForm = FormGroup<{
  lineId: FormControl<number>;
  partId: FormControl<number>;
  receivedQuantity: FormControl<number | null>;
  toLocationId: FormControl<number | null>;
}>;
