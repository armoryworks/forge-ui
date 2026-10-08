import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { EntityCompleteness } from '../models/entity-completeness.model';
import { EntityCompletenessService } from './entity-completeness.service';

function completeness(entityId: number, ok = true): EntityCompleteness {
  return {
    entityType: 'Part',
    entityId,
    capabilities: [{ capabilityCode: 'CAP-MD-PARTS', capabilityName: 'Parts', ok, missingFields: [] }],
  };
}

describe('EntityCompletenessService', () => {
  let service: EntityCompletenessService;
  let httpMock: HttpTestingController;
  const batchUrl = `${environment.apiUrl}/entities/Part/completeness`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EntityCompletenessService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getCompleteness() fetches one entity once and shares the result', () => {
    const seen: EntityCompleteness[] = [];
    service.getCompleteness('Part', 5).subscribe(v => seen.push(v));
    service.getCompleteness('Part', 5).subscribe(v => seen.push(v));

    httpMock.expectOne(`${environment.apiUrl}/entities/Part/5/completeness`).flush(completeness(5));

    expect(seen.map(v => v.entityId)).toEqual([5, 5]);
  });

  it('prime() serves every primed id from one batch request', () => {
    service.prime('Part', [1, 2, 3]);
    const seen = new Map<number, boolean>();
    for (const id of [1, 2, 3]) {
      service.getCompleteness('Part', id).subscribe(v => seen.set(v.entityId, v.capabilities[0].ok));
    }
    service.getCompleteness('Part', 2).subscribe();

    const req = httpMock.expectOne(r => r.url === batchUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('ids')).toBe('1,2,3');
    req.flush([completeness(1), completeness(2, false), completeness(3)]);

    expect([...seen.entries()]).toEqual([[1, true], [2, false], [3, true]]);
  });

  it('prime() skips ids already cached and de-duplicates the rest', () => {
    service.seed('Part', 1, completeness(1));

    service.prime('Part', [1, 2, 2, 3]);
    service.getCompleteness('Part', 2).subscribe();

    const req = httpMock.expectOne(r => r.url === batchUrl);
    expect(req.request.params.get('ids')).toBe('2,3');
    req.flush([completeness(2), completeness(3)]);
  });

  it('prime() sends nothing when every id is already cached', () => {
    service.seed('Part', 1, completeness(1));

    service.prime('Part', [1]);
    service.getCompleteness('Part', 1).subscribe();

    httpMock.expectNone(r => r.url === batchUrl);
  });

  it('prime() splits more than 200 ids into batches of at most 200', () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    service.prime('Part', ids);
    service.getCompleteness('Part', 1).subscribe();
    service.getCompleteness('Part', 250).subscribe();

    const requests = httpMock.match(r => r.url === batchUrl);
    expect(requests.map(r => r.request.params.get('ids')!.split(',').length)).toEqual([200, 50]);
    requests[0].flush(ids.slice(0, 200).map(id => completeness(id)));
    requests[1].flush(ids.slice(200).map(id => completeness(id)));
  });

  it('an id missing from the batch errors for its consumer and is refetched individually next time', () => {
    service.prime('Part', [1, 2]);
    let failed = false;
    service.getCompleteness('Part', 2).subscribe({ error: () => (failed = true) });

    httpMock.expectOne(r => r.url === batchUrl).flush([completeness(1)]);
    expect(failed).toBe(true);

    service.getCompleteness('Part', 2).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/entities/Part/2/completeness`).flush(completeness(2));
  });

  it('invalidate() drops a primed entry so the next read fetches fresh', () => {
    service.prime('Part', [1]);
    service.invalidate('Part', 1);

    service.getCompleteness('Part', 1).subscribe();

    httpMock.expectNone(r => r.url === batchUrl);
    httpMock.expectOne(`${environment.apiUrl}/entities/Part/1/completeness`).flush(completeness(1));
  });
});
