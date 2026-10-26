import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { VendorReturnService } from './vendor-return.service';
import { environment } from '../../../../environments/environment';

describe('VendorReturnService', () => {
  let service: VendorReturnService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/vendor-returns`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VendorReturnService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists returns for an NCR', () => {
    service.getReturns(null, null, 12).subscribe();
    const req = httpMock.expectOne(r => r.url === base);
    expect(req.request.params.get('nonConformanceId')).toBe('12');
    req.flush([]);
  });

  it('ships and records the credit', () => {
    service.ship(3, { shipDate: null, carrier: 'UPS', trackingNumber: '1Z', rmaNumber: null, notes: null }).subscribe();
    expect(httpMock.expectOne(`${base}/3/ship`).request.body.carrier).toBe('UPS');
    service.recordCredit(3, { vendorReference: 'VC-1', memoDate: null, notes: null, lines: null }).subscribe();
    expect(httpMock.expectOne(`${base}/3/credit`).request.method).toBe('POST');
  });

  it('downloads the packing document in the given language', () => {
    service.getPdf(3, 'en').subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/3/pdf`);
    expect(req.request.params.get('lang')).toBe('en');
    req.flush(new Blob());
  });
});
