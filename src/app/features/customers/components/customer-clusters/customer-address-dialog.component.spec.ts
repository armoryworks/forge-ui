import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../../environments/environment';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { CustomerAddressDialogComponent } from './customer-address-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: {
    invalid: boolean;
    patchValue(v: Record<string, unknown>): void;
    getRawValue(): Record<string, unknown>;
  };
  save(): void;
  close(): void;
}

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  return {
    id: 10,
    label: 'HQ',
    addressType: 'Billing',
    line1: '100 Main St',
    line2: null,
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US',
    isDefault: true,
    ...overrides,
  };
}

function setup(address: CustomerAddress | null = null) {
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
  // customer-identity-cluster and price-list-form-dialog specs.
  const component = TestBed.runInInjectionContext(() => new CustomerAddressDialogComponent());
  mockSignalInputs(component, { customerId: 42, address });
  TestBed.flushEffects();
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as DialogInternals, httpMock };
}

describe('CustomerAddressDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts invalid in create mode (label + address required)', () => {
    const { internals } = setup();
    expect(internals.form.invalid).toBe(true);

    internals.form.patchValue({
      label: 'HQ',
      address: { line1: '100 Main St', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' },
    });
    expect(internals.form.invalid).toBe(false);
  });

  it('rejects a partially-filled address (addressCompleteValidator)', () => {
    const { internals } = setup();
    internals.form.patchValue({
      label: 'HQ',
      // AddressFormComponent emits '' for untouched fields once any field has a value.
      address: { line1: '100 Main St', city: '', state: '', postalCode: '', country: 'US' },
    });
    expect(internals.form.invalid).toBe(true);

    internals.form.patchValue({
      address: { line1: '100 Main St', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' },
    });
    expect(internals.form.invalid).toBe(false);
  });

  it('hydrates the form from the bound address in edit mode', () => {
    const { internals } = setup(makeAddress({ label: 'Warehouse', addressType: 'Shipping' }));
    const v = internals.form.getRawValue();
    expect(v['label']).toBe('Warehouse');
    expect(v['addressType']).toBe('Shipping');
    expect((v['address'] as { line1: string }).line1).toBe('100 Main St');
    expect(v['isDefault']).toBe(true);
    expect(internals.form.invalid).toBe(false);
  });

  it('save() POSTs the flattened payload in create mode and emits saved', () => {
    const { component, internals, httpMock } = setup();
    internals.form.patchValue({
      label: 'HQ',
      addressType: 'Both',
      isDefault: true,
      address: { line1: '100 Main St', line2: 'Suite 5', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' },
    });

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/customers/42/addresses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      label: 'HQ',
      addressType: 'Both',
      line1: '100 Main St',
      line2: 'Suite 5',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
      isDefault: true,
    });
    req.flush(makeAddress({ id: 99 }));

    expect(savedCb).toHaveBeenCalledTimes(1);
    httpMock.verify();
  });

  it('save() PUTs to the address id in edit mode', () => {
    const { component, internals, httpMock } = setup(makeAddress({ id: 7 }));
    internals.form.patchValue({ label: 'HQ East' });

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/customers/42/addresses/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ label: 'HQ East', addressType: 'Billing', isDefault: true });
    req.flush(null);

    expect(savedCb).toHaveBeenCalledTimes(1);
    httpMock.verify();
  });

  it('does not call the API when the form is invalid', () => {
    const { internals, httpMock } = setup();
    internals.save();
    httpMock.expectNone(`${environment.apiUrl}/customers/42/addresses`);
    httpMock.verify();
  });

  it('close() emits closed without saving', () => {
    const { component, internals, httpMock } = setup();
    const closedCb = vi.fn();
    component.closed.subscribe(closedCb);
    internals.close();
    expect(closedCb).toHaveBeenCalledTimes(1);
    httpMock.verify();
  });
});
