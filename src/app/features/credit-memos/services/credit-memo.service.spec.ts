import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CreditMemoService } from './credit-memo.service';
import { environment } from '../../../../environments/environment';

describe('CreditMemoService', () => {
  let service: CreditMemoService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CreditMemoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists open memos for a customer', () => {
    service.getCreditMemos({ customerId: 4, openOnly: true }).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/credit-memos?customerId=4&openOnly=true`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('issues, applies, unapplies, refunds and voids', () => {
    service.issue(3).subscribe();
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${apiUrl}/credit-memos/3/issue`).flush({});

    service.apply(3, 9, 120.5).subscribe();
    const apply = httpMock.expectOne(`${apiUrl}/credit-memos/3/applications`);
    expect(apply.request.body).toEqual({ invoiceId: 9, amount: 120.5 });
    apply.flush({});

    service.unapply(3, 11).subscribe();
    expect(httpMock.expectOne(`${apiUrl}/credit-memos/3/applications/11`).request.method).toBe('DELETE');

    service.refund(3, { amount: 10, method: 'Check', refundDate: '2026-03-10T00:00:00Z' }).subscribe();
    expect(httpMock.expectOne(`${apiUrl}/credit-memos/3/refund`).request.body.amount).toBe(10);

    service.void(3, 'Mistake').subscribe();
    expect(httpMock.expectOne(`${apiUrl}/credit-memos/3/void`).request.body).toEqual({ reason: 'Mistake' });
  });

  it('updates a draft with its row version', () => {
    service.update(5, { reasonType: 'Other', reason: 'Fix', creditDate: '2026-03-10', lines: [] }, 4).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/credit-memos/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('"4"');
    expect(req.request.body.reason).toBe('Fix');
    req.flush({});
  });

  it('sends the row version on delete', () => {
    service.delete(5, 3).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/credit-memos/5`);
    expect(req.request.headers.get('If-Match')).toBe('"3"');
    req.flush(null);
  });

  it('writes off an invoice and refunds unapplied cash on a payment', () => {
    service.writeOffInvoice(8, null, 'Bankrupt').subscribe();
    expect(httpMock.expectOne(`${apiUrl}/invoices/8/write-off`).request.body).toEqual({ amount: null, reason: 'Bankrupt' });

    service.refundPayment(2, { amount: 40, method: 'BankTransfer', refundDate: '2026-03-10T00:00:00Z' }).subscribe();
    expect(httpMock.expectOne(`${apiUrl}/payments/2/refund`).request.method).toBe('POST');
  });
});
