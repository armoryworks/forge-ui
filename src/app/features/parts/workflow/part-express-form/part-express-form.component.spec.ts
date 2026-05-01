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
    status: 'Draft', partType: 'RawMaterial',
    procurementSource: 'Buy', inventoryClass: 'Raw', itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null, manufacturerName: null, manufacturerPartNumber: null,
    material: 'Steel',
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
      entity: buildPart({ name: 'Aluminum stock', description: 'Long-form notes', material: 'Aluminum', manualCostOverride: 5.25 }),
    });
    TestBed.flushEffects();
    const form = (component as unknown as { form: { value: Record<string, unknown> } }).form;
    expect(form.value).toMatchObject({
      partType: 'RawMaterial',
      name: 'Aluminum stock',
      description: 'Long-form notes',
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
      name: 'Steel bar',
      description: '',
      material: '',
      manualCostOverride: 5.0,
    });
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
      partType: 'RawMaterial',
      name: 'Steel bar',
      description: '',
      material: 'Steel',
      manualCostOverride: 8.75,
    });
    c.save();

    // First request: workflow step PATCH (materializes / applies fields).
    const stepReq = httpMock.expectOne(`${environment.apiUrl}/workflows/7/step`);
    expect(stepReq.request.method).toBe('PATCH');
    expect(stepReq.request.body.stepId).toBe('all');
    expect(stepReq.request.body.fields).toMatchObject({
      name: 'Steel bar',
      material: 'Steel',
      partType: 'RawMaterial',
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
      partType: 'RawMaterial',
      name: 'Steel bar',
      material: 'Steel',
      manualCostOverride: 8.75,
    });
    c.save();
    httpMock.verify(); // No requests fired.
  });
});
