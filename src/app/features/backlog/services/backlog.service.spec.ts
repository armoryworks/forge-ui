import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BacklogService } from './backlog.service';
import { environment } from '../../../../environments/environment';

describe('BacklogService', () => {
  let service: BacklogService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BacklogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getJobs', () => {
    it('should GET jobs with isArchived=false', () => {
      service.getJobs().subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('isArchived')).toBe('false');
      // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });

    it('should pass trackTypeId filter', () => {
      service.getJobs({ trackTypeId: 3 }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.params.get('trackTypeId')).toBe('3');
      // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });

    it('should pass assigneeId filter', () => {
      service.getJobs({ assigneeId: 7 }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.params.get('assigneeId')).toBe('7');
      // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });

    it('should pass search filter', () => {
      service.getJobs({ search: 'widget' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.params.get('search')).toBe('widget');
      // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });

    it('should not set optional params when null', () => {
      service.getJobs({ trackTypeId: null, assigneeId: null, search: '' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/jobs`);
      expect(req.request.params.has('trackTypeId')).toBe(false);
      expect(req.request.params.has('assigneeId')).toBe(false);
      expect(req.request.params.has('search')).toBe(false);
      // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    });
  });
});
