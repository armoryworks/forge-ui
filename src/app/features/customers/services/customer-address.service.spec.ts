import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CustomerAddressService } from './customer-address.service';
import { environment } from '../../../../environments/environment';
import { CustomerAddress } from '../../../shared/models/customer-address.model';
import { CreateCustomerAddressRequest } from '../../../shared/models/create-customer-address-request.model';
import { UpdateCustomerAddressRequest } from '../../../shared/models/update-customer-address-request.model';

describe('CustomerAddressService', () => {
  let service: CustomerAddressService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/customers`;

  const mockAddress: CustomerAddress = {
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
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CustomerAddressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getAddresses ──────────────────────────────────────────────────────────

  describe('getAddresses', () => {
    it('should GET the address list for the customer', () => {
      let result: CustomerAddress[] = [];
      service.getAddresses(1).subscribe((items) => { result = items; });

      const req = httpMock.expectOne(`${baseUrl}/1/addresses`);
      expect(req.request.method).toBe('GET');
      req.flush([mockAddress]);

      expect(result.length).toBe(1);
      expect(result[0].label).toBe('HQ');
    });
  });

  // ── createAddress ─────────────────────────────────────────────────────────

  describe('createAddress', () => {
    it('should POST a new address and return the created record', () => {
      const request: CreateCustomerAddressRequest = {
        label: 'Warehouse',
        addressType: 'Shipping',
        line1: '200 Dock Rd',
        line2: 'Bay 4',
        city: 'Peoria',
        state: 'IL',
        postalCode: '61601',
        country: 'US',
        isDefault: false,
      };
      let result: CustomerAddress | null = null;

      service.createAddress(1, request).subscribe((a) => { result = a; });

      const req = httpMock.expectOne(`${baseUrl}/1/addresses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ ...mockAddress, id: 11, label: 'Warehouse', addressType: 'Shipping' });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(11);
    });
  });

  // ── updateAddress ─────────────────────────────────────────────────────────

  describe('updateAddress', () => {
    it('should PUT the updated address fields', () => {
      const request: UpdateCustomerAddressRequest = {
        label: 'HQ',
        addressType: 'Both',
        line1: '100 Main St',
        line2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
        isDefault: true,
      };
      let completed = false;

      service.updateAddress(1, 10, request).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/addresses/10`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── deleteAddress ─────────────────────────────────────────────────────────

  describe('deleteAddress', () => {
    it('should DELETE the specified address', () => {
      let completed = false;
      service.deleteAddress(1, 10).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/addresses/10`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
