import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetItem } from '../../models/asset-item.model';
import { AssetsService } from '../../services/assets.service';
import { AssetDetailPanelComponent } from './asset-detail-panel.component';

interface PanelView {
  canRecordHours: Signal<boolean>;
  asset: { set(value: AssetItem | null): void; (): AssetItem | null };
  recordHours(): void;
}

const PRESS = { id: 5, name: 'Press 1', currentHours: 1200 } as AssetItem;

function setup(capability: boolean, roles: boolean) {
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of({ ...PRESS, currentHours: 1250 }) })) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: AssetsService, useValue: { getAssets: vi.fn(() => of([PRESS])), getMaintenanceLogs: vi.fn(() => of([])) } },
      { provide: AuthService, useValue: { hasAnyRole: vi.fn(() => roles) } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn((code: string) => capability && code === 'CAP-MAINT-PM') } },
      { provide: MatDialog, useValue: dialog },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new AssetDetailPanelComponent()) as unknown as PanelView;
  return { view, dialog };
}

describe('AssetDetailPanelComponent record hours', () => {
  it('offers Record hours with preventive maintenance on, and shows the new reading', () => {
    const { view, dialog } = setup(true, true);
    view.asset.set(PRESS);

    expect(view.canRecordHours()).toBe(true);
    view.recordHours();

    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { asset: PRESS } }));
    expect(view.asset()?.currentHours).toBe(1250);
  });

  it('hides Record hours while preventive maintenance is off or for other roles', () => {
    expect(setup(false, true).view.canRecordHours()).toBe(false);
    expect(setup(true, false).view.canRecordHours()).toBe(false);
  });
});
