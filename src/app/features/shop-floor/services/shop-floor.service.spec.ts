import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ShopFloorService } from './shop-floor.service';
import { environment } from '../../../../environments/environment';

describe('ShopFloorService', () => {
  let service: ShopFloorService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;
  const base = `${apiUrl}/display/shop-floor`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ShopFloorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getOverview', () => {
    it('should GET shop floor overview', () => {
      service.getOverview().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush({ workers: [], jobs: [] });
    });

    it('should pass teamId param', () => {
      service.getOverview(2).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('teamId')).toBe('2');
      req.flush({ workers: [], jobs: [] });
    });
  });

  describe('getClockStatus', () => {
    it('should GET clock status', () => {
      service.getClockStatus().subscribe();
      const req = httpMock.expectOne(`${base}/clock-status`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('clockInOut', () => {
    it('should POST clock event', () => {
      service.clockInOut(1, 'ClockIn').subscribe();
      const req = httpMock.expectOne(`${base}/clock`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.userId).toBe(1);
      expect(req.request.body.eventType).toBe('ClockIn');
      req.flush(null);
    });
  });

  describe('identifyScan', () => {
    it('should POST scan value', () => {
      service.identifyScan('BADGE-001').subscribe();
      const req = httpMock.expectOne(`${base}/identify-scan`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.scanValue).toBe('BADGE-001');
      req.flush({ userId: 1, displayName: 'Test User' });
    });
  });

  describe('assignJob', () => {
    it('should POST assign job', () => {
      service.assignJob(10, 2).subscribe();
      const req = httpMock.expectOne(`${base}/assign-job`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.jobId).toBe(10);
      expect(req.request.body.userId).toBe(2);
      req.flush(null);
    });
  });

  describe('startTimer', () => {
    it('should POST start timer', () => {
      service.startTimer(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/time-tracking/timer/start`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.jobId).toBe(5);
      req.flush(null);
    });
  });

  describe('stopTimer', () => {
    it('should POST stop timer', () => {
      service.stopTimer().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('sends exactly today\'s body when no target is named', () => {
      service.stopTimer().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`);
      expect(req.request.body).toEqual({ notes: null });
      req.flush(null);
    });

    it('names the job or the time entry to stop', () => {
      service.stopTimer({ jobId: 41 }).subscribe();
      httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`).flush(null);
      service.stopTimer({ timeEntryId: 9 }).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`);
      expect(req.request.body).toEqual({ notes: null, timeEntryId: 9 });
      req.flush(null);
    });
  });

  describe('operation tracking', () => {
    it('reads the switch from the job-operations config', () => {
      let tracking: boolean | undefined;
      service.getConfig().subscribe(c => (tracking = c.operationTracking));
      const req = httpMock.expectOne(`${apiUrl}/job-operations/config`);
      expect(req.request.method).toBe('GET');
      req.flush({ operationTracking: true });
      expect(tracking).toBe(true);
    });

    it('treats a refused or failed config read as off', () => {
      let tracking: boolean | undefined;
      service.getConfig().subscribe(c => (tracking = c.operationTracking));
      httpMock.expectOne(`${apiUrl}/job-operations/config`).flush(null, { status: 403, statusText: 'Forbidden' });
      expect(tracking).toBe(false);
    });

    it('GETs the job operations and the caller\'s open timers', () => {
      service.getOperations(41).subscribe();
      expect(httpMock.expectOne(`${apiUrl}/jobs/41/operations`).request.method).toBe('GET');
      service.getActiveTimers().subscribe();
      expect(httpMock.expectOne(`${apiUrl}/time-tracking/timers/active`).request.method).toBe('GET');
    });

    it('starts a run timer by default and a setup timer on request', () => {
      service.startOperationTimer(41, 7).subscribe();
      const run = httpMock.expectOne(`${apiUrl}/jobs/41/operations/7/timer/start`);
      expect(run.request.method).toBe('POST');
      expect(run.request.body).toEqual({ entryType: 'Run' });
      service.startOperationTimer(41, 7, 'Setup').subscribe();
      expect(httpMock.expectOne(`${apiUrl}/jobs/41/operations/7/timer/start`).request.body).toEqual({ entryType: 'Setup' });
    });

    it('stops the caller\'s timer on one operation', () => {
      service.stopOperationTimer(41, 7).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/41/operations/7/timer/stop`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ notes: null });
    });

    it('PATCHes absolute progress with the expected version', () => {
      service.updateOperationProgress(41, 7, { completedQuantity: 20, scrapQuantity: 1, expectedVersion: 3 }).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/41/operations/7`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ completedQuantity: 20, scrapQuantity: 1, expectedVersion: 3 });
    });
  });

  describe('completeJob', () => {
    it('should POST complete job and return the new status name', () => {
      let stageName: string | undefined;
      service.completeJob(5).subscribe(r => (stageName = r.stageName));
      const req = httpMock.expectOne(`${base}/complete-job`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.jobId).toBe(5);
      req.flush({ stageName: 'QC/Review' });
      expect(stageName).toBe('QC/Review');
    });
  });

  describe('getJobStatus', () => {
    it('should GET the job status from the kiosk surface', () => {
      service.getJobStatus(5).subscribe();
      const req = httpMock.expectOne(`${base}/jobs/5/status`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('advanceJob', () => {
    it('should POST advance for the job', () => {
      service.advanceJob(5).subscribe();
      const req = httpMock.expectOne(`${base}/jobs/5/advance`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('getTeams', () => {
    it('should GET teams', () => {
      service.getTeams().subscribe();
      const req = httpMock.expectOne(`${base}/teams`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createTeam', () => {
    it('should POST new team', () => {
      service.createTeam('Welding', '#ff0000', 'Welding team').subscribe();
      const req = httpMock.expectOne(`${base}/teams`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe('Welding');
      req.flush({ id: 1 });
    });
  });
});
