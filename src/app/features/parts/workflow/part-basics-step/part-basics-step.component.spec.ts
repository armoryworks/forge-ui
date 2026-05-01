import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartBasicsStepComponent } from './part-basics-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 42, partNumber: 'PRT-00042', name: 'Widget', description: null, revision: 'A',
    status: 'Draft', partType: 'Assembly',
    procurementSource: 'Make', inventoryClass: 'Subassembly', itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null, manufacturerName: null, manufacturerPartNumber: null,
    material: 'Steel',
    materialSpecId: null, materialSpecLabel: null,
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
    bomEntries: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe('PartBasicsStepComponent (Phase 5)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartBasicsStepComponent],
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

  it('hydrates the form from the entity input', () => {
    const component = TestBed.runInInjectionContext(() => new PartBasicsStepComponent());
    mockSignalInputs(component, {
      stepId: 'basics', componentName: 'PartBasicsStepComponent',
      runId: 7, entityId: 42, entity: buildPart({ name: 'Hydration', description: 'Hydration notes', material: 'Aluminum' }),
    });
    // Trigger effect by reading the form
    TestBed.flushEffects();
    const form = (component as unknown as { form: { value: unknown } }).form;
    expect(form.value).toMatchObject({
      name: 'Hydration',
      description: 'Hydration notes',
      material: 'Aluminum',
      partType: 'Assembly',
    });
  });

  it('dispatches a PATCH /workflows/:runId/step on form change after debounce', async () => {
    vi.useFakeTimers();
    try {
      const component = TestBed.runInInjectionContext(() => new PartBasicsStepComponent());
      mockSignalInputs(component, {
        stepId: 'basics', componentName: 'PartBasicsStepComponent',
        runId: 7, entityId: 42, entity: buildPart({ name: 'Initial', material: 'Steel' }),
      });
      TestBed.flushEffects();

      const form = (component as unknown as { form: { patchValue(v: unknown): void } }).form;
      form.patchValue({ name: 'Updated name' });

      // Debounce 600ms
      vi.advanceTimersByTime(700);

      const req = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.stepId).toBe('basics');
      expect(req.request.body.fields.name).toBe('Updated name');
      req.flush({
        id: 7, entityType: 'Part', entityId: 42, definitionId: 'd', currentStepId: 'basics',
        mode: 'guided', startedAt: '', startedByUserId: 1, completedAt: null,
        abandonedAt: null, abandonedReason: null, lastActivityAt: '', version: 1,
      });
      // Re-fetch of the part for currentEntity sync
      const partReq = httpMock.expectOne(`${environment.apiUrl}/parts/42`);
      partReq.flush(buildPart({ name: 'Updated name' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the dispatch when runId is null (entity-less, before materialization)', async () => {
    vi.useFakeTimers();
    try {
      const component = TestBed.runInInjectionContext(() => new PartBasicsStepComponent());
      mockSignalInputs(component, {
        stepId: 'basics', componentName: 'PartBasicsStepComponent',
        runId: null, entityId: null, entity: null,
      });
      TestBed.flushEffects();

      const form = (component as unknown as { form: { patchValue(v: unknown): void } }).form;
      form.patchValue({ name: 'Whatever', material: 'Steel', partType: 'Part' });

      vi.advanceTimersByTime(700);

      // Nothing fires — guard clause short-circuits the save.
      httpMock.verify();
    } finally {
      vi.useRealTimers();
    }
  });
});
