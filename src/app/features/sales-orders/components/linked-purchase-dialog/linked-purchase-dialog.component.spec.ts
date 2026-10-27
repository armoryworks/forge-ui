import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { LinkedPurchasingService } from '../../services/line-purchasing.service';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { LinkedPurchaseDialogComponent } from './linked-purchase-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  form: FormGroup<{
    vendorId: FormControl<number | null>;
    quantity: FormControl<number | null>;
    unitCost: FormControl<number | null>;
    expectedDeliveryDate: FormControl<Date | null>;
    notes: FormControl<string>;
  }>;
  save(): void;
}

const LINE = { id: 11, lineNumber: 2 } as SalesOrderLine;

function create(createPurchase = vi.fn(() => of({ purchaseOrderId: 90 }))): { dialog: DialogInternals; component: LinkedPurchaseDialogComponent } {
  TestBed.configureTestingModule({
    providers: [
      { provide: LinkedPurchasingService, useValue: { createPurchase } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LinkedPurchaseDialogComponent());
  mockSignalInputs(component, { type: 'DropShip', salesOrderId: 7, line: LINE, openQuantity: 6 });
  const dialog = component as unknown as DialogInternals;
  dialog.ngOnInit();
  return { dialog, component };
}

describe('LinkedPurchaseDialogComponent', () => {
  it('prefills the open quantity and refuses more than the line needs', () => {
    const { dialog } = create();
    expect(dialog.form.controls.quantity.value).toBe(6);
    dialog.form.controls.quantity.setValue(7);
    expect(dialog.form.invalid).toBe(true);
  });

  it('raises the purchase order for the line and reports its id', () => {
    const createPurchase = vi.fn(() => of({ purchaseOrderId: 90 }));
    const { dialog, component } = create(createPurchase);
    const created = vi.fn();
    component.created.subscribe(created);
    dialog.form.patchValue({ vendorId: 5, quantity: 4, unitCost: 12.5, expectedDeliveryDate: new Date(2026, 10, 3), notes: ' rush ' });
    dialog.save();

    expect(createPurchase).toHaveBeenCalledWith('DropShip', 7, 11, {
      vendorId: 5, quantity: 4, unitCost: 12.5, expectedDeliveryDate: '2026-11-03T00:00:00Z', notes: 'rush',
    });
    expect(created).toHaveBeenCalledWith(90);
  });

  it('sends vendor 0 so the server picks the preferred vendor', () => {
    const createPurchase = vi.fn(() => of({ purchaseOrderId: 91 }));
    const { dialog } = create(createPurchase);
    dialog.save();
    expect(createPurchase).toHaveBeenCalledWith('DropShip', 7, 11, expect.objectContaining({ vendorId: 0, quantity: 6, unitCost: null }));
  });
});
