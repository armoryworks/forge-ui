import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetItem } from '../../models/asset-item.model';
import { DowntimeDialogData } from '../../models/downtime-dialog-data.model';
import { AssetsService } from '../../services/assets.service';
import { DowntimeDialogComponent } from './downtime-dialog.component';

interface DowntimeView {
  form: DowntimeDialogComponent['form'];
  pickAsset: boolean;
  assetOptions: () => { value: unknown; label: string }[];
  ngOnInit(): void;
  save(): void;
}

const PRESS = { id: 5, name: 'Press 1', assetType: 'Machine', workCenterCode: 'P1' } as AssetItem;

function setup(data: DowntimeDialogData) {
  const assets = {
    getAssets: vi.fn(() => of([PRESS, { id: 6, name: 'Forklift', assetType: 'Vehicle' } as AssetItem])),
    createDowntimeLog: vi.fn(() => of({ id: 1, assetName: 'Press 1' })),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: AssetsService, useValue: assets },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new DowntimeDialogComponent()) as unknown as DowntimeView;
  view.ngOnInit();
  return { view, assets };
}

describe('DowntimeDialogComponent', () => {
  it('starts downtime on the asset it was opened for with the chosen loss category', () => {
    const { view, assets } = setup({ asset: PRESS });
    expect(view.pickAsset).toBe(false);
    expect(assets.getAssets).not.toHaveBeenCalled();
    view.form.patchValue({ category: 'SetupAdjustment', reason: 'Mold change' });

    view.save();

    expect(assets.createDowntimeLog).toHaveBeenCalledWith(5, expect.objectContaining({
      assetId: 5, category: 'SetupAdjustment', reason: 'Mold change', isPlanned: false, endedAt: null,
    }));
  });

  it('lets the maintenance page pick a machine or tool, with its work center', () => {
    const { view, assets } = setup({ asset: null });

    expect(view.pickAsset).toBe(true);
    expect(view.assetOptions()).toEqual([{ value: 5, label: 'Press 1 (P1)' }]);
    view.save();
    expect(assets.createDowntimeLog).not.toHaveBeenCalled();
  });

  it('needs a reason', () => {
    const { view, assets } = setup({ asset: PRESS });

    view.save();

    expect(view.form.controls.reason.invalid).toBe(true);
    expect(assets.createDowntimeLog).not.toHaveBeenCalled();
  });
});
