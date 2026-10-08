import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../../environments/environment';
import { SubcontractService } from './subcontract.service';

describe('SubcontractService', () => {
  let service: SubcontractService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubcontractService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the subcontracted operations of a job', () => {
    service.getOperations(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/jobs/7/subcontract-operations`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('loads the subcontract orders of a job', () => {
    service.getOrders(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/jobs/7/subcontract-orders`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('posts a send-out for an operation', () => {
    const body = { quantity: 10, unitCost: 0, expectedReturnDate: '2026-10-15T00:00:00.000Z', createPurchaseOrder: true };
    service.sendOut(7, 30, body).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/jobs/7/operations/30/send-out`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('posts a receive-back for an order', () => {
    const body = { receivedQuantity: 8, scrapQuantity: 2, passedInspection: true };
    service.receiveBack(5, body).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/subcontract-orders/5/receive`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});
