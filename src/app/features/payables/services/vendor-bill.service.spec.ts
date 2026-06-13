import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorBillService } from './vendor-bill.service';
import { environment } from '../../../../environments/environment';

describe('VendorBillService', () => {
  let service: VendorBillService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/vendor-bills`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VendorBillService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getVendorBills', () => {
    it('should GET vendor bills without filters', () => {
      service.getVendorBills().subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('should pass vendorId filter', () => {
      service.getVendorBills(7).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('vendorId')).toBe('7');
      req.flush([]);
    });

    it('should pass status filter', () => {
      service.getVendorBills(undefined, 'Approved').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('status')).toBe('Approved');
      expect(req.request.params.has('vendorId')).toBe(false);
      req.flush([]);
    });
  });

  describe('getVendorBillById', () => {
    it('should GET vendor bill detail', () => {
      service.getVendorBillById(3).subscribe();
      const req = httpMock.expectOne(`${base}/3`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3 });
    });
  });

  describe('createVendorBill', () => {
    it('should POST new vendor bill', () => {
      const body = {
        vendorId: 1,
        billDate: '2026-06-01T00:00:00Z',
        dueDate: '2026-07-01T00:00:00Z',
        taxAmount: 0,
        lines: [{ description: 'Widgets', quantity: 2, unitPrice: 10 }],
      };
      service.createVendorBill(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('approveVendorBill', () => {
    it('should POST approve', () => {
      service.approveVendorBill(5).subscribe();
      const req = httpMock.expectOne(`${base}/5/approve`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('voidVendorBill', () => {
    it('should POST void', () => {
      service.voidVendorBill(6).subscribe();
      const req = httpMock.expectOne(`${base}/6/void`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });
});
