import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { CapabilityService } from '../../../../../shared/services/capability.service';
import { PartQualityClusterComponent } from './part-quality-cluster.component';
import { PartDetail } from '../../../models/part-detail.model';
import { PartQualitySummary } from '../../../models/part-quality-summary.model';
import { PartQualityService } from '../../../services/part-quality.service';

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
    bomLines: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    effectivePrice: 0, effectivePriceCurrency: 'USD', effectivePriceSource: 'Default',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<PartQualitySummary> = {}): PartQualitySummary {
  return {
    partId: 1,
    recentInspections: [{
      id: 31, status: 'Failed', templateName: 'Final', jobNumber: 'J-1', lotNumber: 'LOT-1',
      inspectorName: 'Inspector', createdAt: '2026-10-01T00:00:00Z', completedAt: null,
      passedCount: 1, failedCount: 1,
    }],
    openNcrs: [{
      id: 41, ncrNumber: 'NCR-1', type: 'Internal', status: 'Open', lotNumber: 'LOT-1',
      detectedAt: '2026-10-02T00:00:00Z', description: 'Bore oversize', affectedQuantity: 2,
    }],
    lots: [{
      id: 21, lotNumber: 'LOT-1', onHandQuantity: 10, heldQuantity: 4, isOnHold: true,
      expirationDate: null, createdAt: '2026-09-01T00:00:00Z',
    }],
    inspectionTemplates: [{ id: 71, name: 'Final', isActive: true, isReceivingTemplate: false }],
    spcCharacteristicCount: 2,
    ...overrides,
  };
}

describe('PartQualityClusterComponent', () => {
  let getSummary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSummary = vi.fn(() => of(makeSummary()));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartQualityClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartQualityService, useValue: { getSummary } },
      ],
    });
  });

  it('seeds the form from quality fields on the part input', () => {
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    mockSignalInputs(component, {
      part: makePart({
        requiresReceivingInspection: true,
        inspectionFrequency: 'FirstArticle',
        inspectionSkipAfterN: 3,
        hazmatClass: 'Class 3',
        shelfLifeDays: 365,
        backflushPolicy: 'Manual',
      }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as { form: { value: Record<string, unknown> } };
    expect(c.form.value['requiresReceivingInspection']).toBe(true);
    expect(c.form.value['inspectionFrequency']).toBe('FirstArticle');
    expect(c.form.value['hazmatClass']).toBe('Class 3');
    expect(c.form.value['shelfLifeDays']).toBe(365);
    expect(c.form.value['backflushPolicy']).toBe('Manual');
  });

  it('shows compliance fields only when CAP-MD-PART-COMPLIANCE is enabled', () => {
    const cap = TestBed.inject(CapabilityService);
    vi.spyOn(cap, 'isEnabled').mockImplementation(() => true);
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    mockSignalInputs(component, { part: makePart(), editing: true, saving: false });
    TestBed.flushEffects();
    const c = component as unknown as { showCompliance(): boolean };
    expect(c.showCompliance()).toBe(true);
  });

  it('hides compliance fields when capability is disabled', () => {
    const cap = TestBed.inject(CapabilityService);
    vi.spyOn(cap, 'isEnabled').mockImplementation(() => false);
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    mockSignalInputs(component, { part: makePart(), editing: true, saving: false });
    TestBed.flushEffects();
    const c = component as unknown as { showCompliance(): boolean };
    expect(c.showCompliance()).toBe(false);
  });

  it('emits the quality patch with toggle + enums + numbers', () => {
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
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
      requiresReceivingInspection: true,
      inspectionFrequency: 'Every',
      shelfLifeDays: 30,
      backflushPolicy: 'Auto',
    });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].requiresReceivingInspection).toBe(true);
    expect(cb.mock.calls[0][0].inspectionFrequency).toBe('Every');
    expect(cb.mock.calls[0][0].backflushPolicy).toBe('Auto');
    expect(cb.mock.calls[0][0].shelfLifeDays).toBe(30);
  });

  it('loads the quality summary for the part when CAP-QC-INSPECTION is enabled', () => {
    const cap = TestBed.inject(CapabilityService);
    vi.spyOn(cap, 'isEnabled').mockImplementation((code: string) => code === 'CAP-QC-INSPECTION');
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    mockSignalInputs(component, { part: makePart({ id: 7 }), editing: false, saving: false });
    TestBed.flushEffects();
    const c = component as unknown as { summary(): PartQualitySummary | null; summaryLoading(): boolean };
    expect(getSummary).toHaveBeenCalledWith(7);
    expect(c.summaryLoading()).toBe(false);
    expect(c.summary()?.recentInspections.map(i => i.id)).toEqual([31]);
    expect(c.summary()?.openNcrs.map(n => n.ncrNumber)).toEqual(['NCR-1']);
  });

  it('does not request the quality summary when CAP-QC-INSPECTION is disabled', () => {
    const cap = TestBed.inject(CapabilityService);
    vi.spyOn(cap, 'isEnabled').mockImplementation(() => false);
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    mockSignalInputs(component, { part: makePart(), editing: false, saving: false });
    TestBed.flushEffects();
    const c = component as unknown as { summary(): PartQualitySummary | null };
    expect(getSummary).not.toHaveBeenCalled();
    expect(c.summary()).toBeNull();
  });

  it('reloads only when the part id changes, not on every part edit', () => {
    const cap = TestBed.inject(CapabilityService);
    vi.spyOn(cap, 'isEnabled').mockImplementation(() => true);
    const component = TestBed.runInInjectionContext(() => new PartQualityClusterComponent());
    const inputs = mockSignalInputs(component, { part: makePart({ id: 7 }), editing: false, saving: false });
    TestBed.flushEffects();
    inputs.part.set(makePart({ id: 7, hazmatClass: 'Class 3' }));
    TestBed.flushEffects();
    expect(getSummary).toHaveBeenCalledTimes(1);
    inputs.part.set(makePart({ id: 8 }));
    TestBed.flushEffects();
    expect(getSummary).toHaveBeenCalledTimes(2);
    expect(getSummary).toHaveBeenLastCalledWith(8);
  });
});
