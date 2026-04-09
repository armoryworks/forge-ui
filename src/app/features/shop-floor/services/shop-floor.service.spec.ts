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
  });

  describe('completeJob', () => {
    it('should POST complete job', () => {
      service.completeJob(5).subscribe();
      const req = httpMock.expectOne(`${base}/complete-job`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.jobId).toBe(5);
      req.flush(null);
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
