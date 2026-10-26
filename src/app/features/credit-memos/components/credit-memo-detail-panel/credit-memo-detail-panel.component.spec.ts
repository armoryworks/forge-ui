import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CreditMemoDetailPanelComponent } from './credit-memo-detail-panel.component';
import { CreditMemoService } from '../../services/credit-memo.service';
import { CreditMemoDetail } from '../../models/credit-memo-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  memo: { set(value: CreditMemoDetail | null): void; (): CreditMemoDetail | null };
  canIssue(): boolean;
  canDelete(): boolean;
  canApplyOrRefund(): boolean;
  canVoid(): boolean;
  issue(): void;
  unapply(applicationId: number, invoiceNumber: string | null): void;
  submitRefund(request: { amount: number; method: string; refundDate: string }): void;
  openVoid(target: { kind: 'memo' }): void;
  voidForm: { setValue(value: { reason: string }): void };
  confirmVoid(): void;
}

const memo = (overrides: Partial<CreditMemoDetail> = {}): CreditMemoDetail => ({
  id: 4, creditMemoNumber: 'CM-000004', customerId: 1, customerName: 'Acme', invoiceId: null, invoiceNumber: null,
  customerReturnId: null, returnNumber: null, reasonType: 'Goodwill', reason: 'Late', status: 'Draft', creditDate: '2026-03-10',
  taxRate: 0, subtotal: 50, taxAmount: 0, total: 50, amountApplied: 0, amountRefunded: 0, openAmount: 0, currencyId: 1,
  currencyCode: 'USD', fxRate: 1, notes: null, issuedAt: null, voidedAt: null, voidReason: null, issueJournalEntryId: null,
  lines: [], applications: [], refunds: [], createdAt: '', updatedAt: '', rowVersion: 1, ...overrides,
});

describe('CreditMemoDetailPanelComponent', () => {
  let panel: PanelInternals;
  let roles: string[];
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CreditMemoService, useValue: service },
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
    panel = TestBed.runInInjectionContext(() => new CreditMemoDetailPanelComponent()) as unknown as PanelInternals;
  };

  beforeEach(() => {
    roles = ['OfficeManager'];
    service = {
      getById: vi.fn(),
      issue: vi.fn(() => of(memo({ status: 'Issued', openAmount: 50 }))),
      unapply: vi.fn(() => of(memo({ status: 'Issued', openAmount: 50 }))),
      refund: vi.fn(() => of(memo({ status: 'Refunded', amountRefunded: 50 }))),
      void: vi.fn(() => of(memo({ status: 'Voided' }))),
    };
  });

  it('offers issue and delete on a draft and issues it', () => {
    build();
    panel.memo.set(memo());
    expect(panel.canIssue()).toBe(true);
    expect(panel.canDelete()).toBe(true);
    expect(panel.canApplyOrRefund()).toBe(false);

    panel.issue();

    expect(service['issue']).toHaveBeenCalledWith(4);
    expect(panel.memo()?.status).toBe('Issued');
    expect(panel.canApplyOrRefund()).toBe(true);
  });

  it('lets only Admin or Manager void, and only while nothing is applied or refunded', () => {
    build();
    panel.memo.set(memo({ status: 'Issued', openAmount: 50 }));
    expect(panel.canVoid()).toBe(false);

    roles = ['Manager'];
    build();
    panel.memo.set(memo({ status: 'Issued', openAmount: 50 }));
    expect(panel.canVoid()).toBe(true);
    panel.memo.set(memo({ status: 'PartiallyApplied', openAmount: 20, amountApplied: 30 }));
    expect(panel.canVoid()).toBe(false);
  });

  it('voids with the reason given', () => {
    roles = ['Admin'];
    build();
    panel.memo.set(memo({ status: 'Issued', openAmount: 50 }));
    panel.openVoid({ kind: 'memo' });
    panel.voidForm.setValue({ reason: 'Entered twice' });

    panel.confirmVoid();

    expect(service['void']).toHaveBeenCalledWith(4, 'Entered twice');
    expect(panel.memo()?.status).toBe('Voided');
  });

  it('refunds and unapplies through the service', () => {
    build();
    panel.memo.set(memo({ status: 'Issued', openAmount: 50 }));

    panel.submitRefund({ amount: 50, method: 'Check', refundDate: '2026-03-10T00:00:00Z' });
    expect(service['refund']).toHaveBeenCalledWith(4, expect.objectContaining({ amount: 50 }));

    panel.unapply(9, 'INV-1');
    expect(service['unapply']).toHaveBeenCalledWith(4, 9);
  });

  it('hides every action from a Controller', () => {
    roles = ['Controller'];
    build();
    panel.memo.set(memo({ status: 'Issued', openAmount: 50 }));
    expect(panel.canApplyOrRefund()).toBe(false);
    expect(panel.canVoid()).toBe(false);
  });
});
