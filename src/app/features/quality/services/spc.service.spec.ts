import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SpcService } from './spc.service';

describe('SpcService', () => {
  let service: SpcService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1/spc';
  const characteristicsUrl = `${baseUrl}/characteristics`;
  const measurementsUrl = `${baseUrl}/measurements`;
  const oocUrl = `${baseUrl}/out-of-control`;
  const capabilityUrl = `${baseUrl}/capability`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpcService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  it('getCharacteristics() with no filters sends GET to /characteristics', () => {
    service.getCharacteristics().subscribe();
    const req = httpMock.expectOne(r => r.url === characteristicsUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getCharacteristics(filters) appends query params', () => {
    service.getCharacteristics({ partId: 5, isActive: true }).subscribe();
    const req = httpMock.expectOne(r => r.url === characteristicsUrl && r.method === 'GET');
    expect(req.request.params.get('partId')).toBe('5');
    expect(req.request.params.get('isActive')).toBe('true');
    req.flush([]);
  });

  it('getCharacteristic(id) sends GET to /characteristics/{id}', () => {
    service.getCharacteristic(7).subscribe();
    const req = httpMock.expectOne(`${characteristicsUrl}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 7 });
  });

  it('createCharacteristic(request) sends POST to /characteristics with body', () => {
    const payload = { name: 'Diameter', usl: 10.5, lsl: 9.5 };
    service.createCharacteristic(payload).subscribe();
    const req = httpMock.expectOne(characteristicsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, ...payload });
  });

  it('updateCharacteristic(id, request) sends PUT to /characteristics/{id}', () => {
    const update = { name: 'Updated Diameter', usl: 11.0, lsl: 9.0 };
    service.updateCharacteristic(7, update).subscribe();
    const req = httpMock.expectOne(`${characteristicsUrl}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(update);
    req.flush({ id: 7, ...update });
  });

  it('getChartData(characteristicId) sends GET to /characteristics/{id}/chart without lastN', () => {
    service.getChartData(7).subscribe();
    const req = httpMock.expectOne(r => r.url === `${characteristicsUrl}/7/chart` && r.method === 'GET');
    expect(req.request.params.has('lastN')).toBe(false);
    req.flush({ subgroups: [] });
  });

  it('getChartData(characteristicId, lastN) appends lastN param', () => {
    service.getChartData(7, 25).subscribe();
    const req = httpMock.expectOne(r => r.url === `${characteristicsUrl}/7/chart` && r.method === 'GET');
    expect(req.request.params.get('lastN')).toBe('25');
    req.flush({ subgroups: [] });
  });

  it('recordMeasurements(request) sends POST to /measurements with body', () => {
    const payload = { characteristicId: 7, values: [10.1, 10.2, 9.9] };
    service.recordMeasurements(payload).subscribe();
    const req = httpMock.expectOne(measurementsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 100 });
  });

  it('getMeasurements() sends GET to /measurements', () => {
    service.getMeasurements().subscribe();
    const req = httpMock.expectOne(r => r.url === measurementsUrl && r.method === 'GET');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getMeasurements(filters) appends query params', () => {
    service.getMeasurements({ characteristicId: 7 }).subscribe();
    const req = httpMock.expectOne(r => r.url === measurementsUrl && r.method === 'GET');
    expect(req.request.params.get('characteristicId')).toBe('7');
    req.flush([]);
  });

  it('recalculateLimits(characteristicId) sends POST to /characteristics/{id}/recalculate-limits', () => {
    service.recalculateLimits(7).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${characteristicsUrl}/7/recalculate-limits` && r.method === 'POST'
    );
    req.flush({});
  });

  it('recalculateLimits(id, fromSubgroup, toSubgroup) appends range params', () => {
    service.recalculateLimits(7, 5, 20).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${characteristicsUrl}/7/recalculate-limits` && r.method === 'POST'
    );
    expect(req.request.params.get('fromSubgroup')).toBe('5');
    expect(req.request.params.get('toSubgroup')).toBe('20');
    req.flush({});
  });

  it('getCapabilityReport(characteristicId) sends GET to /capability/{id}', () => {
    service.getCapabilityReport(7).subscribe();
    const req = httpMock.expectOne(`${capabilityUrl}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ cp: 1.33, cpk: 1.25 });
  });

  it('getOocEvents() sends GET to /out-of-control', () => {
    service.getOocEvents().subscribe();
    const req = httpMock.expectOne(r => r.url === oocUrl && r.method === 'GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);
  });

  it('getOocEvents(filters) appends query params', () => {
    service.getOocEvents({ status: 'Open' as any, characteristicId: 3 }).subscribe();
    const req = httpMock.expectOne(r => r.url === oocUrl && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('Open');
    expect(req.request.params.get('characteristicId')).toBe('3');
    req.flush([]);
  });

  it('acknowledgeOoc(id) sends POST to /out-of-control/{id}/acknowledge', () => {
    service.acknowledgeOoc(15).subscribe();
    const req = httpMock.expectOne(`${oocUrl}/15/acknowledge`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('acknowledgeOoc(id, notes) includes notes in body', () => {
    service.acknowledgeOoc(15, 'Reviewed and resolved').subscribe();
    const req = httpMock.expectOne(`${oocUrl}/15/acknowledge`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ notes: 'Reviewed and resolved' });
    req.flush({});
  });

  it('createCapaFromOoc(id) sends POST to /out-of-control/{id}/create-capa', () => {
    service.createCapaFromOoc(15).subscribe();
    const req = httpMock.expectOne(`${oocUrl}/15/create-capa`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 400 });
  });
});
