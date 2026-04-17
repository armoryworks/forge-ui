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
    req.flush([]);
  });

  it('getMyTasks sends only the assigneeId param (no extra params)', () => {
    service.getMyTasks(7).subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(1);
    expect(req.request.params.get('assigneeId')).toBe('7');
    req.flush([]);
  });

  it('getMyTasks returns the response from the API', () => {
    const mockTasks = [
      { id: 1, title: 'Mill part', status: 'InProgress' },
      { id: 2, title: 'Inspect bore', status: 'Pending' },
    ];
    let result: unknown;
    service.getMyTasks(42).subscribe(tasks => { result = tasks; });
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    req.flush(mockTasks);
    expect(result).toEqual(mockTasks);
  });
});
