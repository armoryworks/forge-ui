import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { QuoteDialogComponent } from './quote-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

/** Protected members exercised by the S1 tax-gate tests. */
interface DialogInternals {
  taxLocked(): boolean;
  taxCertBacked(): boolean;
  taxOverridden(): boolean;
  taxEditability(): CustomerTaxEditability | null;
  lines: {
    set(lines: { partId: number; partNumber: string; description: string; quantity: number; unitPrice: number }[]): void;
    (): { partId: number; partNumber: string; description: string; quantity: number; unitPrice: number }[];
  };
  taxAmount(): number;
  grandTotal(): number;
  lineForm: {
    controls: {
      partId: { setValue(v: number | null): void };
      unitPrice: { value: number | null };
    };
  };
  priceIsDefault(): boolean;
  onPartPicked(row: Record<string, unknown> | null): void;
  onCustomerSelected(row: Record<string, unknown> | null): void;
  addLine(): void;
  draftConfig: { snapshotFn(): Record<string, unknown>; restoreFn(data: Record<string, unknown>): void };
  customerPicker?: { setSelected(id: number, text: string): void };
}

function part(overrides: Partial<PartListItem> = {}): PartListItem {
  return {
    id: 210,
    partNumber: 'SA-210',
    name: 'Old subassembly',
    description: null,
    revision: 'A',
    status: 'Active',
    procurementSource: 'Make',
    inventoryClass: 'Subassembly',
    bomLineCount: 0,
    createdAt: new Date(),
    effectivePrice: 14.5,
    effectivePriceCurrency: 'USD',
    effectivePriceSource: 'PartPrice',
    ...overrides,
  } as PartListItem;
}

function makeEditability(overrides: Partial<CustomerTaxEditability> = {}): CustomerTaxEditability {
  return {
    canEditTax: false,
    reason: 'No verified state tax certificate is on file for this customer.',
    activeDocumentId: null,
    stateCode: null,
    expiresAt: null,
    ...overrides,
  };
}

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

  // Construct imperatively without rendering — same pattern as the sibling
  // customer-address-dialog spec.
  const component = TestBed.runInInjectionContext(() => new QuoteDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);

  return { component, internals: component as unknown as DialogInternals, httpMock };
}

