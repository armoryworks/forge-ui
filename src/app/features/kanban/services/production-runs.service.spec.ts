import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProductionRunsService } from './production-runs.service';

describe('ProductionRunsService', () => {
  let service: ProductionRunsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProductionRunsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists a job\'s runs', () => {
    service.getRuns(7).subscribe();
    const req = httpMock.expectOne('/api/v1/jobs/7/production-runs');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a run with its work center and tooling', () => {
    service.createRun(7, { partId: 3, targetQuantity: 2000, operatorId: null, notes: null, workCenterId: 4, toolingAssetId: 9 }).subscribe();
    const req = httpMock.expectOne('/api/v1/jobs/7/production-runs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.toolingAssetId).toBe(9);
    req.flush({});
  });

  it('updates a run with PUT', () => {
    service.updateRun(7, 11, {
      completedQuantity: 10, scrapQuantity: 1, status: 'Completed', notes: null, setupTimeMinutes: null, runTimeMinutes: null, toolingAssetId: null,
    }).subscribe();
    const req = httpMock.expectOne('/api/v1/jobs/7/production-runs/11');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.status).toBe('Completed');
    req.flush({});
  });

  it('receives a run to stock, passing the bin only when chosen', () => {
    service.receiveToStock(7, 11).subscribe();
    const plain = httpMock.expectOne('/api/v1/jobs/7/production-runs/11/receive-to-stock');
    expect(plain.request.method).toBe('POST');
    plain.flush({});

    service.receiveToStock(7, 11, 5).subscribe();
    const withBin = httpMock.expectOne(r => r.url === '/api/v1/jobs/7/production-runs/11/receive-to-stock' && r.params.get('locationId') === '5');
    withBin.flush({});
  });
});
