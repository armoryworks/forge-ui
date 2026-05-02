import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PartMrpClusterComponent } from './part-mrp-cluster.component';
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
    
    materialSpecId: null, materialSpecLabel: null,
    externalId: null, externalRef: null, provider: null,
    preferredVendorId: null, preferredVendorName: null,
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
    bomEntries: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    effectivePrice: 0, effectivePriceCurrency: 'USD', effectivePriceSource: 'Default',
    ...overrides,
  };
}

describe('PartMrpClusterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartMrpClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('seeds the form from MRP fields on the part input', () => {
    const component = TestBed.runInInjectionContext(() => new PartMrpClusterComponent());
    mockSignalInputs(component, {
      part: makePart({
        isMrpPlanned: true,
        lotSizingRule: 'FixedQuantity',
        fixedOrderQuantity: 100,
        minimumOrderQuantity: 10,
        orderMultiple: 5,
        planningFenceDays: 30,
        demandFenceDays: 7,
      }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { form: { value: Record<string, unknown> } };
    expect(c.form.value['isMrpPlanned']).toBe(true);
    expect(c.form.value['lotSizingRule']).toBe('FixedQuantity');
    expect(c.form.value['fixedOrderQuantity']).toBe(100);
    expect(c.form.value['minimumOrderQuantity']).toBe(10);
  });

  it('reveals the FixedOrderQuantity field only when LotSizingRule is FixedQuantity', () => {
    const component = TestBed.runInInjectionContext(() => new PartMrpClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ lotSizingRule: 'LotForLot' }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      showFixedQty(): boolean;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    expect(c.showFixedQty()).toBe(false);
    c.form.patchValue({ lotSizingRule: 'FixedQuantity' });
    expect(c.showFixedQty()).toBe(true);
  });

  it('emits the patched MRP values on onSave', () => {
    const component = TestBed.runInInjectionContext(() => new PartMrpClusterComponent());
    mockSignalInputs(component, {
      part: makePart(),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: Record<string, unknown>): void };
      onSave(): void;
    };
    c.form.patchValue({
      isMrpPlanned: true, lotSizingRule: 'LotForLot',
      planningFenceDays: 14, demandFenceDays: 3,
    });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].isMrpPlanned).toBe(true);
    expect(cb.mock.calls[0][0].lotSizingRule).toBe('LotForLot');
    expect(cb.mock.calls[0][0].planningFenceDays).toBe(14);
  });
});
