import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PhysicalInventoryService } from './physical-inventory.service';

describe('PhysicalInventoryService', () => {
  let service: PhysicalInventoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PhysicalInventoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists by status', () => {
    service.list('Counting').subscribe();
    const req = http.expectOne(r => r.url.endsWith('/inventory/physical-inventory') && r.params.get('status') === 'Counting');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('puts a count on a tag', () => {
    service.enterCount(4, 9, 12).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/inventory/physical-inventory/4/tags/9/count'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ quantity: 12, notes: null });
    req.flush({});
  });

  it('posts the lifecycle actions', () => {
    service.freeze(1).subscribe();
    service.submitForReview(1).subscribe();
    service.post(1).subscribe();
    service.cancel(1).subscribe();
    for (const action of ['freeze', 'review', 'post', 'cancel']) {
      const req = http.expectOne(r => r.url.endsWith(`/physical-inventory/1/${action}`));
      expect(req.request.method).toBe('POST');
      req.flush({});
    }
  });

  it('downloads the count sheets as a blob', () => {
    service.countSheets(3, 'es').subscribe();
    const req = http.expectOne(r => r.url.endsWith('/physical-inventory/3/count-sheets') && r.params.get('language') === 'es');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
