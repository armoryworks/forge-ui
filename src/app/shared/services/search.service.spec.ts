import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { SearchService } from './search.service';
import { SearchResult } from '../models/search.model';
import { environment } from '../../../environments/environment';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  const mockResults: SearchResult[] = [
    { entityType: 'job', entityId: 1, title: 'JOB-001', subtitle: 'Test job', icon: 'work', url: '/kanban?detail=job:1' },
    { entityType: 'part', entityId: 2, title: 'PART-002', subtitle: 'Test part', icon: 'inventory_2', url: '/parts?detail=part:2' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SearchService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── search ──

  it('search should call correct API endpoint with term and limit', () => {
    service.search('test', 10).subscribe((results) => {
      expect(results.length).toBe(2);
      expect(results[0].entityType).toBe('job');
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/search` && r.params.get('q') === 'test' && r.params.get('limit') === '10',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResults);
  });

  it('search should use default limit of 20', () => {
    service.search('query').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/search` && r.params.get('q') === 'query' && r.params.get('limit') === '20',
    );
    req.flush([]);
  });
});
