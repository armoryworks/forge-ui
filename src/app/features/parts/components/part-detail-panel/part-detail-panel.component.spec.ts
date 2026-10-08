import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
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
};

describe('PartDetailPanelComponent', () => {
  let getPartById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPartById = vi.fn().mockReturnValue(of({ id: 7, revision: 'A' } as PartDetail));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: PartsService,
          useValue: {
            getPartById,
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
});
