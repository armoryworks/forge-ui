import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PaymentService } from './payment.service';
import { environment } from '../../../../environments/environment';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/payments`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Phase 3 F7-broad / WU-22 — getPayments() now goes through the paged
  // endpoint and unwraps the envelope.
  describe('getPayments', () => {
    const empty = { items: [], totalCount: 0, page: 1, pageSize: 200 };

    it('should GET payments without filters', () => {
      service.getPayments().subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('pageSize')).toBe('200');
      req.flush(empty);
    });

    it('should pass customerId filter', () => {
      service.getPayments(12).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('12');
      req.flush(empty);
    });
  });

  describe('getPaymentById', () => {
    it('should GET payment detail', () => {
      service.getPaymentById(3).subscribe();
      const req = httpMock.expectOne(`${base}/3`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3 });
    });
  });

  describe('createPayment', () => {
    it('should POST new payment', () => {
      const body = { customerId: 1, amount: 500, method: 'Check' } as any;
      service.createPayment(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('deletePayment', () => {
    it('should DELETE payment', () => {
      service.deletePayment(6).subscribe();
      const req = httpMock.expectOne(`${base}/6`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
