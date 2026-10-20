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
import { CustomerDetail } from '../../../customers/models/customer-detail.model';
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
    invoiceDate: FormControl<Date | null>;
    dueDate: FormControl<Date | null>;
    creditTerms: FormControl<string | null>;
    taxRate: FormControl<number | null>;
  }>;
  violations(): string[];
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
  lines: { (): { partId: number | null; partNumber: string; description: string; quantity: number; unitPrice: number; taxable: boolean }[]; set(v: unknown[]): void };
  taxAmount(): number;
  lineAmounts(): number[];
  lineTotal(): number;
  grandTotal(): number;
  customerTaxExempt(): boolean;
  effectiveTaxRate(): number;
  toggleTaxable(index: number): void;
}

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 200 };

const acmeSources: InvoiceSources = {
  salesOrders: [
    { id: 42, orderNumber: 'SO-00042', customerName: 'Acme', taxRate: 0.0485, creditTerms: 'Net45' },
    { id: 43, orderNumber: 'SO-00043', customerName: 'Acme', taxRate: 0.0725 },
  ],
  shipments: [
    {
      id: 7, shipmentNumber: 'SHP-00007', salesOrderId: 42, salesOrderNumber: 'SO-00042', shippedDate: '2026-10-01T12:00:00Z',
      lines: [{ partId: 4711, partNumber: 'PN-1001', description: 'Bracket', quantity: 4, unitPrice: 12.5, taxable: true }],
    },
    {
      id: 8, shipmentNumber: 'SHP-00008', salesOrderId: 43, salesOrderNumber: 'SO-00043', shippedDate: null,
      lines: [{ partId: null, partNumber: null, description: 'Freight', quantity: 1, unitPrice: 40, taxable: false }],
    },
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

function selectCustomer(
  internals: DialogInternals, httpMock: HttpTestingController, customerId: number, sources: InvoiceSources, customerRate: number | null = null,
  customer: Partial<CustomerDetail> = {},
) {
  internals.invoiceForm.controls.customerId.setValue(customerId);
  const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/invoices/sources`);
  expect(req.request.params.get('customerId')).toBe(String(customerId));
  req.flush(sources);
  httpMock.expectOne(`${environment.apiUrl}/customers/${customerId}`)
    .flush({ id: customerId, name: 'Acme', isTaxExempt: false, ...customer });
  httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/${customerId}`)
    .flush(customerRate === null ? null : { id: 53, code: 'UT-UTCO', rate: customerRate });
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

  it('rejects a due date before the invoice date and names both fields', () => {
    const { internals } = setup();
    const form = internals.invoiceForm;

    form.controls.invoiceDate.setValue(new Date(2026, 9, 19));
    form.controls.dueDate.setValue(new Date(2026, 9, 18));
    expect(form.hasError('dateRangeOrder')).toBe(true);
    expect(internals.violations()).toContain(form.errors!['dateRangeOrder'].message);

    form.controls.dueDate.setValue(new Date(2026, 9, 19));
    expect(form.hasError('dateRangeOrder')).toBe(false);
  });

  it('rejects an invoice number longer than 20 characters', () => {
    const { internals } = setup();
    const control = internals.invoiceForm.controls.invoiceNumber;

    control.setValue('A'.repeat(25));
    expect(control.hasError('maxlength')).toBe(true);

    control.setValue('A'.repeat(20));
    expect(control.valid).toBe(true);
  });

  it('prefills the lines from a picked shipment at the order price', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);

    internals.invoiceForm.controls.shipmentId.setValue(7);

    expect(internals.lines()).toEqual([
      { partId: 4711, partNumber: 'PN-1001', description: 'Bracket', quantity: 4, unitPrice: 12.5, taxable: true },
    ]);
  });

  it('swaps prefilled lines when another shipment is picked, and clears them when none is', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);
    const shipment = internals.invoiceForm.controls.shipmentId;

    shipment.setValue(7);
    shipment.setValue(8);
    expect(internals.lines().map(l => l.description)).toEqual(['Freight']);

    shipment.setValue(null);
    expect(internals.lines()).toEqual([]);
  });

  it('never overwrites lines the user typed or changed', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);
    internals.lines.set([{ partId: null, partNumber: '', description: 'Setup charge', quantity: 1, unitPrice: 75 }]);

    internals.invoiceForm.controls.shipmentId.setValue(7);
    expect(internals.lines().map(l => l.description)).toEqual(['Setup charge']);

    internals.lines.set([]);
    internals.invoiceForm.controls.shipmentId.setValue(8);
    internals.lines.set([...internals.lines(), { partId: null, partNumber: '', description: 'Crating', quantity: 1, unitPrice: 20 }]);
    internals.invoiceForm.controls.shipmentId.setValue(7);
    expect(internals.lines().map(l => l.description)).toEqual(['Freight', 'Crating']);
  });
});

