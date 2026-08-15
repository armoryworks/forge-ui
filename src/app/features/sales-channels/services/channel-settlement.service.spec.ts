import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChannelSettlementService } from './channel-settlement.service';
import { environment } from '../../../../environments/environment';

describe('ChannelSettlementService', () => {
  let service: ChannelSettlementService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/channel-settlements`;
  const adminBase = `${environment.apiUrl}/admin/ecommerce`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ChannelSettlementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('filters settlements by channel and status', () => {
    service.getSettlements({ channelId: 6, status: 'Discrepancy' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.get('channelId')).toBe('6');
    expect(req.request.params.get('status')).toBe('Discrepancy');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('fetches one settlement with its lines', () => {
    service.getSettlement(8).subscribe((detail) => {
      expect(detail.lines.length).toBe(1);
    });

    const req = httpMock.expectOne(`${base}/8`);
    expect(req.request.method).toBe('GET');
    req.flush({ settlement: { id: 8 }, lines: [{ id: 1 }] });
  });

  it('sends the reason when accepting a variance', () => {
    service.acceptVariance(8, 'Reserve withheld, never itemised').subscribe();

    const req = httpMock.expectOne(`${base}/8/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resolutionNotes: 'Reserve withheld, never itemised' });
    req.flush({ id: 8, status: 'Accepted' });
  });

  it('imports settlements through the admin e-commerce route', () => {
    service.importSettlements(6).subscribe();

    const req = httpMock.expectOne(`${adminBase}/channels/6/import-settlements`);
    expect(req.request.method).toBe('POST');
    req.flush({ imported: 2, updated: 0, reconciled: 1, withDiscrepancy: 1, unmatchedOrderLines: 0 });
  });
});
