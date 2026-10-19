import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { etagInterceptor } from './etag.interceptor';
import { ConcurrencyConflictService } from '../services/concurrency-conflict.service';

describe('etagInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([etagInterceptor])),
        provideHttpClientTesting(),
        { provide: ConcurrencyConflictService, useValue: { notify: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sends the rowVersion of the last purchase-order GET as If-Match on the next PUT', () => {
    http.get('/api/v1/purchase-orders/5').subscribe();
    backend.expectOne('/api/v1/purchase-orders/5').flush({ id: 5, poNumber: 'PO-00005', rowVersion: 3 });

    http.put('/api/v1/purchase-orders/5', { notes: 'Call before delivery' }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/purchase-orders/5');

    expect(put.request.headers.get('If-Match')).toBe('"3"');
    put.flush(null);
  });

  it('sends no If-Match when the resource was never read', () => {
    http.put('/api/v1/purchase-orders/6', { notes: 'x' }).subscribe();
    const put = backend.expectOne('/api/v1/purchase-orders/6');

    expect(put.request.headers.has('If-Match')).toBe(false);
    put.flush(null);
  });
});
