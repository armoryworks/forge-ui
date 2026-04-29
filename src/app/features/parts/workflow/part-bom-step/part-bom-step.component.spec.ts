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
    id: 42, partNumber: 'PRT-00042', description: 'Widget', revision: 'A',
    status: 'Draft', partType: 'Assembly', material: 'Steel',
    moldToolRef: null, externalPartNumber: null, externalId: null, externalRef: null,
    provider: null, preferredVendorId: null, preferredVendorName: null,
    minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
    leadTimeDays: null, safetyStockDays: null, isSerialTracked: false,
    toolingAssetId: null, toolingAssetName: null,
    manualCostOverride: null, currentCostCalculationId: null,
    bomEntries: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function buildEntry(id: number): BOMEntry {
  return {
    id, childPartId: id * 100, childPartNumber: `CHILD-${id}`,
    childDescription: `Child ${id}`,
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
    c.save();
    const req = httpMock.expectOne(`${environment.apiUrl}/parts/42/bom`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ childPartId: 7, quantity: 2, sourceType: 'Buy' });
    req.flush(buildPart({ bomEntries: [buildEntry(99)] }));
    const c2 = component as unknown as { bomEntries(): BOMEntry[] };
    expect(c2.bomEntries().length).toBe(1);
  });
});
