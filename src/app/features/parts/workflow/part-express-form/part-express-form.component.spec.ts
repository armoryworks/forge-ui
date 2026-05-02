import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
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
    bomEntries: [], usedIn: [],
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
    completeReq.flush({
      id: 7, entityType: 'Part', entityId: 99, definitionId: 'part-raw-material-express-v1',
      currentStepId: null, mode: 'express', startedAt: '', startedByUserId: 1,
      completedAt: '2026-04-30T20:00:00Z', abandonedAt: null, abandonedReason: null,
      lastActivityAt: '', version: 3,
    });

    expect(navSpy).toHaveBeenCalledWith(['/parts']);
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
});
