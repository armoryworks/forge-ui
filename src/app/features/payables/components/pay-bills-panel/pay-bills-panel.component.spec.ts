import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PayBillsPanelComponent } from './pay-bills-panel.component';
import { VendorPaymentService } from '../../services/vendor-payment.service';
import { PaymentRunService } from '../../services/payment-run.service';
import { VendorPaymentSuggestion } from '../../models/vendor-payment-suggestion.model';
import { PaymentRunDetail } from '../../models/payment-run-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const suggestion: VendorPaymentSuggestion = {
  vendorBillId: 31, billNumber: 'BILL-3001', vendorId: 4, vendorName: 'Steel Supply', vendorInvoiceNumber: 'V-1',
  currencyId: 1, currencyCode: 'USD', billDate: '2026-01-25T00:00:00Z', dueDate: '2026-02-24T00:00:00Z',
  balanceDue: 5000, suggestedPayAmount: 4900, suggestedDiscount: 100, discountDeadline: '2026-02-04T00:00:00Z',
  daysLeft: 2, paymentTermsName: '2/10 Net 30', vendorOpenCredit: 300,
};

const run = (status: string): PaymentRunDetail => ({
  id: 5, runNumber: 'PR-000005', status, paymentDate: '2026-02-03T00:00:00Z', method: 'Check', referenceNumber: null, notes: null,
  applyVendorCredits: true, lastError: status === 'Interrupted' ? 'Bank down' : null, createdAt: '', startedAt: null, completedAt: null,
  items: [],
});

interface PanelInternals {
  suggestions(): VendorPaymentSuggestion[];
  cashTotal(): number;
  savingsTotal(): number;
  creditTotal(): number;
  interruptedRun: Signal<PaymentRunDetail | null>;
  onSelectionChange(rows: unknown[]): void;
  pay(): void;
  resume(): void;
}

describe('PayBillsPanelComponent', () => {
  const getPaymentSuggestions = vi.fn();
  const create = vi.fn();
  const resume = vi.fn();
  const error = vi.fn();

  beforeEach(() => {
    getPaymentSuggestions.mockReset().mockReturnValue(of([suggestion]));
    create.mockReset().mockReturnValue(of(run('Completed')));
    resume.mockReset().mockReturnValue(of(run('Completed')));
    error.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorPaymentService, useValue: { getPaymentSuggestions } },
        { provide: PaymentRunService, useValue: { create, resume } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error } },
      ],
    });
  });

  it('loads suggestions and totals the picked bills\' cash, savings and the credits that can be deducted', () => {
    const panel = TestBed.runInInjectionContext(() => new PayBillsPanelComponent()) as unknown as PanelInternals;

    expect(getPaymentSuggestions).toHaveBeenCalled();
    expect(panel.suggestions()).toEqual([suggestion]);

    panel.onSelectionChange([suggestion]);
    expect(panel.cashTotal()).toBe(4900);
    expect(panel.savingsTotal()).toBe(100);
    expect(panel.creditTotal()).toBe(300);
  });

  it('pays the picked bills as a payment run that deducts vendor credits', () => {
    const panel = TestBed.runInInjectionContext(() => new PayBillsPanelComponent()) as unknown as PanelInternals;
    panel.onSelectionChange([suggestion]);

    panel.pay();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      method: 'Check',
      applyVendorCredits: true,
      items: [{ vendorBillId: 31, amount: 4900, discountAmount: 100 }],
    }));
    expect(panel.interruptedRun()).toBeNull();
  });

  it('offers to resume an interrupted run and resumes only that run', () => {
    create.mockReturnValue(of(run('Interrupted')));
    const panel = TestBed.runInInjectionContext(() => new PayBillsPanelComponent()) as unknown as PanelInternals;
    panel.onSelectionChange([suggestion]);

    panel.pay();
    expect(panel.interruptedRun()?.id).toBe(5);
    expect(error).toHaveBeenCalled();

    panel.resume();
    expect(resume).toHaveBeenCalledWith(5);
    expect(panel.interruptedRun()).toBeNull();
  });
});
