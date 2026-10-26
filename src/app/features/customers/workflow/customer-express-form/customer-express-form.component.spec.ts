import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CustomerExpressFormComponent } from './customer-express-form.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 7, entityType: 'Customer', entityId: null, definitionId: 'customer-guided-v1',
    currentStepId: 'identity', mode: 'express', startedAt: '', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt: '', version: 1, draftPayload: null,
    ...overrides,
  };
}

type ExpressForm = {
  form: { patchValue(v: unknown): void; markAsDirty(): void; dirty: boolean };
  save(): void;
};

describe('CustomerExpressFormComponent Save', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let snackbar: SnackbarService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActiveCurrencyService, useValue: { listActiveCurrencies: () => of([]) } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    snackbar = TestBed.inject(SnackbarService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(snackbar, 'success').mockImplementation(() => undefined);
    vi.spyOn(snackbar, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => httpMock.verify());

  function build(entityId: number | null, entity: unknown): ExpressForm {
    const component = TestBed.runInInjectionContext(() => new CustomerExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'identity', componentName: 'CustomerExpressFormComponent', runId: 7, entityId, entity,
    });
    TestBed.flushEffects();
    return component as unknown as ExpressForm;
  }

  it('saves the typed fields, completes the run and opens the new customer', async () => {
    const c = build(null, null);
    c.form.patchValue({ name: 'Acme' });
    c.form.markAsDirty();

    c.save();

    const patch = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
    expect(patch.request.body.stepId).toBe('identity');
    expect(patch.request.body.fields).toMatchObject({ name: 'Acme' });
    patch.flush(buildRun({ entityId: 31 }));
    httpMock.expectOne(`${environment.apiUrl}/workflows/7/complete`)
      .flush(buildRun({ entityId: 31, completedAt: '2026-10-19T00:00:00Z' }));
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/customers', 31, 'overview']);
    expect(snackbar.success).toHaveBeenCalledWith('customers.workflow.page.completeSuccess');
  });

  it('completes an already-saved customer without patching it again', () => {
    const c = build(31, { id: 31, name: 'Acme' });

    c.save();

    httpMock.expectNone(`${environment.apiUrl}/workflows/7/step`);
    httpMock.expectOne(`${environment.apiUrl}/workflows/7/complete`)
      .flush(buildRun({ entityId: 31, completedAt: '2026-10-19T00:00:00Z' }));
    expect(router.navigate).toHaveBeenCalledWith(['/customers', 31, 'overview']);
  });

  it('stays in Quick add and names what is missing when completion is blocked', () => {
    const c = build(31, { id: 31, name: 'Acme' });

    c.save();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/complete`).flush(
      { missing: [{ validatorId: 'hasIdentity', displayNameKey: 'v.identity', missingMessageKey: 'v.identityMissing' }] },
      { status: 409, statusText: 'Conflict' },
    );

    expect(router.navigate).not.toHaveBeenCalled();
    expect(snackbar.error).toHaveBeenCalledWith('customers.workflow.page.missingValidators');
  });

  it('the mode-switch save only patches and never completes the run', () => {
    const c = build(31, { id: 31, name: 'Acme' });
    c.form.patchValue({ name: 'Acme Two' });
    c.form.markAsDirty();

    TestBed.inject(WorkflowService).saveCurrentStep().subscribe();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush(buildRun({ entityId: 31 }));
    httpMock.expectOne(`${environment.apiUrl}/customers/31`).flush({ id: 31, name: 'Acme' });
    httpMock.expectNone(`${environment.apiUrl}/workflows/7/complete`);
  });
});
