import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { CapabilityDescriptor } from '../../../../shared/models/capability-descriptor.model';
import { FlatContactRow } from '../../models/flat-contact.model';
import { CustomerContactsPageComponent } from './customer-contacts.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PageInternals {
  displayRows(): (FlatContactRow & { fullName: string })[];
  loading(): boolean;
  showAddDialog(): boolean;
  canAddContact(): boolean;
  openCustomer(row: FlatContactRow): void;
  openAdd(): void;
  closeAdd(): void;
  onContactSaved(): void;
}

function makeRow(overrides: Partial<FlatContactRow> = {}): FlatContactRow {
  return {
    contactId: 1,
    customerId: 5,
    customerName: 'Acme',
    companyName: 'Acme Corp',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: null,
    phone: null,
    role: null,
    isPrimary: true,
    emailOptOut: false,
    callOptOut: false,
    inCooldown: false,
    ...overrides,
  };
}

function descriptorWith(code: string, enabled: boolean): CapabilityDescriptor {
  return {
    generatedAt: '2026-08-01T00:00:00Z',
    totalCount: 1,
    enabledCount: enabled ? 1 : 0,
    capabilities: [{
      id: code, code, area: 'MD', name: code, description: '',
      enabled, isDefaultOn: true, requiresRoles: null,
      version: 1, eTag: 'W/"1"', configVersion: null, configETag: null, configId: null,
      dependencies: [], mutexes: [],
    }],
  };
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  // Construct imperatively without rendering — same pattern as the customer
  // cluster/dialog specs. ngOnInit is driven explicitly per test.
  const component = TestBed.runInInjectionContext(() => new CustomerContactsPageComponent());
  return {
    component,
    internals: component as unknown as PageInternals,
    httpMock: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
    capabilities: TestBed.inject(CapabilityService),
  };
}

describe('CustomerContactsPageComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('forge-capability-snapshot');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    localStorage.removeItem('forge-capability-snapshot');
    vi.restoreAllMocks();
  });

  it('fails open: Add Contact is available before any capability snapshot is loaded', () => {
    const { internals } = setup();
    // CAP-MD-CUSTOMER-CONTACTS is default-on in the server catalog — with no
    // snapshot the add affordance must NOT silently vanish (the 2026-08-04
    // regression symptom).
    expect(internals.canAddContact()).toBe(true);
  });

  it('hides Add Contact when the live snapshot disables CAP-MD-CUSTOMER-CONTACTS', () => {
    const { internals, httpMock, capabilities } = setup();
    capabilities.load().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/capabilities/descriptor`)
      .flush(descriptorWith('CAP-MD-CUSTOMER-CONTACTS', false));

    expect(internals.canAddContact()).toBe(false);
    httpMock.verify();
  });

  it('ngOnInit loads the flat list and maps rows to "Last, First" display names', () => {
    const { component, internals, httpMock } = setup();
    component.ngOnInit();

    const req = httpMock.expectOne(`${environment.apiUrl}/customers/all-contacts`);
    expect(req.request.method).toBe('GET');
    req.flush([makeRow()]);

    expect(internals.loading()).toBe(false);
    expect(internals.displayRows()[0].fullName).toBe('Lovelace, Ada');
    httpMock.verify();
  });

  it('row click deep-links to that customer\'s Contacts tab (where full CRUD lives)', () => {
    const { internals, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    internals.openCustomer(makeRow({ customerId: 5 }));

    expect(navigate).toHaveBeenCalledWith(['/customers', 5, 'contacts']);
  });

  it('onContactSaved closes the add dialog and reloads the flat list', () => {
    const { component, internals, httpMock } = setup();
    component.ngOnInit();
    httpMock.expectOne(`${environment.apiUrl}/customers/all-contacts`).flush([]);

    internals.openAdd();
    expect(internals.showAddDialog()).toBe(true);

    internals.onContactSaved();
    expect(internals.showAddDialog()).toBe(false);

    const reload = httpMock.expectOne(`${environment.apiUrl}/customers/all-contacts`);
    reload.flush([makeRow()]);
    expect(internals.displayRows().length).toBe(1);
    httpMock.verify();
  });
});
