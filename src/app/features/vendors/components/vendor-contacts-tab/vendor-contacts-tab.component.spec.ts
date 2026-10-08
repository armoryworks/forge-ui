import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../../environments/environment';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { AuthService } from '../../../../shared/services/auth.service';
import { VendorContact } from '../../models/vendor-contact.model';
import { VendorContactsTabComponent } from './vendor-contacts-tab.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface TabInternals {
  contacts(): VendorContact[];
  canManage(): boolean;
}

function contact(id: number, firstName: string, lastName: string, isPrimary: boolean): VendorContact {
  return {
    id, vendorId: 7, firstName, lastName, isPrimary,
    role: null, email: null, phone: null, mobile: null, fax: null, notes: null,
  };
}

function setup(roles: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.some(x => roles.includes(x)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new VendorContactsTabComponent());
  mockSignalInputs(component, { vendorId: 7 });
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as TabInternals, httpMock };
}

describe('VendorContactsTabComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the vendor contacts with the primary contact first', () => {
    const { component, internals, httpMock } = setup(['Admin']);
    component.ngOnInit();
    httpMock.expectOne(`${environment.apiUrl}/vendors/7/contacts`).flush([
      contact(1, 'Bea', 'Adams', false),
      contact(2, 'Cal', 'Young', true),
      contact(3, 'Al', 'Adams', false),
    ]);
    expect(internals.contacts().map(c => c.id)).toEqual([2, 3, 1]);
    httpMock.verify();
  });

  it('lets Admin, Manager and OfficeManager manage contacts', () => {
    expect(setup(['Manager']).internals.canManage()).toBe(true);
    expect(setup(['OfficeManager']).internals.canManage()).toBe(true);
    expect(setup(['Engineer']).internals.canManage()).toBe(false);
  });
});
