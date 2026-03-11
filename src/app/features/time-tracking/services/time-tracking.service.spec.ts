import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TimeTrackingService } from './time-tracking.service';
import { environment } from '../../../../environments/environment';

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/time-tracking`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TimeTrackingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getTimeEntries ────────────────────────────────────────────────────────

  describe('getTimeEntries', () => {
    it('should GET time entries without filters', () => {
      let result: unknown[] = [];
      service.getTimeEntries().subscribe((entries) => { result = entries; });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/entries`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, hours: 2.5, description: 'Machining' }]);

      expect(result.length).toBe(1);
    });

    it('should include userId and jobId query params when provided', () => {
      service.getTimeEntries(5, 10).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/entries`);
      expect(req.request.params.get('userId')).toBe('5');
      expect(req.request.params.get('jobId')).toBe('10');
      req.flush([]);
    });

    it('should include from and to query params when provided', () => {
      service.getTimeEntries(undefined, undefined, '2026-03-01', '2026-03-31').subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/entries`);
      expect(req.request.params.get('from')).toBe('2026-03-01');
      expect(req.request.params.get('to')).toBe('2026-03-31');
      req.flush([]);
    });
  });

  // ── startTimer ────────────────────────────────────────────────────────────

  describe('startTimer', () => {
    it('should POST to start a timer and return the entry', () => {
      const request = { jobId: 10, description: 'Working on machining' } as any;
      const mockResponse = { id: 5, jobId: 10, isRunning: true };
      let result: unknown = null;

      service.startTimer(request).subscribe((entry) => { result = entry; });

      const req = httpMock.expectOne(`${baseUrl}/timer/start`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── stopTimer ─────────────────────────────────────────────────────────────

  describe('stopTimer', () => {
    it('should POST to stop a timer and return the entry', () => {
      const request = { entryId: 5 } as any;
      const mockResponse = { id: 5, jobId: 10, isRunning: false, hours: 1.5 };
      let result: unknown = null;

      service.stopTimer(request).subscribe((entry) => { result = entry; });

      const req = httpMock.expectOne(`${baseUrl}/timer/stop`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── createTimeEntry ───────────────────────────────────────────────────────

  describe('createTimeEntry', () => {
    it('should POST a new time entry and return it', () => {
      const request = { jobId: 10, hours: 3.0, description: 'Assembly' } as any;
      const mockResponse = { id: 6, jobId: 10, hours: 3.0, description: 'Assembly' };
      let result: unknown = null;

      service.createTimeEntry(request).subscribe((entry) => { result = entry; });

      const req = httpMock.expectOne(`${baseUrl}/entries`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── deleteTimeEntry ───────────────────────────────────────────────────────

  describe('deleteTimeEntry', () => {
    it('should DELETE the specified time entry', () => {
      let completed = false;
      service.deleteTimeEntry(6).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/entries/6`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── getCurrentPayPeriod ───────────────────────────────────────────────────

  describe('getCurrentPayPeriod', () => {
    it('should GET the current pay period', () => {
      const mockPeriod = { startDate: '2026-03-01', endDate: '2026-03-14', type: 'Biweekly' };
      let result: unknown = null;

      service.getCurrentPayPeriod().subscribe((period) => { result = period; });

      const req = httpMock.expectOne(`${baseUrl}/pay-period`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPeriod);

      expect(result).toEqual(mockPeriod);
    });
  });

  // ── updateTimeEntry ───────────────────────────────────────────────────────

  describe('updateTimeEntry', () => {
    it('should PATCH the time entry with updated fields', () => {
      const request = { hours: 4.0, description: 'Updated' } as any;
      const mockResponse = { id: 6, hours: 4.0, description: 'Updated' };
      let result: unknown = null;

      service.updateTimeEntry(6, request).subscribe((entry) => { result = entry; });

      const req = httpMock.expectOne(`${baseUrl}/entries/6`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });
});
