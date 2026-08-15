import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RetailBuyerService } from './retail-buyer.service';
import { environment } from '../../../../environments/environment';

describe('RetailBuyerService', () => {
  let service: RetailBuyerService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/retail-orders`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RetailBuyerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests buyers with no params when unfiltered', () => {
    service.getBuyers({}).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/buyers`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('passes the purged filter as an explicit boolean', () => {
    service.getBuyers({ isPurged: false, channelId: 2 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/buyers`);
    expect(req.request.params.get('isPurged')).toBe('false');
    expect(req.request.params.get('channelId')).toBe('2');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('purges a buyer and reports how many addresses went with them', () => {
    service.purgePii(11).subscribe((result) => {
      expect(result.buyersPurged).toBe(1);
      expect(result.addressesPurged).toBe(4);
    });

    const req = httpMock.expectOne(`${base}/buyers/11/purge-pii`);
    expect(req.request.method).toBe('POST');
    req.flush({ buyersPurged: 1, addressesPurged: 4 });
  });
});
