import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartManufacturerStepComponent } from './part-manufacturer-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 42, partNumber: 'PRT-00042', name: 'Widget', description: null, revision: 'A',
    status: 'Draft', partType: 'Part',
    procurementSource: 'Buy', inventoryClass: 'Component', itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null, manufacturerName: null, manufacturerPartNumber: null,
    material: 'Steel', materialSpecId: null, materialSpecLabel: null,
    moldToolRef: null, externalPartNumber: null, externalId: null, externalRef: null,
    provider: null, preferredVendorId: null, preferredVendorName: null,
    minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
    leadTimeDays: null, safetyStockDays: null, isSerialTracked: false,
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

describe('PartManufacturerStepComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartManufacturerStepComponent],
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
    const component = TestBed.runInInjectionContext(() => new PartManufacturerStepComponent());
    mockSignalInputs(component, {
      stepId: 'manufacturer', componentName: 'PartManufacturerStepComponent',
      runId: null, entityId: null, entity: null,
    });
    TestBed.flushEffects();
    expect(component).toBeTruthy();
  });

  it('dispatches a PATCH /workflows/:runId/step on form change after debounce', () => {
    vi.useFakeTimers();
    try {
      const component = TestBed.runInInjectionContext(() => new PartManufacturerStepComponent());
      mockSignalInputs(component, {
        stepId: 'manufacturer', componentName: 'PartManufacturerStepComponent',
        runId: 7, entityId: 42, entity: buildPart(),
      });
      TestBed.flushEffects();

      const form = (component as unknown as { form: { patchValue(v: unknown): void } }).form;
      form.patchValue({ manufacturerName: 'Acme Inc', manufacturerPartNumber: 'A-100' });

      vi.advanceTimersByTime(700);

      const req = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.stepId).toBe('manufacturer');
      expect(req.request.body.fields.manufacturerName).toBe('Acme Inc');
      expect(req.request.body.fields.manufacturerPartNumber).toBe('A-100');
      req.flush({
        id: 7, entityType: 'Part', entityId: 42, definitionId: 'd', currentStepId: 'manufacturer',
        mode: 'guided', startedAt: '', startedByUserId: 1, completedAt: null,
        abandonedAt: null, abandonedReason: null, lastActivityAt: '', version: 1,
      });
      const partReq = httpMock.expectOne(`${environment.apiUrl}/parts/42`);
      partReq.flush(buildPart({ manufacturerName: 'Acme Inc' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
