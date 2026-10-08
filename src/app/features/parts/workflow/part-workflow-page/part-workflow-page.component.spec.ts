import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../../shared/services/workflow.service';
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
});
