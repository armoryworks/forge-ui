import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SalesChannelService } from './sales-channel.service';
import { environment } from '../../../../environments/environment';
import { SalesChannel } from '../models/sales-channel.model';

describe('SalesChannelService', () => {
  let service: SalesChannelService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/sales-channels`;

  const mockChannel: SalesChannel = {
    id: 1,
    name: 'Direct',
    code: 'DIRECT',
    description: null,
    channelType: 'DirectB2B',
    soldToCustomerId: null,
    soldToCustomerName: null,
    taxCollectedBy: 'Seller',
    isDefault: true,
    isActive: true,
    orderNumberPrefix: null,
    eCommerceIntegrationId: null,
    isRetail: false,
    orderCount: 12,
    listingCount: 0,
    createdAt: '2026-08-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SalesChannelService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests active channels by default', () => {
    service.getChannels().subscribe((channels) => {
      expect(channels).toEqual([mockChannel]);
    });

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('includeInactive')).toBe('false');
    // Absent rather than empty — an unset channelType must not narrow the list.
    expect(req.request.params.has('channelType')).toBe(false);
    req.flush([mockChannel]);
  });

  it('passes includeInactive and channelType when filtering', () => {
    service.getChannels(true, 'Marketplace').subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.get('includeInactive')).toBe('true');
    expect(req.request.params.get('channelType')).toBe('Marketplace');
    req.flush([]);
  });

  it('creates a channel', () => {
    const body = {
      name: 'eBay US',
      code: 'EBAY-US',
      description: null,
      channelType: 'Marketplace' as const,
      soldToCustomerId: 7,
      taxCollectedBy: null,
      orderNumberPrefix: 'EB',
      eCommerceIntegrationId: null,
    };

    service.createChannel(body).subscribe((channel) => {
      expect(channel.id).toBe(2);
    });

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ ...mockChannel, id: 2 });
  });

  it('posts to the set-default action with an empty body', () => {
    service.setDefault(3).subscribe();

    const req = httpMock.expectOne(`${base}/3/set-default`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('deletes a channel', () => {
    service.deleteChannel(4).subscribe();

    const req = httpMock.expectOne(`${base}/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
