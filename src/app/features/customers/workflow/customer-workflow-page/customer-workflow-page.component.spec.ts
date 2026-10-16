import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../../shared/services/workflow.service';
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

  it('returns to the customer list when /customers/new is reached without a workflow', () => {
    setUp({});
    create();
    TestBed.tick();

    expect(router.navigate).toHaveBeenCalledWith(['/customers'], { replaceUrl: true });
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
