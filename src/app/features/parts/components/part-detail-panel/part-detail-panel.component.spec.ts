import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, Subject, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { PendingChangesService } from '../../../../shared/services/pending-changes.service';
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
  selectTab(id: string): void;
  activeTabId(): string;
};

describe('PartDetailPanelComponent', () => {
  let getPartById: ReturnType<typeof vi.fn>;
  let createBOMLine: ReturnType<typeof vi.fn>;
  let pending: { hasPending: ReturnType<typeof vi.fn>; confirmDiscard: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    pending = { hasPending: vi.fn(() => false), confirmDiscard: vi.fn(() => of(true)) };
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
        { provide: PendingChangesService, useValue: pending },
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

  it('asks before switching tabs while the routing editor has unsaved changes, and stays when declined', () => {
    const component = TestBed.runInInjectionContext(() => new PartDetailPanelComponent());
    mockSignalInputs(component, { partId: 7 });
    const c = component as unknown as PanelInternals;
    c.selectTab('routing');
    pending.hasPending.mockReturnValue(true);
    pending.confirmDiscard.mockReturnValue(of(false));

    c.selectTab('bom');

    expect(pending.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(c.activeTabId()).toBe('routing');

    pending.confirmDiscard.mockReturnValue(of(true));
    c.selectTab('bom');

    expect(c.activeTabId()).toBe('bom');
  });
});
