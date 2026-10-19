import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { VendorWorkflowPageComponent } from './vendor-workflow-page.component';
import { WorkflowDefinition } from '../../../../shared/models/workflow-definition.model';
import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 4, entityType: 'Vendor', entityId: null, definitionId: 'vendor-guided-v1',
    currentStepId: 'review', mode: 'guided',
    startedAt: '2026-10-01T00:00:00Z', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt: '2026-10-01T00:00:00Z', version: 1, draftPayload: null,
    ...overrides,
  };
}

describe('VendorWorkflowPageComponent completion', () => {
  let router: Router;
  let workflowService: WorkflowService;
  let snackbar: SnackbarService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorWorkflowPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    workflowService = TestBed.inject(WorkflowService);
    snackbar = TestBed.inject(SnackbarService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(snackbar, 'success').mockImplementation(() => undefined);
    vi.spyOn(workflowService, 'saveCurrentStep').mockReturnValue(of({ ok: true as const }));
  });

  function complete(run: WorkflowRun, completed: WorkflowRun): void {
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    (component as unknown as { run: { set(r: WorkflowRun): void } }).run.set(run);
    vi.spyOn(workflowService, 'completeRun').mockReturnValue(of({ success: true as const, run: completed }));
    (component as unknown as { onCompleteRequested(): void }).onCompleteRequested();
  }

  it('announces the new vendor and opens its detail', () => {
    complete(buildRun({ entityId: 55 }), buildRun({ entityId: 55, completedAt: '2026-10-01T01:00:00Z' }));
    expect(snackbar.success).toHaveBeenCalledWith('guidedSetup.vendorCreated');
    expect(router.navigate).toHaveBeenCalledWith(['/vendors'], { queryParams: { detail: 'vendor:55' } });
  });

  it('falls back to the list when the run has no vendor id', () => {
    complete(buildRun(), buildRun());
    expect(router.navigate).toHaveBeenCalledWith(['/vendors']);
  });
});

