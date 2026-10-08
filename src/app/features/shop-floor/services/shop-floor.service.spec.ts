import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ShopFloorService } from './shop-floor.service';
import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';

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

  describe('getAvailableJobs', () => {
    it('should GET a page of open jobs for the team, filtered by the search term', () => {
      service.getAvailableJobs(7, ' J-2403 ', 50).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/jobs/available`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('teamId')).toBe('7');
      expect(req.request.params.get('search')).toBe('J-2403');
      expect(req.request.params.get('take')).toBe('50');
      req.flush([]);
    });

    it('should leave out an empty search and a missing team', () => {
      service.getAvailableJobs(undefined, '  ', 100).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/jobs/available`);
      expect(req.request.params.has('teamId')).toBe(false);
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.get('take')).toBe('100');
      req.flush([]);
    });
  });

  describe('claimJob', () => {
    it('should POST a claim for the signed-in worker', () => {
      service.claimJob(2403).subscribe();
      const req = httpMock.expectOne(`${base}/jobs/2403/claim`);
      expect(req.request.method).toBe('POST');
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
      expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(false);
      req.flush(null);
    });

    it('names the job or the time entry to stop', () => {
      service.stopTimer({ jobId: 41 }).subscribe();
      httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`).flush(null);
      service.stopTimer({ timeEntryId: 9 }).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/time-tracking/timer/stop`);
      expect(req.request.body).toEqual({ notes: null, timeEntryId: 9 });
      expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
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

    it('leaves operation failures to the terminal instead of the global error toast', () => {
      service.getConfig().subscribe();
      service.getOperations(41).subscribe();
      service.getActiveTimers().subscribe();
      service.startOperationTimer(41, 7).subscribe();
      service.stopOperationTimer(41, 7).subscribe();
      service.updateOperationProgress(41, 7, { completedQuantity: 1, scrapQuantity: 0, expectedVersion: 1 }).subscribe();
      const requests = [
        httpMock.expectOne(`${apiUrl}/job-operations/config`),
        httpMock.expectOne(`${apiUrl}/jobs/41/operations`),
        httpMock.expectOne(`${apiUrl}/time-tracking/timers/active`),
        httpMock.expectOne(`${apiUrl}/jobs/41/operations/7/timer/start`),
        httpMock.expectOne(`${apiUrl}/jobs/41/operations/7/timer/stop`),
        httpMock.expectOne(r => r.method === 'PATCH' && r.url === `${apiUrl}/jobs/41/operations/7`),
      ];
      expect(requests.map(r => r.request.context.get(SILENT_HTTP_ERRORS))).toEqual([true, true, true, true, true, true]);
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

  describe('raiseAndon', () => {
    it('posts the job, type and note to the terminal andon route without a global error toast', () => {
      service.raiseAndon({ jobId: 41, type: 'Stoppage', notes: 'Spindle stalled' }).subscribe();
      const req = httpMock.expectOne(`${base}/andon`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ jobId: 41, type: 'Stoppage', notes: 'Spindle stalled' });
      expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
      req.flush({ alertId: 1 });
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
