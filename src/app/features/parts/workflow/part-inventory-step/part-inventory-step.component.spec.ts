import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartInventoryStepComponent } from './part-inventory-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 42, partNumber: 'PRT-00042', name: 'Widget', description: null, revision: 'A',
    status: 'Draft',
    procurementSource: 'Buy', inventoryClass: 'Component', itemKindId: null, itemKindLabel: null,
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

describe('PartInventoryStepComponent (Phase 5 — save-on-Continue)', () => {
  let httpMock: HttpTestingController;
  let workflowService: WorkflowService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartInventoryStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    workflowService = TestBed.inject(WorkflowService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // The component loads the UoM and bin dropdown options from the API on construction.
  // Flush those GETs so each test's httpMock.verify() stays clean.
  function binRow(id: number, locationPath: string) {
    return { id, locationPath, name: locationPath, locationType: 'Bin', barcode: null, isActive: true };
  }

  function flushOptionLoads(bins: { id: number; locationPath: string }[] = []): void {
    httpMock.expectOne(`${environment.apiUrl}/inventory/uom`).flush([]);
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/inventory/locations/bins`);
    expect(req.request.params.get('activeOnly')).toBe('true');
    req.flush({ items: bins.map(b => binRow(b.id, b.locationPath)), totalCount: bins.length, page: 1, pageSize: 100 });
  }

  function binOptions(component: PartInventoryStepComponent): { value: unknown; label: string }[] {
    return (component as unknown as { defaultBinOptions(): { value: unknown; label: string }[] }).defaultBinOptions();
  }

  it('renders without errors when entity is null', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    flushOptionLoads();
    mockSignalInputs(component, {
      stepId: 'inventory', componentName: 'PartInventoryStepComponent',
      runId: null, entityId: null, entity: null,
    });
    TestBed.flushEffects();
    expect(component).toBeTruthy();
  });

  it('PATCHes /workflows/:runId/step when WorkflowService.saveCurrentStep() fires after a user edit', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    flushOptionLoads();
    mockSignalInputs(component, {
      stepId: 'inventory', componentName: 'PartInventoryStepComponent',
      runId: 7, entityId: 42, entity: buildPart(),
    });
    TestBed.flushEffects();

    const form = (component as unknown as { form: { patchValue(v: unknown): void; markAsDirty(): void } }).form;
    form.patchValue({ minStockThreshold: 10, reorderPoint: 25, reorderQuantity: 50 });
    form.markAsDirty();

    let saveResult: { ok: boolean } | null = null;
    workflowService.saveCurrentStep().subscribe((r) => (saveResult = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.stepId).toBe('inventory');
    expect(req.request.body.fields.minStockThreshold).toBe(10);
    expect(req.request.body.fields.reorderPoint).toBe(25);
    expect(req.request.body.fields.reorderQuantity).toBe(50);
    req.flush({
      id: 7, entityType: 'Part', entityId: 42, definitionId: 'd', currentStepId: 'inventory',
      mode: 'guided', startedAt: '', startedByUserId: 1, completedAt: null,
      abandonedAt: null, abandonedReason: null, lastActivityAt: '', version: 1,
    });
    const partReq = httpMock.expectOne(`${environment.apiUrl}/parts/42`);
    partReq.flush(buildPart({ minStockThreshold: 10 }));

    expect(saveResult).toEqual({ ok: true });
  });

  it('does NOT round-trip when the form is pristine — Back/Jump on a never-touched step is a no-op', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    flushOptionLoads();
    mockSignalInputs(component, {
      stepId: 'inventory', componentName: 'PartInventoryStepComponent',
      runId: 7, entityId: 42, entity: buildPart(),
    });
    TestBed.flushEffects();

    let saveResult: { ok: boolean } | null = null;
    workflowService.saveCurrentStep().subscribe((r) => (saveResult = r));

    httpMock.verify();
    expect(saveResult).toEqual({ ok: true });
  });

  it('asks the server for active bins only and offers them for the default bin', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    flushOptionLoads([{ id: 3, locationPath: 'Main / A / 01' }]);
    const options = binOptions(component);
    expect(options.map(o => o.value)).toEqual([null, 3]);
    expect(options[1].label).toBe('Main / A / 01');
  });

  it('pages through every active bin when there are more than one page', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    httpMock.expectOne(`${environment.apiUrl}/inventory/uom`).flush([]);
    const firstPage = Array.from({ length: 100 }, (_, i) => binRow(i + 1, `Main / ${i + 1}`));
    httpMock.expectOne(r => r.url === `${environment.apiUrl}/inventory/locations/bins` && r.params.get('page') === '1')
      .flush({ items: firstPage, totalCount: 101, page: 1, pageSize: 100 });
    httpMock.expectOne(r => r.url === `${environment.apiUrl}/inventory/locations/bins` && r.params.get('page') === '2')
      .flush({ items: [binRow(101, 'Overflow / 01')], totalCount: 101, page: 2, pageSize: 100 });
    const options = binOptions(component);
    expect(options).toHaveLength(102);
    expect(options[101]).toEqual({ value: 101, label: 'Overflow / 01' });
  });

  it('keeps a saved default bin that is no longer active among the options', () => {
    const component = TestBed.runInInjectionContext(() => new PartInventoryStepComponent());
    flushOptionLoads([{ id: 3, locationPath: 'Main / A / 01' }]);
    mockSignalInputs(component, {
      stepId: 'inventory', componentName: 'PartInventoryStepComponent',
      runId: 7, entityId: 42, entity: buildPart({ defaultBinId: 9 }),
    });
    TestBed.flushEffects();
    httpMock.expectOne(`${environment.apiUrl}/inventory/locations`).flush([
      {
        id: 1, name: 'Main', locationType: 'Area', parentId: null, barcode: null, description: null,
        sortOrder: 0, isActive: true, locationPath: 'Main', contentCount: 0,
        children: [{
          id: 9, name: 'Old', locationType: 'Bin', parentId: 1, barcode: null, description: null,
          sortOrder: 0, isActive: false, locationPath: 'Main / Old', contentCount: 0, children: [],
        }],
      },
    ]);
    expect(binOptions(component).map(o => o.value)).toEqual([null, 9, 3]);
  });
});
