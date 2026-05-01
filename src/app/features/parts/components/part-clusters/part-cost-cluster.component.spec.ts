import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartCostClusterComponent } from './part-cost-cluster.component';
import { PartDetail } from '../../models/part-detail.model';

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
    manualCostOverride: 12.5, currentCostCalculationId: 99,
    weightEach: null, weightDisplayUnit: null,
    lengthMm: null, widthMm: null, heightMm: null, dimensionDisplayUnit: null,
    volumeMl: null, volumeDisplayUnit: null,
    valuationClassId: null, valuationClassLabel: 'Inventory',
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

describe('PartCostClusterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartCostClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('seeds the manual-cost override from the part input', () => {
    const component = TestBed.runInInjectionContext(() => new PartCostClusterComponent());
    mockSignalInputs(component, {
      part: makePart({ manualCostOverride: 12.5 }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { form: { value: Record<string, unknown> } };
    expect(c.form.value['manualCostOverride']).toBe(12.5);
  });
});
