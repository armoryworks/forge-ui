import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { PartIdentityClusterComponent } from './part-identity-cluster.component';
import { PartReviseDialogComponent } from '../part-revise-dialog/part-revise-dialog.component';
import { PartDetail } from '../../models/part-detail.model';
import { PartRevision } from '../../models/part-revision.model';
import { PartsService } from '../../services/parts.service';

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
    procurementSource: 'Buy',
    inventoryClass: 'Component',
    itemKindId: null,
    itemKindLabel: null,
    traceabilityType: 'None',
    abcClass: null,
    materialSpecId: null,
    materialSpecLabel: null,
    externalId: null,
    externalRef: null,
    provider: null,
    preferredVendorId: null,
    preferredVendorName: null,
    minStockThreshold: null,
    reorderPoint: null,
    reorderQuantity: null,
    safetyStockDays: null,
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
    bomLines: [],
    usedIn: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    effectivePrice: 0,
    effectivePriceCurrency: 'USD',
    effectivePriceSource: 'Default',
    ...overrides,
  };
}

function makeRevision(overrides: Partial<PartRevision> = {}): PartRevision {
  return {
    id: 1,
    partId: 1,
    revision: 'A',
    changeDescription: null,
    changeReason: 'Initial release',
    effectiveDate: new Date('2026-01-01T00:00:00Z'),
    isCurrent: true,
    fileCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    createdByName: 'Dana Reyes',
    ...overrides,
  };
}

type ClusterInternals = {
  form: PartIdentityClusterComponent['form'];
  revisions: () => PartRevision[];
  canRevise: () => boolean;
  onSave(close?: boolean): void;
  openRevise(): void;
};

