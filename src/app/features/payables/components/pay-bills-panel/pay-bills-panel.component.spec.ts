import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PayBillsPanelComponent } from './pay-bills-panel.component';
import { VendorPaymentService } from '../../services/vendor-payment.service';
import { VendorPaymentSuggestion } from '../../models/vendor-payment-suggestion.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const suggestion: VendorPaymentSuggestion = {
  vendorBillId: 31, billNumber: 'BILL-3001', vendorId: 4, vendorName: 'Steel Supply', vendorInvoiceNumber: 'V-1',
  currencyId: 1, currencyCode: 'USD', billDate: '2026-01-25T00:00:00Z', dueDate: '2026-02-24T00:00:00Z',
  balanceDue: 5000, suggestedPayAmount: 4900, suggestedDiscount: 100, discountDeadline: '2026-02-04T00:00:00Z',
  daysLeft: 2, paymentTermsName: '2/10 Net 30',
};

interface PanelInternals {
  suggestions(): VendorPaymentSuggestion[];
  cashTotal(): number;
  savingsTotal(): number;
  onSelectionChange(rows: unknown[]): void;
  pay(): void;
}

describe('PayBillsPanelComponent', () => {
  const getPaymentSuggestions = vi.fn();
  const createFromSuggestions = vi.fn();

  beforeEach(() => {
    getPaymentSuggestions.mockReset().mockReturnValue(of([suggestion]));
    createFromSuggestions.mockReset().mockReturnValue(of([{ id: 1 }]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorPaymentService, useValue: { getPaymentSuggestions, createFromSuggestions } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
  });

  it('loads suggestions and totals the picked bills\' cash and savings', () => {
    const panel = TestBed.runInInjectionContext(() => new PayBillsPanelComponent()) as unknown as PanelInternals;

    expect(getPaymentSuggestions).toHaveBeenCalled();
    expect(panel.suggestions()).toEqual([suggestion]);

    panel.onSelectionChange([suggestion]);
    expect(panel.cashTotal()).toBe(4900);
    expect(panel.savingsTotal()).toBe(100);
  });

  it('pays the picked bills with their suggested discount', () => {
    const panel = TestBed.runInInjectionContext(() => new PayBillsPanelComponent()) as unknown as PanelInternals;
    panel.onSelectionChange([suggestion]);

    panel.pay();

    expect(createFromSuggestions).toHaveBeenCalledWith(expect.objectContaining({
      method: 'Check',
      items: [{ vendorBillId: 31, amount: 4900, discountAmount: 100 }],
    }));
  });
});
