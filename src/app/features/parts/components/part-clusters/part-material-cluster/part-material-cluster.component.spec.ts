import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PartMaterialClusterComponent } from './part-material-cluster.component';
import { PartDetail } from '../../../models/part-detail.model';
import { ReferenceDataItem, ReferenceDataService } from '../../../../../shared/services/reference-data.service';

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

  describe('new material', () => {
    const aluminum: ReferenceDataItem = {
      id: 1, groupCode: 'part.material_spec', code: 'aluminum', label: 'Aluminum',
      sortOrder: 10, isActive: true, parentId: null,
    };
    const t6061: ReferenceDataItem = {
      id: 2, groupCode: 'part.material_spec', code: 'aluminum-6061-t6', label: '6061-T6',
      sortOrder: 10, isActive: true, parentId: 1,
    };
    const t7075: ReferenceDataItem = {
      id: 3, groupCode: 'part.material_spec', code: 'aluminum-7075-t6', label: '7075-T6',
      sortOrder: 20, isActive: true, parentId: 1,
    };

    type ClusterInternals = {
      form: PartMaterialClusterComponent['form'];
      materialSpecOptions: () => { value: unknown; label: string }[];
      openNewMaterial(): void;
      onSave(): void;
    };

    let getByGroup: ReturnType<typeof vi.fn>;
    let clearGroupCache: ReturnType<typeof vi.fn>;
    let open: ReturnType<typeof vi.fn>;
    let dialogResult: ReferenceDataItem | null;

    beforeEach(() => {
      dialogResult = null;
      getByGroup = vi.fn().mockReturnValue(of([aluminum, t6061]));
      clearGroupCache = vi.fn();
      open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
      TestBed.overrideProvider(ReferenceDataService, { useValue: { getByGroup, clearGroupCache } });
      TestBed.overrideProvider(MatDialog, { useValue: { open } });
    });

    function createEditing(): ClusterInternals {
      const component = TestBed.runInInjectionContext(() => new PartMaterialClusterComponent());
      mockSignalInputs(component, { part: makePart({ materialSpecId: 2 }), editing: true, saving: false });
      TestBed.flushEffects();
      component.ngOnInit();
      return component as unknown as ClusterInternals;
    }

    it('opens the dialog with the loaded material rows', () => {
      const c = createEditing();
      c.openNewMaterial();

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0][1].data).toEqual({ items: [aluminum, t6061] });
    });

    it('reloads the group and selects the created material so Save stores it', () => {
      const c = createEditing();
      dialogResult = t7075;
      getByGroup.mockReturnValue(of([aluminum, t6061, t7075]));

      c.openNewMaterial();

      expect(clearGroupCache).toHaveBeenCalledWith('part.material_spec');
      expect(c.materialSpecOptions().map(o => o.label)).toContain('Aluminum / 7075-T6');
      expect(c.form.controls.materialSpecId.value).toBe(3);
      expect(c.form.controls.materialSpecId.dirty).toBe(true);

      const saved = vi.fn();
      (c as unknown as PartMaterialClusterComponent).save.subscribe(saved);
      c.onSave();
      expect(saved.mock.calls[0][0].materialSpecId).toBe(3);
    });

    it('leaves the selection and cache alone when the dialog is dismissed', () => {
      const c = createEditing();

      c.openNewMaterial();

      expect(clearGroupCache).not.toHaveBeenCalled();
      expect(getByGroup).toHaveBeenCalledTimes(1);
      expect(c.form.controls.materialSpecId.value).toBe(2);
    });
  });
});
