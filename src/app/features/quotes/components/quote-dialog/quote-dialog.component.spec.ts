import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
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
}

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 200 };

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

  // Flush the constructor's customer + part loads.
  httpMock.expectOne(r => r.url === `${environment.apiUrl}/customers`).flush(emptyPage);
  httpMock.expectOne(r => r.url === `${environment.apiUrl}/parts`).flush(emptyPage);

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
