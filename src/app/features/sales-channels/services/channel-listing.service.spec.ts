import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChannelListingService } from './channel-listing.service';
import { environment } from '../../../../environments/environment';

describe('ChannelListingService', () => {
  let service: ChannelListingService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/channel-listings`;
  const adminBase = `${environment.apiUrl}/admin/ecommerce`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ChannelListingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('omits filters that were not supplied', () => {
    service.getListings({}).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('sends the unmapped filter as an explicit boolean', () => {
    // false must survive as "false" rather than being dropped by a truthiness
    // check — it is a real filter meaning "only mapped listings".
    service.getListings({ channelId: 3, isUnmapped: false }).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.get('channelId')).toBe('3');
    expect(req.request.params.get('isUnmapped')).toBe('false');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('maps a listing to a part', () => {
    service.mapListing(9, 42).subscribe((result) => {
      expect(result.backfilledOrderLines).toBe(3);
    });

    const req = httpMock.expectOne(`${base}/9/mapping`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ partId: 42 });
    req.flush({ listing: { id: 9 }, backfilledOrderLines: 3 });
  });

  it('clears a mapping by sending an explicit null partId', () => {
    service.mapListing(9, null).subscribe();

    const req = httpMock.expectOne(`${base}/9/mapping`);
    expect(req.request.body).toEqual({ partId: null });
    req.flush({ listing: { id: 9 }, backfilledOrderLines: 0 });
  });

  it('syncs listings through the admin e-commerce route', () => {
    service.syncListings(5).subscribe();

    const req = httpMock.expectOne(`${adminBase}/channels/5/sync-listings`);
    expect(req.request.method).toBe('POST');
    req.flush({ created: 1, updated: 2, deactivated: 0, unmapped: 1 });
  });
});
