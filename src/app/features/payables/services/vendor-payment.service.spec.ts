import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorPaymentService } from './vendor-payment.service';
import { environment } from '../../../../environments/environment';

describe('VendorPaymentService', () => {
  let service: VendorPaymentService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/vendor-payments`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VendorPaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getVendorPayments', () => {
    it('should GET vendor payments without filters', () => {
      service.getVendorPayments().subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('should pass vendorId filter', () => {
      service.getVendorPayments(7).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('vendorId')).toBe('7');
      req.flush([]);
    });
  });

  describe('getVendorPaymentById', () => {
    it('should GET vendor payment detail', () => {
      service.getVendorPaymentById(3).subscribe();
      const req = httpMock.expectOne(`${base}/3`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3 });
    });
  });

  describe('createVendorPayment', () => {
    it('should POST new vendor payment', () => {
      const body = {
        vendorId: 1,
        method: 'Check',
        amount: 100,
        paymentDate: '2026-06-01T00:00:00Z',
        applications: [{ vendorBillId: 2, amount: 100 }],
      };
      service.createVendorPayment(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('voidVendorPayment', () => {
    it('should POST void with the required reason in the body', () => {
      service.voidVendorPayment(6, 'Duplicate payment').subscribe();
      const req = httpMock.expectOne(`${base}/6/void`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'Duplicate payment' });
      req.flush(null);
    });
  });
});
