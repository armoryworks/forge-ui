import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WorkerService } from './worker.service';
import { environment } from '../../../../environments/environment';

describe('WorkerService', () => {
  let service: WorkerService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/jobs`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('getMyTasks(assigneeId) sends GET to base with assigneeId as query param', () => {
    service.getMyTasks(42).subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.get('assigneeId')).toBe('42');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
  });

  it('getMyTasks asks for the largest page the server allows', () => {
    service.getMyTasks(7).subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.keys().sort()).toEqual(['assigneeId', 'pageSize']);
    expect(req.request.params.get('pageSize')).toBe('200');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
  });

  it('getMyTasks unwraps the paged envelope and maps job list items to tasks', () => {
    let result: unknown;
    service.getMyTasks(42).subscribe(tasks => { result = tasks; });
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    req.flush({
      items: [
        {
          id: 1, jobNumber: 'J-1', title: 'Mill part', stageName: 'In Production', stageColor: '#f59e0b',
          priorityName: 'High', customerName: 'Apex', dueDate: '2026-10-17T00:00:00+00:00',
          operationsTotal: 4, operationsComplete: 1,
        },
        {
          id: 2, jobNumber: 'J-2', title: 'Inspect bore', stageName: 'QC', stageColor: '#0d9488',
          priorityName: 'Normal', customerName: null, dueDate: null,
          operationsTotal: null, operationsComplete: null,
        },
      ],
      totalCount: 2, page: 1, pageSize: 200,
    });
    expect(result).toEqual([
      {
        id: 1, jobNumber: 'J-1', title: 'Mill part', stageName: 'In Production', stageColor: '#f59e0b',
        priority: 'High', customerName: 'Apex', dueDate: new Date('2026-10-17T00:00:00+00:00'),
        operationCount: 4, operationsCompleted: 1,
      },
      {
        id: 2, jobNumber: 'J-2', title: 'Inspect bore', stageName: 'QC', stageColor: '#0d9488',
        priority: 'Normal', customerName: null, dueDate: null,
        operationCount: 0, operationsCompleted: 0,
      },
    ]);
  });
});
