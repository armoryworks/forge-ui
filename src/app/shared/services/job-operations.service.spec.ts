import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { JobOperationsService } from './job-operations.service';

describe('JobOperationsService', () => {
  let service: JobOperationsService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobOperationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the operations of a job', () => {
    service.getOperations(42).subscribe();
    const req = http.expectOne(`${api}/jobs/42/operations`);
    expect(req.request.method).toBe('GET');
    req.flush({ operations: [] });
  });

  it('starts an operation timer with the entry type in the body', () => {
    service.startTimer(42, 7, 'Setup').subscribe();
    const req = http.expectOne(`${api}/jobs/42/operations/7/timer/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ entryType: 'Setup' });
    req.flush({});
  });

  it('starts a run timer when no entry type is given', () => {
    service.startTimer(42, 7).subscribe();
    const req = http.expectOne(`${api}/jobs/42/operations/7/timer/start`);
    expect(req.request.body).toEqual({ entryType: 'Run' });
    req.flush({});
  });

  it('stops the caller\'s timer on one operation', () => {
    service.stopTimer(42, 7).subscribe();
    const req = http.expectOne(`${api}/jobs/42/operations/7/timer/stop`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ notes: null });
    req.flush({ stopped: true, entry: null });
  });

  it('patches progress with absolute values and the expected version', () => {
    service.updateProgress(42, 7, { completedQuantity: 20, scrapQuantity: 1, status: null, expectedVersion: 3 }).subscribe();
    const req = http.expectOne(`${api}/jobs/42/operations/7`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ completedQuantity: 20, scrapQuantity: 1, status: null, expectedVersion: 3 });
    req.flush({});
  });

  it('turns tracking on from the config and caches the answer', async () => {
    const first = firstValueFrom(service.loadConfig());
    http.expectOne(`${api}/job-operations/config`).flush({ operationTracking: true });
    expect(await first).toBe(true);
    expect(service.trackingEnabled()).toBe(true);

    expect(await firstValueFrom(service.loadConfig())).toBe(true);
    http.expectNone(`${api}/job-operations/config`);
  });

  it('treats a failed config read as tracking off', async () => {
    const result = firstValueFrom(service.loadConfig());
    http.expectOne(`${api}/job-operations/config`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(await result).toBe(false);
    expect(service.trackingEnabled()).toBe(false);
  });
});
