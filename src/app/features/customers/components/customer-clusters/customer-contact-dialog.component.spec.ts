import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../../environments/environment';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { Contact } from '../../models/contact.model';
import { CustomerContactDialogComponent } from './customer-contact-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: {
    invalid: boolean;
    patchValue(v: Record<string, unknown>): void;
    getRawValue(): Record<string, unknown>;
  };
  needsCustomerSelection(): boolean;
  save(): void;
  close(): void;
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 10,
    firstName: 'Daniel',
    lastName: 'Hartman',
    email: 'dan@example.com',
    phone: '(555) 123-4567',
    role: 'Buyer',
    isPrimary: true,
    ...overrides,
  };
}

function setup(customerId: number | null = 42, contact: Contact | null = null) {
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
  // customer-address-dialog spec. ngOnInit (role reference-data load) is
  // deliberately not invoked; role options keep their seeded null entry.
  const component = TestBed.runInInjectionContext(() => new CustomerContactDialogComponent());
  mockSignalInputs(component, { customerId, contact });
  TestBed.flushEffects();
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as DialogInternals, httpMock };
}

describe('CustomerContactDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('cluster mode: bound customerId hides the picker and pre-satisfies the customer control', () => {
    const { internals } = setup(42);
    expect(internals.needsCustomerSelection()).toBe(false);
    // customerId already valid — only the name fields gate validity.
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(internals.form.invalid).toBe(false);
    expect(internals.form.getRawValue()['customerId']).toBe(42);
  });

  it('cross-customer mode: requires a customer selection before the form is valid', () => {
    const { internals } = setup(null);
    expect(internals.needsCustomerSelection()).toBe(true);
    internals.form.patchValue({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(internals.form.invalid).toBe(true);
    internals.form.patchValue({ customerId: 7 });
    expect(internals.form.invalid).toBe(false);
  });

  it('save() POSTs to the selected customer in cross-customer create mode and emits saved(customerId)', () => {
    const { component, internals, httpMock } = setup(null);
    internals.form.patchValue({ customerId: 7, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/customers/7/contacts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      isPrimary: false,
    });
    req.flush(makeContact({ id: 99, firstName: 'Ada', lastName: 'Lovelace' }));

    expect(savedCb).toHaveBeenCalledTimes(1);
    expect(savedCb).toHaveBeenCalledWith(7);
    httpMock.verify();
  });

  it('hydrates from the bound contact and PUTs to the contact id in edit mode', () => {
    const { component, internals, httpMock } = setup(42, makeContact());
    const v = internals.form.getRawValue();
    expect(v['firstName']).toBe('Daniel');
    expect(v['lastName']).toBe('Hartman');
    expect(v['isPrimary']).toBe(true);
    expect(internals.form.invalid).toBe(false);

    const savedCb = vi.fn();
    component.saved.subscribe(savedCb);
    internals.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/customers/42/contacts/10`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ firstName: 'Daniel', lastName: 'Hartman', isPrimary: true });
    req.flush(makeContact());

    expect(savedCb).toHaveBeenCalledWith(42);
    httpMock.verify();
  });

  it('does not call the API when the form is invalid', () => {
    const { internals, httpMock } = setup(null);
    internals.save();
    httpMock.expectNone(`${environment.apiUrl}/customers/7/contacts`);
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
