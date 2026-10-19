import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { InvoiceDetailPanelComponent } from './invoice-detail-panel.component';
import { SendInvoiceEmailDialogComponent } from '../send-invoice-email-dialog/send-invoice-email-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmSendService } from '../../../../shared/services/confirm-send.service';

type PanelInternals = {
  invoice: { set(v: InvoiceDetail): void };
  canEmail: () => boolean;
  numberControl: { setValue(v: string): void };
  canVoid(status: string): boolean;
  saveNumber(): void;
  deleteInvoice(): void;
  emailInvoice(): void;
  sendInvoice(): void;
};

describe('InvoiceDetailPanelComponent actions', () => {
  let panel: PanelInternals;
  let service: {
    getInvoiceById: ReturnType<typeof vi.fn>;
    renameInvoiceNumber: ReturnType<typeof vi.fn>;
    deleteInvoice: ReturnType<typeof vi.fn>;
  };
  let confirmSend: { confirmSend: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dialogResult: unknown;
  const invoice = { id: 7, invoiceNumber: 'INV-0007', customerName: 'Acme', status: 'Draft', rowVersion: 3 } as InvoiceDetail;

  beforeEach(() => {
    dialogResult = undefined;
    service = {
      getInvoiceById: vi.fn(() => of(invoice)),
      renameInvoiceNumber: vi.fn(() => of(undefined)),
      deleteInvoice: vi.fn(() => of(undefined)),
    };
    confirmSend = { confirmSend: vi.fn(() => of(false)) };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: InvoiceService, useValue: service },
        { provide: MatDialog, useValue: dialog },
        { provide: ConfirmSendService, useValue: confirmSend },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set(invoice);
  });

  it('sends the version it loaded when renaming the number', () => {
    panel.numberControl.setValue('INV-0100');

    panel.saveNumber();

    expect(service.renameInvoiceNumber).toHaveBeenCalledWith(7, 'INV-0100', 3);
  });

  it('sends the version it loaded when deleting the draft', () => {
    dialogResult = true;

    panel.deleteInvoice();

    expect(service.deleteInvoice).toHaveBeenCalledWith(7, 3);
  });

  it('offers void only where the server allows it', () => {
    expect(panel.canVoid('Draft')).toBe(false);
    expect(panel.canVoid('Sent')).toBe(true);
    expect(panel.canVoid('Overdue')).toBe(true);
    expect(panel.canVoid('Voided')).toBe(false);
  });

  it('offers Email only once the invoice is finalized', () => {
    expect(panel.canEmail()).toBe(false);
    panel.invoice.set({ ...invoice, status: 'Sent' });
    expect(panel.canEmail()).toBe(true);
    panel.invoice.set({ ...invoice, status: 'Voided' });
    expect(panel.canEmail()).toBe(false);
  });

  it('opens the email dialog for the invoice', () => {
    panel.invoice.set({ ...invoice, status: 'Sent' });

    panel.emailInvoice();

    expect(dialog.open).toHaveBeenCalledWith(SendInvoiceEmailDialogComponent, expect.objectContaining({
      data: { invoiceId: 7, invoiceNumber: 'INV-0007', customerName: 'Acme' },
    }));
  });

  it('asks to finalize, not to send, before finalizing', () => {
    panel.sendInvoice();

    expect(confirmSend.confirmSend).toHaveBeenCalledWith(expect.objectContaining({
      titleKey: 'invoices.confirmSendTitle',
      confirmLabelKey: 'invoices.send',
    }));
  });
});
