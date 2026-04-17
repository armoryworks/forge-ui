import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { OeeService } from './oee.service';
import { environment } from '../../../../environments/environment';

describe('OeeService', () => {
  let service: OeeService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/reports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OeeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('getOeeReport', () => {
    it('should GET /reports/oee with dateFrom and dateTo params', () => {
      const mockData = [{ workCenterId: 1, oee: 0.82 }];
      service.getOeeReport('2026-01-01', '2026-01-31').subscribe(res => {
        expect(res).toEqual(mockData);
      });
      const req = httpMock.expectOne(r => r.url === `${base}/oee`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('dateFrom')).toBe('2026-01-01');
      expect(req.request.params.get('dateTo')).toBe('2026-01-31');
      req.flush(mockData);
    });
  });

  describe('getOeeByWorkCenter', () => {
    it('should GET /reports/oee/{workCenterId} with date params', () => {
      const mockData = { workCenterId: 3, oee: 0.75, availability: 0.9 };
      service.getOeeByWorkCenter(3, '2026-02-01', '2026-02-28').subscribe(res => {
        expect(res).toEqual(mockData);
      });
      const req = httpMock.expectOne(r => r.url === `${base}/oee/3`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('dateFrom')).toBe('2026-02-01');
      expect(req.request.params.get('dateTo')).toBe('2026-02-28');
      req.flush(mockData);
    });
  });

  describe('getOeeTrend', () => {
    it('should GET /reports/oee/{workCenterId}/trend with default granularity of Daily', () => {
      service.getOeeTrend(2, '2026-01-01', '2026-01-31').subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/oee/2/trend`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('dateFrom')).toBe('2026-01-01');
      expect(req.request.params.get('dateTo')).toBe('2026-01-31');
      expect(req.request.params.get('granularity')).toBe('Daily');
      req.flush([]);
    });

    it('should GET /reports/oee/{workCenterId}/trend with custom granularity', () => {
      service.getOeeTrend(2, '2026-01-01', '2026-03-31', 'Weekly').subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/oee/2/trend`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('granularity')).toBe('Weekly');
      req.flush([]);
    });
  });

  describe('getSixBigLosses', () => {
    it('should GET /reports/oee/{workCenterId}/losses with date params', () => {
      const mockLosses = { breakdownLoss: 5, setupLoss: 3, speedLoss: 8, qualityLoss: 2 };
      service.getSixBigLosses(5, '2026-01-01', '2026-01-31').subscribe(res => {
        expect(res).toEqual(mockLosses);
      });
      const req = httpMock.expectOne(r => r.url === `${base}/oee/5/losses`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('dateFrom')).toBe('2026-01-01');
      expect(req.request.params.get('dateTo')).toBe('2026-01-31');
      req.flush(mockLosses);
    });
  });
});
