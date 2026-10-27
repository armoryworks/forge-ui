import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorBillDetailPanelComponent } from './vendor-bill-detail-panel.component';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillDetail } from '../../models/vendor-bill-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  canCreateCreditMemo(bill: VendorBillDetail): boolean;
}

const bill = (status: string) => ({ id: 31, status, amountPaid: 0, sourceExpenseId: null }) as unknown as VendorBillDetail;

describe('VendorBillDetailPanelComponent · credit memo', () => {
  const build = (roles: string[]): PanelInternals => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorBillService, useValue: { getVendorBillById: vi.fn(() => of(bill('Approved'))) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new VendorBillDetailPanelComponent()) as unknown as PanelInternals;
  };

  it('offers a credit memo on approved, part-paid and paid bills to the roles that manage payables', () => {
    const panel = build(['OfficeManager']);
    expect(panel.canCreateCreditMemo(bill('Approved'))).toBe(true);
    expect(panel.canCreateCreditMemo(bill('PartiallyPaid'))).toBe(true);
    expect(panel.canCreateCreditMemo(bill('Paid'))).toBe(true);
    expect(panel.canCreateCreditMemo(bill('Draft'))).toBe(false);
    expect(panel.canCreateCreditMemo(bill('Void'))).toBe(false);
  });

  it('hides it from Procurement and the Controller', () => {
    expect(build(['Procurement']).canCreateCreditMemo(bill('Approved'))).toBe(false);
    expect(build(['Controller']).canCreateCreditMemo(bill('Approved'))).toBe(false);
  });
});
