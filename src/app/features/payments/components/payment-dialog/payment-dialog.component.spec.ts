import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaymentDialogComponent } from './payment-dialog.component';
import { PaymentService } from '../../services/payment.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { CurrencyService } from '../../../../shared/services/currency.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';

interface DialogInternals {
  paymentForm: FormGroup;
  appForm: FormGroup;
  invoiceOptions(): AutocompleteOption[];
}

describe('PaymentDialogComponent invoice picker', () => {
  let dialog: DialogInternals;
  let invoiceService: { getInvoices: ReturnType<typeof vi.fn> };

  const invoices = [
    { id: 5, invoiceNumber: 'INV-00005', status: 'Sent', balanceDue: 1250 },
    { id: 6, invoiceNumber: 'INV-00006', status: 'Paid', balanceDue: 0 },
    { id: 7, invoiceNumber: 'INV-00007', status: 'Draft', balanceDue: 300 },
  ] as InvoiceListItem[];

  beforeEach(() => {
    invoiceService = { getInvoices: vi.fn(() => of(invoices)) };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: PaymentService, useValue: {} },
        { provide: CustomerService, useValue: { getCustomers: () => of([]) } },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: ActiveCurrencyService, useValue: { listActiveCurrencies: () => of([]) } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: SnackbarService, useValue: {} },
        { provide: CurrencyService, useValue: { baseCurrency: signal('USD') } },
      ],
    });
    TestBed.inject(TranslateService).setTranslation('en', { payments: { invoiceOptionLabel: '{{number}} — {{balance}} open' } });
    TestBed.inject(TranslateService).use('en');
    dialog = TestBed.runInInjectionContext(() => new PaymentDialogComponent()) as unknown as DialogInternals;
  });

  it('offers the open invoices of the picked customer', () => {
    dialog.paymentForm.controls['customerId'].setValue(3);

    expect(invoiceService.getInvoices).toHaveBeenCalledWith(3);
    expect(dialog.invoiceOptions().map(o => o['value'])).toEqual([5]);
  });

  it('fills the invoice number and the open balance when an invoice is picked', () => {
    dialog.paymentForm.controls['customerId'].setValue(3);

    dialog.appForm.controls['invoiceId'].setValue(5);

    expect(dialog.appForm.controls['invoiceNumber'].value).toBe('INV-00005');
    expect(dialog.appForm.controls['amount'].value).toBe(1250);
    expect(dialog.appForm.valid).toBe(true);
  });

  it('labels each invoice with its open balance as money', () => {
    dialog.paymentForm.controls['customerId'].setValue(3);

    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1250);
    expect(dialog.invoiceOptions()[0]['label']).toBe(`INV-00005 — ${expected} open`);
  });

  it('refuses to apply more than the invoice still owes', () => {
    dialog.paymentForm.controls['customerId'].setValue(3);
    dialog.appForm.controls['invoiceId'].setValue(5);

    dialog.appForm.controls['amount'].setValue(1300);

    expect(dialog.appForm.controls['amount'].hasError('max')).toBe(true);
    expect(dialog.appForm.valid).toBe(false);
  });

  it('starts the payment date at today', () => {
    const date = dialog.paymentForm.controls['paymentDate'].value as Date;

    expect(date.toDateString()).toBe(new Date().toDateString());
  });
});
