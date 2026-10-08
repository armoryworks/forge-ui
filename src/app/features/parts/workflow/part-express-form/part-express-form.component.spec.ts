import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../shared/interceptors/silent-http-errors.token';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartExpressFormComponent } from './part-express-form.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 99, partNumber: 'PRT-00099', name: 'Steel rod', description: null, revision: 'A',
    status: 'Draft',
    procurementSource: 'Buy', inventoryClass: 'Raw', itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null, 
    materialSpecId: null, materialSpecLabel: null,
    externalId: null, externalRef: null,
    provider: null, preferredVendorId: null, preferredVendorName: null,
    minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
    safetyStockDays: null,
    toolingAssetId: null, toolingAssetName: null,
    manualCostOverride: null, currentCostCalculationId: null,
    weightEach: null, weightDisplayUnit: null,
    lengthMm: null, widthMm: null, heightMm: null, dimensionDisplayUnit: null,
    volumeMl: null, volumeDisplayUnit: null,
    valuationClassId: null, valuationClassLabel: null,
    htsCode: null, hazmatClass: null, shelfLifeDays: null,
    backflushPolicy: null, isKit: false, isConfigurable: false,
    defaultBinId: null, sourcePartId: null,
    isMrpPlanned: false, lotSizingRule: null,
    fixedOrderQuantity: null, minimumOrderQuantity: null, orderMultiple: null,
    planningFenceDays: null, demandFenceDays: null,
    stockUomId: null, stockUomCode: null, stockUomLabel: null,
    purchaseUomId: null, purchaseUomCode: null, purchaseUomLabel: null,
    salesUomId: null, salesUomCode: null, salesUomLabel: null,
    requiresReceivingInspection: false, receivingInspectionTemplateId: null,
    inspectionFrequency: null, inspectionSkipAfterN: null,
    bomLines: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    effectivePrice: 0, effectivePriceCurrency: 'USD', effectivePriceSource: 'Default',
    ...overrides,
  };
}

