import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { KanbanService } from './kanban.service';
import { environment } from '../../../../environments/environment';

describe('KanbanService', () => {
  let service: KanbanService;
  let httpMock: HttpTestingController;

  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(KanbanService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getBoard ──────────────────────────────────────────────────────────────

  describe('getBoard', () => {
    it('should GET track type and jobs then build board columns', () => {
      let result: unknown[] = [];
      service.getBoard(1).subscribe((columns) => { result = columns; });

      const trackTypeReq = httpMock.expectOne(`${apiUrl}/track-types/1`);
      expect(trackTypeReq.request.method).toBe('GET');
      trackTypeReq.flush({
        id: 1,
        name: 'Production',
        stages: [
          { id: 10, name: 'Quoting', sortOrder: 0 },
          { id: 11, name: 'In Production', sortOrder: 1 },
        ],
      });

      const jobsReq = httpMock.expectOne((r) => r.url === `${apiUrl}/jobs`);
      expect(jobsReq.request.method).toBe('GET');
      expect(jobsReq.request.params.get('trackTypeId')).toBe('1');
      expect(jobsReq.request.params.get('isArchived')).toBe('false');
      jobsReq.flush([
        { id: 100, title: 'Job A', stageName: 'Quoting' },
        { id: 101, title: 'Job B', stageName: 'In Production' },
      ]);

      expect(result.length).toBe(2);
    });
  });

  // ── getJobDetail ──────────────────────────────────────────────────────────

  describe('getJobDetail', () => {
    it('should GET job detail by id', () => {
      const mockDetail = { id: 5, title: 'Test Job', description: 'desc' };
      let result: unknown = null;

      service.getJobDetail(5).subscribe((detail) => { result = detail; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/5`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);

      expect(result).toEqual(mockDetail);
    });
  });

  // ── moveJobStage ──────────────────────────────────────────────────────────

  describe('moveJobStage', () => {
    it('should PATCH job stage with the new stageId', () => {
      let completed = false;
      service.moveJobStage(5, 11).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/5/stage`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ stageId: 11 });
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── createJob ─────────────────────────────────────────────────────────────

  describe('createJob', () => {
    it('should POST a new job and return the detail', () => {
      const command = { title: 'New Job', trackTypeId: 1, priority: 'Medium' };
      const mockResponse = { id: 99, title: 'New Job', trackTypeId: 1 };
      let result: unknown = null;

      service.createJob(command).subscribe((detail) => { result = detail; });

      const req = httpMock.expectOne(`${apiUrl}/jobs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(command);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateJob ─────────────────────────────────────────────────────────────

  describe('updateJob', () => {
    it('should PUT updated job fields', () => {
      const changes = { title: 'Updated Title', priority: 'High' };
      let completed = false;

      service.updateJob(5, changes).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/5`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(changes);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── getSubtasks ───────────────────────────────────────────────────────────

  describe('getSubtasks', () => {
    it('should GET subtasks for a job', () => {
      const mockSubtasks = [{ id: 1, text: 'Do thing', isCompleted: false }];
      let result: unknown[] = [];

      service.getSubtasks(5).subscribe((subtasks) => { result = subtasks; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/5/subtasks`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSubtasks);

      expect(result.length).toBe(1);
    });
  });

  // ── addSubtask ────────────────────────────────────────────────────────────

  describe('addSubtask', () => {
    it('should POST a new subtask', () => {
      const mockSubtask = { id: 2, text: 'New task', isCompleted: false };
      let result: unknown = null;

      service.addSubtask(5, 'New task').subscribe((st) => { result = st; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/5/subtasks`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ text: 'New task' });
      req.flush(mockSubtask);

      expect(result).toEqual(mockSubtask);
    });
  });

  // ── bulkMoveStage ─────────────────────────────────────────────────────────

  describe('bulkMoveStage', () => {
    it('should PATCH bulk stage move', () => {
      const mockResult = { successCount: 2, failureCount: 0, failures: [] };
      let result: unknown = null;

      service.bulkMoveStage([1, 2], 10).subscribe((r) => { result = r; });

      const req = httpMock.expectOne(`${apiUrl}/jobs/bulk/stage`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ jobIds: [1, 2], stageId: 10 });
      req.flush(mockResult);

      expect(result).toEqual(mockResult);
    });
  });
});
