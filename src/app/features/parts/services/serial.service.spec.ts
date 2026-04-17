import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SerialService } from './serial.service';
import { environment } from '../../../../environments/environment';

describe('SerialService', () => {
  let service: SerialService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/serials`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SerialService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('getPartSerials', () => {
    it('should GET /serials/part/{partId} without status filter', () => {
      const mockSerials = [{ id: 1, serialValue: 'SN-001' }, { id: 2, serialValue: 'SN-002' }];
      service.getPartSerials(10).subscribe(res => {
        expect(res).toEqual(mockSerials);
      });
      const req = httpMock.expectOne(`${base}/part/10`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockSerials);
    });

    it('should GET /serials/part/{partId} with status param', () => {
      service.getPartSerials(10, 'Active' as any).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/part/10`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('Active');
      req.flush([]);
    });
  });

  describe('createSerialNumber', () => {
    it('should POST to /serials/part/{partId} with the request body', () => {
      const request = { serialValue: 'SN-003', manufacturedAt: '2026-01-15T00:00:00Z' };
      const mockSerial = { id: 3, serialValue: 'SN-003', partId: 10 };
      service.createSerialNumber(10, request as any).subscribe(res => {
        expect(res).toEqual(mockSerial);
      });
      const req = httpMock.expectOne(`${base}/part/10`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockSerial);
    });
  });

  describe('getGenealogy', () => {
    it('should GET /serials/{encodedValue}/genealogy with URL-encoded serial value', () => {
      const serialValue = 'SN/2026-001';
      const encoded = encodeURIComponent(serialValue);
      const mockGenealogy = { serialValue, children: [], parent: null };
      service.getGenealogy(serialValue).subscribe(res => {
        expect(res).toEqual(mockGenealogy);
      });
      const req = httpMock.expectOne(`${base}/${encoded}/genealogy`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGenealogy);
    });

    it('should correctly encode a plain serial value', () => {
      const serialValue = 'SN-001';
      service.getGenealogy(serialValue).subscribe();
      const req = httpMock.expectOne(`${base}/${encodeURIComponent(serialValue)}/genealogy`);
      expect(req.request.method).toBe('GET');
      req.flush({ serialValue, children: [], parent: null });
    });
  });

  describe('transferSerial', () => {
    it('should POST to /serials/{id}/transfer with the request body', () => {
      const request = { toJobId: 42, notes: 'Transfer to assembly job' };
      service.transferSerial(5, request as any).subscribe();
      const req = httpMock.expectOne(`${base}/5/transfer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });
  });

  describe('getSerialHistory', () => {
    it('should GET /serials/{id}/history', () => {
      const mockHistory = [{ id: 1, action: 'Created', timestamp: '2026-01-01T00:00:00Z' }];
      service.getSerialHistory(5).subscribe(res => {
        expect(res).toEqual(mockHistory);
      });
      const req = httpMock.expectOne(`${base}/5/history`);
      expect(req.request.method).toBe('GET');
      req.flush(mockHistory);
    });
  });
});
