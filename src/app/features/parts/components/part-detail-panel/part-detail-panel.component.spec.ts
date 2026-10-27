import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, Subject, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { AuthService } from '../../../../shared/services/auth.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartDetailLayoutResolverService } from '../../services/part-detail-layout-resolver.service';
import { PartsService } from '../../services/parts.service';
import { VendorPartsService } from '../../services/vendor-parts.service';
import { PartDetailPanelComponent } from './part-detail-panel.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type PanelInternals = {
  part: () => PartDetail | null;
  onRevised(): void;
  bomForm: FormGroup;
  saveBomLine(): void;
};

describe('PartDetailPanelComponent', () => {
  let getPartById: ReturnType<typeof vi.fn>;
  let createBOMLine: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPartById = vi.fn().mockReturnValue(of({ id: 7, revision: 'A' } as PartDetail));
    createBOMLine = vi.fn(() => new Subject());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: PartsService,
          useValue: {
            getPartById,
            createBOMLine,
            getPartFiles: vi.fn().mockReturnValue(of([])),
            getPartInventorySummary: vi.fn().mockReturnValue(of(null)),
          },
        },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: WorkflowService, useValue: {} },
        { provide: PartDetailLayoutResolverService, useValue: { resolve: () => [] } },
        { provide: VendorPartsService, useValue: {} },
        { provide: InventoryService, useValue: { getUnitsOfMeasure: () => of([]) } },
      ],
    });
  });

  it('reloads the part after it is revised so the header and clusters show the new revision', () => {
    const component = TestBed.runInInjectionContext(() => new PartDetailPanelComponent());
    mockSignalInputs(component, { partId: 7 });
    TestBed.flushEffects();
    const c = component as unknown as PanelInternals;
    expect(getPartById).toHaveBeenCalledTimes(1);

    getPartById.mockReturnValue(of({ id: 7, revision: 'B' } as PartDetail));
    c.onRevised();

    expect(getPartById).toHaveBeenCalledTimes(2);
    expect(getPartById).toHaveBeenLastCalledWith(7);
    expect(c.part()?.revision).toBe('B');
  });

  function bomReady(): PanelInternals {
    const component = TestBed.runInInjectionContext(() => new PartDetailPanelComponent());
    mockSignalInputs(component, { partId: 7 });
    TestBed.flushEffects();
    const c = component as unknown as PanelInternals;
    c.bomForm.patchValue({ childPartId: 12, quantity: 2 });
    return c;
  }

  it('adds one BOM line when Add is pressed twice before the server answers', () => {
    const c = bomReady();

    c.saveBomLine();
    c.saveBomLine();

    expect(createBOMLine).toHaveBeenCalledTimes(1);
  });

  it('lets Add BOM line be pressed again after the server rejects the first press', () => {
    createBOMLine.mockReturnValue(throwError(() => new Error('500')));
    const c = bomReady();

    c.saveBomLine();
    c.saveBomLine();

    expect(createBOMLine).toHaveBeenCalledTimes(2);
  });
});

describe('PartDetailPanelComponent · read-only roles', () => {
  const tabs = ['identity', 'sourcing', 'purchaseHistory', 'inventory', 'cost', 'pricing', 'bom', 'routing', 'files']
    .map(id => ({ id, labelKey: id, iconName: 'x' }));

  function setup(roles: string[]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: PartsService,
          useValue: {
            getPartById: vi.fn().mockReturnValue(of({ id: 7, revision: 'A' } as PartDetail)),
            getPartFiles: vi.fn().mockReturnValue(of([])),
            getPartInventorySummary: vi.fn().mockReturnValue(of(null)),
          },
        },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: WorkflowService, useValue: {} },
        { provide: PartDetailLayoutResolverService, useValue: { resolve: () => tabs } },
        { provide: VendorPartsService, useValue: {} },
        { provide: InventoryService, useValue: { getUnitsOfMeasure: () => of([]) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PartDetailPanelComponent());
    mockSignalInputs(component, { partId: 7 });
    TestBed.flushEffects();
    return component as unknown as { canEditParts: boolean; tabLayout(): { id: string }[] };
  }

  it('shows the Production Planner the part, BOM and routing without the price tabs or edit controls', () => {
    const panel = setup(['Production Planner']);

    expect(panel.canEditParts).toBe(false);
    expect(panel.tabLayout().map(t => t.id)).toEqual(['identity', 'inventory', 'bom', 'routing', 'files']);
  });

  it('keeps every tab and the edit controls for an engineer', () => {
    const panel = setup(['Engineer']);

    expect(panel.canEditParts).toBe(true);
    expect(panel.tabLayout()).toHaveLength(tabs.length);
  });
});
