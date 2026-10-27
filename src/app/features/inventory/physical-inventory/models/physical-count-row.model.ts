import { FormControl } from '@angular/forms';

import { PhysicalInventoryTag } from './physical-inventory-tag.model';

export interface PhysicalCountRow extends PhysicalInventoryTag {
  control: FormControl<number | null>;
  isRecount: boolean;
}
