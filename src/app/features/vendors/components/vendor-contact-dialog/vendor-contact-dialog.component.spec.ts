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
import { VendorContact } from '../../models/vendor-contact.model';
import { VendorContactDialogComponent } from './vendor-contact-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: {
    invalid: boolean;
    patchValue(v: Record<string, unknown>): void;
    getRawValue(): Record<string, unknown>;
  };
  roleOptions(): SelectOption[];
  save(): void;
  close(): void;
}

function makeContact(overrides: Partial<VendorContact> = {}): VendorContact {
  return {
    id: 10,
    vendorId: 42,
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'Billing',
    email: 'ada@example.com',
    phone: '(555) 010-1000',
    mobile: '(555) 010-2000',
    fax: null,
    isPrimary: true,
    notes: 'Prefers email',
    ...overrides,
  };
}

function setup(contact: VendorContact | null = null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new VendorContactDialogComponent());
  mockSignalInputs(component, { vendorId: 42, contact });
  TestBed.flushEffects();
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as DialogInternals, httpMock };
}

describe('VendorContactDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('requires first and last name', () => {
    const { internals } = setup();
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(internals.form.invalid).toBe(false);
  });

  it('drops the primary code from the role options', () => {
    const { component, internals, httpMock } = setup();
    component.ngOnInit();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/contact_role`).flush([
      { id: 1, groupCode: 'contact_role', code: 'primary', label: 'Primary', sortOrder: 1, isActive: true },
      { id: 2, groupCode: 'contact_role', code: 'billing', label: 'Billing', sortOrder: 2, isActive: true },
      { id: 3, groupCode: 'contact_role', code: 'owner', label: 'Owner', sortOrder: 5, isActive: false },
    ]);
    const values = internals.roleOptions().map(o => o.value);
    expect(values).toEqual([null, 'Billing']);
    httpMock.verify();
  });

  it('POSTs a new contact with blank optional fields sent as null', () => {
    const { component, internals, httpMock } = setup();
    internals.form.patchValue({ firstName: ' Ada ', lastName: 'Lovelace', mobile: '(555) 010-2000', isPrimary: true });

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/vendors/42/contacts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: null,
      email: null,
      phone: null,
      mobile: '(555) 010-2000',
      fax: null,
      isPrimary: true,
      notes: null,
    });
    req.flush(makeContact());
    expect(savedCb).toHaveBeenCalledTimes(1);
    httpMock.verify();
  });

  it('hydrates from the bound contact and PUTs to its id', () => {
    const { internals, httpMock } = setup(makeContact());
    const v = internals.form.getRawValue();
    expect(v['mobile']).toBe('(555) 010-2000');
    expect(v['notes']).toBe('Prefers email');
    expect(v['isPrimary']).toBe(true);

    internals.form.patchValue({ isPrimary: false });
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/vendors/42/contacts/10`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ firstName: 'Ada', role: 'Billing', isPrimary: false, notes: 'Prefers email' });
    req.flush(makeContact({ isPrimary: false }));
    httpMock.verify();
  });

  it('does not call the API when the form is invalid', () => {
    const { internals, httpMock } = setup();
    internals.save();
    httpMock.expectNone(`${environment.apiUrl}/vendors/42/contacts`);
    httpMock.verify();
  });

  it('close() emits closed', () => {
    const { component, internals } = setup();
    const closedCb = vi.fn();
    component.closed.subscribe(closedCb);
    internals.close();
    expect(closedCb).toHaveBeenCalledTimes(1);
  });
});
