import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceEmailRecipient } from '../../models/invoice-email-recipient.model';
import { SendInvoiceEmailDialogComponent } from './send-invoice-email-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

type DialogInternals = {
  form: { controls: { recipientEmail: { value: string; setValue(v: string): void; markAsDirty(): void } }; invalid: boolean };
  recipient: () => InvoiceEmailRecipient | null;
  send(): void;
};

describe('SendInvoiceEmailDialogComponent', () => {
  let service: { getEmailRecipient: ReturnType<typeof vi.fn>; emailInvoice: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  function create(recipient: InvoiceEmailRecipient): DialogInternals {
    service = {
      getEmailRecipient: vi.fn(() => of(recipient)),
      emailInvoice: vi.fn(() => of(undefined)),
    };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: InvoiceService, useValue: service },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { invoiceId: 7, invoiceNumber: 'INV-0007', customerName: 'Acme' } },
      ],
    });
    return TestBed.runInInjectionContext(() => new SendInvoiceEmailDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('pre-fills the billing contact and emails the invoice to it', () => {
    const dlg = create({ email: 'elias@buyer.test', source: 'billing-contact', contactName: 'Ledger, Elias' });

    expect(service.getEmailRecipient).toHaveBeenCalledWith(7);
    expect(dlg.form.controls.recipientEmail.value).toBe('elias@buyer.test');
    expect(dlg.recipient()?.source).toBe('billing-contact');

    dlg.send();

    expect(service.emailInvoice).toHaveBeenCalledWith(7, { recipientEmail: 'elias@buyer.test' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('cannot send until a recipient is entered when the customer has no email', () => {
    const dlg = create({ email: null, source: null, contactName: null });

    expect(dlg.form.invalid).toBe(true);
    dlg.send();
    expect(service.emailInvoice).not.toHaveBeenCalled();

    dlg.form.controls.recipientEmail.setValue('ap@buyer.test');
    dlg.send();
    expect(service.emailInvoice).toHaveBeenCalledWith(7, { recipientEmail: 'ap@buyer.test' });
  });
});
