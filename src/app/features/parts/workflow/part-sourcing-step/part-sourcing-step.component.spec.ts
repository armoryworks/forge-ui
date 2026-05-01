import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartSourcingStepComponent } from './part-sourcing-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 42, partNumber: 'PRT-00042', name: 'Widget', description: null, revision: 'A',
    status: 'Draft',
    procurementSource: 'Buy', inventoryClass: 'Component', itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null, manufacturerName: null, manufacturerPartNumber: null,
    materialSpecId: null, materialSpecLabel: null,
    externalPartNumber: null,
    externalId: null, externalRef: null,
    provider: null, preferredVendorId: null, preferredVendorName: null,
    minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
    leadTimeDays: null, safetyStockDays: null,
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

describe('PartSourcingStepComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartSourcingStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders without errors when entity is null', () => {
    const component = TestBed.runInInjectionContext(() => new PartSourcingStepComponent());
    mockSignalInputs(component, {
      stepId: 'sourcing', componentName: 'PartSourcingStepComponent',
      runId: null, entityId: null, entity: null,
    });
    TestBed.flushEffects();
    expect(component).toBeTruthy();
  });

  it('dispatches a PATCH /workflows/:runId/step on form change after debounce', () => {
    vi.useFakeTimers();
    try {
      const component = TestBed.runInInjectionContext(() => new PartSourcingStepComponent());
      mockSignalInputs(component, {
        stepId: 'sourcing', componentName: 'PartSourcingStepComponent',
        runId: 7, entityId: 42, entity: buildPart(),
      });
      TestBed.flushEffects();

      const form = (component as unknown as { form: { patchValue(v: unknown): void } }).form;
      form.patchValue({ leadTimeDays: 14, minOrderQty: 100 });

      vi.advanceTimersByTime(700);

      const req = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.stepId).toBe('sourcing');
      expect(req.request.body.fields.leadTimeDays).toBe(14);
      expect(req.request.body.fields.minimumOrderQuantity).toBe(100);
      req.flush({
        id: 7, entityType: 'Part', entityId: 42, definitionId: 'd', currentStepId: 'sourcing',
        mode: 'guided', startedAt: '', startedByUserId: 1, completedAt: null,
        abandonedAt: null, abandonedReason: null, lastActivityAt: '', version: 1,
      });
      const partReq = httpMock.expectOne(`${environment.apiUrl}/parts/42`);
      partReq.flush(buildPart({ leadTimeDays: 14 }));
    } finally {
      vi.useRealTimers();
    }
  });
});
