import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { BOMEntry } from '../../models/bom-entry.model';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartBomStepComponent } from './part-bom-step.component';

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

function buildEntry(id: number): BOMEntry {
  return {
    id, childPartId: id * 100, childPartNumber: `CHILD-${id}`,
    childName: `Child ${id}`,
    quantity: 1, referenceDesignator: null, sortOrder: id,
    sourceType: 'Buy', leadTimeDays: null, notes: null,
  };
}

describe('PartBomStepComponent (Phase 5)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartBomStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('seeds the bom list from the entity input', () => {
    const component = TestBed.runInInjectionContext(() => new PartBomStepComponent());
    mockSignalInputs(component, {
      stepId: 'bom', componentName: 'PartBomStepComponent',
      entityId: 42, entity: buildPart({ bomEntries: [buildEntry(1), buildEntry(2)] }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { bomEntries(): BOMEntry[] };
    expect(c.bomEntries().length).toBe(2);
  });

  it('save POSTs a new BOM entry to /parts/:id/bom', () => {
    const component = TestBed.runInInjectionContext(() => new PartBomStepComponent());
    mockSignalInputs(component, {
      stepId: 'bom', componentName: 'PartBomStepComponent',
      entityId: 42, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void };
      save(): void;
    };
    c.form.patchValue({ childPartId: 7, quantity: 2, sourceType: 'Buy' });
    // Picking a child part now triggers a part-detail fetch so the dialog can
    // auto-derive the source type. Flush it with a stub so the BOM POST below
    // is unaffected and httpMock.verify() stays clean.
    const childReq = httpMock.expectOne(`${environment.apiUrl}/parts/7`);
    expect(childReq.request.method).toBe('GET');
    childReq.flush(buildPart({ id: 7, partType: 'RawMaterial' }));
    c.save();
    const req = httpMock.expectOne(`${environment.apiUrl}/parts/42/bom`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ childPartId: 7, quantity: 2, sourceType: 'Buy' });
    req.flush(buildPart({ bomEntries: [buildEntry(99)] }));
    const c2 = component as unknown as { bomEntries(): BOMEntry[] };
    expect(c2.bomEntries().length).toBe(1);
  });

  it('auto-sets sourceType from child part type (Assembly → Make)', () => {
    const component = TestBed.runInInjectionContext(() => new PartBomStepComponent());
    mockSignalInputs(component, {
      stepId: 'bom', componentName: 'PartBomStepComponent',
      entityId: 42, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: {
        patchValue(v: unknown): void;
        controls: { sourceType: { value: string } };
        get(name: string): { value: string };
      };
    };
    c.form.patchValue({ childPartId: 11 });
    const childReq = httpMock.expectOne(`${environment.apiUrl}/parts/11`);
    childReq.flush(buildPart({ id: 11, partType: 'Assembly' }));
    expect(c.form.controls.sourceType.value).toBe('Make');
  });

  it('auto-sets sourceType from child part type (RawMaterial → Buy)', () => {
    const component = TestBed.runInInjectionContext(() => new PartBomStepComponent());
    mockSignalInputs(component, {
      stepId: 'bom', componentName: 'PartBomStepComponent',
      entityId: 42, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: {
        patchValue(v: unknown): void;
        controls: { sourceType: { setValue(v: string): void; value: string } };
      };
    };
    // Seed sourceType to Make so we can verify it's overridden to Buy.
    c.form.controls.sourceType.setValue('Make');
    c.form.patchValue({ childPartId: 22 });
    const childReq = httpMock.expectOne(`${environment.apiUrl}/parts/22`);
    childReq.flush(buildPart({ id: 22, partType: 'RawMaterial' }));
    expect(c.form.controls.sourceType.value).toBe('Buy');
  });
});
