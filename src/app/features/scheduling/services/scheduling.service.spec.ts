import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SchedulingService } from './scheduling.service';

describe('SchedulingService', () => {
  let service: SchedulingService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SchedulingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── Scheduling Runs ──────────────────────────────────────

  describe('runScheduler', () => {
    it('should POST scheduler run request', () => {
      const body = { algorithm: 'forward' } as any;
      service.runScheduler(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/run`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('simulateSchedule', () => {
    it('should POST simulate request', () => {
      const body = { algorithm: 'backward' } as any;
      service.simulateSchedule(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/simulate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 2 });
    });
  });

  describe('getScheduleRuns', () => {
    it('should GET schedule runs', () => {
      service.getScheduleRuns().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/runs`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ── Gantt ──────────────────────────────────────────────────

  describe('getGanttData', () => {
    it('should GET gantt data with from/to params', () => {
      service.getGanttData('2026-04-01', '2026-04-30').subscribe();
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/scheduling/gantt`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('from')).toBe('2026-04-01');
      expect(req.request.params.get('to')).toBe('2026-04-30');
      req.flush([]);
    });
  });

  // ── Operations ──────────────────────────────────────────────

  describe('rescheduleOperation', () => {
    it('should PATCH operation with new start', () => {
      service.rescheduleOperation(5, '2026-04-10T08:00:00Z').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/operations/5`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ newStart: '2026-04-10T08:00:00Z' });
      req.flush({});
    });
  });

  describe('lockOperation', () => {
    it('should POST lock state for operation', () => {
      service.lockOperation(5, true).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/operations/5/lock`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ isLocked: true });
      req.flush({});
    });
  });

  // ── Dispatch ──────────────────────────────────────────────

  describe('getDispatchList', () => {
    it('should GET dispatch list for work center', () => {
      service.getDispatchList(3).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/scheduling/dispatch/3`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ── Work Center Load ──────────────────────────────────────

  describe('getWorkCenterLoad', () => {
    it('should GET work center load with date range', () => {
      service.getWorkCenterLoad(2, '2026-04-01', '2026-04-07').subscribe();
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/scheduling/work-center-load/2`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('from')).toBe('2026-04-01');
      expect(req.request.params.get('to')).toBe('2026-04-07');
      req.flush({});
    });
  });

  // ── Work Centers ──────────────────────────────────────────

  describe('getWorkCenters', () => {
    it('should GET work centers', () => {
      service.getWorkCenters().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/work-centers`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createWorkCenter', () => {
    it('should POST new work center', () => {
      const body = { name: 'CNC Mill' } as any;
      service.createWorkCenter(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/work-centers`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateWorkCenter', () => {
    it('should PUT work center', () => {
      const body = { name: 'CNC Mill v2' } as any;
      service.updateWorkCenter(4, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/work-centers/4`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 4 });
    });
  });

  describe('deleteWorkCenter', () => {
    it('should DELETE work center', () => {
      service.deleteWorkCenter(4).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/work-centers/4`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ── Shifts ──────────────────────────────────────────────────

  describe('getShifts', () => {
    it('should GET shifts', () => {
      service.getShifts().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/shifts`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createShift', () => {
    it('should POST new shift', () => {
      const body = { name: 'Day Shift' } as any;
      service.createShift(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/shifts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateShift', () => {
    it('should PUT shift', () => {
      const body = { name: 'Night Shift' } as any;
      service.updateShift(2, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/shifts/2`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 2 });
    });
  });

  describe('deleteShift', () => {
    it('should DELETE shift', () => {
      service.deleteShift(2).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/shifts/2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