describe('VendorWorkflowPageComponent routing', () => {
  let router: Router;
  let workflowService: WorkflowService;

  function setUp(params: Record<string, string>, query: Record<string, string>): void {
    TestBed.configureTestingModule({
      imports: [VendorWorkflowPageComponent],
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
    router = TestBed.inject(Router);
    workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  it('fills in the vendor workflow when /vendors/new is reached without one', () => {
    setUp({}, {});
    TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    TestBed.tick();

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { workflow: 'vendor-guided-v1' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }));
  });

  it('opens the vendor detail when /vendors/:id is reached without a workflow', () => {
    setUp({ id: '7' }, {});
    TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    TestBed.tick();

    expect(router.navigate).toHaveBeenCalledWith(['/vendors'], { queryParams: { detail: 'vendor:7' }, replaceUrl: true });
  });

  it('moves to the new vendor URL in the chosen mode when Quick add materializes the vendor', () => {
    setUp({}, { workflow: 'vendor-guided-v1', runId: '4', mode: 'guided' });
    vi.spyOn(workflowService, 'getRun').mockReturnValue(of(buildRun()));
    vi.spyOn(workflowService, 'saveCurrentStep').mockReturnValue(of({ ok: true as const }));
    vi.spyOn(workflowService, 'setMode').mockReturnValue(of(buildRun({ entityId: 9, mode: 'express' })));
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    (component as unknown as { run: { set(r: WorkflowRun): void } }).run.set(buildRun());

    (component as unknown as { onModeChanged(mode: 'express' | 'guided'): void }).onModeChanged('express');

    expect(router.navigate).toHaveBeenCalledWith(['/vendors', 9], expect.objectContaining({
      queryParams: { mode: 'express', runId: 4 },
      queryParamsHandling: 'merge',
    }));
  });

  it('stays in the current mode when saving the step fails', () => {
    setUp({}, { workflow: 'vendor-guided-v1', runId: '4', mode: 'guided' });
    vi.spyOn(workflowService, 'getRun').mockReturnValue(of(buildRun()));
    vi.spyOn(workflowService, 'saveCurrentStep').mockReturnValue(of({ ok: false as const, error: new Error('400') }));
    const setMode = vi.spyOn(workflowService, 'setMode');
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    (component as unknown as { run: { set(r: WorkflowRun): void } }).run.set(buildRun());

    (component as unknown as { onModeChanged(mode: 'express' | 'guided'): void }).onModeChanged('express');

    expect(setMode).not.toHaveBeenCalled();
  });
});

describe('VendorWorkflowPageComponent on an existing vendor', () => {
  const definition: WorkflowDefinition = {
    id: 1, definitionId: 'vendor-guided-v1', entityType: 'Vendor', defaultMode: 'guided',
    steps: [], stepsJson: '[]', expressTemplateComponent: null, isSeedData: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorWorkflowPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
  });

  function stub(): WorkflowService {
    const workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(VendorService), 'getVendorById').mockReturnValue(of({ id: 55 } as unknown as VendorDetail));
    vi.spyOn(workflowService, 'loadDefinitionsForEntity').mockReturnValue(of([definition]));
    vi.spyOn(workflowService, 'loadValidatorsForEntity').mockReturnValue(of([]));
    return workflowService;
  }

  function load(runId: number): VendorWorkflowPageComponent {
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    (component as unknown as { loadWorkflowContext(id: number, runId: number, def: string): void })
      .loadWorkflowContext(55, runId, 'vendor-guided-v1');
    return component;
  }

  it('opens the vendor instead of reopening its finished workflow when no run is open', () => {
    const workflowService = stub();
    vi.spyOn(workflowService, 'listActive').mockReturnValue(of([]));
    const start = vi.spyOn(workflowService, 'startRun');

    load(0);

    expect(start).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/vendors'], { queryParams: { detail: 'vendor:55' }, replaceUrl: true });
  });

  it('resumes the current user\'s open run on the vendor', () => {
    const workflowService = stub();
    vi.spyOn(workflowService, 'listActive').mockReturnValue(of([buildRun({ id: 6, entityId: 55 })]));

    const component = load(0);

    expect((component as unknown as { run(): WorkflowRun | null }).run()?.id).toBe(6);
  });

  it('mounts the run named by ?runId even when someone else started it', () => {
    const workflowService = stub();
    const listActive = vi.spyOn(workflowService, 'listActive');
    vi.spyOn(workflowService, 'getRun').mockReturnValue(of(buildRun({ id: 8, entityId: 55, startedByUserId: 2 })));

    const component = load(8);

    expect(listActive).not.toHaveBeenCalled();
    expect((component as unknown as { run(): WorkflowRun | null }).run()?.id).toBe(8);
  });

  it('opens the vendor instead of editing a finished run', async () => {
    const workflowService = stub();
    vi.spyOn(workflowService, 'getRun').mockReturnValue(of(buildRun({ id: 8, entityId: 55, completedAt: '2026-10-02T00:00:00Z' })));
    const info = vi.spyOn(TestBed.inject(SnackbarService), 'info').mockImplementation(() => undefined);

    const component = load(8);
    await Promise.resolve();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/vendors'], { queryParams: { detail: 'vendor:55' }, replaceUrl: true });
    expect(info).toHaveBeenCalledWith('workflow.shell.closedRun.completed');
    expect((component as unknown as { run(): WorkflowRun | null }).run()).toBeNull();
  });

  it('abandons an unsaved run on close but keeps one bound to a vendor', () => {
    const workflowService = stub();
    const abandon = vi.spyOn(workflowService, 'abandonRun').mockReturnValue(of(buildRun()));
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent()) as unknown as { onClosed(): void };

    workflowService.currentRun.set(buildRun({ entityId: null }));
    component.onClosed();
    expect(abandon).toHaveBeenCalledWith(4, 'user');

    abandon.mockClear();
    workflowService.currentRun.set(buildRun({ entityId: 55 }));
    component.onClosed();
    expect(abandon).not.toHaveBeenCalled();
  });
});

describe('VendorWorkflowPageComponent bad links', () => {
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
    getById = vi.spyOn(TestBed.inject(VendorService), 'getVendorById')
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(workflowService, 'listActive').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'loadDefinitionsForEntity').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'loadValidatorsForEntity').mockReturnValue(of([]));
    vi.spyOn(workflowService, 'startRun');
    const component = TestBed.runInInjectionContext(() => new VendorWorkflowPageComponent());
    TestBed.tick();
    return component as unknown as { loadError(): unknown };
  }

  it.each(['abc', '12abc', '0'])('shows not-found in place for the malformed id %s', (id) => {
    const page = open({ id }, { workflow: 'vendor-guided-v1' });

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
    const page = open({ id: '42' }, { workflow: 'vendor-guided-v1' });

    expect(getById).toHaveBeenCalledWith(42);
    expect((page.loadError() as HttpErrorResponse).status).toBe(404);
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('still sends a valid id without a workflow to the list detail', () => {
    const page = open({ id: '42' });

    expect(page.loadError()).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/vendors'], { queryParams: { detail: 'vendor:42' }, replaceUrl: true });
  });
});
