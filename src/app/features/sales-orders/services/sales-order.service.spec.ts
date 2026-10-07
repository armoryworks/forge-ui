import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SalesOrderService } from './sales-order.service';
import { environment } from '../../../../environments/environment';

describe('SalesOrderService', () => {
  let service: SalesOrderService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getSalesOrders', () => {
    it('should GET sales orders', () => {
      service.getSalesOrders().subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/sales-orders`);
      expect(req.request.method).toBe('GET');
      // Default page size of 200 is always sent
      expect(req.request.params.get('pageSize')).toBe('200');
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });
  });

  describe('getSalesOrderById', () => {
    it('should GET detail by id', () => {
      service.getSalesOrderById(3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/orders/3`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3 });
    });
  });

  describe('createSalesOrder', () => {
    it('should POST new order', () => {
      const body = { customerId: 1, lines: [] } as any;
      service.createSalesOrder(body).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/orders`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
    });
  });

  describe('confirmSalesOrder', () => {
    it('should POST confirm action', () => {
      service.confirmSalesOrder(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/orders/5/confirm`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should return the number of work orders created', () => {
      let result: unknown;
      service.confirmSalesOrder(5).subscribe(r => (result = r));
      httpMock.expectOne(`${apiUrl}/orders/5/confirm`).flush({ jobsCreated: 2 });
      expect(result).toEqual({ jobsCreated: 2 });
    });
  });

  describe('createMissingJobs', () => {
    it('should POST for every unlinked line when no line is given', () => {
      let result: unknown;
      service.createMissingJobs(5).subscribe(r => (result = r));
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/orders/5/create-missing-jobs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.params.has('lineId')).toBe(false);
      req.flush({ created: 1, skipped: [{ lineNumber: 2, reason: 'No part' }] });
      expect(result).toEqual({ created: 1, skipped: [{ lineNumber: 2, reason: 'No part' }] });
    });

    it('should send the line id when one line is given', () => {
      service.createMissingJobs(5, 41).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/orders/5/create-missing-jobs`);
      expect(req.request.params.get('lineId')).toBe('41');
      req.flush({ created: 1, skipped: [] });
    });
  });

  describe('cancelSalesOrder', () => {
    it('should POST an empty body when no fee is charged', () => {
      service.cancelSalesOrder(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/orders/5/cancel`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });

    it('should send the fee and reason', () => {
      service.cancelSalesOrder(5, { feeAmount: 150, feeReason: 'Material bought' }).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/orders/5/cancel`);
      expect(req.request.body).toEqual({ feeAmount: 150, feeReason: 'Material bought' });
      req.flush(null);
    });
  });

  describe('deleteSalesOrder', () => {
    it('should DELETE order', () => {
      service.deleteSalesOrder(2).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/orders/2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