/** Selects a customer and flushes the resulting tax-rate + tax-editability calls. */
function selectCustomer(
  component: QuoteDialogComponent,
  httpMock: HttpTestingController,
  editability: CustomerTaxEditability,
): void {
  component.form.controls.customerId.setValue(5);
  httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/5`).flush(null);
  httpMock.expectOne(`${environment.apiUrl}/customers/5/tax-editability`).flush(editability);
}

describe('QuoteDialogComponent — S1 tax-rate gate', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('disables the tax-rate control when the customer has no verified certificate', () => {
    const { component, internals, httpMock } = setup();

    selectCustomer(component, httpMock, makeEditability({ canEditTax: false }));

    expect(internals.taxLocked()).toBe(true);
    expect(component.form.controls.taxRate.disabled).toBe(true);
    httpMock.verify();
  });

  it('keeps the tax-rate control editable when a verified certificate is on file', () => {
    const { component, internals, httpMock } = setup();

    selectCustomer(component, httpMock, makeEditability({
      canEditTax: true, reason: null, activeDocumentId: 5, stateCode: 'CA',
    }));

    expect(internals.taxLocked()).toBe(false);
    expect(component.form.controls.taxRate.enabled).toBe(true);
    httpMock.verify();
  });

  it('marks a manual override as cert-backed only when editing is allowed', () => {
    const { component, internals, httpMock } = setup();

    selectCustomer(component, httpMock, makeEditability({
      canEditTax: true, reason: null, activeDocumentId: 5, stateCode: 'CA',
    }));
    expect(internals.taxCertBacked()).toBe(false);

    component.form.controls.taxRate.setValue(0);

    expect(internals.taxOverridden()).toBe(true);
    expect(internals.taxCertBacked()).toBe(true);
    httpMock.verify();
  });

  it('re-enables the control and clears the gate when the customer is cleared', () => {
    const { component, internals, httpMock } = setup();

    selectCustomer(component, httpMock, makeEditability({ canEditTax: false }));
    expect(component.form.controls.taxRate.disabled).toBe(true);

    component.form.controls.customerId.setValue(null);

    expect(internals.taxLocked()).toBe(false);
    expect(internals.taxEditability()).toBeNull();
    expect(component.form.controls.taxRate.enabled).toBe(true);
    httpMock.verify();
  });
});

describe('QuoteDialogComponent — summary tax', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('includes the auto-filled customer tax rate in the summary', () => {
    const { component, internals, httpMock } = setup();
    internals.lines.set([{ partId: 1, partNumber: 'P-1', description: 'Bracket', quantity: 10, unitPrice: 125 }]);

    component.form.controls.customerId.setValue(5);
    httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/5`)
      .flush({ id: 1, stateCode: 'NC', rate: 0.0475 });
    httpMock.expectOne(`${environment.apiUrl}/customers/5/tax-editability`).flush(makeEditability());

    expect(internals.taxAmount()).toBeCloseTo(59.375, 3);
    expect(internals.grandTotal()).toBeCloseTo(1309.375, 3);
    httpMock.verify();
  });

  it('follows a manual tax-rate edit', () => {
    const { component, internals, httpMock } = setup();
    internals.lines.set([{ partId: 1, partNumber: 'P-1', description: 'Bracket', quantity: 1, unitPrice: 200 }]);

    component.form.controls.taxRate.setValue(10);

    expect(internals.taxAmount()).toBeCloseTo(20, 3);
    expect(internals.grandTotal()).toBeCloseTo(220, 3);
    httpMock.verify();
  });

  it('loads no part or customer list up front — both pickers search the server', () => {
    const { httpMock } = setup();
    httpMock.verify();
  });

  it('prefills the price from the picked part and adds a line from it', () => {
    const { internals, httpMock } = setup();
    internals.lineForm.controls.partId.setValue(210);
    internals.onPartPicked(part() as unknown as Record<string, unknown>);

    expect(internals.lineForm.controls.unitPrice.value).toBe(14.5);
    expect(internals.priceIsDefault()).toBe(true);

    internals.addLine();
    expect(internals.lines()).toEqual([
      { partId: 210, partNumber: 'SA-210', description: 'Old subassembly', quantity: 1, unitPrice: 14.5 },
    ]);
    httpMock.verify();
  });

  it('does not add a line when the picked part was cleared', () => {
    const { internals, httpMock } = setup();
    internals.lineForm.controls.partId.setValue(210);
    internals.onPartPicked(part() as unknown as Record<string, unknown>);
    internals.lineForm.controls.partId.setValue(null);
    internals.lineForm.controls.partId.setValue(210);

    internals.addLine();
    expect(internals.lines()).toEqual([]);
    httpMock.verify();
  });

  it('keeps the picked customer name in the draft and restores it into the picker', () => {
    const { component, internals, httpMock } = setup();
    component.form.controls.customerId.setValue(5);
    httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/5`).flush(null);
    httpMock.expectOne(`${environment.apiUrl}/customers/5/tax-editability`).flush(makeEditability());
    internals.onCustomerSelected({ id: 5, name: 'Northwind Fabrication' });

    const snapshot = internals.draftConfig.snapshotFn();
    expect(snapshot['customerName']).toBe('Northwind Fabrication');

    const restored = setup();
    const setSelected = vi.fn();
    restored.internals.customerPicker = { setSelected };
    restored.internals.draftConfig.restoreFn(snapshot);
    restored.httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/5`).flush(null);
    restored.httpMock.expectOne(`${environment.apiUrl}/customers/5/tax-editability`).flush(makeEditability());

    expect(setSelected).toHaveBeenCalledWith(5, 'Northwind Fabrication');
    expect(restored.component.form.controls.customerId.value).toBe(5);
    restored.httpMock.verify();
  });
});

describe('QuoteDialogComponent — credit hold warning', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('warns with quote wording when the selected customer is on hold', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: AuthService, useValue: { hasAnyRole: () => true, hasRole: () => true, user: () => null } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new QuoteDialogComponent());
    const internals = component as unknown as { creditHoldMessage(): string | null };
    const httpMock = TestBed.inject(HttpTestingController);
    component.form.controls.customerId.setValue(5);
    httpMock.expectOne(`${environment.apiUrl}/customers/5/credit-status`).flush({ customerId: 5, isOnHold: true, holdReason: 'Past due' });
    httpMock.expectOne(`${environment.apiUrl}/sales-tax-rates/for-customer/5`).flush(null);
    httpMock.expectOne(`${environment.apiUrl}/customers/5/tax-editability`).flush(makeEditability());

    expect(internals.creditHoldMessage()).toBe('quotes.creditHoldWarning');
    httpMock.verify();
  });
});
