import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { WorkflowDefinition } from '../../../../shared/models/workflow-definition.model';
import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { CustomerDetail } from '../../models/customer-detail.model';
import { CustomerService } from '../../services/customer.service';
import { CustomerWorkflowPageComponent } from './customer-workflow-page.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 4, entityType: 'Customer', entityId: 12, definitionId: 'customer-guided-v1',
    currentStepId: 'basics', mode: 'guided',
    startedAt: '2026-10-01T00:00:00Z', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt: '2026-10-01T00:00:00Z', version: 1, draftPayload: null,
    ...overrides,
  };
}

describe('CustomerWorkflowPageComponent', () => {
  let router: Router;
  let workflowService: WorkflowService;

  function setUp(query: Record<string, string>): void {
    TestBed.configureTestingModule({
      imports: [CustomerWorkflowPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap(query)) },
        },
      ],
    });
    router = TestBed.inject(Router);
    workflowService = TestBed.inject(WorkflowService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  function create(): CustomerWorkflowPageComponent {
    return TestBed.runInInjectionContext(() => new CustomerWorkflowPageComponent());
  }

  const definition: WorkflowDefinition = {
    id: 3, definitionId: 'customer-guided-v1', entityType: 'Customer', defaultMode: 'guided',
    steps: [
      { id: 'identity', labelKey: 'a', componentName: 'A', required: true, completionGates: [] },
      { id: 'review', labelKey: 'b', componentName: 'B', required: true, completionGates: [] },
    ],
    stepsJson: '[]', expressTemplateComponent: null, isSeedData: true,
  } as unknown as WorkflowDefinition;

  function stubLoad(run: WorkflowRun): void {
    vi.spyOn(workflowService, 'getRun').mockReturnValue(of(run));
    vi.spyOn(workflowService, 'loadDefinitionsForEntity').mockReturnValue(of([definition]));
    vi.spyOn(workflowService, 'loadValidatorsForEntity').mockReturnValue(of([]));
  }

  it('fills in the customer workflow when /customers/new is reached without one', () => {
    setUp({});
    create();
    TestBed.tick();

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { workflow: 'customer-guided-v1' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }));
  });

  it('opens the customer instead of editing a finished run', async () => {
    setUp({ workflow: 'customer-guided-v1', runId: '4' });
    stubLoad(buildRun({ completedAt: '2026-10-02T00:00:00Z' }));
    const info = vi.spyOn(TestBed.inject(SnackbarService), 'info').mockImplementation(() => undefined);
    const component = create();
    TestBed.tick();
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/customers', 12, 'overview'], { replaceUrl: true });
    expect(info).toHaveBeenCalledWith('workflow.shell.closedRun.completed');
    expect((component as unknown as { run(): WorkflowRun | null }).run()).toBeNull();
  });

  it('returns to the list instead of editing an abandoned run', async () => {
    setUp({ workflow: 'customer-guided-v1', runId: '4' });
    stubLoad(buildRun({ abandonedAt: '2026-10-02T00:00:00Z' }));
    const info = vi.spyOn(TestBed.inject(SnackbarService), 'info').mockImplementation(() => undefined);
    create();
    TestBed.tick();
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/customers'], { replaceUrl: true });
    expect(info).toHaveBeenCalledWith('workflow.shell.closedRun.abandoned');
  });

  it('ignores a ?step= that is not part of the workflow', () => {
    setUp({ workflow: 'customer-guided-v1', runId: '4', step: 'nonsense' });
    vi.spyOn(TestBed.inject(CustomerService), 'getCustomerById').mockReturnValue(of({ id: 12 } as unknown as CustomerDetail));
    stubLoad(buildRun({ currentStepId: 'identity' }));
    const component = create();
    TestBed.tick();

    expect((component as unknown as { run(): WorkflowRun | null }).run()?.currentStepId).toBe('identity');
  });

  it('returns to the list when the run\'s customer cannot be loaded', () => {
    setUp({ workflow: 'customer-guided-v1', runId: '4' });
    vi.spyOn(TestBed.inject(CustomerService), 'getCustomerById').mockReturnValue(throwError(() => new Error('404')));
    stubLoad(buildRun());
    const errorFrom = vi.spyOn(TestBed.inject(SnackbarService), 'errorFrom').mockImplementation(() => undefined);
    create();
    TestBed.tick();

    expect(errorFrom).toHaveBeenCalledWith(expect.any(Error), 'customers.workflow.page.loadFailed');
    expect(router.navigate).toHaveBeenCalledWith(['/customers']);
  });

  it('abandons an unsaved run on close but keeps one bound to a customer', () => {
    setUp({});
    const abandon = vi.spyOn(workflowService, 'abandonRun').mockReturnValue(of(buildRun()));
    const component = create() as unknown as { onClosed(): void };

    workflowService.currentRun.set(buildRun({ entityId: null }));
    component.onClosed();
    expect(abandon).toHaveBeenCalledWith(4, 'user');

    abandon.mockClear();
    workflowService.currentRun.set(buildRun({ entityId: 12 }));
    component.onClosed();
    expect(abandon).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenLastCalledWith(['/customers']);
  });

  it('switches mode after the step saves', () => {
    setUp({});
    vi.spyOn(workflowService, 'saveCurrentStep').mockReturnValue(of({ ok: true as const }));
    const setMode = vi.spyOn(workflowService, 'setMode').mockReturnValue(of(buildRun({ mode: 'express' })));
    const component = create();
    (component as unknown as { run: { set(r: WorkflowRun): void } }).run.set(buildRun());

    (component as unknown as { onModeChanged(mode: 'express' | 'guided'): void }).onModeChanged('express');

    expect(setMode).toHaveBeenCalledWith(4, 'express');
  });

  it('stays in the current mode when saving the step fails', () => {
    setUp({});
    vi.spyOn(workflowService, 'saveCurrentStep').mockReturnValue(of({ ok: false as const, error: new Error('400') }));
    const setMode = vi.spyOn(workflowService, 'setMode');
    const component = create();
    (component as unknown as { run: { set(r: WorkflowRun): void } }).run.set(buildRun());

    (component as unknown as { onModeChanged(mode: 'express' | 'guided'): void }).onModeChanged('express');

    expect(setMode).not.toHaveBeenCalled();
  });
});
