import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { InvoiceSources } from '../../models/invoice-sources.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { InvoiceDialogComponent } from './invoice-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  invoiceForm: FormGroup<{
    invoiceNumber: FormControl<string | null>;
    customerId: FormControl<number | null>;
    salesOrderId: FormControl<number | null>;
    shipmentId: FormControl<number | null>;
  }>;
  lineForm: FormGroup<{
    partId: FormControl<number | null>;
    partNumber: FormControl<string | null>;
    description: FormControl<string | null>;
    quantity: FormControl<number | null>;
    unitPrice: FormControl<number | null>;
  }>;
  salesOrderOptions(): SelectOption[];
  shipmentOptions(): SelectOption[];
  onPartPicked(entity: Record<string, unknown> | null): void;
}

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 200 };

const acmeSources: InvoiceSources = {
  salesOrders: [
    { id: 42, orderNumber: 'SO-00042', customerName: 'Acme' },
    { id: 43, orderNumber: 'SO-00043', customerName: 'Acme' },
  ],
  shipments: [
    { id: 7, shipmentNumber: 'SHP-00007', salesOrderId: 42, salesOrderNumber: 'SO-00042', shippedDate: '2026-10-01T12:00:00Z' },
    { id: 8, shipmentNumber: 'SHP-00008', salesOrderId: 43, salesOrderNumber: 'SO-00043', shippedDate: null },
  ],
};

const bracket = {
  id: 4711,
  partNumber: 'PN-1001',
  name: 'Bracket',
  description: null,
  effectivePrice: 12.5,
  effectivePriceCurrency: 'USD',
  effectivePriceSource: 'PartPrice',
} as PartListItem;

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  const component = TestBed.runInInjectionContext(() => new InvoiceDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);

  httpMock.expectOne(r => r.url === `${environment.apiUrl}/customers`).flush(emptyPage);
  httpMock.match(r => r.url === `${environment.apiUrl}/system/currencies`).forEach(r => r.flush([]));

  return { internals: component as unknown as DialogInternals, httpMock };
}

function selectCustomer(internals: DialogInternals, httpMock: HttpTestingController, customerId: number, sources: InvoiceSources) {
  internals.invoiceForm.controls.customerId.setValue(customerId);
  const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/invoices/sources`);
  expect(req.request.params.get('customerId')).toBe(String(customerId));
  req.flush(sources);
}

describe('InvoiceDialogComponent — order, shipment and part pickers', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers the customer\'s sales orders by number and customer', () => {
    const { internals, httpMock } = setup();

    selectCustomer(internals, httpMock, 5, acmeSources);

    expect(internals.salesOrderOptions().map(o => o.label)).toContain('SO-00042 — Acme');
    internals.invoiceForm.controls.salesOrderId.setValue(42);
    expect(internals.invoiceForm.controls.salesOrderId.value).toBe(42);
    httpMock.verify();
  });

  it('narrows shipments to the picked sales order', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);

    expect(internals.shipmentOptions().map(o => o.value)).toEqual([null, 7, 8]);

    internals.invoiceForm.controls.salesOrderId.setValue(43);

    expect(internals.shipmentOptions().map(o => o.value)).toEqual([null, 8]);
    expect(internals.shipmentOptions()[1].label).toBe('SHP-00008');
  });

  it('fills the sales order from a picked shipment and clears a shipment from another order', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);
    const controls = internals.invoiceForm.controls;

    controls.shipmentId.setValue(7);
    expect(controls.salesOrderId.value).toBe(42);

    controls.salesOrderId.setValue(43);
    expect(controls.shipmentId.value).toBeNull();
  });

  it('clears the sales order and shipment when the customer changes', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);
    const controls = internals.invoiceForm.controls;
    controls.shipmentId.setValue(7);

    selectCustomer(internals, httpMock, 6, { salesOrders: [], shipments: [] });

    expect(controls.salesOrderId.value).toBeNull();
    expect(controls.shipmentId.value).toBeNull();
    expect(internals.salesOrderOptions()).toHaveLength(1);
  });

  it('does not preload a slice of the part catalogue', () => {
    const { httpMock } = setup();

    httpMock.expectNone(r => r.url.includes('/parts'));
    httpMock.verify();
  });

  it('fills the part number, description and price from a part found by search', () => {
    const { internals } = setup();

    internals.lineForm.controls.partId.setValue(bracket.id);
    internals.onPartPicked(bracket as unknown as Record<string, unknown>);

    expect(internals.lineForm.getRawValue()).toMatchObject({
      partId: 4711, partNumber: 'PN-1001', description: 'Bracket', unitPrice: 12.5,
    });
  });

  it('keeps the typed price when the part has no sales price', () => {
    const { internals } = setup();
    internals.lineForm.controls.unitPrice.setValue(9);

    internals.onPartPicked({ ...bracket, effectivePrice: 0, effectivePriceSource: 'Default' } as unknown as Record<string, unknown>);

    expect(internals.lineForm.controls.unitPrice.value).toBe(9);
  });

  it('clears the part number when the part selection is cleared', () => {
    const { internals } = setup();
    internals.onPartPicked(bracket as unknown as Record<string, unknown>);

    internals.lineForm.controls.partId.setValue(null);
    internals.onPartPicked(null);

    expect(internals.lineForm.controls.partNumber.value).toBe('');
  });

  it('keeps free-text lines with no part valid', () => {
    const { internals } = setup();

    internals.lineForm.patchValue({ description: 'Freight', quantity: 1, unitPrice: 40 });

    expect(internals.lineForm.valid).toBe(true);
    expect(internals.lineForm.controls.partId.value).toBeNull();
  });

  it('rejects an invoice number longer than 20 characters', () => {
    const { internals } = setup();
    const control = internals.invoiceForm.controls.invoiceNumber;

    control.setValue('A'.repeat(25));
    expect(control.hasError('maxlength')).toBe(true);

    control.setValue('A'.repeat(20));
    expect(control.valid).toBe(true);
  });
});
