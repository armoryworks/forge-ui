import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { KanbanService } from './kanban.service';
import { KanbanBoard } from '../models/kanban-board.model';
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
    function flushTrackType(): void {
      httpMock.expectOne(`${apiUrl}/track-types/1`).flush({
        id: 1,
        name: 'Production',
        stages: [
          { id: 10, name: 'Quoting', sortOrder: 0 },
          { id: 11, name: 'In Production', sortOrder: 1 },
        ],
      });
    }

    it('should GET track type and jobs then build board columns', () => {
      let result: KanbanBoard | null = null;
      service.getBoard(1).subscribe((board) => { result = board; });

      flushTrackType();

      const jobsReq = httpMock.expectOne((r) => r.url === `${apiUrl}/jobs`);
      expect(jobsReq.request.method).toBe('GET');
      expect(jobsReq.request.params.get('trackTypeId')).toBe('1');
      expect(jobsReq.request.params.get('isArchived')).toBe('false');
      expect(jobsReq.request.params.get('sort')).toBe('board');
      jobsReq.flush({
        items: [
          { id: 100, title: 'Job A', stageName: 'Quoting' },
          { id: 101, title: 'Job B', stageName: 'In Production' },
        ],
        totalCount: 2,
        page: 1,
        pageSize: 200,
      });

      const board = result as unknown as KanbanBoard;
      expect(board.columns.length).toBe(2);
      expect(board.totalCount).toBe(2);
      expect(board.loadedCount).toBe(2);
    });

    it('orders each column by board position, then id, and maps part and quantity', () => {
      let result: KanbanBoard | null = null;
      service.getBoard(1).subscribe((board) => { result = board; });

      flushTrackType();
      httpMock.expectOne((r) => r.url === `${apiUrl}/jobs`).flush({
        items: [
          { id: 7, stageName: 'Quoting', boardPosition: 2 },
          { id: 9, stageName: 'Quoting', boardPosition: 0, partNumber: 'BRK-100', quantity: 500 },
          { id: 3, stageName: 'Quoting', boardPosition: 2 },
          { id: 4, stageName: 'Quoting' },
        ],
        totalCount: 4,
        page: 1,
        pageSize: 200,
      });

      const quoting = (result as unknown as KanbanBoard).columns[0].jobs;
      expect(quoting.map(j => j.id)).toEqual([4, 9, 3, 7]);
      const part = quoting.find(j => j.id === 9)!;
      expect(part.partNumber).toBe('BRK-100');
      expect(part.quantity).toBe(500);
      const bare = quoting.find(j => j.id === 4)!;
      expect(bare.boardPosition).toBe(0);
      expect(bare.partNumber).toBeNull();
      expect(bare.quantity).toBeNull();
    });

    it('reports the server total when the board holds more jobs than one page', () => {
      let result: KanbanBoard | null = null;
      service.getBoard(1).subscribe((board) => { result = board; });

      flushTrackType();
      httpMock.expectOne((r) => r.url === `${apiUrl}/jobs`).flush({
        items: [{ id: 1, stageName: 'Quoting', boardPosition: 0 }],
        totalCount: 245,
        page: 1,
        pageSize: 200,
      });

      expect((result as unknown as KanbanBoard).totalCount).toBe(245);
      expect((result as unknown as KanbanBoard).loadedCount).toBe(1);
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
      const command = { title: 'New Job', trackTypeId: 1, priority: 'Medium', partId: 12, quantity: 500 };
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
