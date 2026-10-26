import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { InvoiceDetailPanelComponent } from './invoice-detail-panel.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type PanelInternals = {
  invoice: { set(v: InvoiceDetail): void };
  currencyCode: () => string | null;
  sortedLines: () => { id: number; lineType?: string }[];
  downloadingPdf: () => boolean;
  downloadPdf(): void;
};

describe('InvoiceDetailPanelComponent PDF', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('downloads the invoice PDF named after the invoice number', () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    const getPdf = vi.spyOn(TestBed.inject(InvoiceService), 'getInvoicePdf').mockReturnValue(of(pdf));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:inv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set({ id: 12, invoiceNumber: 'INV-00012' } as InvoiceDetail);

    panel.downloadPdf();

    expect(getPdf).toHaveBeenCalledWith(12);
    expect(names).toEqual(['INV-00012.pdf']);
    expect(panel.downloadingPdf()).toBe(false);
  });

  it('shows amounts in the invoice currency', () => {
    const panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set({ id: 12, invoiceNumber: 'INV-00012', currencyCode: 'CAD' } as InvoiceDetail);

    expect(panel.currencyCode()).toBe('CAD');
  });

  it('falls back to the base currency when the invoice has no currency code', () => {
    const panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set({ id: 12, invoiceNumber: 'INV-00012' } as InvoiceDetail);

    expect(panel.currencyCode()).toBeNull();
  });

  it('lists the deposit line after the items and freight', () => {
    const panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set({
      id: 12,
      invoiceNumber: 'INV-00012',
      lines: [
        { id: 1, lineType: 'Deposit' },
        { id: 2, lineType: 'Freight' },
        { id: 3, lineType: 'Item' },
      ],
    } as unknown as InvoiceDetail);

    expect(panel.sortedLines().map(l => l.id)).toEqual([3, 2, 1]);
  });
});
