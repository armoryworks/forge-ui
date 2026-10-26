import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { VendorPaymentDialogComponent } from './vendor-payment-dialog.component';
import { VendorPaymentService } from '../../services/vendor-payment.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { VendorBillListItem } from '../../models/vendor-bill-list-item.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogInternals {
  paymentForm: FormGroup;
  applications: FormArray<FormGroup>;
  payWithDiscount(index: number): void;
  discountTotal(): number;
  save(): void;
}

const bill = {
  id: 31, billNumber: 'BILL-3001', status: 'Approved', balanceDue: 5000, dueDate: '2026-02-24T00:00:00Z',
  discountPercent: 2, discountDeadline: '2026-02-04T00:00:00Z', discountAvailable: 100,
} as VendorBillListItem;

describe('VendorPaymentDialogComponent early-payment discounts', () => {
  const createVendorPayment = vi.fn();
  let dialog: DialogInternals;

  beforeEach(() => {
    createVendorPayment.mockReset().mockReturnValue(of({}));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorPaymentService, useValue: { createVendorPayment } },
        { provide: VendorBillService, useValue: { getVendorBills: () => of([bill]) } },
        { provide: VendorService, useValue: { getVendorDropdown: () => of([]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    dialog = TestBed.runInInjectionContext(() => new VendorPaymentDialogComponent()) as unknown as DialogInternals;
    Object.defineProperty(dialog, 'dialogRef', { value: { clearDraft: vi.fn() } });
    dialog.paymentForm.controls['paymentDate'].setValue(new Date(2026, 1, 2));
    dialog.paymentForm.controls['vendorId'].setValue(4);
  });

  it('fills the discounted amount and the discount for a bill paid in the window', () => {
    dialog.payWithDiscount(0);

    expect(dialog.applications.at(0).value).toEqual({ amount: 4900, discount: 100 });
    expect(dialog.discountTotal()).toBe(100);
  });

  it('works the discount out from a typed amount and sends it with the application', () => {
    dialog.applications.at(0).controls['amount'].setValue(4900);
    expect(dialog.applications.at(0).controls['discount'].value).toBe(100);

    dialog.paymentForm.patchValue({ method: 'Check', amount: 4900 });
    dialog.save();

    expect(createVendorPayment).toHaveBeenCalledWith(expect.objectContaining({
      applications: [{ vendorBillId: 31, amount: 4900, discountAmount: 100 }],
    }));
  });
});
