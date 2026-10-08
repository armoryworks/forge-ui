import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RecallService } from './recall.service';
import { environment } from '../../../../environments/environment';

describe('RecallService', () => {
  let service: RecallService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/recalls`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('getRecalls() sends GET to the recalls base with no params', () => {
    service.getRecalls().subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getRecalls(status) appends the status param', () => {
    service.getRecalls('Active').subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('Active');
    req.flush([]);
  });

  it('getRecall(id) sends GET to base/{id}', () => {
    service.getRecall(7).subscribe();
    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 7 });
  });

  it('initiateRecall() posts the lot, reason and date to the base', () => {
    const body = { recalledLotId: 12, reason: 'Contaminated resin', recallDate: '2026-10-08T00:00:00Z' };
    service.initiateRecall(body).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 3 });
  });

  it('resolveRecall() posts the notes to base/{id}/resolve', () => {
    service.resolveRecall(3, 'Customers notified').subscribe();
    const req = httpMock.expectOne(`${base}/3/resolve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resolutionNotes: 'Customers notified' });
    req.flush({ id: 3 });
  });
});
