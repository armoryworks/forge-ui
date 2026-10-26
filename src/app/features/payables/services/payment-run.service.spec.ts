import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PaymentRunService } from './payment-run.service';
import { environment } from '../../../../environments/environment';

describe('PaymentRunService', () => {
  let service: PaymentRunService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/payment-runs`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PaymentRunService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('creates a run with the credit deduction flag', () => {
    service.create({ paymentDate: '2026-03-12T00:00:00Z', method: 'Check', applyVendorCredits: true, items: [{ vendorBillId: 1, amount: 50 }] }).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.applyVendorCredits).toBe(true);
    req.flush({});
  });

  it('resumes and cancels a run', () => {
    service.resume(4).subscribe();
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${base}/4/resume`).flush({});
    service.cancel(4).subscribe();
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${base}/4/cancel`).flush({});
  });

  it('filters the list by status', () => {
    service.getRuns('Interrupted').subscribe();
    const req = httpMock.expectOne(r => r.url === base);
    expect(req.request.params.get('status')).toBe('Interrupted');
    req.flush([]);
  });
});
