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
import { VendorAddress } from '../../models/vendor-address.model';
import { VendorAddressesTabComponent } from './vendor-addresses-tab.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface TabInternals {
  addresses(): VendorAddress[];
  canManage(): boolean;
  oneLine(a: VendorAddress): string;
  typeLabelKey(t: string): string;
}

function address(id: number, addressType: string, isDefault: boolean, overrides: Partial<VendorAddress> = {}): VendorAddress {
  return {
    id, vendorId: 7, addressType, isDefault, label: `Address ${id}`,
    line1: '1 Main St', line2: null, city: 'Provo', state: 'UT', postalCode: '84601', country: 'US',
    ...overrides,
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
  const component = TestBed.runInInjectionContext(() => new VendorAddressesTabComponent());
  const inputs = mockSignalInputs(component, { vendorId: 7 });
  const httpMock = TestBed.inject(HttpTestingController);
  return { inputs, internals: component as unknown as TabInternals, httpMock };
}

describe('VendorAddressesTabComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads addresses grouped by type with the default first', () => {
    const { internals, httpMock } = setup(['Admin']);
    TestBed.flushEffects();
    httpMock.expectOne(`${environment.apiUrl}/vendors/7/addresses`).flush([
      address(1, 'OrderFrom', false),
      address(2, 'RemitTo', false),
      address(3, 'RemitTo', true),
    ]);
    expect(internals.addresses().map(a => a.id)).toEqual([3, 2, 1]);
    httpMock.verify();
  });

  it('renders the address on one line', () => {
    const { internals } = setup(['Admin']);
    expect(internals.oneLine(address(1, 'RemitTo', false, { line2: 'Suite 4' })))
      .toBe('1 Main St, Suite 4, Provo, UT 84601, US');
  });

  it('maps unknown types to Other', () => {
    const { internals } = setup(['Admin']);
    expect(internals.typeLabelKey('ShipFrom')).toBe('vendorContacts.addressTypes.shipFrom');
    expect(internals.typeLabelKey('Legacy')).toBe('vendorContacts.addressTypes.other');
  });

  it('hides management actions from roles outside Admin, Manager and OfficeManager', () => {
    expect(setup(['Admin']).internals.canManage()).toBe(true);
    expect(setup(['Engineer']).internals.canManage()).toBe(false);
  });
});
