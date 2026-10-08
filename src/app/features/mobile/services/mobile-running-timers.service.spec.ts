import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import { RunningTimer } from '../../../shared/models/running-timer.model';
import { MobileRunningTimersService } from './mobile-running-timers.service';

describe('MobileRunningTimersService', () => {
  let service: MobileRunningTimersService;
  let http: HttpTestingController;

  const timer = (id: number, jobId: number | null, timerStart = '2026-10-08T14:00:00Z'): RunningTimer => ({
    id, jobId, jobNumber: jobId === null ? null : `J-${jobId}`, userId: 1, operationId: null, jobOperationId: null,
    operationStepNumber: null, operationTitle: null, entryType: null, timerStart,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MobileRunningTimersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads every open timer of the caller without surfacing a failure', () => {
    service.load();

    const req = http.expectOne('/api/v1/time-tracking/timers/active');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush([timer(1, 59), timer(2, 60)]);

    expect(service.timers().map(t => t.id)).toEqual([1, 2]);
    expect(service.onJob(60).map(t => t.id)).toEqual([2]);
    expect(service.onJob(61)).toEqual([]);
  });

  it('shows nothing running when the request fails', () => {
    service.load();
    http.expectOne('/api/v1/time-tracking/timers/active').flush([timer(1, 59)]);

    service.load();
    http.expectOne('/api/v1/time-tracking/timers/active').flush(null, { status: 404, statusText: 'Not Found' });

    expect(service.timers()).toEqual([]);
  });

  it('formats elapsed time as hours, minutes and seconds', () => {
    const start = Date.parse('2026-10-08T14:00:00Z');

    expect(service.elapsed(timer(1, 59), start + 754_000)).toBe('0:12:34');
    expect(service.elapsed(timer(1, 59), start + 3 * 3_600_000 + 5_000)).toBe('3:00:05');
    expect(service.elapsed(timer(1, 59), start - 60_000)).toBe('0:00:00');
  });
});
