import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { LinkedPurchasingService } from '../../services/line-purchasing.service';
import { DropShipDeliveryDialogComponent } from './drop-ship-delivery-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  form: FormGroup<{ deliveredQuantity: FormControl<number | null>; trackingNumber: FormControl<string> }>;
  save(): void;
}

describe('DropShipDeliveryDialogComponent', () => {
  it('confirms the delivered quantity and tracking number, capped at what is left', () => {
    const confirmDropShipDelivery = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: LinkedPurchasingService, useValue: { confirmDropShipDelivery } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new DropShipDeliveryDialogComponent());
    mockSignalInputs(component, { purchaseOrderId: 4, purchaseOrderLineId: 40, poNumber: 'PO-4', remainingQuantity: 5 });
    const confirmed = vi.fn();
    component.confirmed.subscribe(confirmed);
    const dialog = component as unknown as DialogInternals;
    dialog.ngOnInit();

    expect(dialog.form.controls.deliveredQuantity.value).toBe(5);
    dialog.form.controls.deliveredQuantity.setValue(6);
    expect(dialog.form.invalid).toBe(true);
    dialog.form.patchValue({ deliveredQuantity: 3, trackingNumber: ' 1Z9 ' });
    dialog.save();

    expect(confirmDropShipDelivery).toHaveBeenCalledWith(4, 40, { deliveredQuantity: 3, trackingNumber: '1Z9' });
    expect(confirmed).toHaveBeenCalled();
  });
});
