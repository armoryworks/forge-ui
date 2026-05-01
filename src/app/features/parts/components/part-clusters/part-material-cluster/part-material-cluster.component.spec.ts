import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PartMaterialClusterComponent } from './part-material-cluster.component';
import { PartDetail } from '../../../models/part-detail.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function makePart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 1, partNumber: 'PRT', name: 'Widget', description: null, revision: 'A',
    status: 'Active',
    procurementSource: 'Buy', inventoryClass: 'Component',
    itemKindId: null, itemKindLabel: null,
    traceabilityType: 'None', abcClass: null,
    manufacturerName: null, manufacturerPartNumber: null,
    materialSpecId: null, materialSpecLabel: null,
    externalPartNumber: null,
    externalId: null, externalRef: null, provider: null,
    preferredVendorId: null, preferredVendorName: null,
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

describe('PartMaterialClusterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartMaterialClusterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('reads materialSpecLabel for the read-mode display when set', () => {
    const component = TestBed.runInInjectionContext(() => new PartMaterialClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ materialSpecLabel: '6061-T6', materialSpecId: 100 }),
      editing: false,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { displayMaterial(): string | null };
    expect(c.displayMaterial()).toBe('6061-T6');
  });

  it('returns null when materialSpecLabel is null (legacy free-text fallback retired pre-beta)', () => {
    const component = TestBed.runInInjectionContext(() => new PartMaterialClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ materialSpecLabel: null }),
      editing: false,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { displayMaterial(): string | null };
    expect(c.displayMaterial()).toBeNull();
  });

  it('emits a save patch with weight converted to canonical grams', () => {
    const component = TestBed.runInInjectionContext(() => new PartMaterialClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ weightEach: null, weightDisplayUnit: null }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: Record<string, unknown>): void };
      onSave(): void;
    };
    // Type 2 kg → expect 2000 grams emitted.
    c.form.patchValue({ weight: 2, weightDisplayUnit: 'kg' });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].weightEach).toBe(2000);
    expect(cb.mock.calls[0][0].weightDisplayUnit).toBe('kg');
  });
});
