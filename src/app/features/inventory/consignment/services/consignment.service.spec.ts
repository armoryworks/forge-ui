import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ConsignmentService } from './consignment.service';

describe('ConsignmentService', () => {
  let service: ConsignmentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ConsignmentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the stock summary and an agreement history', () => {
    service.stockSummary().subscribe();
    service.transactions(5).subscribe();
    http.expectOne(r => r.url.endsWith('/consignment-agreements/stock-summary')).flush({ agreements: [] });
    http.expectOne(r => r.url.endsWith('/consignment-agreements/5/transactions')).flush([]);
  });

  it('posts receive, consume and reconcile to the agreement', () => {
    const body = { quantity: 3, notes: null, storageLocationId: 2, binContentId: null, lotNumber: null, jobId: null, purchaseOrderId: null };
    service.receive(5, body).subscribe();
    service.consume(5, { ...body, jobId: 9 }).subscribe();
    service.reconcile(5, { physicalCount: null, periodFrom: null, periodTo: null, createBill: true, vendorInvoiceNumber: null }).subscribe();
    for (const action of ['receive', 'consume', 'reconcile']) {
      const req = http.expectOne(r => r.url.endsWith(`/consignment-agreements/5/${action}`));
      expect(req.request.method).toBe('POST');
      req.flush({});
    }
  });
});
