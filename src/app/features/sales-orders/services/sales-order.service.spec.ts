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
      const req = httpMock.expectOne(`${apiUrl}/orders`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
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