describe('InvoiceDialogComponent — tax rate and taxable lines', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('defaults the tax rate from the customer\'s tax code', () => {
    const { internals, httpMock } = setup();

    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725);

    expect(internals.invoiceForm.controls.taxRate.value).toBe(7.25);
    httpMock.verify();
  });

  it('repeats the picked sales order\'s tax rate', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725);

    internals.invoiceForm.controls.salesOrderId.setValue(42);

    expect(internals.invoiceForm.controls.taxRate.value).toBe(4.85);
  });

  it('keeps a tax rate the user typed', () => {
    const { internals, httpMock } = setup();
    const taxRate = internals.invoiceForm.controls.taxRate;
    taxRate.setValue(6);
    taxRate.markAsDirty();

    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725);
    internals.invoiceForm.controls.salesOrderId.setValue(42);

    expect(taxRate.value).toBe(6);
  });

  it('leaves a non-taxable line out of the tax and sends it as non-taxable', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources, 0.1);
    internals.lines.set([
      { partId: null, partNumber: '', description: 'Bracket', quantity: 4, unitPrice: 100, taxable: true },
      { partId: null, partNumber: '', description: 'Freight', quantity: 1, unitPrice: 40, taxable: true },
    ]);

    internals.toggleTaxable(1);

    expect(internals.taxAmount()).toBeCloseTo(40, 6);
    expect(internals.lines()[1].taxable).toBe(false);
  });

  it('rounds each line, the tax on the taxable lines and the total the way the server does', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725);
    internals.lines.set([
      { partId: null, partNumber: '', description: 'Bracket', quantity: 3, unitPrice: 33.335, taxable: true },
      { partId: null, partNumber: '', description: 'Shim', quantity: 0.1, unitPrice: 0.2, taxable: true },
    ]);

    expect(internals.lineAmounts()).toEqual([100.01, 0.02]);
    expect(internals.lineTotal()).toBe(100.03);
    expect(internals.taxAmount()).toBe(7.25);
    expect(internals.grandTotal()).toBe(107.28);
  });

  it('sums the rounded lines into the subtotal, not the raw products', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725);
    internals.lines.set([1, 2, 3].map(n => (
      { partId: null, partNumber: '', description: `Line ${n}`, quantity: 1, unitPrice: 33.333, taxable: true }
    )));

    expect(internals.lineAmounts()).toEqual([33.33, 33.33, 33.33]);
    expect(internals.lineTotal()).toBe(99.99);
    expect(internals.taxAmount()).toBe(7.25);
    expect(internals.grandTotal()).toBe(107.24);
  });

  it('carries a non-taxable order line onto the prefilled invoice line', () => {
    const { internals, httpMock } = setup();
    selectCustomer(internals, httpMock, 5, acmeSources);

    internals.invoiceForm.controls.shipmentId.setValue(8);

    expect(internals.lines()[0].taxable).toBe(false);
  });
});

describe('InvoiceDialogComponent — dates and credit terms', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts the invoice date at today', () => {
    const { internals } = setup();

    expect(internals.invoiceForm.controls.invoiceDate.value?.toDateString()).toBe(new Date().toDateString());
  });

  it('takes the customer\'s default terms and dates the invoice from them', () => {
    const { internals, httpMock } = setup();
    internals.invoiceForm.controls.invoiceDate.setValue(new Date(2026, 9, 19));

    selectCustomer(internals, httpMock, 5, acmeSources, null, { defaultCreditTerms: 'Net30' });

    expect(internals.invoiceForm.controls.creditTerms.value).toBe('Net30');
    expect(internals.invoiceForm.controls.dueDate.value?.toDateString()).toBe(new Date(2026, 10, 18).toDateString());
  });

  it('prefers the picked sales order\'s terms', () => {
    const { internals, httpMock } = setup();
    internals.invoiceForm.controls.invoiceDate.setValue(new Date(2026, 9, 19));
    selectCustomer(internals, httpMock, 5, acmeSources, null, { defaultCreditTerms: 'Net30' });

    internals.invoiceForm.controls.salesOrderId.setValue(42);

    expect(internals.invoiceForm.controls.creditTerms.value).toBe('Net45');
    expect(internals.invoiceForm.controls.dueDate.value?.toDateString()).toBe(new Date(2026, 11, 3).toDateString());
  });

  it('flags a hand-typed due date that contradicts the terms', () => {
    const { internals } = setup();
    const controls = internals.invoiceForm.controls;
    controls.invoiceDate.setValue(new Date(2026, 9, 19));
    controls.creditTerms.setValue('Net30');

    controls.dueDate.setValue(new Date(2026, 10, 3));
    expect(controls.dueDate.hasError('termsMismatch')).toBe(true);

    controls.creditTerms.setValue(null);
    expect(controls.dueDate.valid).toBe(true);
  });
});

describe('InvoiceDialogComponent — tax-exempt customer', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('bills no tax and locks the rate for a customer with a current exemption', () => {
    const { internals, httpMock } = setup();
    internals.lines.set([{ partId: null, partNumber: '', description: 'Probe', quantity: 2, unitPrice: 10, taxable: true }]);

    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725, { isTaxExempt: true, taxExemptionId: 'RS-1' });
    TestBed.tick();

    expect(internals.customerTaxExempt()).toBe(true);
    expect(internals.effectiveTaxRate()).toBe(0);
    expect(internals.taxAmount()).toBe(0);
    expect(internals.invoiceForm.controls.taxRate.disabled).toBe(true);
  });

  it('charges tax again once the exemption has lapsed by the invoice date', () => {
    const { internals, httpMock } = setup();
    internals.invoiceForm.controls.invoiceDate.setValue(new Date(2026, 9, 19));
    internals.lines.set([{ partId: null, partNumber: '', description: 'Probe', quantity: 2, unitPrice: 10, taxable: true }]);

    selectCustomer(internals, httpMock, 5, acmeSources, 0.0725,
      { isTaxExempt: true, taxExemptionId: 'RS-1', exemptionExpiryDate: '2026-10-01' });

    expect(internals.customerTaxExempt()).toBe(false);
    expect(internals.taxAmount()).toBeCloseTo(1.45, 6);
  });
});
