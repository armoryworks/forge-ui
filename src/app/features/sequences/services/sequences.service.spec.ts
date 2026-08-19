import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SequencesService } from './sequences.service';
import { environment } from '../../../../environments/environment';

describe('SequencesService', () => {
  let service: SequencesService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/sequences`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SequencesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists definitions with optional filters', () => {
    service.getDefinitions('job-basic', 'Published').subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/definitions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('code')).toBe('job-basic');
    expect(req.request.params.get('status')).toBe('Published');
    req.flush([]);
  });

  it('publishes a definition', () => {
    service.publishDefinition(3).subscribe();
    const req = httpMock.expectOne(`${base}/definitions/3/publish`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('lists instances for a subject', () => {
    service.getInstances({ subjectEntityType: 'Job', subjectEntityId: 42, status: 'Running' }).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/instances`);
    expect(req.request.params.get('subjectEntityType')).toBe('Job');
    expect(req.request.params.get('subjectEntityId')).toBe('42');
    expect(req.request.params.get('status')).toBe('Running');
    req.flush([]);
  });

  it('starts a run against a subject', () => {
    service.start({ definitionId: 1, subjectEntityType: 'Job', subjectEntityId: 42 }).subscribe();
    const req = httpMock.expectOne(`${base}/instances`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ definitionId: 1, subjectEntityType: 'Job', subjectEntityId: 42 });
    req.flush({});
  });

  it('encodes step and gate keys in gate actions and sends the reason on override', () => {
    service.overrideGate(5, 'first article', 'qc/1', 'Supervisor waived').subscribe();
    const req = httpMock.expectOne(`${base}/instances/5/gates/first%20article/qc%2F1/override`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Supervisor waived' });
    req.flush({});
  });

  it('reworks with target step and reason', () => {
    service.rework(5, 'cut', 'Wrong material').subscribe();
    const req = httpMock.expectOne(`${base}/instances/5/rework`);
    expect(req.request.body).toEqual({ targetStepKey: 'cut', reason: 'Wrong material' });
    req.flush({});
  });
});
