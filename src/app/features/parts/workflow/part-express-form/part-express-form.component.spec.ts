import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
    id: 99, partNumber: 'PRT-00099', description: 'Steel rod', revision: 'A',
    status: 'Draft', partType: 'RawMaterial', material: 'Steel',
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

describe('PartExpressFormComponent (Phase 5)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartExpressFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('hydrates all gated fields from entity', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99,
      entity: buildPart({ description: 'Aluminum stock', material: 'Aluminum', manualCostOverride: 5.25 }),
    });
    TestBed.flushEffects();
    const form = (component as unknown as { form: { value: Record<string, unknown> } }).form;
    expect(form.value).toMatchObject({
      partType: 'RawMaterial',
      description: 'Aluminum stock',
      material: 'Aluminum',
      manualCostOverride: 5.25,
    });
  });

  it('partTypeLocked is true when entity has a partType (fork dialog flow)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'RawMaterial' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { partTypeLocked(): boolean };
    expect(c.partTypeLocked()).toBe(true);
  });

  it('partTypeLocked is false when entity is null (defensive — no current flow)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: null, entity: null,
    });
    TestBed.flushEffects();
    const c = component as unknown as { partTypeLocked(): boolean };
    expect(c.partTypeLocked()).toBe(false);
  });

  it('hides Material field for RawMaterial part type', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'RawMaterial' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { showMaterialField(): boolean };
    expect(c.showMaterialField()).toBe(false);
  });

  it('shows Material field for Assembly part type', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'Assembly' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { showMaterialField(): boolean };
    expect(c.showMaterialField()).toBe(true);
  });

  it('shows Material field for made Part type', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'Part' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { showMaterialField(): boolean };
    expect(c.showMaterialField()).toBe(true);
  });

  it('hides Material field for Consumable / other non-made types', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'Consumable' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as { showMaterialField(): boolean };
    expect(c.showMaterialField()).toBe(false);
  });

  it('form is valid when Material is empty (no longer required)', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart({ partType: 'RawMaterial', material: '' }),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void; valid: boolean };
    };
    c.form.patchValue({
      partType: 'RawMaterial',
      description: 'Steel bar',
      material: '',
      manualCostOverride: 5.0,
    });
    expect(c.form.valid).toBe(true);
  });

  it('save() PATCHes basics + cost together', () => {
    const component = TestBed.runInInjectionContext(() => new PartExpressFormComponent());
    mockSignalInputs(component, {
      stepId: 'express', componentName: 'PartExpressFormComponent',
      entityId: 99, entity: buildPart(),
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: unknown): void };
      save(): void;
    };
    c.form.patchValue({
      partType: 'RawMaterial',
      description: 'Steel bar',
      material: 'Steel',
      manualCostOverride: 8.75,
    });
    c.save();
    const req = httpMock.expectOne(`${environment.apiUrl}/parts/99`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({
      description: 'Steel bar',
      material: 'Steel',
      partType: 'RawMaterial',
      manualCostOverride: 8.75,
    });
    req.flush(buildPart({ description: 'Steel bar', manualCostOverride: 8.75 }));
  });
});
