import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EcoService } from './eco.service';
import { environment } from '../../../../environments/environment';

describe('EcoService', () => {
  let service: EcoService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/quality/ecos`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EcoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('getEcos() with no filter sends GET to base URL', () => {
    service.getEcos().subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getEcos({ status }) appends status query param', () => {
    service.getEcos({ status: 'Approved' }).subscribe();
    const req = httpMock.expectOne(r => r.url === base && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('Approved');
    req.flush([]);
  });

  it('getEcoById(id) sends GET to base/{id}', () => {
    service.getEcoById(42).subscribe();
    const req = httpMock.expectOne(`${base}/42`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 42 });
  });

  it('createEco(data) sends POST to base with body', () => {
    const payload = { title: 'New ECO', description: 'Change rev' };
    service.createEco(payload).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, ...payload });
  });

  it('updateEco(id, data) sends PATCH to base/{id} with body', () => {
    const patch = { title: 'Updated ECO' };
    service.updateEco(7, patch).subscribe();
    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
    req.flush({ id: 7, ...patch });
  });

  it('approveEco(id) sends POST to base/{id}/approve', () => {
    service.approveEco(3).subscribe();
    const req = httpMock.expectOne(`${base}/3/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('implementEco(id) sends POST to base/{id}/implement', () => {
    service.implementEco(5).subscribe();
    const req = httpMock.expectOne(`${base}/5/implement`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('addAffectedItem(ecoId, data) sends POST to base/{ecoId}/affected-items with body', () => {
    const item = { partId: 99, changeType: 'Revision' };
    service.addAffectedItem(10, item).subscribe();
    const req = httpMock.expectOne(`${base}/10/affected-items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(item);
    req.flush({ id: 50, ...item });
  });

  it('deleteAffectedItem(ecoId, itemId) sends DELETE to base/{ecoId}/affected-items/{itemId}', () => {
    service.deleteAffectedItem(10, 50).subscribe();
    const req = httpMock.expectOne(`${base}/10/affected-items/50`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
