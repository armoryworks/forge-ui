import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorService } from './vendor.service';
import { environment } from '../../../../environments/environment';
import { VendorContactRequest } from '../models/vendor-contact-request.model';
import { VendorAddressRequest } from '../models/vendor-address-request.model';

const contactBody: VendorContactRequest = {
  firstName: 'Ada', lastName: 'Lovelace', role: null, email: 'ada@example.com',
  phone: null, mobile: '(555) 010-2000', fax: null, isPrimary: true, notes: null,
};

const addressBody: VendorAddressRequest = {
  addressType: 'RemitTo', label: 'Lockbox', line1: '1 Main St', line2: null,
  city: 'Provo', state: 'UT', postalCode: '84601', country: 'US', isDefault: true,
};

describe('VendorService', () => {
  let service: VendorService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VendorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getVendors', () => {
    it('should GET vendors list (Phase 3 F7-broad / WU-22 — paged envelope)', () => {
      service.getVendors().subscribe();
      // The shim now hits the paged endpoint with pageSize=200.
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/vendors`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('pageSize')).toBe('200');
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });
  });

  describe('getVendorById', () => {
    it('should GET vendor detail', () => {
      service.getVendorById(2).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/2`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 2 });
    });
  });

  describe('getVendorDropdown', () => {
    it('should GET dropdown list', () => {
      service.getVendorDropdown().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/dropdown`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createVendor', () => {
    it('should POST new vendor', () => {
      const body = { name: 'Test Vendor' } as any;
      service.createVendor(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
    });
  });

  describe('deleteVendor', () => {
    it('should DELETE vendor', () => {
      service.deleteVendor(3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('vendor contacts', () => {
    it('should GET the contacts of a vendor', () => {
      service.getContacts(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/contacts`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should POST a new contact to the vendor', () => {
      service.createContact(5, contactBody).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/contacts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(contactBody);
      req.flush({ id: 11 });
    });

    it('should PUT an edited contact to its id', () => {
      service.updateContact(5, 11, contactBody).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/contacts/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(contactBody);
      req.flush({ id: 11 });
    });

    it('should DELETE a contact by id', () => {
      service.deleteContact(5, 11).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/contacts/11`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('vendor addresses', () => {
    it('should GET the addresses of a vendor', () => {
      service.getAddresses(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/addresses`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should POST a new address to the vendor', () => {
      service.createAddress(5, addressBody).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/addresses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(addressBody);
      req.flush({ id: 21 });
    });

    it('should PUT an edited address to its id', () => {
      service.updateAddress(5, 21, addressBody).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/addresses/21`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(addressBody);
      req.flush({ id: 21 });
    });

    it('should DELETE an address by id', () => {
      service.deleteAddress(5, 21).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors/5/addresses/21`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
