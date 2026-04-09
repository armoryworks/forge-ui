import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorService } from './vendor.service';
import { environment } from '../../../../environments/environment';

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
    it('should GET vendors list', () => {
      service.getVendors().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/vendors`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
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
});
