import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApplyVendorCreditDialogComponent } from './apply-vendor-credit-dialog.component';
import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillListItem } from '../../models/vendor-bill-list-item.model';

interface DialogInternals {
  ngOnInit(): void;
  bills(): VendorBillListItem[];
  form: { setValue(v: { vendorBillId: number | null; amount: number | null }): void };
  canSave(): boolean;
  save(): void;
}

const memo = { id: 4, memoNumber: 'VCM-000004', vendorId: 2, currencyId: 1, currencyCode: 'USD', openAmount: 100 };
const bill = (id: number, balanceDue: number, currencyId = 1, status = 'Approved') =>
  ({ id, billNumber: `BILL-${id}`, balanceDue, currencyId, status }) as VendorBillListItem;

describe('ApplyVendorCreditDialogComponent', () => {
  it('offers only the vendor\'s approved bills in the memo currency and caps the amount', () => {
    const apply = vi.fn(() => of(memo));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorCreditMemoService, useValue: { apply } },
        { provide: VendorBillService, useValue: { getVendorBills: vi.fn(() => of([bill(1, 40), bill(2, 300, 2), bill(3, 90, 1, 'Draft')])) } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new ApplyVendorCreditDialogComponent()) as unknown as DialogInternals;
    Object.assign(dialog, { memo: () => memo });
    dialog.ngOnInit();

    expect(dialog.bills().map(b => b.id)).toEqual([1]);
    dialog.form.setValue({ vendorBillId: 1, amount: 50 });
    expect(dialog.canSave()).toBe(false);
    dialog.form.setValue({ vendorBillId: 1, amount: 40 });
    expect(dialog.canSave()).toBe(true);

    dialog.save();
    expect(apply).toHaveBeenCalledWith(4, 1, 40);
  });
});
