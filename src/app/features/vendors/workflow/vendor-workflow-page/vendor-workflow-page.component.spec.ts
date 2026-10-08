import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { VendorWorkflowPageComponent } from './vendor-workflow-page.component';

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
