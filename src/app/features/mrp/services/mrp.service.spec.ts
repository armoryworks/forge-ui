import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MrpService } from './mrp.service';
import { environment } from '../../../../environments/environment';

describe('MrpService', () => {
  let service: MrpService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/mrp`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MrpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('getRuns', () => {
    it('should GET /mrp/runs and return list of runs', () => {
      const mockRuns = [{ id: 1, status: 'Completed' }, { id: 2, status: 'Running' }];
      service.getRuns().subscribe(res => {
        expect(res).toEqual(mockRuns);
      });
      const req = httpMock.expectOne(`${base}/runs`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRuns);
    });
  });

  describe('executeRun', () => {
    it('should POST to /mrp/runs with the request body', () => {
      const request = { planningHorizonDays: 90, includeForecasts: true };
      const mockRun = { id: 3, status: 'Running' };
      service.executeRun(request as any).subscribe(res => {
        expect(res).toEqual(mockRun);
      });
      const req = httpMock.expectOne(`${base}/runs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockRun);
    });
  });

  describe('getPlannedOrders', () => {
    it('should GET /mrp/planned-orders without filters', () => {
      service.getPlannedOrders().subscribe();
      const req = httpMock.expectOne(`${base}/planned-orders`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });

    it('should GET /mrp/planned-orders with mrpRunId filter', () => {
      service.getPlannedOrders(7).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/planned-orders`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('mrpRunId')).toBe('7');
      req.flush([]);
    });

    it('should GET /mrp/planned-orders with status filter', () => {
      service.getPlannedOrders(undefined, 'Planned' as any).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/planned-orders`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('Planned');
      req.flush([]);
    });

    it('should GET /mrp/planned-orders with both mrpRunId and status', () => {
      service.getPlannedOrders(5, 'Released' as any).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/planned-orders`);
      expect(req.request.params.get('mrpRunId')).toBe('5');
      expect(req.request.params.get('status')).toBe('Released');
      req.flush([]);
    });
  });

  describe('releasePlannedOrder', () => {
    it('should POST to /mrp/planned-orders/{id}/release', () => {
      const mockResult = { createdEntityType: 'PurchaseOrder', createdEntityId: 99 };
      service.releasePlannedOrder(12).subscribe(res => {
        expect(res).toEqual(mockResult);
      });
      const req = httpMock.expectOne(`${base}/planned-orders/12/release`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResult);
    });
  });

  describe('getExceptions', () => {
    it('should GET /mrp/exceptions without filters', () => {
      service.getExceptions().subscribe();
      const req = httpMock.expectOne(`${base}/exceptions`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });

    it('should GET /mrp/exceptions with unresolvedOnly=true', () => {
      service.getExceptions(undefined, true).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/exceptions`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('unresolvedOnly')).toBe('true');
      req.flush([]);
    });

    it('should GET /mrp/exceptions with mrpRunId and unresolvedOnly', () => {
      service.getExceptions(3, false).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/exceptions`);
      expect(req.request.params.get('mrpRunId')).toBe('3');
      expect(req.request.params.get('unresolvedOnly')).toBe('false');
      req.flush([]);
    });
  });

  describe('getMasterSchedules', () => {
    it('should GET /mrp/master-schedules without status filter', () => {
      service.getMasterSchedules().subscribe();
      const req = httpMock.expectOne(`${base}/master-schedules`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });

    it('should GET /mrp/master-schedules with status filter', () => {
      service.getMasterSchedules('Active' as any).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/master-schedules`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('Active');
      req.flush([]);
    });
  });

  describe('getForecasts', () => {
    it('should GET /mrp/forecasts without partId', () => {
      service.getForecasts().subscribe();
      const req = httpMock.expectOne(`${base}/forecasts`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });

    it('should GET /mrp/forecasts with partId param', () => {
      service.getForecasts(55).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/forecasts`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('partId')).toBe('55');
      req.flush([]);
    });
  });
});
