import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AccountingHubService } from '../../shared/services/accounting-hub.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { VendorService } from '../vendors/services/vendor.service';
import { PayablesComponent } from './payables.component';
import { BankingService } from './services/banking.service';
import { PaymentTransmissionService } from './services/payment-transmission.service';
import { VendorBillService } from './services/vendor-bill.service';
import { VendorPaymentService } from './services/vendor-payment.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PayablesInternals {
  activeTab(): string;
  canManage: boolean;
  canReadPayments: boolean;
  nachaEnabled(): boolean;
}

describe('PayablesComponent · role access', () => {
  let bills: { getVendorBills: ReturnType<typeof vi.fn> };
  let payments: { getVendorPayments: ReturnType<typeof vi.fn> };
  let transmissions: { getPaymentTransmissions: ReturnType<typeof vi.fn> };
  let banking: { getBatches: ReturnType<typeof vi.fn>; getBankAccounts: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bills = { getVendorBills: vi.fn(() => of([])) };
    payments = { getVendorPayments: vi.fn(() => of([])) };
    transmissions = { getPaymentTransmissions: vi.fn(() => of([])) };
    banking = { getBatches: vi.fn(() => of([])), getBankAccounts: vi.fn(() => of([])) };
  });

  function setup(roles: string[], tab: string): PayablesInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: VendorBillService, useValue: bills },
        { provide: VendorPaymentService, useValue: payments },
        { provide: PaymentTransmissionService, useValue: transmissions },
        { provide: BankingService, useValue: banking },
        { provide: VendorService, useValue: { getVendorDropdown: () => of([]) } },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: () => true, capabilities: () => [] } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: AccountingHubService, useValue: { subscribe: () => () => undefined } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PayablesComponent()) as unknown as PayablesInternals;
    TestBed.flushEffects();
    return component;
  }

  it('shows Procurement the bills only, read-only, and never asks for payments or transmissions', () => {
    const payables = setup(['Procurement'], 'payments');

    expect(payables.activeTab()).toBe('bills');
    expect(payables.canManage).toBe(false);
    expect(payables.canReadPayments).toBe(false);
    expect(bills.getVendorBills).toHaveBeenCalled();
    expect(payments.getVendorPayments).not.toHaveBeenCalled();
    expect(transmissions.getPaymentTransmissions).not.toHaveBeenCalled();
  });

  it('lets the Controller review bills and payments without the manage actions or the bank tabs', () => {
    const payables = setup(['Controller'], 'payments');

    expect(payables.activeTab()).toBe('payments');
    expect(payables.canManage).toBe(false);
    expect(payables.nachaEnabled()).toBe(false);
    expect(payments.getVendorPayments).toHaveBeenCalled();
    expect(transmissions.getPaymentTransmissions).toHaveBeenCalledWith('Failed');
  });

  it('keeps the bank tabs from the Controller even on a deep link', () => {
    const payables = setup(['Controller'], 'batches');

    expect(payables.activeTab()).toBe('bills');
    expect(banking.getBatches).not.toHaveBeenCalled();
  });

  it('gives an office manager every tab and the manage actions', () => {
    const payables = setup(['OfficeManager'], 'batches');

    expect(payables.activeTab()).toBe('batches');
    expect(payables.canManage).toBe(true);
    expect(banking.getBatches).toHaveBeenCalled();
  });
});

describe('PayablesComponent · detail deep link', () => {
  let detailFromUrl: { entityType: string; entityId: number } | null;
  let detailDialog: { getDetailFromUrl: () => typeof detailFromUrl; open: ReturnType<typeof vi.fn> };
  let glChanged: () => void;

  function setup(): void {
    detailDialog = {
      getDetailFromUrl: () => detailFromUrl,
      open: vi.fn(() => ({ afterClosed: () => of(false) })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab: 'payments' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: VendorBillService, useValue: { getVendorBills: vi.fn(() => of([])) } },
        { provide: VendorPaymentService, useValue: { getVendorPayments: vi.fn(() => of([])) } },
        { provide: PaymentTransmissionService, useValue: { getPaymentTransmissions: vi.fn(() => of([])) } },
        { provide: BankingService, useValue: { getBatches: vi.fn(() => of([])), getBankAccounts: vi.fn(() => of([])) } },
        { provide: VendorService, useValue: { getVendorDropdown: () => of([]) } },
        { provide: DetailDialogService, useValue: detailDialog },
        { provide: CapabilityService, useValue: { isEnabled: () => true, capabilities: () => [] } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: AccountingHubService,
          useValue: { subscribe: (reload: () => void) => { glChanged = reload; return () => undefined; } },
        },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    });
    TestBed.runInInjectionContext(() => new PayablesComponent());
    TestBed.flushEffects();
  }

  it('opens the payment named in the URL once when the page loads', () => {
    detailFromUrl = { entityType: 'vendor-payment', entityId: 7 };
    setup();
    glChanged();

    expect(detailDialog.open).toHaveBeenCalledTimes(1);
    expect(detailDialog.open.mock.calls[0][1]).toBe(7);
  });

  it('does not reopen a payment the user opened when a GL push reloads the lists', () => {
    detailFromUrl = null;
    setup();

    detailFromUrl = { entityType: 'vendor-payment', entityId: 7 };
    glChanged();

    expect(detailDialog.open).not.toHaveBeenCalled();
  });
});
