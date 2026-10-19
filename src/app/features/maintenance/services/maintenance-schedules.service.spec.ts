import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { environment } from '../../../../environments/environment';

describe('MaintenanceSchedulesService', () => {
  let service: MaintenanceSchedulesService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/assets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MaintenanceSchedulesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('lists every schedule', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(`${base}/maintenance`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a schedule under its asset with the shot interval', () => {
    service.create({ assetId: 9, title: 'Mold PM', intervalDays: 180, intervalShots: 50000, nextDueAt: '2026-11-01T00:00:00Z' }).subscribe();
    const req = httpMock.expectOne(`${base}/9/maintenance`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.intervalShots).toBe(50000);
    req.flush({});
  });

  it('logs a service with the meter readings', () => {
    service.logService(4, { hoursAtService: 260, shotCountAtService: 50500 }).subscribe();
    const req = httpMock.expectOne(`${base}/maintenance/4/log`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ hoursAtService: 260, shotCountAtService: 50500 });
    req.flush({});
  });

  it('creates a maintenance job for a schedule', () => {
    service.createJob(4).subscribe();
    const req = httpMock.expectOne(`${base}/maintenance/4/create-job`);
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 12 });
  });
});
