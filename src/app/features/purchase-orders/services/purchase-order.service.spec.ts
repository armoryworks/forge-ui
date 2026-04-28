import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PurchaseOrderService } from './purchase-order.service';
import { environment } from '../../../../environments/environment';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PurchaseOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPurchaseOrders', () => {
    it('should GET purchase orders list (Phase 3 F7-broad / WU-22 — paged envelope)', () => {
      const mock = { items: [{ id: 1, poNumber: 'PO-001' }], totalCount: 1, page: 1, pageSize: 200 };
      let result: unknown[] = [];
      service.getPurchaseOrders().subscribe(r => { result = r; });

      const req = httpMock.expectOne(r => r.url === `${apiUrl}/purchase-orders`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('pageSize')).toBe('200');
      req.flush(mock);
      expect(result.length).toBe(1);
    });

    it('should pass filter params (Phase 3 F7-broad / WU-22 — paged envelope)', () => {
      service.getPurchaseOrders(5, undefined, 'Submitted').subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/purchase-orders`);
      expect(req.request.params.get('vendorId')).toBe('5');
      expect(req.request.params.get('status')).toBe('Submitted');
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });
  });

  describe('getPurchaseOrderById', () => {
    it('should GET PO detail', () => {
      const mock = { id: 1, poNumber: 'PO-001', lines: [] };
      let result: unknown = null;
      service.getPurchaseOrderById(1).subscribe(r => { result = r; });

      const req = httpMock.expectOne(`${apiUrl}/purchase-orders/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);
      expect(result).toEqual(mock);
    });
  });

  describe('createPurchaseOrder', () => {
    it('should POST new PO', () => {
      const body = { vendorId: 1, lines: [] } as any;
      service.createPurchaseOrder(body).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/purchase-orders`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 99 });
    });
  });

  describe('submitPurchaseOrder', () => {
    it('should POST submit action', () => {
      service.submitPurchaseOrder(5).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/purchase-orders/5/submit`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('deletePurchaseOrder', () => {
    it('should DELETE PO', () => {
      service.deletePurchaseOrder(3).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/purchase-orders/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
