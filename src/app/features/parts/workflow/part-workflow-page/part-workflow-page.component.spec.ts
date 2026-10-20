import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { WorkflowDefinition } from '../../../../shared/models/workflow-definition.model';
import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';
import { PartWorkflowPageComponent } from './part-workflow-page.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 7, entityType: 'Part', entityId: null, definitionId: 'part-make-component-v1',
    currentStepId: null, mode: 'express', startedAt: '', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt: '', version: 1, draftPayload: null,
    ...overrides,
  };
}

describe('PartWorkflowPageComponent close', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let workflowService: WorkflowService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'parts', children: [] }]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    workflowService = TestBed.inject(WorkflowService);
  });

  afterEach(() => httpMock.verify());

  function closePage(): void {
    const component = TestBed.runInInjectionContext(() => new PartWorkflowPageComponent());
    (component as unknown as { onClosed(): void }).onClosed();
  }

  it('abandons a run that never saved anything, then returns to the list', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    workflowService.currentRun.set(buildRun());

    closePage();

    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/7/abandon`);
    expect(req.request.method).toBe('POST');
    expect(navSpy).not.toHaveBeenCalled();
    req.flush(buildRun({ abandonedAt: '2026-10-08T00:00:00Z' }));

    expect(navSpy).toHaveBeenCalledWith(['/parts']);
    expect(workflowService.currentRun()).toBeNull();
  });

  it('keeps a run whose part was already saved', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    workflowService.currentRun.set(buildRun({ entityId: 42 }));

    closePage();

    httpMock.expectNone(`${environment.apiUrl}/workflows/7/abandon`);
    expect(navSpy).toHaveBeenCalledWith(['/parts']);
  });

  it('does not abandon a run while its first save is still in flight', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    workflowService.currentRun.set(buildRun());
    workflowService.patchStep(7, 'basics', { name: 'Bracket' }).subscribe();
    const patch = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);

    closePage();

    httpMock.expectNone(`${environment.apiUrl}/workflows/7/abandon`);
    expect(navSpy).toHaveBeenCalledWith(['/parts']);
    patch.flush(buildRun({ entityId: 42 }));
    expect(workflowService.stepSavePending()).toBe(false);
  });
});

describe('PartWorkflowPageComponent on an existing part', () => {
  const definition: WorkflowDefinition = {
    id: 2, definitionId: 'part-make-finishedgood-v1', entityType: 'Part', defaultMode: 'guided',
    steps: [], stepsJson: '[]', expressTemplateComponent: null, isSeedData: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'parts', children: [] }]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
  });

  it('binds the new run to the part instead of starting an entity-less run', () => {
    const workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(TestBed.inject(PartsService), 'getPartById').mockReturnValue(of({ id: 1 } as unknown as PartDetail));
    vi.spyOn(workflowService, 'listActive').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'loadDefinitionsForEntity').mockReturnValue(of([definition]));
    vi.spyOn(workflowService, 'loadValidatorsForEntity').mockReturnValue(of([]));
    const start = vi.spyOn(workflowService, 'startRun').mockReturnValue(of(buildRun({ entityId: 1 })));
    const component = TestBed.runInInjectionContext(() => new PartWorkflowPageComponent());

    (component as unknown as { loadWorkflowContext(id: number, def: string): void })
      .loadWorkflowContext(1, 'part-make-finishedgood-v1');

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Part', entityId: 1 }));
  });
});

describe('PartWorkflowPageComponent bad links', () => {
  let navSpy: ReturnType<typeof vi.spyOn>;
  let getById: ReturnType<typeof vi.spyOn>;

  function open(params: Record<string, string>, query: Record<string, string> = {}): { loadError(): unknown } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(params)), queryParamMap: of(convertToParamMap(query)) },
        },
      ],
    });
    navSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    getById = vi.spyOn(TestBed.inject(PartsService), 'getPartById')
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(workflowService, 'listActive').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'loadDefinitionsForEntity').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'loadValidatorsForEntity').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'startRun');
    const component = TestBed.runInInjectionContext(() => new PartWorkflowPageComponent());
    TestBed.tick();
    return component as unknown as { loadError(): unknown };
  }

  it.each(['abc', '12abc', '0'])('shows not-found in place for the malformed id %s', (id) => {
    const page = open({ id }, { workflow: 'part-make-component-v1' });

    expect((page.loadError() as HttpErrorResponse).status).toBe(404);
    expect(getById).not.toHaveBeenCalled();
    expect(TestBed.inject(WorkflowService).startRun).not.toHaveBeenCalled();
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('shows not-found in place instead of bouncing to the list when no workflow is named', () => {
    const page = open({ id: 'abc' });

    expect((page.loadError() as HttpErrorResponse).status).toBe(404);
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('shows a missing record in place instead of bouncing to the list', () => {
    const page = open({ id: '42' }, { workflow: 'part-make-component-v1' });

    expect(getById).toHaveBeenCalledWith(42);
    expect((page.loadError() as HttpErrorResponse).status).toBe(404);
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('still sends a valid id without a workflow to the list detail', () => {
    const page = open({ id: '42' });

    expect(page.loadError()).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/parts'], { queryParams: { detail: 'part:42' }, replaceUrl: true });
  });
});
