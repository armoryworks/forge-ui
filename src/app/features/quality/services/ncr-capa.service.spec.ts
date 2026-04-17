import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NcrCapaService } from './ncr-capa.service';

describe('NcrCapaService', () => {
  let service: NcrCapaService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1/quality';
  const ncrsUrl = `${baseUrl}/ncrs`;
  const capasUrl = `${baseUrl}/capas`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NcrCapaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  // --- NCRs ---

  it('getNcrs() with no filters sends GET to /ncrs', () => {
    service.getNcrs().subscribe();
    const req = httpMock.expectOne(r => r.url === ncrsUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getNcrs(filters) appends provided query params', () => {
    service.getNcrs({ type: 'Defect', status: 'Open', partId: 10, jobId: 20 }).subscribe();
    const req = httpMock.expectOne(r => r.url === ncrsUrl && r.method === 'GET');
    expect(req.request.params.get('type')).toBe('Defect');
    expect(req.request.params.get('status')).toBe('Open');
    expect(req.request.params.get('partId')).toBe('10');
    expect(req.request.params.get('jobId')).toBe('20');
    req.flush([]);
  });

  it('getNcr(id) sends GET to /ncrs/{id}', () => {
    service.getNcr(5).subscribe();
    const req = httpMock.expectOne(`${ncrsUrl}/5`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 5 });
  });

  it('createNcr(request) sends POST to /ncrs with body', () => {
    const payload = { type: 'Defect', description: 'Part scratch' };
    service.createNcr(payload).subscribe();
    const req = httpMock.expectOne(ncrsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, ...payload });
  });

  it('updateNcr(id, request) sends PATCH to /ncrs/{id}', () => {
    const patch = { status: 'Closed' };
    service.updateNcr(3, patch).subscribe();
    const req = httpMock.expectOne(`${ncrsUrl}/3`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
    req.flush({ id: 3, ...patch });
  });

  it('dispositionNcr(id, disposition) sends POST to /ncrs/{id}/disposition with body', () => {
    const disposition = { decision: 'Scrap', notes: 'Beyond repair' };
    service.dispositionNcr(7, disposition).subscribe();
    const req = httpMock.expectOne(`${ncrsUrl}/7/disposition`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(disposition);
    req.flush({});
  });

  it('createCapaFromNcr(ncrId, ownerId) sends POST to /ncrs/{ncrId}/create-capa', () => {
    service.createCapaFromNcr(4, 99).subscribe();
    const req = httpMock.expectOne(`${ncrsUrl}/4/create-capa`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 200 });
  });

  // --- CAPAs ---

  it('getCapas() with no filters sends GET to /capas', () => {
    service.getCapas().subscribe();
    const req = httpMock.expectOne(r => r.url === capasUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getCapas(filters) appends query params', () => {
    service.getCapas({ status: 'InProgress' }).subscribe();
    const req = httpMock.expectOne(r => r.url === capasUrl && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('InProgress');
    req.flush([]);
  });

  it('getCapa(id) sends GET to /capas/{id}', () => {
    service.getCapa(11).subscribe();
    const req = httpMock.expectOne(`${capasUrl}/11`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 11 });
  });

  it('createCapa(request) sends POST to /capas with body', () => {
    const payload = { title: 'Fix process', ownerId: 5 };
    service.createCapa(payload).subscribe();
    const req = httpMock.expectOne(capasUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 200 });
  });

  it('advanceCapaPhase(id) sends POST to /capas/{id}/advance', () => {
    service.advanceCapaPhase(11).subscribe();
    const req = httpMock.expectOne(`${capasUrl}/11/advance`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // --- Tasks ---

  it('getCapaTasks(capaId) sends GET to /capas/{capaId}/tasks', () => {
    service.getCapaTasks(11).subscribe();
    const req = httpMock.expectOne(`${capasUrl}/11/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createCapaTask(capaId, request) sends POST to /capas/{capaId}/tasks with body', () => {
    const task = { description: 'Review procedure', dueDate: '2026-05-01T00:00:00Z' };
    service.createCapaTask(11, task).subscribe();
    const req = httpMock.expectOne(`${capasUrl}/11/tasks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(task);
    req.flush({ id: 300, ...task });
  });
});
