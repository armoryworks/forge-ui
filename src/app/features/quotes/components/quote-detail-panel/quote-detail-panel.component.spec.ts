import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { QuoteDetailPanelComponent } from './quote-detail-panel.component';
import { QuoteService } from '../../services/quote.service';
import { QuoteDetail } from '../../models/quote-detail.model';
import { SendQuoteEmailDialogComponent } from '../send-quote-email-dialog/send-quote-email-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface PanelInternals {
  quote: { set(value: QuoteDetail | null): void; (): QuoteDetail | null };
  changed: { subscribe(fn: () => void): unknown };
  closed: { subscribe(fn: () => void): unknown };
  duplicateQuote(): void;
  reviseQuote(): void;
  canRevise(status: string): boolean;
  close(): void;
  sendQuote(): void;
  markSent(): void;
  downloadPdf(): void;
  canSend(status: string): boolean;
  canMarkSent(status: string): boolean;
  acceptQuote(): void;
  convertToOrder(): void;
}

describe('QuoteDetailPanelComponent', () => {
  let panel: PanelInternals;
  let quoteService: {
    getQuoteById: ReturnType<typeof vi.fn>;
    getRecipientEmail: ReturnType<typeof vi.fn>;
    sendQuote: ReturnType<typeof vi.fn>;
    getQuotePdf: ReturnType<typeof vi.fn>;
    duplicateQuote: ReturnType<typeof vi.fn>;
    reviseQuote: ReturnType<typeof vi.fn>;
    acceptQuote: ReturnType<typeof vi.fn>;
    convertToOrder: ReturnType<typeof vi.fn>;
  };
  let snackbar: { success: ReturnType<typeof vi.fn>; successWithNav: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dialogResult: unknown;

  const quote = { id: 12, quoteNumber: 'Q-0012', customerId: 4, customerName: 'Acme Corp', status: 'Draft' } as QuoteDetail;
  const copy = { ...quote, id: 30, quoteNumber: 'Q-0030' } as QuoteDetail;

  beforeEach(() => {
    dialogResult = undefined;
    quoteService = {
      getQuoteById: vi.fn(() => of(quote)),
      getRecipientEmail: vi.fn(() => of('buyer@acme.test')),
      sendQuote: vi.fn(() => of(undefined)),
      getQuotePdf: vi.fn(() => of(new Blob(['%PDF'], { type: 'application/pdf' }))),
      duplicateQuote: vi.fn(() => of(copy)),
      reviseQuote: vi.fn(() => of({ ...copy, quoteNumber: 'Q-0012-R1' })),
      acceptQuote: vi.fn(() => of(undefined)),
      convertToOrder: vi.fn(() => of({ id: 55, orderNumber: 'SO-0055' })),
    };
    snackbar = { success: vi.fn(), successWithNav: vi.fn() };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
        { provide: QuoteService, useValue: quoteService },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    panel = TestBed.runInInjectionContext(() => new QuoteDetailPanelComponent()) as unknown as PanelInternals;
    panel.quote.set(quote);
  });

  it('opens the send-email dialog with the buyer email filled in and reloads on close', () => {
    dialogResult = true;

    panel.sendQuote();

    expect(quoteService.getRecipientEmail).toHaveBeenCalledWith(4);
    expect(dialog.open).toHaveBeenCalledWith(SendQuoteEmailDialogComponent, expect.objectContaining({
      data: { quoteId: 12, quoteNumber: 'Q-0012', customerName: 'Acme Corp', recipientEmail: 'buyer@acme.test' },
    }));
    expect(quoteService.sendQuote).not.toHaveBeenCalled();
    expect(quoteService.getQuoteById).toHaveBeenCalledWith(12);
  });

  it('marks the quote sent through the status-only call after confirmation', () => {
    dialogResult = true;

    panel.markSent();

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.anything());
    expect(quoteService.sendQuote).toHaveBeenCalledWith(12);
  });

  it('does not mark the quote sent when the confirmation is cancelled', () => {
    dialogResult = false;

    panel.markSent();

    expect(quoteService.sendQuote).not.toHaveBeenCalled();
  });

  it('downloads the PDF without changing status', () => {
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:quote');
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    panel.downloadPdf();

    expect(quoteService.getQuotePdf).toHaveBeenCalledWith(12);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:quote');
    expect(quoteService.sendQuote).not.toHaveBeenCalled();
    click.mockRestore();
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('offers Send for Draft and Sent quotes but Mark as sent only for Draft', () => {
    expect(panel.canSend('Draft')).toBe(true);
    expect(panel.canSend('Sent')).toBe(true);
    expect(panel.canSend('Accepted')).toBe(false);
    expect(panel.canMarkSent('Draft')).toBe(true);
    expect(panel.canMarkSent('Sent')).toBe(false);
  });

  it('opens the duplicate in place and refreshes the list when closed', () => {
    const changed = vi.fn();
    const closed = vi.fn();
    panel.changed.subscribe(changed);
    panel.closed.subscribe(closed);

    panel.duplicateQuote();

    expect(quoteService.duplicateQuote).toHaveBeenCalledWith(12);
    expect(panel.quote()).toEqual(copy);
    expect(changed).not.toHaveBeenCalled();

    panel.close();

    expect(changed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('offers Revise only while the quote is out with the customer', () => {
    expect(panel.canRevise('Sent')).toBe(true);
    expect(panel.canRevise('Declined')).toBe(true);
    expect(panel.canRevise('Expired')).toBe(true);
    expect(panel.canRevise('Draft')).toBe(false);
    expect(panel.canRevise('Accepted')).toBe(false);
    expect(panel.canRevise('Superseded')).toBe(false);
  });

  it('opens the revision in place through the revise call', () => {
    panel.reviseQuote();

    expect(quoteService.reviseQuote).toHaveBeenCalledWith(12);
    expect(quoteService.duplicateQuote).not.toHaveBeenCalled();
    expect(panel.quote()?.quoteNumber).toBe('Q-0012-R1');
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('asks for confirmation before accepting and stays open on the refreshed quote', () => {
    const closed = vi.fn();
    panel.closed.subscribe(closed);
    dialogResult = true;

    panel.acceptQuote();

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.anything());
    expect(quoteService.acceptQuote).toHaveBeenCalledWith(12);
    expect(quoteService.getQuoteById).toHaveBeenCalledWith(12);
    expect(closed).not.toHaveBeenCalled();
  });

  it('does not accept when the confirmation is cancelled', () => {
    dialogResult = false;

    panel.acceptQuote();

    expect(quoteService.acceptQuote).not.toHaveBeenCalled();
  });

  it('closes after Convert and offers a link to the new sales order', () => {
    const changed = vi.fn();
    const closed = vi.fn();
    panel.changed.subscribe(changed);
    panel.closed.subscribe(closed);

    panel.convertToOrder();

    expect(quoteService.convertToOrder).toHaveBeenCalledWith(12);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(snackbar.successWithNav).toHaveBeenCalledWith(expect.any(String), '/sales-orders/55', expect.any(String));
  });
});
