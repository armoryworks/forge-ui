import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ReplenishmentService } from './replenishment.service';
import { environment } from '../../../../environments/environment';

describe('ReplenishmentService', () => {
  let service: ReplenishmentService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/replenishment`;
  const burnRatesUrl = `${base}/burn-rates`;
  const suggestionsUrl = `${base}/suggestions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReplenishmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('getBurnRates() with no filters sends GET to burn-rates with no params', () => {
    service.getBurnRates().subscribe();
    const req = httpMock.expectOne(r => r.url === burnRatesUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getBurnRates(search, needsReorderOnly) appends query params', () => {
    service.getBurnRates('bolt', true).subscribe();
    const req = httpMock.expectOne(r => r.url === burnRatesUrl && r.method === 'GET');
    expect(req.request.params.get('search')).toBe('bolt');
    expect(req.request.params.get('needsReorderOnly')).toBe('true');
    req.flush([]);
  });

  it('getBurnRates with only search param does not append needsReorderOnly', () => {
    service.getBurnRates('nut').subscribe();
    const req = httpMock.expectOne(r => r.url === burnRatesUrl && r.method === 'GET');
    expect(req.request.params.get('search')).toBe('nut');
    expect(req.request.params.has('needsReorderOnly')).toBe(false);
    req.flush([]);
  });

  it('getSuggestions() sends GET to suggestions with no params', () => {
    service.getSuggestions().subscribe();
    const req = httpMock.expectOne(r => r.url === suggestionsUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getSuggestions(status) appends status param', () => {
    service.getSuggestions('Pending').subscribe();
    const req = httpMock.expectOne(r => r.url === suggestionsUrl && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('Pending');
    req.flush([]);
  });

  it('approveSuggestion(id) sends POST to suggestions/{id}/approve', () => {
    service.approveSuggestion(8).subscribe();
    const req = httpMock.expectOne(`${suggestionsUrl}/8/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('approveBulk(suggestionIds) sends POST to suggestions/approve-bulk with id array', () => {
    const ids = [1, 2, 3];
    service.approveBulk(ids).subscribe();
    const req = httpMock.expectOne(`${suggestionsUrl}/approve-bulk`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ suggestionIds: ids });
    req.flush({});
  });

  it('dismissSuggestion(id, reason) sends POST to suggestions/{id}/dismiss with reason body', () => {
    service.dismissSuggestion(8, 'Not needed at this time').subscribe();
    const req = httpMock.expectOne(`${suggestionsUrl}/8/dismiss`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ reason: 'Not needed at this time' });
    req.flush({});
  });
});