describe('PartIdentityClusterComponent', () => {
  let getRevisions: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let dialogResult: unknown;
  let hasAnyRole: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getRevisions = vi.fn().mockReturnValue(of([makeRevision()]));
    dialogResult = undefined;
    dialogOpen = vi.fn().mockImplementation(() => ({ afterClosed: () => of(dialogResult) }));
    hasAnyRole = vi.fn().mockReturnValue(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartIdentityClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: { getRevisions } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: AuthService, useValue: { hasAnyRole } },
      ],
    });
  });

  function createEditing(overrides: Partial<PartDetail> = {}): ClusterInternals & PartIdentityClusterComponent {
    const component = TestBed.runInInjectionContext(() => new PartIdentityClusterComponent());
    mockSignalInputs(component, {
      part: makePart(overrides),
      editing: true,
      saving: false,
      allowManualNumbers: false,
    });
    TestBed.flushEffects();
    return component as unknown as ClusterInternals & PartIdentityClusterComponent;
  }

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

  it('emits the patch without classification keys and without confirming when they are unchanged', () => {
    const c = createEditing();
    const cb = vi.fn();
    c.save.subscribe(cb);

    c.onSave();

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).not.toHaveProperty('procurementSource');
    expect(cb.mock.calls[0][0]).not.toHaveProperty('inventoryClass');
  });

  it('asks for confirmation before emitting a changed procurement source and inventory class', () => {
    const c = createEditing({ procurementSource: 'Buy', inventoryClass: 'Component' });
    const cb = vi.fn();
    c.saveAndClose.subscribe(cb);
    c.form.patchValue({ procurementSource: 'Make', inventoryClass: 'Subassembly' });
    dialogResult = true;

    c.onSave(true);

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const [dialogType, config] = dialogOpen.mock.calls[0] as [unknown, { data: ConfirmDialogData }];
    expect(dialogType).toBe(ConfirmDialogComponent);
    expect(config.data.details).toEqual([
      'partRevisions.classification.tabsChange',
      'partRevisions.classification.recordsUntouched',
    ]);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toMatchObject({ procurementSource: 'Make', inventoryClass: 'Subassembly', name: 'Widget' });
  });

  it('emits only the classification axis that changed', () => {
    const c = createEditing({ procurementSource: 'Buy', inventoryClass: 'Component' });
    const cb = vi.fn();
    c.save.subscribe(cb);
    c.form.patchValue({ procurementSource: 'Make' });
    dialogResult = true;

    c.onSave();

    expect(cb.mock.calls[0][0].procurementSource).toBe('Make');
    expect(cb.mock.calls[0][0]).not.toHaveProperty('inventoryClass');
  });

  it('does not emit when the classification change is not confirmed', () => {
    const c = createEditing();
    const cb = vi.fn();
    c.save.subscribe(cb);
    c.form.patchValue({ inventoryClass: 'FinishedGood' });
    dialogResult = false;

    c.onSave();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('loads the revision history for the bound part', () => {
    const c = createEditing({ id: 42 });

    expect(getRevisions).toHaveBeenCalledWith(42);
    expect(c.revisions().map((r) => r.revision)).toEqual(['A']);
  });

  it('keeps who made each revision, including historic revisions with no recorded author', () => {
    getRevisions.mockReturnValue(of([
      makeRevision({ id: 2, revision: 'B' }),
      makeRevision({ id: 1, revision: 'A', createdByName: null }),
    ]));

    const c = createEditing();

    expect(c.revisions().map((r) => [r.revision, r.createdByName])).toEqual([['B', 'Dana Reyes'], ['A', null]]);
  });

  it('offers Revise part only to Admin, Manager and Engineer', () => {
    const c = createEditing();
    expect(c.canRevise()).toBe(true);
    expect(hasAnyRole).toHaveBeenCalledWith(['Admin', 'Manager', 'Engineer']);

    hasAnyRole.mockReturnValue(false);
    const viewer = createEditing();
    expect(viewer.canRevise()).toBe(false);
  });

  it('shows the new revision, reloads the history and emits revised after Revise part', () => {
    const c = createEditing({ revision: 'A' });
    const created = makeRevision({ id: 2, revision: 'B', changeReason: 'Thicker wall' });
    const cb = vi.fn();
    c.revised.subscribe(cb);
    getRevisions.mockReturnValue(of([created, makeRevision({ isCurrent: false })]));
    dialogResult = created;

    c.openRevise();
    TestBed.flushEffects();

    expect(dialogOpen.mock.calls[0][0]).toBe(PartReviseDialogComponent);
    expect(c.form.controls.revision.value).toBe('B');
    expect(c.revisions().map((r) => r.revision)).toEqual(['B', 'A']);
    expect(cb).toHaveBeenCalledWith(created);
  });

  it('leaves the revision out of the patch when it was not edited', () => {
    const c = createEditing({ revision: 'A' });
    const cb = vi.fn();
    c.save.subscribe(cb);
    c.form.patchValue({ name: 'Renamed' });

    c.onSave();

    expect(cb.mock.calls[0][0]).not.toHaveProperty('revision');
  });

  it('does not revert a revision made through Revise part when the part input is stale', () => {
    const component = TestBed.runInInjectionContext(() => new PartIdentityClusterComponent());
    const inputs = mockSignalInputs(component, {
      part: makePart({ revision: 'A' }),
      editing: false,
      saving: false,
      allowManualNumbers: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as ClusterInternals & PartIdentityClusterComponent;
    dialogResult = makeRevision({ id: 2, revision: 'B' });
    c.openRevise();
    TestBed.flushEffects();

    inputs.editing.set(true);
    TestBed.flushEffects();
    expect(c.form.controls.revision.value).toBe('B');

    const cb = vi.fn();
    c.save.subscribe(cb);
    c.form.patchValue({ name: 'Renamed' });
    c.onSave();

    expect(cb.mock.calls[0][0]).not.toHaveProperty('revision');
    expect(cb.mock.calls[0][0].name).toBe('Renamed');
  });

  it('includes an edited revision in the patch', () => {
    const c = createEditing({ revision: 'A' });
    const cb = vi.fn();
    c.save.subscribe(cb);
    c.form.patchValue({ revision: ' C ' });

    c.onSave();

    expect(cb.mock.calls[0][0].revision).toBe('C');
  });
});
