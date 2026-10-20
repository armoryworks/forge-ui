import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApplyCreditDialogComponent } from './apply-credit-dialog.component';
import { PaymentService } from '../../services/payment.service';
import { PaymentDetail } from '../../models/payment-detail.model';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';

interface DialogInternals {
  appForm: FormGroup;
  invoiceOptions(): AutocompleteOption[];
  remainingCredit(): number;
  canAdd(): boolean;
  addApplication(): void;
  save(): void;
  ngOnInit(): void;
}

describe('ApplyCreditDialogComponent', () => {
  let dialog: DialogInternals;
  let paymentService: { applyPayment: ReturnType<typeof vi.fn> };
  let invoiceService: { getOpenInvoices: ReturnType<typeof vi.fn> };
  let savedCount: number;

  const payment = {
    id: 4, paymentNumber: 'PMT-00004', customerId: 3, unappliedAmount: 250, applications: [],
  } as unknown as PaymentDetail;

  const invoices = [
    { id: 5, invoiceNumber: 'INV-00005', status: 'Sent', balanceDue: 400 },
    { id: 6, invoiceNumber: 'INV-00006', status: 'Paid', balanceDue: 0 },
    { id: 7, invoiceNumber: 'INV-00007', status: 'Draft', balanceDue: 300 },
    { id: 8, invoiceNumber: 'INV-00008', status: 'PartiallyPaid', balanceDue: 100 },
  ] as InvoiceListItem[];

  beforeEach(() => {
    paymentService = { applyPayment: vi.fn(() => of({ id: 4 })) };
    invoiceService = { getOpenInvoices: vi.fn(() => of(invoices)) };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: PaymentService, useValue: paymentService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: ActiveCurrencyService, useValue: { listActiveCurrencies: () => of([]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ApplyCreditDialogComponent);
    fixture.componentRef.setInput('payment', payment);
    savedCount = 0;
    fixture.componentInstance.saved.subscribe(() => savedCount++);
    dialog = fixture.componentInstance as unknown as DialogInternals;
    dialog.ngOnInit();
  });

  it('offers only the open invoices of the payment customer', () => {
    expect(invoiceService.getOpenInvoices).toHaveBeenCalledWith(3);
    expect(dialog.invoiceOptions().map(o => o['value'])).toEqual([5, 8]);
  });

  it('suggests the smaller of the invoice balance and the remaining credit', () => {
    dialog.appForm.controls['invoiceId'].setValue(5);

    expect(dialog.appForm.controls['amount'].value).toBe(250);
  });

  it('will not add more than the remaining credit', () => {
    dialog.appForm.controls['invoiceId'].setValue(8);
    dialog.appForm.controls['amount'].setValue(100);
    dialog.addApplication();

    dialog.appForm.controls['invoiceId'].setValue(5);
    dialog.appForm.controls['amount'].setValue(200);

    expect(dialog.remainingCredit()).toBe(150);
    expect(dialog.canAdd()).toBe(false);
    expect(dialog.invoiceOptions().map(o => o['value'])).toEqual([5]);
  });

  it('posts the applications and reports success', () => {
    dialog.appForm.controls['invoiceId'].setValue(5);
    dialog.addApplication();

    dialog.save();

    expect(paymentService.applyPayment).toHaveBeenCalledWith(4, {
      applications: [{ invoiceId: 5, amount: 250, settlementFxRate: undefined }],
    });
    expect(savedCount).toBe(1);
  });
});
