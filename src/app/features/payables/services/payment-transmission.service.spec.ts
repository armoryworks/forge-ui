import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PaymentTransmissionService } from './payment-transmission.service';
import { environment } from '../../../../environments/environment';

describe('PaymentTransmissionService', () => {
  let service: PaymentTransmissionService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/payment-transmissions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentTransmissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPaymentTransmissions', () => {
    it('should GET transmissions without filters', () => {
      service.getPaymentTransmissions().subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('should pass status filter', () => {
      service.getPaymentTransmissions('Failed').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('status')).toBe('Failed');
      expect(req.request.params.has('sourceType')).toBe(false);
      req.flush([]);
    });

    it('should pass sourceType filter', () => {
      service.getPaymentTransmissions(undefined, 'VendorPayment').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('sourceType')).toBe('VendorPayment');
      expect(req.request.params.has('status')).toBe(false);
      req.flush([]);
    });

    it('should pass both filters', () => {
      service.getPaymentTransmissions('Failed', 'VendorPayment').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('status')).toBe('Failed');
      expect(req.request.params.get('sourceType')).toBe('VendorPayment');
      req.flush([]);
    });
  });

  describe('retryPaymentTransmission', () => {
    it('should POST retry and return the updated list item', () => {
      service.retryPaymentTransmission(9).subscribe();
      const req = httpMock.expectOne(`${base}/9/retry`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 9, status: 'Queued' });
    });
  });
});
