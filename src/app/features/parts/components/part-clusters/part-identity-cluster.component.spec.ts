import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartIdentityClusterComponent } from './part-identity-cluster.component';
import { PartDetail } from '../../models/part-detail.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function makePart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 1,
    partNumber: 'PRT-001',
    name: 'Widget',
    description: 'A handy widget',
    revision: 'A',
    status: 'Draft',
    partType: 'Part',
    procurementSource: 'Buy',
    inventoryClass: 'Component',
    itemKindId: null,
    itemKindLabel: null,
    traceabilityType: 'None',
    abcClass: null,
    manufacturerName: 'Acme Inc',
    manufacturerPartNumber: 'AC-100',
    material: null,
    materialSpecId: null,
    materialSpecLabel: null,
    moldToolRef: null,
    externalPartNumber: 'EXT-1',
    externalId: null,
    externalRef: null,
    provider: null,
    preferredVendorId: null,
    preferredVendorName: null,
    minStockThreshold: null,
    reorderPoint: null,
    reorderQuantity: null,
    leadTimeDays: null,
    safetyStockDays: null,
    isSerialTracked: false,
    toolingAssetId: null,
    toolingAssetName: null,
    manualCostOverride: null,
    currentCostCalculationId: null,
    weightEach: null,
    weightDisplayUnit: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    dimensionDisplayUnit: null,
    volumeMl: null,
    volumeDisplayUnit: null,
    valuationClassId: null,
    valuationClassLabel: null,
    htsCode: null,
    hazmatClass: null,
    shelfLifeDays: null,
    backflushPolicy: null,
    isKit: false,
    isConfigurable: false,
    defaultBinId: null,
    sourcePartId: null,
    isMrpPlanned: false,
    lotSizingRule: null,
    fixedOrderQuantity: null,
    minimumOrderQuantity: null,
    orderMultiple: null,
    planningFenceDays: null,
    demandFenceDays: null,
    stockUomId: null,
    stockUomCode: null,
    stockUomLabel: null,
    purchaseUomId: null,
    purchaseUomCode: null,
    purchaseUomLabel: null,
    salesUomId: null,
    salesUomCode: null,
    salesUomLabel: null,
    requiresReceivingInspection: false,
    receivingInspectionTemplateId: null,
    inspectionFrequency: null,
    inspectionSkipAfterN: null,
    bomEntries: [],
    usedIn: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    effectivePrice: 0,
    effectivePriceCurrency: 'USD',
    effectivePriceSource: 'Default',
    ...overrides,
  };
}

describe('PartIdentityClusterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartIdentityClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('reads required identity fields off the bound part input', () => {
    const component = TestBed.runInInjectionContext(() => new PartIdentityClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ name: 'Custom Widget', status: 'Active' }),
      editing: false,
      saving: false,
    });
    expect(component.part().name).toBe('Custom Widget');
    expect(component.part().status).toBe('Active');
    expect(component.part().partNumber).toBe('PRT-001');
  });

  it('disables the form when not editing and enables it when editing', () => {
    const component = TestBed.runInInjectionContext(() => new PartIdentityClusterComponent());
    const inputs = mockSignalInputs(component, {
      part: makePart(),
      editing: false,
      saving: false,
    });
    // Run the constructor effect by reading the form state
    const form = (component as unknown as { form: { disabled: boolean; enabled: boolean } }).form;
    // Trigger the effect
    TestBed.flushEffects();
    expect(form.disabled).toBe(true);
    inputs.editing.set(true);
    TestBed.flushEffects();
    expect(form.enabled).toBe(true);
  });

  it('emits the patched values via save output when onSave fires with valid form', () => {
    const component = TestBed.runInInjectionContext(() => new PartIdentityClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ name: 'Original' }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: Record<string, unknown>): void; markAllAsTouched(): void };
      onSave(): void;
    };
    c.form.patchValue({ name: 'Renamed' });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].name).toBe('Renamed');
  });
});
