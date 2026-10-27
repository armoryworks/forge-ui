import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorCreditMemoService } from './vendor-credit-memo.service';
import { environment } from '../../../../environments/environment';

describe('VendorCreditMemoService', () => {
  let service: VendorCreditMemoService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/vendor-credit-memos`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VendorCreditMemoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists memos with the vendor, open-only and currency filters', () => {
    service.getMemos({ vendorId: 4, openOnly: true, currencyId: 2 }).subscribe();
    const req = httpMock.expectOne(r => r.url === base);
    expect(req.request.params.get('vendorId')).toBe('4');
    expect(req.request.params.get('openOnly')).toBe('true');
    expect(req.request.params.get('currencyId')).toBe('2');
    req.flush([]);
  });

  it('issues, applies, unapplies and voids through the memo routes', () => {
    service.issue(9).subscribe();
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${base}/9/issue`).flush({});
    service.apply(9, 31, 100).subscribe();
    const apply = httpMock.expectOne(r => r.method === 'POST' && r.url === `${base}/9/applications`);
    expect(apply.request.body).toEqual({ vendorBillId: 31, amount: 100 });
    apply.flush({});
    service.unapply(9, 5).subscribe();
    httpMock.expectOne(r => r.method === 'DELETE' && r.url === `${base}/9/applications/5`).flush({});
    service.void(9, 'Withdrawn').subscribe();
    expect(httpMock.expectOne(`${base}/9/void`).request.body).toEqual({ reason: 'Withdrawn' });
  });

  it('sends If-Match on update and delete', () => {
    service.delete(9, 3).subscribe();
    const req = httpMock.expectOne(r => r.method === 'DELETE' && r.url === `${base}/9`);
    expect(req.request.headers.get('If-Match')).toBe('"3"');
    req.flush(null);
  });

  it('asks for the PDF in the given language and reads the vendor statement', () => {
    service.getPdf(9, 'es').subscribe();
    const pdf = httpMock.expectOne(r => r.url === `${base}/9/pdf`);
    expect(pdf.request.params.get('lang')).toBe('es');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob());
    service.getStatement(4).subscribe();
    httpMock.expectOne(`${base}/statement/4`).flush({ lines: [], totals: [] });
  });
});