describe('PartExpressFormComponent (Phase 5)', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartExpressFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'parts', children: [] }]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpMock.verify());

  it('hydrates all gated fields from entity', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99,
      entity: buildPart({ name: 'Aluminum stock', description: 'Long-form notes', manualCostOverride: 5.25 }),
    });
    TestBed.flushEffects();
    const form = (component as unknown as { form: { value: Record<string, unknown> } }).form;
    expect(form.value).toMatchObject({
      name: 'Aluminum stock',
      description: 'Long-form notes',
      manualCostOverride: 5.25,
    });
  });

  it('does not clobber in-progress edits when the entity re-emits (dirty guard)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    const inputs = mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ name: 'Original' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { value: Record<string, unknown>; patchValue(v: unknown): void; markAsDirty(): void };
    };
    // Pristine form hydrates from the entity.
    expect(c.form.value['name']).toBe('Original');

    // User edits → form becomes dirty.
    c.form.patchValue({ name: 'User typed this' });
    c.form.markAsDirty();

    // A late / refreshed entity emission arrives (slow load resolving, or a
    // mid-edit refresh). It must NOT overwrite the unsaved edit.
    inputs.entity.set(buildPart({ name: 'Stale server snapshot' }));
    TestBed.flushEffects();

    expect(c.form.value['name']).toBe('User typed this');
  });

  it('axisLabel renders the procurement+inventory pair from the entity', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ procurementSource: 'Make', inventoryClass: 'Subassembly' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { axisLabel(): string };
    expect(c.axisLabel()).toBe('Make · Subassembly');
  });

  it('axisLabel is empty when entity is null (defensive — no current flow)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: null, entity: null,
    });
    TestBed.flushEffects();
    const c = component as unknown as { axisLabel(): string };
    expect(c.axisLabel()).toBe('');
  });

  it('form is invalid until name + manualCostOverride are filled', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void; valid: boolean };
    };
    c.form.patchValue({ name: '', manualCostOverride: null });
    expect(c.form.valid).toBe(false);

    c.form.patchValue({ name: 'Steel bar', manualCostOverride: 5.0 });
    expect(c.form.valid).toBe(true);
  });

  it('save() PATCHes the workflow step then completes the run', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'all', componentName: 'PartExpressFormComponent',
      runId: 7, entityId: 99, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void };
      save(): void;
    };
    c.form.patchValue({
      name: 'Steel bar',
      description: '',
      manualCostOverride: 8.75,
    });
    c.save();

    // First request: workflow step PATCH (materializes / applies fields).
    const stepReq = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
    expect(stepReq.request.method).toBe('PATCH');
    expect(stepReq.request.body.stepId).toBe('all');
    expect(stepReq.request.body.fields).toMatchObject({
      name: 'Steel bar',
      manualCostOverride: 8.75,
    });
    stepReq.flush({
      id: 7, entityType: 'Part', entityId: 99, definitionId: 'part-raw-material-express-v1',
      currentStepId: null, mode: 'express', startedAt: '', startedByUserId: 1,
      completedAt: null, abandonedAt: null, abandonedReason: null,
      lastActivityAt: '', version: 2,
    });

    // Second request: complete the run (Draft → Active).
    const completeReq = httpMock.expectOne(`${environment.apiUrl}/workflows/7/complete`);
    expect(completeReq.request.method).toBe('POST');
    expect(completeReq.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    completeReq.flush({
      id: 7, entityType: 'Part', entityId: 99, definitionId: 'part-raw-material-express-v1',
      currentStepId: null, mode: 'express', startedAt: '', startedByUserId: 1,
      completedAt: '2026-04-30T20:00:00Z', abandonedAt: null, abandonedReason: null,
      lastActivityAt: '', version: 3,
    });

    expect(navSpy).toHaveBeenCalledWith(['/parts'], { queryParams: { detail: 'part:99' } });
  });

  it('save() keeps Quick add and explains what is missing when readiness blocks promotion', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const warnSpy = vi.spyOn(TestBed.inject(SnackbarService), 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(TestBed.inject(SnackbarService), 'error').mockImplementation(() => {});
    const workflowService = TestBed.inject(WorkflowService);

    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      runId: 7, entityId: null, entity: null,
    });
    TestBed.flushEffects();
    const c = component as unknown as { form: { patchValue(v: unknown): void }; save(): void };
    c.form.patchValue({ partNumber: 'P-100', name: 'Bracket' });
    c.save();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush({
      id: 7, entityType: 'Part', entityId: 123, definitionId: 'part-make-component-v1',
      currentStepId: 'basics', mode: 'express', startedAt: '', startedByUserId: 1,
      completedAt: null, abandonedAt: null, abandonedReason: null,
      lastActivityAt: '', version: 2,
    });
    httpMock.expectOne(`${environment.apiUrl}/workflows/7/complete`).flush(
      {
        title: 'Finish the required steps first',
        code: 'workflow-readiness-missing',
        missing: [
          { validatorId: 'hasRouting', displayNameKey: 'validators.parts.hasRouting', missingMessageKey: 'validators.parts.hasRoutingMissing' },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );

    await navSpy.mock.results[0].value;

    expect(navSpy).toHaveBeenCalledWith(['/parts'], { queryParams: { detail: 'part:123' } });
    expect(warnSpy).toHaveBeenCalledWith('newPartFlow.savedAsDraft');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(workflowService.mode()).toBe('express');
    httpMock.expectNone(`${environment.apiUrl}/workflows/7/mode`);
  });

  it('save() is a no-op when runId is null (entity-less, before materialization)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'all', componentName: 'PartExpressFormComponent',
      runId: null, entityId: null, entity: null,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void };
      save(): void;
    };
    c.form.patchValue({
      name: 'Steel bar',
      manualCostOverride: 8.75,
    });
    c.save();
    httpMock.verify(); // No requests fired.
  });

  const deletedPartMessage = "Part number 'P-1' belongs to a deleted part. Restore that part or choose another number.";

  function buildSavingComponent(): { form: { patchValue(v: unknown): void; markAsDirty(): void }; save(): void } {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'all', componentName: 'PartExpressFormComponent',
      runId: 7, entityId: 99, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as { form: { patchValue(v: unknown): void; markAsDirty(): void }; save(): void };
    c.form.patchValue({ name: 'Steel bar', manualCostOverride: 8.75 });
    c.form.markAsDirty();
    return c;
  }

  it('save() leaves the server validation message on screen instead of the generic save failure', () => {
    const errorSpy = vi.spyOn(TestBed.inject(SnackbarService), 'errorFrom').mockImplementation(() => {});
    buildSavingComponent().save();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush(
      { title: 'Validation failed', detail: deletedPartMessage, errors: { partNumber: [deletedPartMessage] } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('save() hands a failure without validation detail to errorFrom', () => {
    const errorSpy = vi.spyOn(TestBed.inject(SnackbarService), 'errorFrom').mockImplementation(() => {});
    buildSavingComponent().save();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush(
      { title: 'An error occurred' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(errorSpy).toHaveBeenCalledWith(expect.any(HttpErrorResponse), 'parts.workflow.express.saveFailed');
  });

  it('the mode-switch save reports failure and keeps the server validation message', () => {
    const errorSpy = vi.spyOn(TestBed.inject(SnackbarService), 'errorFrom').mockImplementation(() => {});
    buildSavingComponent();
    let result: { ok: boolean } | undefined;
    TestBed.inject(WorkflowService).saveCurrentStep().subscribe(r => (result = r));

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush(
      { title: 'Validation failed', detail: deletedPartMessage, errors: { partNumber: [deletedPartMessage] } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(result?.ok).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('the mode-switch save hands a failure without validation detail to errorFrom', () => {
    const errorSpy = vi.spyOn(TestBed.inject(SnackbarService), 'errorFrom').mockImplementation(() => {});
    buildSavingComponent();
    TestBed.inject(WorkflowService).saveCurrentStep().subscribe();

    httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`).flush(
      { title: 'An error occurred' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(errorSpy).toHaveBeenCalledWith(expect.any(HttpErrorResponse), 'parts.workflow.express.saveFailed');
  });
});
