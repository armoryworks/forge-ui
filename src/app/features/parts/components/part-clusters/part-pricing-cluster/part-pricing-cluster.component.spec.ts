import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PartPricingClusterComponent } from './part-pricing-cluster.component';
import { PartDetail } from '../../../models/part-detail.model';
import { PartPrice } from '../../../models/part-price.model';
import { PartsService } from '../../../services/parts.service';

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

function makePrice(overrides: Partial<PartPrice> = {}): PartPrice {
  return {
    id: 1, partId: 1, unitPrice: 5, currency: 'USD',
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PartPricingClusterComponent', () => {
  let partsService: { getPartPriceHistory: ReturnType<typeof vi.fn>; addPartPrice: ReturnType<typeof vi.fn>; deletePartPrice: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    partsService = {
      getPartPriceHistory: vi.fn().mockReturnValue(of([])),
      addPartPrice: vi.fn().mockReturnValue(of(makePrice({ id: 99, unitPrice: 10 }))),
      deletePartPrice: vi.fn().mockReturnValue(of(void 0)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartPricingClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: partsService },
      ],
    });
  });

  it('renders the empty-state when history is empty', () => {
    partsService.getPartPriceHistory.mockReturnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new PartPricingClusterComponent());
    mockSignalInputs(component, {
      entity: makePart(),
      editing: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { history: () => PartPrice[] };
    expect(c.history()).toEqual([]);
    expect(partsService.getPartPriceHistory).toHaveBeenCalledWith(1);
  });

  it('loads history rows when populated', () => {
    const rows = [
      makePrice({ id: 1, unitPrice: 7, effectiveTo: null }),
      makePrice({ id: 2, unitPrice: 6, effectiveFrom: '2025-01-01T00:00:00Z', effectiveTo: '2026-01-01T00:00:00Z' }),
    ];
    partsService.getPartPriceHistory.mockReturnValue(of(rows));
    const component = TestBed.runInInjectionContext(() => new PartPricingClusterComponent());
    mockSignalInputs(component, {
      entity: makePart(),
      editing: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { history: () => PartPrice[]; openRowId: () => number | null };
    expect(c.history()).toHaveLength(2);
    // The most-recent open row is the one with effectiveTo === null.
    expect(c.openRowId()).toBe(1);
  });

  it('add-new-price form posts to addPartPrice and refreshes history', () => {
    partsService.getPartPriceHistory.mockReturnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new PartPricingClusterComponent());
    mockSignalInputs(component, {
      entity: makePart(),
      editing: true,
    });
    TestBed.flushEffects();

    const c = component as unknown as {
      form: { patchValue: (v: Record<string, unknown>) => void; getRawValue: () => Record<string, unknown> };
      addPrice: () => void;
    };
    c.form.patchValue({
      unitPrice: 10,
      currency: 'USD',
      effectiveFrom: new Date('2026-04-01'),
      notes: 'test',
    });
    c.addPrice();

    expect(partsService.addPartPrice).toHaveBeenCalled();
    const [partId, body] = partsService.addPartPrice.mock.calls[0];
    expect(partId).toBe(1);
    expect(body.unitPrice).toBe(10);
    expect(body.currency).toBe('USD');
    // Posting refreshes history → second call to getPartPriceHistory.
    expect(partsService.getPartPriceHistory).toHaveBeenCalledTimes(2);
  });

  it('source label resolves to the resolver-current rung', () => {
    const component = TestBed.runInInjectionContext(() => new PartPricingClusterComponent());
    mockSignalInputs(component, {
      entity: makePart({ effectivePriceSource: 'PartPrice', effectivePrice: 12.5, effectivePriceCurrency: 'USD' }),
      editing: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { sourceLabelKey: () => string };
    expect(c.sourceLabelKey()).toBe('parts.pricing.priceSourcePartPrice');
  });
});
