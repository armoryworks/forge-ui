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

  it('sends the version from the job GET on a stage move', () => {
    http.get('/api/v1/jobs/20').subscribe();
    backend.expectOne('/api/v1/jobs/20').flush({ id: 20, rowVersion: 4 });

    http.patch('/api/v1/jobs/20/stage', { stageId: 3 }).subscribe();
    const patch = backend.expectOne('/api/v1/jobs/20/stage');

    expect(patch.request.headers.get('If-Match')).toBe('"4"');
    patch.flush(null);
  });

  it('files the version a stage move returns under the job, so the next edit is not stale', () => {
    http.patch('/api/v1/jobs/20/stage', { stageId: 3 }).subscribe();
    backend.expectOne('/api/v1/jobs/20/stage').flush({ id: 20, rowVersion: 8 });

    http.put('/api/v1/jobs/20', { title: 'x' }).subscribe();
    http.patch('/api/v1/jobs/20/stage', { stageId: 4 }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/jobs/20');
    const patch = backend.expectOne('/api/v1/jobs/20/stage');

    expect(put.request.headers.get('If-Match')).toBe('"8"');
    expect(patch.request.headers.get('If-Match')).toBe('"8"');
    put.flush(null);
    patch.flush(null);
  });

  it('sends the version from the invoice GET on a number change', () => {
    http.get('/api/v1/invoices/12').subscribe();
    backend.expectOne('/api/v1/invoices/12').flush({ id: 12, rowVersion: 2 });

    http.patch('/api/v1/invoices/12/number', { invoiceNumber: 'INV-9' }).subscribe();
    const patch = backend.expectOne('/api/v1/invoices/12/number');

    expect(patch.request.headers.get('If-Match')).toBe('"2"');
    patch.flush(null);
  });

  it('keeps a nested record under its own key', () => {
    http.get('/api/v1/jobs/20/operations/5').subscribe();
    backend.expectOne('/api/v1/jobs/20/operations/5').flush({ id: 5, rowVersion: 6 });

    http.put('/api/v1/jobs/20', { title: 'x' }).subscribe();
    http.put('/api/v1/jobs/20/operations/5', { name: 'Deburr' }).subscribe();
    const job = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/jobs/20');
    const op = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/jobs/20/operations/5');

    expect(job.request.headers.has('If-Match')).toBe(false);
    expect(op.request.headers.get('If-Match')).toBe('"6"');
    job.flush(null);
    op.flush(null);
  });

  it('does not file a child row returned under a parent path as the parent', () => {
    http.post('/api/v1/sales-orders/5/lines', { partId: 1 }).subscribe();
    backend.expectOne('/api/v1/sales-orders/5/lines').flush({ id: 77, rowVersion: 1 });

    http.put('/api/v1/sales-orders/5', { notes: 'x' }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/sales-orders/5');

    expect(put.request.headers.has('If-Match')).toBe(false);
    put.flush(null);
  });

  it('sends no If-Match on a board reorder but keeps the job version it returns', () => {
    http.get('/api/v1/jobs/20').subscribe();
    backend.expectOne('/api/v1/jobs/20').flush({ id: 20, rowVersion: 4 });

    http.patch('/api/v1/jobs/20/position', { position: 2 }).subscribe();
    const position = backend.expectOne('/api/v1/jobs/20/position');
    expect(position.request.headers.has('If-Match')).toBe(false);
    position.flush(null, { headers: { ETag: '"5"' } });

    http.put('/api/v1/jobs/20', { title: 'x' }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/jobs/20');

    expect(put.request.headers.get('If-Match')).toBe('"5"');
    put.flush(null);
  });

  it('keeps an If-Match the caller set over the cached one', () => {
    http.get('/api/v1/jobs/20').subscribe();
    backend.expectOne('/api/v1/jobs/20').flush({ id: 20, rowVersion: 4 });

    http.patch('/api/v1/jobs/20/stage', { stageId: 3 }, { headers: { 'If-Match': '"9"' } }).subscribe();
    const patch = backend.expectOne('/api/v1/jobs/20/stage');

    expect(patch.request.headers.get('If-Match')).toBe('"9"');
    patch.flush(null);
  });

  it('leaves bulk job paths alone', () => {
    http.get('/api/v1/jobs/20').subscribe();
    backend.expectOne('/api/v1/jobs/20').flush({ id: 20, rowVersion: 4 });

    http.patch('/api/v1/jobs/bulk/stage', { jobIds: [20], stageId: 3 }).subscribe();
    const bulk = backend.expectOne('/api/v1/jobs/bulk/stage');

    expect(bulk.request.headers.has('If-Match')).toBe(false);
    bulk.flush(null);
  });

  it('sends no If-Match when the resource was never read', () => {
    http.put('/api/v1/purchase-orders/6', { notes: 'x' }).subscribe();
    const put = backend.expectOne('/api/v1/purchase-orders/6');

    expect(put.request.headers.has('If-Match')).toBe(false);
    put.flush(null);
  });
  it('files the version a customer summary read returns under the customer, so the detail save sends it', () => {
    http.get('/api/v1/customers/5/summary').subscribe();
    backend.expectOne('/api/v1/customers/5/summary').flush({ id: 5, name: 'Acme', rowVersion: 2 });

    http.put('/api/v1/customers/5', { name: 'Acme Co' }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/customers/5');

    expect(put.request.headers.get('If-Match')).toBe('"2"');
    put.flush(null);
  });

  it('sends the refreshed customer version after a credit hold reloads the summary', () => {
    http.get('/api/v1/customers/5/summary').subscribe();
    backend.expectOne('/api/v1/customers/5/summary').flush({ id: 5, rowVersion: 2 });
    http.post('/api/v1/customers/5/credit-hold', { reason: 'Past due' }).subscribe();
    backend.expectOne('/api/v1/customers/5/credit-hold').flush(null);
    http.get('/api/v1/customers/5/summary').subscribe();
    backend.expectOne('/api/v1/customers/5/summary').flush({ id: 5, rowVersion: 3 });

    http.put('/api/v1/customers/5', { name: 'Acme Co' }).subscribe();
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/customers/5');

    expect(put.request.headers.get('If-Match')).toBe('"3"');
    put.flush(null);
  });

  it('keeps an explicit If-Match over a cached one', () => {
    http.get('/api/v1/master-schedules/4').subscribe();
    backend.expectOne('/api/v1/master-schedules/4').flush({ id: 4, rowVersion: 2 });

    http.put('/api/v1/master-schedules/4', {}, { headers: { 'If-Match': '"9"' } }).subscribe();
    const put = backend.expectOne('/api/v1/master-schedules/4');

    expect(put.request.headers.get('If-Match')).toBe('"9"');
    put.flush(null);
  });
});
