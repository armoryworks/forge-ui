import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { VendorCreditMemoDetailPanelComponent } from './vendor-credit-memo-detail-panel.component';
import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorCreditMemoDetail } from '../../models/vendor-credit-memo-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  memo: { set(value: VendorCreditMemoDetail | null): void; (): VendorCreditMemoDetail | null };
  canEdit(): boolean;
  canApply(): boolean;
  canUnapply(): boolean;
  canVoid(): boolean;
  issue(): void;
  unapply(applicationId: number, billNumber: string | null): void;
  openVoid(): void;
  voidForm: { setValue(value: { reason: string }): void };
  confirmVoid(): void;
  downloadPdf(): void;
}

const memo = (overrides: Partial<VendorCreditMemoDetail> = {}): VendorCreditMemoDetail => ({
  id: 4, memoNumber: 'VCM-000004', kind: 'VendorCredit', vendorId: 2, vendorName: 'Steel Supply', vendorBillId: null,
  vendorBillNumber: null, vendorReturnId: null, vendorReturnNumber: null, sourceType: 'Rebate', reason: 'Volume', vendorReference: null,
  status: 'Draft', memoDate: '2026-03-10', subtotal: 100, taxAmount: 0, total: 100, amountApplied: 0, openAmount: 0, currencyId: 1,
  currencyCode: 'USD', fxRate: 1, notes: null, issuedAt: null, voidedAt: null, voidReason: null, issueJournalEntryId: null,
  lines: [], applications: [], createdAt: '', updatedAt: '', rowVersion: 1, ...overrides,
});

describe('VendorCreditMemoDetailPanelComponent', () => {
  let panel: PanelInternals;
  let roles: string[];
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorCreditMemoService, useValue: service },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        {
          provide: AuthService,
          useValue: {
            hasRole: (role: string) => roles.includes(role),
            hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)),
          },
        },
      ],
    });
    panel = TestBed.runInInjectionContext(() => new VendorCreditMemoDetailPanelComponent()) as unknown as PanelInternals;
  };

  beforeEach(() => {
    roles = ['OfficeManager'];
    service = {
      getById: vi.fn(),
      issue: vi.fn(() => of(memo({ status: 'Open', openAmount: 100 }))),
      unapply: vi.fn(() => of(memo({ status: 'Open', openAmount: 100 }))),
      void: vi.fn(() => of(memo({ status: 'Voided' }))),
      getPdf: vi.fn(() => NEVER),
    };
  });

  it('offers edit and issue on a draft and issues it', () => {
    build();
    panel.memo.set(memo());
    expect(panel.canEdit()).toBe(true);
    expect(panel.canApply()).toBe(false);

    panel.issue();

    expect(service['issue']).toHaveBeenCalledWith(4);
    expect(panel.memo()?.status).toBe('Open');
    expect(panel.canApply()).toBe(true);
  });

  it('lets an approver void an unapplied memo, and refuses while it is applied', () => {
    roles = ['Manager'];
    build();
    panel.memo.set(memo({ status: 'Open', openAmount: 100 }));
    expect(panel.canVoid()).toBe(true);
    panel.memo.set(memo({ status: 'PartiallyApplied', amountApplied: 40, openAmount: 60 }));
    expect(panel.canVoid()).toBe(false);

    panel.memo.set(memo({ status: 'Open', openAmount: 100 }));
    panel.openVoid();
    panel.voidForm.setValue({ reason: 'Vendor withdrew it' });
    panel.confirmVoid();
    expect(service['void']).toHaveBeenCalledWith(4, 'Vendor withdrew it');
  });

  it('keeps an office manager from voiding and Procurement or the Controller from changing anything', () => {
    build();
    panel.memo.set(memo({ status: 'Open', openAmount: 100 }));
    expect(panel.canVoid()).toBe(false);

    for (const role of ['Procurement', 'Controller']) {
      roles = [role];
      build();
      panel.memo.set(memo({ status: 'Open', openAmount: 100 }));
      expect(panel.canEdit()).toBe(false);
      expect(panel.canApply()).toBe(false);
      expect(panel.canUnapply()).toBe(false);
    }
  });

  it('unapplies after confirming and downloads the PDF in the current language', () => {
    build();
    panel.memo.set(memo({ status: 'Applied', amountApplied: 100 }));
    panel.unapply(9, 'BILL-1');
    expect(service['unapply']).toHaveBeenCalledWith(4, 9);

    panel.downloadPdf();
    expect(service['getPdf']).toHaveBeenCalledWith(4, expect.any(String));
  });
});
