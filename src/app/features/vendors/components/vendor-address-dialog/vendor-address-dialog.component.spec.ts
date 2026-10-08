import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../../environments/environment';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { VendorAddress } from '../../models/vendor-address.model';
import { VendorAddressDialogComponent } from './vendor-address-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: {
    invalid: boolean;
    patchValue(v: Record<string, unknown>): void;
    getRawValue(): Record<string, unknown>;
  };
  typeOptions: SelectOption[];
  save(): void;
}

const fullAddress = {
  line1: '1 Main St', line2: '', city: 'Provo', state: 'UT', postalCode: '84601', country: 'US',
};

function makeAddress(overrides: Partial<VendorAddress> = {}): VendorAddress {
  return {
    id: 21,
    vendorId: 42,
    addressType: 'OrderFrom',
    label: 'Sales desk',
    line1: '1 Main St',
    line2: null,
    city: 'Provo',
    state: 'UT',
    postalCode: '84601',
    country: 'US',
    isDefault: false,
    ...overrides,
  };
}

function setup(address: VendorAddress | null = null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new VendorAddressDialogComponent());
  mockSignalInputs(component, { vendorId: 42, address });
  TestBed.flushEffects();
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as DialogInternals, httpMock };
}

describe('VendorAddressDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers the five vendor address types', () => {
    const { internals } = setup();
    expect(internals.typeOptions.map(o => o.value)).toEqual(['RemitTo', 'OrderFrom', 'ShipFrom', 'Billing', 'Other']);
  });

  it('requires a label that is not blank', () => {
    const { internals } = setup();
    internals.form.patchValue({ address: fullAddress, label: '   ' });
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ label: 'Lockbox' });
    expect(internals.form.invalid).toBe(false);
  });

  it('rejects a partially filled address', () => {
    const { internals } = setup();
    internals.form.patchValue({ label: 'Lockbox' });
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ address: { ...fullAddress, city: '' } });
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ address: fullAddress });
    expect(internals.form.invalid).toBe(false);
  });

  it('POSTs a new remit-to address flattened into the request', () => {
    const { component, internals, httpMock } = setup();
    internals.form.patchValue({ label: ' Lockbox ', address: fullAddress, isDefault: true });

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/vendors/42/addresses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      addressType: 'RemitTo',
      label: 'Lockbox',
      line1: '1 Main St',
      line2: null,
      city: 'Provo',
      state: 'UT',
      postalCode: '84601',
      country: 'US',
      isDefault: true,
    });
    req.flush(makeAddress({ addressType: 'RemitTo', isDefault: true }));
    expect(savedCb).toHaveBeenCalledTimes(1);
    httpMock.verify();
  });

  it('hydrates from the bound address and PUTs to its id', () => {
    const { internals, httpMock } = setup(makeAddress());
    const v = internals.form.getRawValue();
    expect(v['addressType']).toBe('OrderFrom');
    expect(v['label']).toBe('Sales desk');
    expect(internals.form.invalid).toBe(false);

    internals.form.patchValue({ isDefault: true });
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/vendors/42/addresses/21`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ addressType: 'OrderFrom', label: 'Sales desk', isDefault: true });
    req.flush(makeAddress({ isDefault: true }));
    httpMock.verify();
  });
});
