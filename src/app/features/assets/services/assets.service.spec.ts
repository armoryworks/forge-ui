import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AssetsService } from './assets.service';
import { environment } from '../../../../environments/environment';

describe('AssetsService', () => {
  let service: AssetsService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/assets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AssetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getAssets ─────────────────────────────────────────────────────────────

  describe('getAssets', () => {
    it('should GET assets without filters', () => {
      let result: unknown[] = [];
      service.getAssets().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, name: 'CNC Mill', type: 'Machine' }]);

      expect(result.length).toBe(1);
    });

    it('should include type, status, and search query params when provided', () => {
      service.getAssets('Machine' as any, 'Active' as any, 'cnc').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('type')).toBe('Machine');
      expect(req.request.params.get('status')).toBe('Active');
      expect(req.request.params.get('search')).toBe('cnc');
      req.flush([]);
    });
  });

  // ── createAsset ───────────────────────────────────────────────────────────

  describe('createAsset', () => {
    it('should POST a new asset and return the item', () => {
      const request = { name: 'Lathe', type: 'Machine', serialNumber: 'SN-001' } as any;
      const mockResponse = { id: 2, name: 'Lathe', type: 'Machine' };
      let result: unknown = null;

      service.createAsset(request).subscribe((asset) => { result = asset; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateAsset ───────────────────────────────────────────────────────────

  describe('updateAsset', () => {
    it('should PATCH the asset with updated fields', () => {
      const request = { name: 'Updated Lathe' } as any;
      const mockResponse = { id: 2, name: 'Updated Lathe', type: 'Machine' };
      let result: unknown = null;

      service.updateAsset(2, request).subscribe((asset) => { result = asset; });

      const req = httpMock.expectOne(`${baseUrl}/2`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── deleteAsset ───────────────────────────────────────────────────────────

  describe('deleteAsset', () => {
    it('should DELETE the specified asset', () => {
      let completed = false;
      service.deleteAsset(2).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── updateMachineHours ────────────────────────────────────────────────────

  describe('updateMachineHours', () => {
    it('should PATCH machine hours for the asset', () => {
      const mockResponse = { id: 1, name: 'CNC Mill', currentHours: 500 };
      let result: unknown = null;

      service.updateMachineHours(1, 500).subscribe((asset) => { result = asset; });

      const req = httpMock.expectOne(`${baseUrl}/1/hours`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ currentHours: 500 });
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── getDowntimeLogs ───────────────────────────────────────────────────────

  describe('getDowntimeLogs', () => {
    it('should GET downtime logs for a specific asset', () => {
      const mockLogs = [{ id: 1, reason: 'Maintenance', startTime: '2026-03-10T08:00:00Z' }];
      let result: unknown[] = [];

      service.getDowntimeLogs(1).subscribe((logs) => { result = logs; });

      const req = httpMock.expectOne(`${baseUrl}/1/downtime`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLogs);

      expect(result.length).toBe(1);
    });

    it('should GET all downtime logs when no assetId provided', () => {
      service.getDowntimeLogs().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/downtime`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ── createDowntimeLog ─────────────────────────────────────────────────────

  describe('createDowntimeLog', () => {
    it('should POST a new downtime log for the asset', () => {
      const request = { reason: 'Breakdown', startTime: '2026-03-10T14:00:00Z' } as any;
      const mockResponse = { id: 2, reason: 'Breakdown', assetId: 1 };
      let result: unknown = null;

      service.createDowntimeLog(1, request).subscribe((log) => { result = log; });

      const req = httpMock.expectOne(`${baseUrl}/1/downtime`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });
});
