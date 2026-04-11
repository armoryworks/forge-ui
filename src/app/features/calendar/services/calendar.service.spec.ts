import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CalendarService } from './calendar.service';
import { environment } from '../../../../environments/environment';

describe('CalendarService', () => {
  let service: CalendarService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CalendarService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getJobs', () => {
    it('should GET jobs with isArchived=false', () => {
      service.getJobs().subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('isArchived')).toBe('false');
      req.flush([]);
    });
  });

  describe('getPoEvents', () => {
    it('should GET PO calendar events with from/to params', () => {
      service.getPoEvents('2026-01-01', '2026-01-31').subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/purchase-orders/calendar`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('from')).toBe('2026-01-01');
      expect(req.request.params.get('to')).toBe('2026-01-31');
      req.flush([]);
    });
  });
});
