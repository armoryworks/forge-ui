import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorCreditMemoDialogComponent } from './vendor-credit-memo-dialog.component';
import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillDetail } from '../../models/vendor-bill-detail.model';
import { VendorCreditMemoLineEntry } from '../../models/vendor-credit-memo-line-entry.model';
import { VendorService } from '../../../vendors/services/vendor.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogInternals {
  billId: () => number | null;
  memo: () => null;
  ngOnInit(): void;
  bill(): VendorBillDetail | null;
  lines(): VendorCreditMemoLineEntry[];
  form: { controls: { vendorId: { value: number | null } }; patchValue(v: Record<string, unknown>): void };
  lineForm: { patchValue(v: Record<string, unknown>): void };
  addLine(): void;
  overCap(): boolean;
  canSave(): boolean;
  save(): void;
}

const bill = {
  id: 31, billNumber: 'BILL-31', vendorId: 2, vendorName: 'Steel Supply', status: 'Approved', currencyId: 1, currencyCode: 'USD',
  lines: [{ id: 7, lineNumber: 1, partId: 5, purchaseOrderLineId: null, description: 'Steel', quantity: 10, unitPrice: 50, lineTotal: 500,
    accountDeterminationKey: 'OPERATING_EXPENSE', glAccountId: null, glAccountName: null }],
} as unknown as VendorBillDetail;

describe('VendorCreditMemoDialogComponent', () => {
  let create: ReturnType<typeof vi.fn>;

  const build = (billId: number | null): DialogInternals => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorCreditMemoService, useValue: { create, update: vi.fn() } },
        { provide: VendorBillService, useValue: { getVendorBillById: vi.fn(() => of(bill)) } },
        { provide: VendorService, useValue: { getVendorDropdown: () => of([{ id: 2, companyName: 'Steel Supply' }]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new VendorCreditMemoDialogComponent()) as unknown as DialogInternals;
    Object.assign(dialog, { billId: () => billId, memo: () => null });
    dialog.ngOnInit();
    return dialog;
  };

  beforeEach(() => {
    create = vi.fn(() => of({ id: 12, memoNumber: 'VCM-000012' }));
  });

  it('takes the bill\'s vendor and caps a bill line at the billed quantity and price', () => {
    const dialog = build(31);
    expect(dialog.bill()?.id).toBe(31);
    expect(dialog.form.controls.vendorId.value).toBe(2);

    dialog.lineForm.patchValue({ vendorBillLineId: 7, quantity: 11, unitPrice: 50 });
    dialog.addLine();
    expect(dialog.lines()[0].maxQuantity).toBe(10);
    expect(dialog.overCap()).toBe(true);
    expect(dialog.canSave()).toBe(false);
  });

  it('saves a draft that credits the bill line', () => {
    const dialog = build(31);
    dialog.lineForm.patchValue({ vendorBillLineId: 7, quantity: 2, unitPrice: 50 });
    dialog.addLine();
    expect(dialog.canSave()).toBe(true);

    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      vendorId: 2, vendorBillId: 31, currencyId: null,
      lines: [expect.objectContaining({ vendorBillLineId: 7, quantity: 2, unitPrice: 50 })],
    }));
  });

  it('saves a standalone memo against the chosen vendor', () => {
    const dialog = build(null);
    dialog.form.patchValue({ vendorId: 2, reason: 'Rebate', sourceType: 'Rebate' });
    dialog.lineForm.patchValue({ description: 'Q1 rebate', quantity: 1, unitPrice: 75 });
    dialog.addLine();

    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ vendorId: 2, vendorBillId: null, sourceType: 'Rebate' }));
  });
});
