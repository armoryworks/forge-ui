import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PoVendorRefsService } from './po-vendor-refs.service';
import { PoVendorRef } from '../models/po-vendor-ref.model';
import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';

describe('PoVendorRefsService', () => {
  let service: PoVendorRefsService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PoVendorRefsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function contact(id: number, isPrimary: boolean, isActive = true) {
    return { id, firstName: 'Pat', lastName: `C${id}`, role: null, isPrimary, isActive };
  }

  function address(id: number, addressType: string, isDefault: boolean, label: string | null = null) {
    return { id, addressType, label, line1: `${id} Main St`, city: 'Ogden', state: 'UT', isDefault, isActive: true };
  }

  it('marks the primary active contact as the default', () => {
    let result: PoVendorRef[] | null = [];
    service.getContacts(5).subscribe(r => { result = r; });

    const req = httpMock.expectOne(`${apiUrl}/vendors/5/contacts`);
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush([contact(1, false), contact(2, true), contact(3, true, false)]);

    expect(result).toEqual([
      { id: 1, label: 'Pat C1', isDefault: false },
      { id: 2, label: 'Pat C2', isDefault: true },
    ]);
  });

  it('has no default contact when none is primary, as the server saves none', () => {
    let result: PoVendorRef[] | null = [];
    service.getContacts(5).subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/vendors/5/contacts`).flush([contact(1, false)]);

    expect(result![0].isDefault).toBe(false);
  });

  it('defaults to the lowest-id primary contact when several are primary', () => {
    let result: PoVendorRef[] | null = [];
    service.getContacts(5).subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/vendors/5/contacts`).flush([contact(4, true), contact(2, true)]);

    expect(result!.filter(r => r.isDefault).map(r => r.id)).toEqual([2]);
  });

  it('lists order-from addresses first and defaults to the default order-from address', () => {
    let result: PoVendorRef[] | null = [];
    service.getOrderFromAddresses(5).subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/vendors/5/addresses`).flush([
      address(1, 'RemitTo', true),
      address(2, 'OrderFrom', false),
      address(3, 'OrderFrom', true, 'Order desk'),
    ]);

    expect(result!.map(r => r.id)).toEqual([2, 3, 1]);
    expect(result!.filter(r => r.isDefault).map(r => r.id)).toEqual([3]);
    expect(result![1].label).toBe('Order desk: 3 Main St, Ogden, UT');
  });

  it('defaults to the lowest-id order-from address when none is marked default', () => {
    let result: PoVendorRef[] | null = [];
    service.getOrderFromAddresses(5).subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/vendors/5/addresses`).flush([
      address(1, 'RemitTo', true),
      address(7, 'OrderFrom', false),
      address(4, 'OrderFrom', false),
    ]);

    expect(result!.filter(r => r.isDefault).map(r => r.id)).toEqual([4]);
  });

  it('falls back to the remit-to address like the server when there is no order-from address', () => {
    let result: PoVendorRef[] | null = [];
    service.getOrderFromAddresses(5).subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/vendors/5/addresses`).flush([
      address(1, 'Shipping', true),
      address(2, 'RemitTo', false),
    ]);

    expect(result!.map(r => r.id)).toEqual([2, 1]);
    expect(result!.filter(r => r.isDefault).map(r => r.id)).toEqual([2]);
  });

  it('defaults the ship-to to the default active company location', () => {
    let result: PoVendorRef[] | null = [];
    service.getShipToLocations().subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/company-locations`).flush([
      { id: 1, name: 'Annex', city: 'Ogden', state: 'UT', isDefault: false, isActive: true },
      { id: 2, name: 'Main', city: 'Ogden', state: 'UT', isDefault: true, isActive: true },
      { id: 3, name: 'Old', city: 'Ogden', state: 'UT', isDefault: false, isActive: false },
    ]);

    expect(result).toEqual([
      { id: 1, label: 'Annex (Ogden, UT)', isDefault: false },
      { id: 2, label: 'Main (Ogden, UT)', isDefault: true },
    ]);
  });

  it('defaults the ship-to to the lowest-id active location when none is marked default', () => {
    let result: PoVendorRef[] | null = [];
    service.getShipToLocations().subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/company-locations`).flush([
      { id: 9, name: 'Annex', city: 'Ogden', state: 'UT', isDefault: false, isActive: true },
      { id: 3, name: 'Main', city: 'Ogden', state: 'UT', isDefault: false, isActive: true },
    ]);

    expect(result!.filter(r => r.isDefault).map(r => r.id)).toEqual([3]);
  });

  it('returns null when the caller may not read the locations', () => {
    let result: PoVendorRef[] | null = [];
    service.getShipToLocations().subscribe(r => { result = r; });
    httpMock.expectOne(`${apiUrl}/company-locations`).flush({}, { status: 403, statusText: 'Forbidden' });

    expect(result).toBeNull();
  });
});
