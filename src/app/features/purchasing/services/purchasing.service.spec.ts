import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PurchasingService } from './purchasing.service';
import { environment } from '../../../../environments/environment';

describe('PurchasingService', () => {
  let service: PurchasingService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/purchasing`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PurchasingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('getRfqs', () => {
    it('should GET /purchasing/rfqs without filters', () => {
      const mockRfqs = [{ id: 1, title: 'RFQ-001' }, { id: 2, title: 'RFQ-002' }];
      service.getRfqs().subscribe(res => {
        expect(res).toEqual(mockRfqs);
      });
      const req = httpMock.expectOne(`${base}/rfqs`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockRfqs);
    });

    it('should GET /purchasing/rfqs with status and search params', () => {
      service.getRfqs('Open', 'bolt').subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/rfqs`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('Open');
      expect(req.request.params.get('search')).toBe('bolt');
      req.flush([]);
    });
  });

  describe('getRfqById', () => {
    it('should GET /purchasing/rfqs/{id}', () => {
      const mockDetail = { id: 7, title: 'RFQ-007', lines: [] };
      service.getRfqById(7).subscribe(res => {
        expect(res).toEqual(mockDetail);
      });
      const req = httpMock.expectOne(`${base}/rfqs/7`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);
    });
  });

  describe('createRfq', () => {
    it('should POST to /purchasing/rfqs with the request body', () => {
      const request = { title: 'New RFQ', partId: 5, quantity: 100 };
      const mockRfq = { id: 8, title: 'New RFQ' };
      service.createRfq(request as any).subscribe(res => {
        expect(res).toEqual(mockRfq);
      });
      const req = httpMock.expectOne(`${base}/rfqs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockRfq);
    });
  });

  describe('sendToVendors', () => {
    it('should POST to /purchasing/rfqs/{id}/send with the request body', () => {
      const request = { vendorIds: [1, 2, 3], dueDate: '2026-05-01T00:00:00Z' };
      service.sendToVendors(7, request as any).subscribe();
      const req = httpMock.expectOne(`${base}/rfqs/7/send`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });
  });

  describe('compareResponses', () => {
    it('should GET /purchasing/rfqs/{id}/compare', () => {
      const mockComparison = [{ vendorId: 1, unitPrice: 9.99 }, { vendorId: 2, unitPrice: 10.5 }];
      service.compareResponses(7).subscribe(res => {
        expect(res).toEqual(mockComparison);
      });
      const req = httpMock.expectOne(`${base}/rfqs/7/compare`);
      expect(req.request.method).toBe('GET');
      req.flush(mockComparison);
    });
  });

  describe('awardRfq', () => {
    it('should POST to /purchasing/rfqs/{id}/award/{responseId}', () => {
      const mockResult = { purchaseOrderId: 42 };
      service.awardRfq(7, 3).subscribe(res => {
        expect(res).toEqual(mockResult);
      });
      const req = httpMock.expectOne(`${base}/rfqs/7/award/3`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResult);
    });
  });
});
