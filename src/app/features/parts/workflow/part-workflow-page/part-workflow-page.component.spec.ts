import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

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

describe('PartWorkflowPageComponent title', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
  });

  function titleFor(part: Partial<PartDetail>): string {
    const component = TestBed.runInInjectionContext(() => new PartWorkflowPageComponent()) as unknown as {
      part: { set(p: PartDetail): void };
      entityTitle: () => string;
    };
    component.part.set(part as PartDetail);
    return component.entityTitle();
  }

  it('shows the part number and name, not the description', () => {
    expect(titleFor({ partNumber: 'NP-1', name: 'Widget', description: 'long text' })).toBe('NP-1 — Widget');
  });

  it('falls back to the description when the name is blank, then to the number alone', () => {
    expect(titleFor({ partNumber: 'NP-1', name: ' ', description: 'Bracket' })).toBe('NP-1 — Bracket');
    expect(titleFor({ partNumber: 'NP-1', name: '', description: null })).toBe('NP-1');
  });
});
